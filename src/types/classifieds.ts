/**
 * NIP-99 Classified Listings types (kind 30402)
 * @see https://github.com/nostr-protocol/nips/blob/master/99.md
 */

/** Parsed price tag: ["price", "<amount>", "<currency>", "<frequency?>"] */
export interface ListingPrice {
  amount: string;
  currency: string; // "sats", "USD", "BTC", "EUR", etc.
  frequency?: string; // "hour", "day", "week", "month", "year"
}

/** A parsed NIP-99 classified listing event */
export interface ClassifiedListing {
  id: string; // event.id
  pubkey: string;
  dTag: string;
  title: string;
  summary?: string;
  description: string; // event.content (markdown)
  publishedAt?: number; // published_at tag unix timestamp
  location?: string;
  geohash?: string; // g tag
  price?: ListingPrice;
  status: "active" | "sold" | "unknown";
  images: string[]; // all image tag values
  tags: string[]; // all t tag values (categories/hashtags)
  coordinate: string; // 30402:<pubkey>:<dTag>
  createdAt: number; // event.created_at
  rawEvent?: Record<string, unknown>;
}

/** Input for building a classified listing event */
export interface ClassifiedListingInput {
  dTag?: string; // auto-generated if absent
  title: string;
  summary?: string;
  description: string;
  location?: string;
  priceAmount?: string;
  priceCurrency?: string;
  priceFrequency?: string;
  status?: "active" | "sold";
  images?: string[];
  tags?: string[];
  geohash?: string;
}
