import React from 'react';
import { socialLinks, SocialLink } from '@/config/socialLinks';
import { GitHubIcon } from './Icons';

// Icon mapping - dynamically import icons based on the icon name
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GitHubIcon,
  // Add more icons here as they are created
  // TwitterIcon,
  // LinkedInIcon,
};

interface SocialLinkProps {
  link: SocialLink;
  className?: string;
}

function SocialLinkItem({ link, className = '' }: SocialLinkProps) {
  const IconComponent = iconMap[link.icon];
  
  if (!IconComponent) {
    console.warn(`Icon "${link.icon}" not found in iconMap`);
    return null;
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        inline-flex items-center justify-center
        w-8 h-8 rounded-full
        text-gray-400 hover:text-white
        transition-colors duration-200
        ${className}
      `}
      aria-label={link.ariaLabel || `Visit our ${link.name} page`}
    >
      <IconComponent className="w-5 h-5" />
    </a>
  );
}

interface SocialLinksProps {
  className?: string;
  linkClassName?: string;
}

export default function SocialLinks({ className = '', linkClassName = '' }: SocialLinksProps) {
  if (socialLinks.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {socialLinks.map((link) => (
        <SocialLinkItem
          key={link.name}
          link={link}
          className={linkClassName}
        />
      ))}
    </div>
  );
}
