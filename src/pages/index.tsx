import React from "react";
import Head from "next/head";
import BitcoinLogo from "@/components/BitcoinLogo";

export default function Home() {
  return (
    <>
      <Head>
        <title>KC Bitcoin Meetup Group</title>
        <meta
          name="description"
          content="Bitcoin only group focused on fostering relationships and building community in Kansas City"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Main Content Section - White Background */}
      <section className="bg-white text-black py-16">
        <div className="container mx-auto px-6 max-w-6xl ">
          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-black bitcoin-orange mb-16 text-center font-archivo-black">
            KC Bitcoiners
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
                We are a Bitcoin only group focused on fostering relationships
                and building community. We meet twice monthly throughout the
                Kansas City metro area.
              </p>

              <p className="leading-relaxed">
                Whether you're new to Bitcoin or a long time HODLer this group
                is for you. Meetups include discussions on topics such as:
              </p>

              <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700 leading-relaxed">
                <li>Economics</li>
                <li>Protocol & Software</li>
                <li>Digital Wallets</li>
                <li>Investing</li>
                <li>Mining</li>
                <li>And all other topics Bitcoin!</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section - Orange Background */}
      <section className="bg-bitcoin-orange text-white py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-8 font-archivo-black">
            Ready to Join the Community?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://www.meetup.com/kansas-city-bitcoin-meetup-group/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white bitcoin-orange px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Join Our Meetups
            </a>
            <a
              href="https://btcpay0.voltageapp.io/apps/26q7Q6PpDTZFoUBfpMko6jSzm4od/pos"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:bitcoin-orange hover:text-gray-700 transition-colors"
            >
              Support Us
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
