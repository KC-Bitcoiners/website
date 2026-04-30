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
}

/** Build a kind 14 rumor (unsigned DM) with order details */
function buildOrderRumor(opts: OrderDMOptions) {
  const orderId = opts.orderId || `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    kind: 14,
    content: `New order for "${opts.listingTitle}" — ${opts.amountSats.toLocaleString()} sats paid. Buyer: ${opts.buyerPubkey.slice(0, 12)}... Arrange local pickup via DM.`,
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
    const rumor = buildOrderRumor(opts);
    const sellerPubkey = opts.sellerPubkey;

    // Step 1: NIP-44 encrypt the rumor to create the seal content
    // Use NIP-07 extension's nip44.encrypt if available
    if (!window.nostr?.nip44?.encrypt) {
      logger.warn("NIP-44 encryption not available via NIP-07 extension. Cannot send order DM.");
      return false;
    }

    const sealContent = await window.nostr.nip44.encrypt(
      sellerPubkey,
      JSON.stringify(rumor),
    );

    // Step 2: Build and sign kind 13 seal
    const sealTemplate = {
      kind: 13,
      content: sealContent,
      tags: [["p", sellerPubkey]],
      created_at: Math.floor(Date.now() / 1000),
    };

    const signedSeal = await window.nostr.signEvent(sealTemplate);

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
