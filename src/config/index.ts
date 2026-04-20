import configData from '../../config.json';

// Type definitions for the configuration
export interface SiteConfig {
  title: string;
  description: string;
  organization: {
    name: string;
    location: string;
    coordinates: {
      lat: number;
      lon: number;
    };
  };
  externalLinks: Record<string, {
    url: string;
    icon?: string;
    ariaLabel?: string;
    urlname?: string;
  }>;
  images: {
    logo: string;
    logoFallback: string;
    hero: string;
  };
}

export interface ApiConfig {
  meetup: {
    graphqlUrl: string;
    groupName: string;
  };
  btcmap: {
    overpassUrl: string;
    defaultBounds: {
      minLat: number;
      maxLat: number;
      minLon: number;
      maxLon: number;
    };
    userAgent: string;
  };
}

export interface NostrConfig {
  relays: string[];
  whitelistedNpubs: string[];
  whitelistedPubkeys?: string[];
  blossom?: {
    server: string;
  };
}

export interface PageConfig {
  [key: string]: any;
}

export interface AppConfig {
  site: SiteConfig;
  nostr: NostrConfig;
  pages: {
    home: PageConfig;
    calendar: PageConfig;
    events: PageConfig;
    shop: PageConfig;
    education: PageConfig;
    gallery: PageConfig;
    committees: PageConfig;
  };
}

// Export the full configuration
export const config: AppConfig = configData as AppConfig;

// Export specific sections for convenience
export const siteConfig = config.site;
export const nostrConfig = config.nostr;
export const pagesConfig = config.pages;

// Export API configurations from their respective pages
export const meetupConfig = config.pages.calendar?.api?.meetup;
export const btcmapConfig = config.pages.shop?.api?.btcmap;

// Export events page configuration
export const eventsConfig = config.pages.events;

// Export newsletter configuration
export const newsletterConfig = (configData as any).newsletter;

// Export events calendar configuration
export const icalConfig = eventsConfig.calendar?.ical;

// Export specific commonly used values
export const {
  title: siteTitle,
  description: siteDescription,
  organization,
  externalLinks
} = siteConfig;

export const {
  relays: nostrRelays,
  whitelistedNpubs
} = nostrConfig;

// Helper functions
export const getExternalLink = (name: string) => externalLinks[name];
export const getMeetupUrl = () => externalLinks.meetup?.url;
export const getGithubUrl = () => externalLinks.GitHub?.url;

// Community relay -- first relay from config is the community relay
export const KC_BITCOINERS_RELAY = nostrRelays[0] || "wss://kcbtc.hzrd149.com/";

// Social links interface and data (moved from socialLinks.ts)
export interface SocialLink {
  name: string;
  url: string;
  icon: string;
  ariaLabel?: string;
}

export const socialLinks: SocialLink[] = Object.entries(externalLinks)
  .filter(([_, link]) => link.icon)
  .map(([name, link]) => ({
    name,
    url: link.url,
    icon: link.icon!,
    ariaLabel: link.ariaLabel,
  }));

// Whitelist functions
import { npubDecode } from "@/utils/bech32";

export const WHITELISTED_NPUBS = whitelistedNpubs;

// Use pre-computed hex pubkeys from config if available, otherwise convert npubs at runtime
function computeWhitelistedPubkeys(): string[] {
  if (nostrConfig.whitelistedPubkeys?.length) {
    return nostrConfig.whitelistedPubkeys;
  }
  return WHITELISTED_NPUBS.map((npub) => {
    try {
      return npubDecode(npub);
    } catch {
      return null;
    }
  }).filter((p): p is string => p !== null);
}

export const WHITELISTED_PUBKEYS = computeWhitelistedPubkeys();

// Blossom server config
export const blossomConfig = nostrConfig.blossom;

// Helper function to check if a pubkey is whitelisted (accepts hex or npub)
export function isWhitelisted(pubkey: string): boolean {
  let hex: string;
  if (pubkey.startsWith("npub1")) {
    try {
      hex = npubDecode(pubkey);
    } catch {
      return false;
    }
  } else {
    hex = pubkey;
  }
  // In test mode, use the dynamically injected whitelist
  if (typeof window !== "undefined" && (window as any).__TEST_WHITELIST) {
    return (window as any).__TEST_WHITELIST.includes(hex);
  }
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
