import React from "react";
import Image from "next/image";
import { config, basePath } from "@/config";

interface BitcoinLogoProps {
  size?: number;
  className?: string;
  useFallback?: boolean;
}

export default function BitcoinLogo({
  size = 200,
  className = "",
  useFallback = false,
}: BitcoinLogoProps) {
  const rawSrc = useFallback ? config.site.images.logoFallback : config.site.images.logo;
  const logoSrc = rawSrc.startsWith('http') ? rawSrc : `${basePath}${rawSrc}`;

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={logoSrc}
        alt="KC Bitcoin Meetup Group Logo"
        width={size}
        height={size}
        className="object-cover rounded-full"
        priority
      />
    </div>
  );
}
