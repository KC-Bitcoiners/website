import configData from '../../config.json';

// TypeScript interfaces for the config structure
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
  contact: {
    meetup: {
      urlname: string;
      url: string;
    };
  };
}

export interface NostrConfig {
  relays: string[];
  kcRelay: string;
  whitelistedNpubs: string[];
}

export interface SocialConfig {
  links: Array<{
    name: string;
    url: string;
    icon: string;
    ariaLabel?: string;
  }>;
}

export interface PageConfig {
  title: string;
  meta: {
    title: string;
    description: string;
  };
}

export interface HomePageConfig extends PageConfig {
  hero: {
    title: string;
    description: string;
    topics: {
      intro: string;
      list: string[];
    };
  };
  callToAction: {
    title: string;
    buttons: Array<{
      text: string;
      url: string;
      style: 'primary' | 'secondary';
    }>;
  };
}

export interface EventsPageConfig extends PageConfig {
  description: string;
  sections: {
    upcoming: {
      title: string;
      emptyMessage: string;
      emptySubtext: string;
    };
    past: {
      title: string;
      showCount: number;
      viewAllText: string;
    };
    callToAction: {
      title: string;
      description: string;
      buttonText: string;
    };
  };
}

export interface CalendarPageConfig extends PageConfig {
  defaultView: 'list' | 'month' | 'week' | 'day';
  eventColors: string[];
  meetupColor: string;
  defaultColor: string;
  statistics: {
    total: string;
    upcoming: string;
    past: string;
  };
  defaultEvent: {
    durationHours: number;
    startTime: string;
    endTime: string;
  };
}

export interface ShopPageConfig extends PageConfig {
  description: string;
  map: {
    center: {
      lat: number;
      lon: number;
    };
    defaultZoom: number;
    boundsPadding: number[];
  };
  vendorKinds: {
    nostr: number;
    delete: number;
  };
  callToAction: {
    title: string;
    description: string;
    buttonText: string;
  };
  filters: {
    name: string;
    category: string;
    submitter: string;
    sortBy: string;
  };
}

export interface PagesConfig {
  home: HomePageConfig;
  events: EventsPageConfig;
  calendar: CalendarPageConfig;
  shop: ShopPageConfig;
}

export interface ApiConfig {
  meetup: {
    graphqlUrl: string;
    timeout: number;
  };
  btcmap: {
    baseUrl: string;
  };
}

export interface BuildConfig {
  outputDir: string;
  generateICalendar: boolean;
  staticAssets: {
    favicon: string;
    logo: string;
    appleTouchIcon: string;
  };
}

export interface AppConfig {
  site: SiteConfig;
  nostr: NostrConfig;
  social: SocialConfig;
  pages: PagesConfig;
  api: ApiConfig;
  build: BuildConfig;
}

// Type-safe config access
const config: AppConfig = configData as AppConfig;

// Export individual config sections
export const siteConfig = config.site;
export const nostrConfig = config.nostr;
export const socialConfig = config.social;
export const pagesConfig = config.pages;
export const apiConfig = config.api;
export const buildConfig = config.build;

// Export page-specific configs
export const homeConfig = config.pages.home;
export const eventsConfig = config.pages.events;
export const calendarConfig = config.pages.calendar;
export const shopConfig = config.pages.shop;

// Export the entire config for advanced usage
export default config;

// Helper functions for common config access patterns
export function getSiteUrl(path: string = ''): string {
  return process.env.NEXT_PUBLIC_SITE_URL || `https://kcbitcoiners.com${path}`;
}

export function getMeetupUrl(): string {
  return config.site.contact.meetup.url;
}

export function getNostrRelays(): string[] {
  return config.nostr.relays;
}

export function getKcRelay(): string {
  return config.nostr.kcRelay;
}

export function getWhitelistedNpubs(): string[] {
  return config.nostr.whitelistedNpubs;
}

export function getSocialLinks() {
  return config.social.links;
}

export function getMapCenter(): { lat: number; lon: number } {
  return config.site.organization.coordinates;
}

export function getApiConfig() {
  return config.api;
}
