import React from "react";
import Head from "next/head";
import BitcoinLogo from "@/components/BitcoinLogo";
import { homeConfig } from "@/config";

export default function Home() {
  return (
    <>
      <Head>
        <title>{homeConfig.meta.title}</title>
        <meta name="description" content={homeConfig.meta.description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Main Content Section - White Background */}
      <section className="bg-white text-black py-16">
        <div className="container mx-auto px-6 max-w-6xl ">
          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-black bitcoin-orange mb-16 text-center font-archivo-black">
            {homeConfig.hero.title}
          </h1>

          {/* Two Column Layout */}
          <div className="grid md:grid-cols-2 gap-16 items-start">
            {/* Left Column - Bitcoin Logo */}
            <div className="flex justify-center">
              <BitcoinLogo size={350} className="shadow-lg" />
            </div>

            {/* Right Column - Content */}
            <div className="space-y-6 text-lg">
              <p className="leading-relaxed">
                {homeConfig.hero.description}
              </p>

              <p className="leading-relaxed">
                {homeConfig.hero.topics.intro}
              </p>

              <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700 leading-relaxed">
                {homeConfig.hero.topics.list.map((topic, index) => (
                  <li key={index}>{topic}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section - Orange Background */}
      <section className="bg-bitcoin-orange text-white py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-8 font-archivo-black">
            {homeConfig.callToAction.title}
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {homeConfig.callToAction.buttons.map((button, index) => (
              <a
                key={index}
                href={button.url}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  button.style === "primary"
                    ? "bg-white bitcoin-orange px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                    : "bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:bitcoin-orange hover:text-gray-700 transition-colors"
                }
              >
                {button.text}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
