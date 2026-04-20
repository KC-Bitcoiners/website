/**
 * NIP-99 Marketplace event utilities
 * Fetch, parse, and publish stall (31989) and product (31990) events
 */

import { pool } from "@/lib/nostr";
import { nostrRelays, getAuthorPubkeys } from "@/config";
import { deduplicateByCoordinate } from "./pinboardEvents";
import type { Stall, Product, ShippingZone, StallWithProducts } from "@/types/marketplace";

// ---- Parse helpers ----

export function parseStallEvent(event: any): Stall | null {
  try {
    const dTag = event.tags?.find((t: string[]) => t[0] === "d")?.[1];
    if (!dTag) return null;

    const name = event.tags?.find((t: string[]) => t[0] === "name")?.[1] || "";
    const currency = event.tags?.find((t: string[]) => t[0] === "currency")?.[1] || "sats";
    const shippingRaw = event.tags?.find((t: string[]) => t[0] === "shipping")?.[1] || "[]";

    let shipping: ShippingZone[] = [];
    try {
      shipping = JSON.parse(shippingRaw);
    } catch {}

    return {
      id: dTag,
      name,
      description: event.content || "",
      currency,
      shipping,
      pubkey: event.pubkey,
      createdAt: event.created_at,
      dTag,
      coordinate: `31989:${event.pubkey}:${dTag}`,
      rawEvent: event,
    };
  } catch {
    return null;
  }
}

export function parseProductEvent(event: any): Product | null {
  try {
    const dTag = event.tags?.find((t: string[]) => t[0] === "d")?.[1];
    if (!dTag) return null;

    const stallA = event.tags?.find((t: string[]) => t[0] === "a")?.[1] || "";
    const name = event.tags?.find((t: string[]) => t[0] === "name")?.[1] || "";
    const priceRaw = event.tags?.find((t: string[]) => t[0] === "price")?.[1] || "0";
    const priceCurrency = event.tags?.find((t: string[]) => t[0] === "price")?.[2] || "sats";
    const quantityRaw = event.tags?.find((t: string[]) => t[0] === "quantity")?.[1] || "0";
    const images = event.tags?.filter((t: string[]) => t[0] === "image").map((t: string[]) => t[1]) || [];
    const categories = event.tags?.filter((t: string[]) => t[0] === "category").map((t: string[]) => t[1]) || [];

    const specifications: Record<string, string> = {};
    event.tags?.filter((t: string[]) => t[0] === "spec").forEach((t: string[]) => {
      if (t[1] && t[2]) specifications[t[1]] = t[2];
    });

    return {
      id: dTag,
      stallCoordinate: stallA,
      name,
      description: event.content || "",
      price: parseFloat(priceRaw) || 0,
      currency: priceCurrency,
      quantity: parseInt(quantityRaw, 10) || 0,
      images,
      categories,
      specifications,
      pubkey: event.pubkey,
      createdAt: event.created_at,
      dTag,
      coordinate: `31990:${event.pubkey}:${dTag}`,
      rawEvent: event,
    };
  } catch {
    return null;
  }
}

// ---- Fetch functions ----

export async function fetchStalls(): Promise<Stall[]> {
  const authors = getAuthorPubkeys();
  const authorSet = new Set(authors);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 15000);
    const rawEvents: any[] = [];

    pool.request(nostrRelays, {
      kinds: [31989],
      authors,
      limit: 200,
    }).subscribe({
      next: (event) => rawEvents.push(event),
      error: () => { clearTimeout(timeout); resolve([]); },
      complete: () => {
        clearTimeout(timeout);
        const filtered = rawEvents.filter((e: any) => authorSet.has(e.pubkey));
        const deduped = deduplicateByCoordinate(filtered, 31989);
        const stalls = deduped.map(parseStallEvent).filter((s): s is Stall => s !== null);
        resolve(stalls.sort((a, b) => b.createdAt - a.createdAt));
      },
    });
  });
}

export async function fetchProducts(stallCoordinates?: string[]): Promise<Product[]> {
  const authors = getAuthorPubkeys();
  const authorSet = new Set(authors);
  const filter: any = {
    kinds: [31990],
    authors,
    limit: 500,
  };
  if (stallCoordinates && stallCoordinates.length > 0) {
    filter["#a"] = stallCoordinates;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 15000);
    const rawEvents: any[] = [];

    pool.request(nostrRelays, filter).subscribe({
      next: (event) => rawEvents.push(event),
      error: () => { clearTimeout(timeout); resolve([]); },
      complete: () => {
        clearTimeout(timeout);
        const filtered = rawEvents.filter((e: any) => authorSet.has(e.pubkey));
        const deduped = deduplicateByCoordinate(filtered, 31990);
        const products = deduped.map(parseProductEvent).filter((p): p is Product => p !== null);
        resolve(products.sort((a, b) => b.createdAt - a.createdAt));
      },
    });
  });
}

export async function fetchStallsWithProducts(): Promise<StallWithProducts[]> {
  const [stalls, products] = await Promise.all([fetchStalls(), fetchProducts()]);

  const productsByStall = new Map<string, Product[]>();
  for (const product of products) {
    const existing = productsByStall.get(product.stallCoordinate) || [];
    existing.push(product);
    productsByStall.set(product.stallCoordinate, existing);
  }

  return stalls.map((stall) => ({
    ...stall,
    products: productsByStall.get(stall.coordinate) || [],
  }));
}
