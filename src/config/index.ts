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
    shop: PageConfig;
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

// Constants for backward compatibility
export const KC_BITCOINERS_RELAY = "wss://kcbtc.hzrd149.com/";

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

// Whitelist functions (moved from whitelist.ts)
import { normalizeToPubkey } from "applesauce-core/helpers";

export const WHITELISTED_NPUBS = whitelistedNpubs;

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
