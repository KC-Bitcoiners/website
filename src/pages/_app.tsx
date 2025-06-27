import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Layout from "@/components/Layout";
import { Source_Sans_3, Archivo_Black } from "next/font/google";

const sourceSans3 = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "900"],
  variable: "--font-source-sans-3",
});

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-archivo-black",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div
      className={`${sourceSans3.variable} ${archivoBlack.variable} font-sans`}
    >
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </div>
  );
}
