import React from "react";
import Image from "next/image";

interface BitcoinLogoProps {
  size?: number;
  className?: string;
}

export default function BitcoinLogo({
  size = 200,
  className = "",
}: BitcoinLogoProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo.jpeg"
        alt="KC Bitcoin Meetup Group Logo"
        width={size}
        height={size}
        className="object-cover rounded-full"
        priority
      />
    </div>
  );
}
