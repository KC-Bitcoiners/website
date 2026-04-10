import { pool } from "@/lib/nostr";
import { WHITELISTED_PUBKEYS, blossomConfig, nostrRelays } from "@/config";
import { BlossomClient } from "blossom-client-sdk";

// Get blossom server from config
const getBlossomServer = (): string => {
  return blossomConfig?.server || "https://mibo.us.nostria.app";
};

export interface GalleryImage {
  id: string;
  kind: number;
  pubkey: string;
  tags: string[][];
  content: string;
  dTag?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  alt?: string;
  created_at: number;
  author?: {
    name?: string;
    display_name?: string;
    picture?: string;
  };
}

// Upload a file to a blossom server using blossom-client-sdk
export async function uploadToBlossom(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const serverUrl = getBlossomServer();

  const signer = async (event: any) => {
    if (!window.nostr) {
      throw new Error("Nostr extension not found. Please install a Nostr extension like Alby, Snort, or Nos2x to upload images.");
    }
    return await window.nostr.signEvent(event);
  };

  try {
    const uploadAuth = await BlossomClient.createUploadAuth(signer, file, {
      message: `Upload ${file.name}`,
      type: "upload",
    });

    const result = await BlossomClient.uploadBlob(serverUrl, file, { auth: uploadAuth });

    if (result.url) {
      return result.url;
    } else {
      const errorMsg = `Unknown error. Result: ${JSON.stringify(result)}`;
      throw new Error(`Upload failed: ${errorMsg}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to upload to ${serverUrl}: ${errorMsg}`);
    throw new Error(`Failed to upload to blossom server: ${errorMsg}`);
  }
}

// Fetch gallery images from nostr relays
export async function fetchNostrGalleryImages(): Promise<GalleryImage[]> {
  const relays = nostrRelays;

  const filter = {
    kinds: [20],
    authors: WHITELISTED_PUBKEYS,
    limit: 100,
  };

  const authorSet = new Set(WHITELISTED_PUBKEYS);
  const allImages: GalleryImage[] = [];

  try {
    const imagesPromise = new Promise<GalleryImage[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Request timeout"));
      }, 30000);

      const images: GalleryImage[] = [];

      pool.request(relays, filter).subscribe({
        next: (nostrEvent) => {
          if (!authorSet.has(nostrEvent.pubkey)) return;

          const galleryImage: GalleryImage = {
            id: nostrEvent.id,
            kind: nostrEvent.kind,
            pubkey: nostrEvent.pubkey,
            tags: nostrEvent.tags || [],
            content: nostrEvent.content,
            dTag: nostrEvent.tags?.find((tag: string[]) => tag[0] === "d")?.[1],
            created_at: nostrEvent.created_at,
          };

          // Extract URL from imeta tags
          const imetaTag = nostrEvent.tags?.find((tag: string[]) => tag[0] === "imeta");
          if (imetaTag && imetaTag[1]) {
            const content = imetaTag[1];

            const urlMatch = content.match(/url\s+(https?:\/\/[^\s]+)/);
            if (urlMatch && urlMatch[1]) {
              galleryImage.imageUrl = urlMatch[1];
            }

            const altMatch = content.match(/alt\s+(.*)$/);
            if (altMatch && altMatch[1]) {
              const caption = altMatch[1].trim();
              galleryImage.caption = caption;
              galleryImage.alt = caption;
            }
          }

          if (!galleryImage.caption && nostrEvent.content) {
            galleryImage.caption = nostrEvent.content;
            galleryImage.alt = nostrEvent.content;
          }

          if (galleryImage.imageUrl) {
            images.push(galleryImage);
          }
        },
        error: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        complete: () => {
          clearTimeout(timeout);
          resolve(images);
        },
      });
    });

    const images = await imagesPromise;

    // Deduplicate images by URL
    const existingUrls = new Set<string>();
    for (const image of images) {
      if (image.imageUrl && !existingUrls.has(image.imageUrl)) {
        allImages.push(image);
        existingUrls.add(image.imageUrl);
      }
    }
  } catch (error) {
    console.warn("Failed to fetch gallery images", error);
  }

  return allImages.sort((a, b) => b.created_at - a.created_at);
}

// Publish a gallery image to nostr relays
export async function publishGalleryImage(
  imageUrl: string,
  caption: string,
  pubkey?: string,
): Promise<{
  success: boolean;
  eventId?: string;
  error?: string;
}> {
  try {
    console.debug("Publishing gallery image to nostr");

    if (!imageUrl || !imageUrl.startsWith("http")) {
      throw new Error("Invalid image URL. Please provide a valid URL.");
    }

    if (!caption || caption.trim().length === 0) {
      throw new Error("Caption is required.");
    }

    if (!window.nostr) {
      throw new Error(
        "No nostr extension found. Please install a nostr extension like Alby, Snort, or Nos2x to upload images.",
      );
    }

    const userPubkey = pubkey || (await window.nostr.getPublicKey());

    if (!WHITELISTED_PUBKEYS.includes(userPubkey)) {
      console.warn(`Unauthorized upload attempt from pubkey: ${userPubkey}`);
      return {
        success: false,
        error: "You are not authorized to upload gallery images. Only whitelisted users can upload.",
      };
    }

    const created_at = Math.floor(Date.now() / 1000);
    const imetaContent = `url ${imageUrl} m image/jpeg alt ${caption}`;
    const tags: string[][] = [
      ["imeta", imetaContent],
    ];

    const event = {
      kind: 20,
      created_at,
      tags,
      content: caption,
    };

    let signedEvent;
    try {
      const eventForExtension = {
        ...event,
        pubkey: userPubkey,
      };
      signedEvent = await window.nostr.signEvent(eventForExtension);
    } catch (signError) {
      console.error("Failed to sign event with extension", signError);
      throw new Error("Failed to sign event. Please make sure your Nostr extension is unlocked and working.");
    }

    const relays = nostrRelays;

    console.debug("Publishing to relays", relays);

    try {
      const responses = await pool.publish(relays, signedEvent);

      const successfulResponses = responses.filter((r) => r.ok);
      const failedResponses = responses.filter((r) => !r.ok);

      if (successfulResponses.length > 0) {
        console.debug("Image event successfully published to relay", signedEvent.id);

        if (failedResponses.length > 0) {
          console.warn(
            `Failed on ${failedResponses.length} relays`,
            failedResponses.map((r) => `${r.from}: ${r.message}`),
          );
        }

        return {
          success: true,
          eventId: signedEvent.id,
        };
      } else {
        const errorMessages = failedResponses
          .map((r) => `${r.from}: ${r.message}`)
          .join("; ");
        console.error("Failed to publish to all relays", errorMessages);
        return {
          success: false,
          error: errorMessages || "Failed to publish to relays",
        };
      }
    } catch (error) {
      console.error("Error publishing gallery image", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish to relays",
      };
    }
  } catch (error) {
    console.error("Error publishing gallery image", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
