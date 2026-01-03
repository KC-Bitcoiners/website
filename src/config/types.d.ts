declare module '*.json' {
  const value: any;
  export default value;
}

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
  externalLinks: {
    GitHub: {
      url: string;
      icon: string;
      ariaLabel: string;
    };
    meetup: {
      urlname: string;
      url: string;
    };
  };
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

export interface PagesConfig {
  home: any;
  calendar: any;
  shop: any;
}

export interface Config {
  site: SiteConfig;
  api: ApiConfig;
  nostr: NostrConfig;
  pages: PagesConfig;
}
