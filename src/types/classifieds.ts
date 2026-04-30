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

/** Shipping options matching Shopstr */
export type ShippingType = "na" | "free" | "pickup" | "free_pickup" | "added_cost";

/** Shipping data parsed from ["shipping", type, cost?, currency?] */
export interface ListingShipping {
  type: ShippingType;
  cost?: string;
  currency?: string;
}

/** Condition options */
export type ListingCondition = "new" | "used" | "refurbished";

/** A parsed NIP-99 classified listing event */
export interface ClassifiedListing {
  id: string; // event.id
  pubkey: string;
  dTag: string;
  title: string;
  description: string; // event.content (markdown)
  publishedAt?: number; // published_at tag unix timestamp
  location?: string;
  geohash?: string; // g tag
  price?: ListingPrice;
  status: "active" | "sold" | "hidden" | "unknown";
  condition?: ListingCondition;
  shipping?: ListingShipping;
  quantity?: number;
  expiration?: number; // unix timestamp
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
  description: string;
  location?: string;
  priceAmount?: string;
  priceCurrency?: string;
  priceFrequency?: string;
  status?: "active" | "sold" | "hidden";
  condition?: ListingCondition;
  shippingType?: ShippingType;
  shippingCost?: string;
  shippingCurrency?: string;
  quantity?: number;
  expiration?: number; // unix timestamp
  images?: string[];
  tags?: string[];
  geohash?: string;
}
