/**
 * NIP-99 Classified Listings event utilities (kind 30402)
 * Fetch, parse, build, publish, and delete classified listings.
 * @see https://github.com/nostr-protocol/nips/blob/master/99.md
 */

import { pool } from "@/lib/nostr";
import {
  nostrRelays,
  WHITELISTED_PUBKEYS,
  CLIENT_TAG,
} from "@/config";
import type {
  ClassifiedListing,
  ClassifiedListingInput,
  ListingPrice,
  ListingCondition,
  ListingShipping,
  ShippingType,
} from "@/types/classifieds";

// ---- Whitelist helper (same pattern as committeeEvents.ts) ----

function getAuthorPubkeys(): string[] {
  const base = WHITELISTED_PUBKEYS;
  if (
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    (window as any).__TEST_WHITELIST
  ) {
    const extra = (window as any).__TEST_WHITELIST as string[];
    const merged = new Set([...base, ...extra]);
    return Array.from(merged);
  }
  return base;
}

// ---- Deduplicate replaceable events by coordinate (keep latest) ----

function deduplicateByCoordinate(events: any[], kind: number): any[] {
  const map = new Map<string, any>();
  for (const event of events) {
    const dTag = event.tags?.find((t: string[]) => t[0] === "d")?.[1] || "";
    const coord = `${kind}:${event.pubkey}:${dTag}`;
    const existing = map.get(coord);
    if (!existing || event.created_at > existing.created_at) {
      map.set(coord, event);
    }
  }
  return Array.from(map.values());
}

// ---- Parse ----

/** Parse a kind 30402 event into a ClassifiedListing. Returns null if required fields missing. */
export function parseClassifiedEvent(event: any): ClassifiedListing | null {
  try {
    const dTag = event.tags?.find((t: string[]) => t[0] === "d")?.[1];
    if (!dTag) return null;

    const title = event.tags?.find((t: string[]) => t[0] === "title")?.[1];
    if (!title) return null;

    const publishedAtRaw = event.tags?.find(
      (t: string[]) => t[0] === "published_at",
    )?.[1];
    const publishedAt = publishedAtRaw ? parseInt(publishedAtRaw, 10) : undefined;
    const location = event.tags?.find(
      (t: string[]) => t[0] === "location",
    )?.[1];
    const geohash = event.tags?.find((t: string[]) => t[0] === "g")?.[1];

    // Price: ["price", "<amount>", "<currency>", "<frequency?>"]
    const priceTag = event.tags?.find(
      (t: string[]) => t[0] === "price",
    );
    let price: ListingPrice | undefined;
    if (priceTag && priceTag[1]) {
      price = {
        amount: priceTag[1],
        currency: priceTag[2] || "sats",
        frequency: priceTag[3] || undefined,
      };
    }

    // Status: defaults to "active"
    const statusRaw = event.tags?.find(
      (t: string[]) => t[0] === "status",
    )?.[1];
    const status: ClassifiedListing["status"] =
      statusRaw === "active" || statusRaw === "sold" || statusRaw === "hidden"
        ? statusRaw
        : "unknown";

    const images =
      event.tags
        ?.filter((t: string[]) => t[0] === "image")
        .map((t: string[]) => t[1])
        .filter(Boolean) || [];

    const tags =
      event.tags
        ?.filter((t: string[]) => t[0] === "t")
        .map((t: string[]) => t[1])
        .filter(Boolean) || [];

    // Condition: ["condition", "new"|"used"|"refurbished"]
    const conditionRaw = event.tags?.find(
      (t: string[]) => t[0] === "condition",
    )?.[1];
    const condition: ListingCondition | undefined =
      conditionRaw === "new" || conditionRaw === "used" || conditionRaw === "refurbished"
        ? conditionRaw
        : undefined;

    // Shipping: ["shipping", type, cost?, currency?]
    const shippingTag = event.tags?.find(
      (t: string[]) => t[0] === "shipping",
    );
    let shipping: ListingShipping | undefined;
    if (shippingTag && shippingTag[1]) {
      const validTypes: ShippingType[] = ["na", "free", "pickup", "free_pickup", "added_cost"];
      const type = validTypes.includes(shippingTag[1] as ShippingType)
        ? (shippingTag[1] as ShippingType)
        : undefined;
      if (type) {
        shipping = {
          type,
          cost: shippingTag[2] || undefined,
          currency: shippingTag[3] || undefined,
        };
      }
    }

    // Quantity: ["quantity", number]
    const quantityRaw = event.tags?.find(
      (t: string[]) => t[0] === "quantity",
    )?.[1];
    const quantity = quantityRaw ? parseInt(quantityRaw, 10) : undefined;

    // Expiration: ["expiration", unix_timestamp]
    const expirationRaw = event.tags?.find(
      (t: string[]) => t[0] === "expiration",
    )?.[1];
    const expiration = expirationRaw ? parseInt(expirationRaw, 10) : undefined;

    return {
      id: event.id,
      pubkey: event.pubkey,
      dTag,
      title,
      description: event.content || "",
      publishedAt: publishedAt && !isNaN(publishedAt) ? publishedAt : undefined,
      location,
      geohash,
      price,
      status,
      condition,
      shipping,
      quantity,
      expiration: expiration && !isNaN(expiration) ? expiration : undefined,
      images,
      tags,
      coordinate: `30402:${event.pubkey}:${dTag}`,
      createdAt: event.created_at,
      rawEvent: event,
    };
  } catch {
    return null;
  }
}

