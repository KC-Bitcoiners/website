export interface SocialLink {
  name: string;
  url: string;
  icon: string; // Will correspond to icon component names
  ariaLabel?: string;
}

export const socialLinks: SocialLink[] = [
  {
    name: 'GitHub',
    url: 'https://github.com/KC-Bitcoiners/website',
    icon: 'GitHubIcon',
    ariaLabel: 'Visit our GitHub repository',
  },
  // Future social links can be added here:
  // {
  //   name: 'Twitter',
  //   url: 'https://twitter.com/kc_bitcoin',
  //   icon: 'TwitterIcon',
  //   ariaLabel: 'Follow us on Twitter',
  // },
  // {
  //   name: 'LinkedIn',
  //   url: 'https://linkedin.com/company/kc-bitcoin',
  //   icon: 'LinkedInIcon',
  //   ariaLabel: 'Connect with us on LinkedIn',
  // },
];
