import { Html, Head, Main, NextScript } from "next/document";

const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
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