// ---- Build ----

/** Build an unsigned kind 30402 event template from input data. */
export function buildClassifiedEvent(
  opts: ClassifiedListingInput,
): Record<string, unknown> {
  const tags: string[][] = [
    [...CLIENT_TAG],
    ["d", opts.dTag || `classified-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`],
    ["title", opts.title],
    ["published_at", String(Math.floor(Date.now() / 1000))],
  ];

  if (opts.location) tags.push(["location", opts.location]);
  if (opts.geohash) tags.push(["g", opts.geohash]);

  // Price tag: ["price", amount, currency, frequency?]
  if (opts.priceAmount && opts.priceCurrency) {
    const priceTag = ["price", opts.priceAmount, opts.priceCurrency];
    if (opts.priceFrequency) priceTag.push(opts.priceFrequency);
    tags.push(priceTag);
  }

  // Status: default "active"
  tags.push(["status", opts.status || "active"]);

  // Condition: ["condition", "new"|"used"|"refurbished"]
  if (opts.condition) tags.push(["condition", opts.condition]);

  // Shipping: ["shipping", type, cost?, currency?]
  if (opts.shippingType) {
    const shippingTag = ["shipping", opts.shippingType];
    if (opts.shippingCost) {
      shippingTag.push(opts.shippingCost);
      if (opts.shippingCurrency) shippingTag.push(opts.shippingCurrency);
    }
    tags.push(shippingTag);
  }

  // Quantity: ["quantity", number]
  if (opts.quantity && opts.quantity > 0) {
    tags.push(["quantity", String(opts.quantity)]);
  }

  // Expiration: ["expiration", unix_timestamp]
  if (opts.expiration) {
    tags.push(["expiration", String(opts.expiration)]);
  }

  // Images (one tag per image URL)
  if (opts.images) {
    for (const url of opts.images) {
      if (url.trim()) tags.push(["image", url.trim()]);
    }
  }

  // Category/hashtag tags
  if (opts.tags) {
    for (const t of opts.tags) {
      if (t.trim()) tags.push(["t", t.trim()]);
    }
  }

  return {
    kind: 30402,
    content: opts.description || "",
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

// ---- Publish ----

/** Publish a signed classified listing event to relays. */
export async function publishClassified(
  signedEvent: Record<string, unknown>,
): Promise<boolean> {
  try {
    const responses = await pool.publish(nostrRelays, signedEvent as any);
    return responses.some((r) => r.ok);
  } catch {
    return false;
  }
}

// ---- Fetch ----

/** Fetch all classified listings from whitelisted authors, deduplicated and sorted. */
export async function fetchClassifiedListings(): Promise<ClassifiedListing[]> {
  const authors = getAuthorPubkeys();
  const authorSet = new Set(authors);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 15000);
    const rawEvents: any[] = [];

    pool
      .request(nostrRelays, {
        kinds: [30402],
        authors,
        limit: 200,
      })
      .subscribe({
        next: (event: any) => rawEvents.push(event),
        error: () => {
          clearTimeout(timeout);
          resolve([]);
        },
        complete: () => {
          clearTimeout(timeout);
          // Filter to whitelisted authors (defense in depth)
          const filtered = rawEvents.filter((e: any) =>
            authorSet.has(e.pubkey),
          );
          const deduped = deduplicateByCoordinate(filtered, 30402);
          const listings = deduped
            .map(parseClassifiedEvent)
            .filter((l): l is ClassifiedListing => l !== null);
          resolve(
            listings.sort(
              (a, b) =>
                (b.publishedAt || b.createdAt) -
                (a.publishedAt || a.createdAt),
            ),
          );
        },
      });
  });
}
