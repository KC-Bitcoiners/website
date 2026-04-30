/**
 * NIP-17 Gift Wrap messaging for order notifications.
 *
 * Pipeline: kind 14 rumor → kind 13 seal → kind 1059 gift wrap
 *
 * - Kind 14 (rumor): unsigned DM with order details
 * - Kind 13 (seal): NIP-44 encrypted rumor, signed by sender
 * - Kind 1059 (gift wrap): NIP-44 encrypted seal with random one-time keypair
 *
 * Uses NIP-07's nip44.encrypt for sender encryption,
 * and nostr-tools nip44 for the random keypair outer layer.
 */

import { generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { pool } from "@/lib/nostr";
import { nostrRelays } from "@/config";
import { logger } from "@/utils/logger";
import { npubEncode, naddrEncode } from "@/utils/bech32";

interface OrderDMOptions {
  /** Seller's pubkey (hex) */
  sellerPubkey: string;
  /** Buyer's pubkey (hex) */
  buyerPubkey: string;
  /** Listing title */
  listingTitle: string;
  /** Listing coordinate (30402:pubkey:dtag) */
  listingCoordinate: string;
  /** Amount paid in sats */
  amountSats: number;
  /** Unique order ID */
  orderId?: string;
  /** Buyer's private key (hex) — fallback when NIP-07 nip44 not available */
  buyerPrivkeyHex?: string;
}

/** Build a kind 14 rumor (unsigned DM) with order details */
function buildOrderRumor(opts: OrderDMOptions) {
  const orderId = opts.orderId || `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const buyerNpub = npubEncode(opts.buyerPubkey);
  // Parse coordinate "30402:pubkey:dtag" into parts for naddr
  const coordParts = opts.listingCoordinate.split(":");
  const dTag = coordParts[2] || "";
  const sellerPubkey = coordParts[1] || opts.sellerPubkey;
  const naddr = naddrEncode({ identifier: dTag, pubkey: sellerPubkey, kind: 30402, relays: nostrRelays.slice(0, 2) });
  return {
    kind: 14,
    content: `New order for "${opts.listingTitle}" — ${opts.amountSats.toLocaleString()} sats paid.\n\nBuyer: ${buyerNpub}\nListing: nostr:${naddr}\n\nArrange local pickup via DM.`,
    tags: [
      ["p", opts.sellerPubkey],
      ["order", orderId],
      ["type", "order-payment"],
      ["amount", String(opts.amountSats)],
      ["item", opts.listingCoordinate],
      ["b", opts.buyerPubkey],
    ],
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Send a NIP-17 gift-wrapped order DM to the seller.
 *
 * Uses window.nostr.nip44 for seal encryption (sender's key),
 * and a random one-time keypair for the gift wrap outer layer.
 */
export async function sendOrderDM(opts: OrderDMOptions): Promise<boolean> {
  try {
    console.log("[OrderDM] Starting sendOrderDM", { seller: opts.sellerPubkey.slice(0, 12), title: opts.listingTitle });
    const rumor = buildOrderRumor(opts);
    const sellerPubkey = opts.sellerPubkey;

    // Step 1: NIP-44 encrypt the rumor to create the seal content
    let sealContent: string;
    let signedSeal: Record<string, unknown>;

    if (window.nostr?.nip44?.encrypt) {
      // Preferred: use NIP-07 extension's nip44.encrypt
      sealContent = await window.nostr.nip44.encrypt(
        sellerPubkey,
        JSON.stringify(rumor),
      );

      // Step 2: Sign kind 13 seal via NIP-07
      const sealTemplate = {
        kind: 13,
        content: sealContent,
        tags: [["p", sellerPubkey]],
        created_at: Math.floor(Date.now() / 1000),
      };
      signedSeal = await window.nostr.signEvent(sealTemplate) as Record<string, unknown>;
    } else if (opts.buyerPrivkeyHex) {
      // Fallback: encrypt + sign directly with buyer's private key
      console.log("[OrderDM] NIP-07 nip44 unavailable, using direct key encryption");
      const privBytes = new Uint8Array(opts.buyerPrivkeyHex.length / 2);
      for (let i = 0; i < opts.buyerPrivkeyHex.length; i += 2) {
        privBytes[i / 2] = parseInt(opts.buyerPrivkeyHex.substring(i, i + 2), 16);
      }

      const conversationKey = nip44.getConversationKey(privBytes, sellerPubkey);
      sealContent = nip44.encrypt(JSON.stringify(rumor), conversationKey);

      // Sign the seal locally
      const sealEvent = {
        kind: 13,
        content: sealContent,
        tags: [["p", sellerPubkey]],
        created_at: Math.floor(Date.now() / 1000),
      };
      signedSeal = finalizeEvent(sealEvent, privBytes) as unknown as Record<string, unknown>;
    } else {
      console.warn("[OrderDM] No encryption method available", { hasNip44: !!window.nostr?.nip44?.encrypt, hasPrivkey: !!opts.buyerPrivkeyHex });
      logger.warn("NIP-44 encryption not available. Cannot send order DM.");
      return false;
    }

    // Step 3: Generate random one-time keypair for gift wrap
    const randomPrivkey = generateSecretKey();
    const randomPubkey = getPublicKey(randomPrivkey);

    // NIP-44 encrypt the seal using the random key
    const conversationKey = nip44.getConversationKey(randomPrivkey, sellerPubkey);
    const giftWrapContent = nip44.encrypt(
      JSON.stringify(signedSeal),
      conversationKey,
    );

    // Step 4: Build kind 1059 gift wrap event
    // Randomize timestamp within last 2 days for privacy
    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
    const randomTimestamp = twoDaysAgo + Math.floor(Math.random() * (2 * 24 * 60 * 60));

    const giftWrapTemplate = {
      kind: 1059,
      content: giftWrapContent,
      tags: [["p", sellerPubkey]],
      created_at: randomTimestamp,
    };

    // Sign with the random key
    const giftWrapEvent = finalizeEvent(giftWrapTemplate, randomPrivkey);

    // Step 5: Publish to relays
    const responses = await pool.publish(nostrRelays, giftWrapEvent as any);
    const published = responses.some((r) => r.ok);

    if (published) {
      logger.debug("Order DM sent to seller:", {
        seller: sellerPubkey.slice(0, 12),
        order: opts.listingTitle,
      });
    } else {
      logger.warn("Failed to publish order DM to any relay");
    }

    return published;
  } catch (error) {
    logger.error("Error sending order DM:", error);
    return false;
  }
}
