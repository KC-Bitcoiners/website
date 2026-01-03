import { getWhitelistedNpubs } from "./index";

// Simple npub to hex conversion (try to use npub directly first)
const normalizeToPubkey = (npub: string): string => {
  // Some Nostr libraries can handle npub format directly in filters
  // Try to use npub as-is first, fall back to hex conversion if needed
  return npub; // Return npub directly for now
};

// Whitelist of allowed npub keys for calendar events (now sourced from config)
export const WHITELISTED_NPUBS = getWhitelistedNpubs();

// Convert npubs to hex for nostr relay filters
export const WHITELISTED_PUBKEYS = WHITELISTED_NPUBS.map((npub) =>
  normalizeToPubkey(npub),
).filter((p) => p !== null);

// Helper function to check if a pubkey is whitelisted
export function isWhitelisted(pubkey: string): boolean {
  const hex = normalizeToPubkey(pubkey);
  if (!hex) return false;
  return WHITELISTED_PUBKEYS.includes(hex);
}

// Helper function to get whitelist filter for nostr queries
export function getWhitelistFilter() {
  return {
    kinds: [31922, 31923, 30311, 30312, 30313], // Calendar events
    authors: WHITELISTED_PUBKEYS, // Use hex format for relay queries
    limit: 100,
  };
}
