import { buildBlossomURI, getServersFromServerListEvent, USER_BLOSSOM_SERVER_LIST_KIND } from "blossom-client-sdk";
import type { BlobDescriptor } from "blossom-client-sdk";
import { pool } from "@/lib/nostr";
import {
  WHITELISTED_PUBKEYS,
  nostrRelays,
  blossomConfig,
  CLIENT_TAG,
  LOCATION_TAG,
} from "@/config";

export type SignerFn = (event: {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
}) => Promise<Record<string, unknown>>;

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
  sha256?: string;
  mimeType?: string;
  size?: number;
  blossomUri?: string;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

function extFromFile(file: File): string {
  const fromMime = MIME_EXT[file.type];
  if (fromMime) return fromMime;
  const dot = file.name.lastIndexOf(".");
  if (dot > -1) return file.name.slice(dot + 1).toLowerCase();
  return "bin";
}

/**
 * Upload a file to the configured Blossom server.
 * Uses manual HTTP + BUD-06 auth with `u` and `method` tags because
 * blossom.f7z.io doesn't accept the SDK v5's `server`-tag auth format.
 */
export async function uploadToBlossom(file: File, signer: SignerFn): Promise<BlobDescriptor> {
  const server = blossomConfig?.server || "https://blossom.primal.net";

  // Compute SHA-256 of the file
  const fileBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
  const sha256 = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Build BUD-06 auth event with `u` and `method` tags (required by blossom.f7z.io)
  const authEvent = {
    kind: 24242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["u", server],
      ["method", "PUT"],
      ["x", sha256],
      ["t", "upload"],
      ["expiration", String(Math.floor(Date.now() / 1000) + 300)],
    ],
    content: `Upload ${file.name}`,
  };
  const signedAuth = await signer(authEvent);
  // URL-safe base64 — blossom servers expect this encoding per BUD-06
  const authBase64 = btoa(JSON.stringify(signedAuth))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const uploadUrl = `${server}/upload?sha256=${sha256}`;
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
  if (!result.sha256) {
    throw new Error("Unexpected upload response");
  }
  return result as BlobDescriptor;
}

/** Build a BUD-10 blossom: URI from an upload result and author. */
export function buildGalleryBlossomURI(descriptor: BlobDescriptor, file: File, pubkey: string): string {
  const primary = blossomConfig?.server;
  const servers = primary ? [new URL(primary).host] : [];
  return buildBlossomURI({
    sha256: descriptor.sha256,
    ext: extFromFile(file),
    servers,
    authors: [pubkey],
    size: descriptor.size,
  });
}

function parseImetaFields(imetaTag: string[]): Record<string, string[]> {
  // NIP-92 imeta tags can encode fields either as " key value" pairs in tag[1]
  // or as multiple "key value" entries spread across tag values.
  const fields: Record<string, string[]> = {};
  const push = (k: string, v: string) => {
    if (!k) return;
    (fields[k] ||= []).push(v);
  };
  if (imetaTag.length === 2) {
    const parts = imetaTag[1].split(/\s+/);
    for (let i = 0; i + 1 < parts.length; i += 2) push(parts[i], parts[i + 1]);
  } else {
    for (let i = 1; i < imetaTag.length; i++) {
      const entry = imetaTag[i];
      const sp = entry.indexOf(" ");
      if (sp === -1) continue;
      push(entry.slice(0, sp), entry.slice(sp + 1));
    }
  }
  return fields;
}

/**
 * Resolve a pubkey to its kind 10063 (BUD-03) blossom server list, for use as the
 * `getServers` callback to `handleBrokenMedia` from blossom-client-sdk.
 */
const serverListCache = new Map<string, Promise<URL[] | undefined>>();

export function getBlossomServers(pubkey?: string): Promise<URL[] | undefined> | undefined {
  if (!pubkey) return undefined;
  const cached = serverListCache.get(pubkey);
  if (cached) return cached;
  const promise = new Promise<URL[] | undefined>((resolve) => {
    let settled = false;
    const sub = pool.request(nostrRelays, {
      kinds: [USER_BLOSSOM_SERVER_LIST_KIND],
      authors: [pubkey],
      limit: 1,
    }).subscribe({
      next: (event: any) => {
        if (settled) return;
        settled = true;
        try {
          resolve(getServersFromServerListEvent(event));
        } catch {
          resolve(undefined);
        }
        sub.unsubscribe();
      },
      error: () => { if (!settled) { settled = true; resolve(undefined); } },
      complete: () => { if (!settled) { settled = true; resolve(undefined); } },
    });
    setTimeout(() => {
      if (!settled) { settled = true; resolve(undefined); sub.unsubscribe(); }
    }, 5000);
  });
  serverListCache.set(pubkey, promise);
  return promise;
}

