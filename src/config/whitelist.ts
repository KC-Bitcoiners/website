import { nip19 } from 'nostr-tools';

// Whitelist of allowed npub keys for calendar events
export const WHITELISTED_NPUBS = [
  'npub16ux4qzg4qjue95vr3q327fzata4n594c9kgh4jmeyn80v8k54nhqg6lra7'
];

// Convert npubs to hex for nostr relay filters
export const WHITELISTED_PUBKEYS = WHITELISTED_NPUBS.map(npub => {
  try {
    const { type, data } = nip19.decode(npub);
    if (type === 'npub') {
      // For npub, data is already a hex string (64 characters)
      const hex = data as string;
      console.log(`🔑 Decoded ${npub} to hex: ${hex} (length: ${hex.length})`);
      return hex;
    }
    return '';
  } catch (error) {
    console.error('Failed to decode npub:', npub, error);
    return '';
  }
}).filter(Boolean);

// Helper function to check if a pubkey is whitelisted
export function isWhitelisted(pubkey: string): boolean {
  // Check both npub and hex formats
  return WHITELISTED_NPUBS.includes(pubkey) || WHITELISTED_PUBKEYS.includes(pubkey);
}

// Helper function to get whitelist filter for nostr queries
export function getWhitelistFilter() {
  return {
    kinds: [31922, 31923, 30311, 30312, 30313], // Calendar events
    authors: WHITELISTED_PUBKEYS, // Use hex format for relay queries
    limit: 100
  };
}
