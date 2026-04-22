import { Html, Head, Main, NextScript } from "next/document";

const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Content Security Policy applied via meta tag for static deployments
// Note: GitHub Pages doesn't support HTTP headers, so meta tag is the only option.
// CloudFront deployments should additionally use a response headers policy.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js hydration requires unsafe-inline
  "style-src 'self' 'unsafe-inline'",  // Tailwind CSS requires unsafe-inline
  "frame-src https://www.youtube.com https://player.vimeo.com https://rumble.com https://open.spotify.com https://formstr.app https://cornychat.com",
  "connect-src wss: https:",
  "img-src 'self' data: https:",
  "font-src 'self'",
].join("; ");

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        <link rel="apple-touch-icon" href={`${bp}/apple-touch-icon.png`} />
        <link rel="manifest" href={`${bp}/manifest.json`} />
        <meta name="theme-color" content="#f7931a" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