/**
 * Fetch gallery images by fetching kind 39067 pins that belong to a gallery pinboard,
 * then resolving their referenced kind 20 image events.
 */
export function streamGalleryImages(onImage: (image: GalleryImage) => void): {
  cancel: () => void;
} {
  // In test mode, use the dynamically injected whitelist
  const testWhitelist =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    (window as any).__TEST_WHITELIST;
  const authors = testWhitelist || WHITELISTED_PUBKEYS;
  const authorSet = new Set(authors);
  const seenIds = new Set<string>();

  // Fetch pins (kind 39067) from whitelisted authors
  const pinSub = pool
    .request(nostrRelays, {
      kinds: [39067],
      authors,
      limit: 200,
    })
    .subscribe({
      next: (pinEvent: any) => {
        if (!authorSet.has(pinEvent.pubkey)) return;

        // Only process pins that belong to a gallery board (d tag contains "gallery")
        const boardCoord =
          pinEvent.tags?.find((t: string[]) => t[0] === "A")?.[1] || "";
        if (!boardCoord.includes("gallery")) return;

        // Get the referenced event ID
        const eTag = pinEvent.tags?.find((t: string[]) => t[0] === "e");
        if (!eTag?.[1]) return;

        const eventId = eTag[1];
        if (seenIds.has(eventId)) return;
        seenIds.add(eventId);

        // Fetch the actual image event (kind 20)
        const imgSub = pool
          .request(nostrRelays, {
            kinds: [20],
            ids: [eventId],
            limit: 1,
          })
          .subscribe({
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
          if (imetaTag) {
            const fields = parseImetaFields(imetaTag);
            image.imageUrl = fields.url?.[0];
            image.sha256 = fields.x?.[0] ?? fields.ox?.[0];
            image.mimeType = fields.m?.[0];
            const sizeStr = fields.size?.[0];
            if (sizeStr && /^\d+$/.test(sizeStr)) image.size = Number(sizeStr);
            const altParts = fields.alt;
            if (altParts?.length) image.caption = altParts.join(" ");
            image.blossomUri = fields.blossom?.[0];
          }
          if (!image.caption && imgEvent.content) image.caption = imgEvent.content;

          // Top-level blossom tag also accepted as a BUD-10 URI carrier
          for (const t of imgEvent.tags || []) {
            if (t[0] === "blossom" && t[1] && !image.blossomUri) image.blossomUri = t[1];
          }

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
  return {
    cancel: () => {
      clearTimeout(timer);
      pinSub.unsubscribe();
    },
  };
}

export async function publishGalleryImage(
  descriptor: BlobDescriptor,
  caption: string,
  signer: SignerFn,
  pubkey: string,
  blossomUri?: string,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  if (!descriptor.url || !descriptor.url.startsWith("http")) throw new Error("Invalid image URL.");
  if (!caption.trim()) throw new Error("Caption is required.");
  if (!WHITELISTED_PUBKEYS.includes(pubkey)) {
    // In test mode, allow test-generated keys
    const testWhitelist =
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      (window as any).__TEST_WHITELIST;
    if (!testWhitelist || !testWhitelist.includes(pubkey)) {
      return {
        success: false,
        error: "Not authorized to upload gallery images.",
      };
    }
  }

  const mime = descriptor.type || "image/jpeg";

  // NIP-92 imeta entries are space-separated "key value" pairs spread across tag values
  const imetaParts = [
    `url ${descriptor.url}`,
    `m ${mime}`,
    `x ${descriptor.sha256}`,
    `size ${descriptor.size}`,
    `alt ${caption}`,
  ];
  if (blossomUri) imetaParts.push(`blossom ${blossomUri}`);

  // 1. Publish kind 20 image event
  const tags: string[][] = [
    [...CLIENT_TAG],
    [...LOCATION_TAG],
    ["imeta", ...imetaParts],
    ["x", descriptor.sha256],
    ["m", mime],
    ["size", String(descriptor.size)],
  ];
  if (blossomUri) tags.push(["blossom", blossomUri]);

  const imageEvent = {
    kind: 20,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: caption,
  };
  const signedImage = await signer(imageEvent);
  const responses = await pool.publish(nostrRelays, signedImage as any);
  const ok = responses.filter((r: any) => r.ok);
  if (ok.length === 0)
    return { success: false, error: "Failed to publish image to relays" };

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
