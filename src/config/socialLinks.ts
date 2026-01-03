import { getSocialLinks } from "./index";

export interface SocialLink {
  name: string;
  url: string;
  icon: string; // Will correspond to icon component names
  ariaLabel?: string;
}

// Social links now sourced from config.json
export const socialLinks: SocialLink[] = getSocialLinks();

// Future social links can be added to config.json
