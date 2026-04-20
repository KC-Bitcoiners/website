/**
 * NIP-99 Marketplace types
 * Kinds: 31989 (Stall), 31990 (Product)
 */

export interface ShippingZone {
  id: string;
  name: string;
  cost: number;
  currency?: string;
  zones: string[];
}

export interface Stall {
  id: string;           // d-tag value
  name: string;
  description: string;
  currency: string;
  shipping: ShippingZone[];
  pubkey: string;
  createdAt: number;
  dTag: string;
  coordinate: string;   // 31989:<pubkey>:<dTag>
  rawEvent?: Record<string, unknown>;
}

export interface Product {
  id: string;           // d-tag value
  stallCoordinate: string; // links to stall via #a tag
  name: string;
  description: string;
  price: number;
  currency: string;     // "sats" | "USD" | etc.
  quantity: number;
  images: string[];
  categories: string[];
  specifications: Record<string, string>;
  pubkey: string;
  createdAt: number;
  dTag: string;
  coordinate: string;   // 31990:<pubkey>:<dTag>
  rawEvent?: Record<string, unknown>;
}

export interface StallWithProducts extends Stall {
  products: Product[];
}
