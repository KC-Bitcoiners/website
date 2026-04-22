import { pool } from "@/lib/nostr";
import { WHITELISTED_PUBKEYS, nostrRelays, blossomConfig, CLIENT_TAG, LOCATION_TAG } from "@/config";

export type SignerFn = (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<Record<string, unknown>>;

export interface GalleryImage {
  id: string;
  kind: number;
  pubkey: string;
  tags: string[][];
  content: string;
  imageUrl?: string;
  caption?: string;
  created_at: number;
  rawEvent?: Record<string, unknown>;
}

export async function uploadToBlossom(file: File, signer: SignerFn): Promise<string> {
  const server = blossomConfig?.server || "https://blossom.primal.net";
  // Compute SHA-256 of the file
  const fileBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
  const sha256 = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  const uploadUrl = `${server}/upload?sha256=${sha256}`;
  const authEvent = {
    kind: 24242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["u", server],
      ["method", "PUT"],
      ["x", sha256],
      ["t", "upload"],
      ["expiration", String(Math.floor(Date.now() / 1000) + 300)], // 5 min expiry
    ],
    content: `Upload ${file.name}`,
  };
  const signedAuth = await signer(authEvent);
  const authBase64 = btoa(JSON.stringify(signedAuth));

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Nostr ${authBase64}`,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Upload failed (${response.status}): ${text}`);
  }
  const result = await response.json();
  // Blossom returns { url, sha256, size, type, uploaded }
  if (result.url) return result.url;
  throw new Error("Unexpected upload response");
}

/**
 * Fetch gallery images by fetching kind 39067 pins that belong to a gallery pinboard,
 * then resolving their referenced kind 20 image events.
 */
export function streamGalleryImages(onImage: (image: GalleryImage) => void): { cancel: () => void } {
  // In test mode, use the dynamically injected whitelist
  const testWhitelist = process.env.NODE_ENV !== "production" && typeof window !== "undefined" && (window as any).__TEST_WHITELIST;
  const authors = testWhitelist || WHITELISTED_PUBKEYS;
  const authorSet = new Set(authors);
  const seenIds = new Set<string>();

  // Fetch pins (kind 39067) from whitelisted authors
  const pinSub = pool.request(nostrRelays, {
    kinds: [39067],
    authors,
    limit: 200,
  }).subscribe({
    next: (pinEvent: any) => {
      if (!authorSet.has(pinEvent.pubkey)) return;

      // Only process pins that belong to a gallery board (d tag contains "gallery")
      const boardCoord = pinEvent.tags?.find((t: string[]) => t[0] === "A")?.[1] || "";
      if (!boardCoord.includes("gallery")) return;

      // Get the referenced event ID
      const eTag = pinEvent.tags?.find((t: string[]) => t[0] === "e");
      if (!eTag?.[1]) return;

      const eventId = eTag[1];
      if (seenIds.has(eventId)) return;
      seenIds.add(eventId);

      // Fetch the actual image event (kind 20)
      const imgSub = pool.request(nostrRelays, {
        kinds: [20],
        ids: [eventId],
        limit: 1,
      }).subscribe({
        next: (imgEvent: any) => {
          const image: GalleryImage = {
            id: imgEvent.id,
            kind: imgEvent.kind,
            pubkey: imgEvent.pubkey,
            tags: imgEvent.tags || [],
            content: imgEvent.content,
            created_at: imgEvent.created_at,
            rawEvent: imgEvent,
          };

          const imetaTag = imgEvent.tags?.find((t: string[]) => t[0] === "imeta");
          if (imetaTag?.[1]) {
            const content = imetaTag[1];
            const urlMatch = content.match(/url\s+(https?:\/\/[^\s]+)/);
            if (urlMatch) image.imageUrl = urlMatch[1];
            const altMatch = content.match(/alt\s+(.*)$/);
            if (altMatch) image.caption = altMatch[1].trim();
          }
          if (!image.caption && imgEvent.content) image.caption = imgEvent.content;

          if (image.imageUrl) onImage(image);
        },
        error: () => {},
        complete: () => {},
      });
      // Auto-cleanup after 15s
      setTimeout(() => imgSub.unsubscribe(), 15000);
    },
    error: () => {},
    complete: () => {},
  });

  const timer = setTimeout(() => pinSub.unsubscribe(), 30000);
  return { cancel: () => { clearTimeout(timer); pinSub.unsubscribe(); } };
}

export async function publishGalleryImage(
  imageUrl: string,
  caption: string,
  signer: SignerFn,
  pubkey: string,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  if (!imageUrl.startsWith("http")) throw new Error("Invalid image URL.");
  if (!caption.trim()) throw new Error("Caption is required.");
  if (!WHITELISTED_PUBKEYS.includes(pubkey)) {
    // In test mode, allow test-generated keys
    const testWhitelist = process.env.NODE_ENV !== "production" && typeof window !== "undefined" && (window as any).__TEST_WHITELIST;
    if (!testWhitelist || !testWhitelist.includes(pubkey)) {
      return { success: false, error: "Not authorized to upload gallery images." };
    }
  }

  // 1. Publish kind 20 image event
  const imetaContent = `url ${imageUrl} m image/jpeg alt ${caption}`;
  const imageEvent = {
    kind: 20,
    created_at: Math.floor(Date.now() / 1000),
    tags: [[...CLIENT_TAG], [...LOCATION_TAG], ["imeta", imetaContent]],
    content: caption,
  };
  const signedImage = await signer(imageEvent);
  const responses = await pool.publish(nostrRelays, signedImage as any);
  const ok = responses.filter((r: any) => r.ok);
  if (ok.length === 0) return { success: false, error: "Failed to publish image to relays" };

  // 2. Publish kind 39067 pin referencing the image on the gallery board
  const galleryCoord = `30067:${pubkey}:gallery`;
  const pinEvent = {
    kind: 39067,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      [...CLIENT_TAG],
      [...LOCATION_TAG],
      ["A", galleryCoord],
      ["d", `gallery-${Date.now()}`],
      ["e", (signedImage as any).id, nostrRelays[0]],
      ["title", caption],
    ],
    content: caption,
  };
  try {
    const signedPin = await signer(pinEvent);
    await pool.publish(nostrRelays, signedPin as any);
  } catch {
    // Image published but pin failed — non-critical
  }

  return { success: true, eventId: (signedImage as any).id };
}
