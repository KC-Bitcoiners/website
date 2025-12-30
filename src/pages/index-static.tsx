import React from "react";
import StaticLayout from "../components/StaticLayout";
import SocialLinks from "../components/SocialLinks";
import BitcoinLogo from "../components/BitcoinLogo";
import { GetStaticProps } from "next";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
  };
};

export default function StaticHomePage() {
  return (
    <StaticLayout 
      title="KC Bitcoiners - Bitcoin Community in Kansas City" 
      description="Join the Kansas City Bitcoin community for meetups, education, and Bitcoin adoption events"
    >
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-bitcoin-orange/10 via-purple-50 to-bitcoin-orange/5">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center">
              <div className="mb-8">
                <BitcoinLogo className="w-20 h-20 mx-auto mb-6" />
                <h1 className="text-5xl md:text-6xl font-bold font-archivo-black text-gray-900 mb-6">
                  KC Bitcoiners
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 mb-8 leading-relaxed">
                  Kansas City's Bitcoin Community
                </p>
                <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                  Join us for weekly meetups, educational workshops, and building the Bitcoin ecosystem 
                  in the heart of America. All skill levels welcome - from beginners to Bitcoin experts.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/calendar-static"
                  className="inline-flex items-center justify-center px-8 py-4 bg-bitcoin-orange text-white font-semibold rounded-lg hover:bg-bitcoin-orange-hover transition-colors text-lg"
                >
                  View Events
                </a>
                <a
                  href="/events"
                  className="inline-flex items-center justify-center px-8 py-4 border-2 border-bitcoin-orange text-bitcoin-orange font-semibold rounded-lg hover:bg-bitcoin-orange hover:text-white transition-colors text-lg"
                >
                  Learn Bitcoin
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-4xl font-bold text-center font-archivo-black text-gray-900 mb-16">
                What We Do
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center p-8 rounded-lg border border-gray-200 hover:border-bitcoin-orange transition-colors">
                  <div className="w-16 h-16 bg-bitcoin-orange/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-bitcoin-orange" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-4 font-archivo-black">Weekly Meetups</h3>
                  <p className="text-gray-600">
                    Join us every week for discussions about Bitcoin technology, price action, 
                    and adoption. Network with local Bitcoin enthusiasts.
                  </p>
                </div>

                <div className="text-center p-8 rounded-lg border border-gray-200 hover:border-bitcoin-orange transition-colors">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-4 font-archivo-black">Education</h3>
                  <p className="text-gray-600">
                    Learn about Bitcoin, Lightning Network, security best practices, and 
                    how to use Bitcoin in your daily life.
                  </p>
                </div>

                <div className="text-center p-8 rounded-lg border border-gray-200 hover:border-bitcoin-orange transition-colors">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 20h5v-2H3v2h5l-2.5 3L7 23l3.5-4.5L14 23l1.5-1.5L13 20zm-3.5-9.5L12 9l-1.5 1.5L14 14l6-6-1.5-1.5L14 11 10.5 7.5 9 9l4.5 4.5z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-4 font-archivo-black">Adoption</h3>
                  <p className="text-gray-600">
                    Help us build the Bitcoin ecosystem in Kansas City through merchant adoption 
                    and community outreach programs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming Events Preview */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl font-bold font-archivo-black text-gray-900 mb-8">
                Join Our Next Event
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                We meet regularly to discuss Bitcoin and build community. 
                Everyone is welcome regardless of your Bitcoin knowledge level.
              </p>
              
              <div className="bg-white rounded-lg p-8 border border-gray-200">
                <div className="text-lg font-semibold text-bitcoin-orange mb-2">
                  Weekly Bitcoin Meetup
                </div>
                <div className="text-gray-600 mb-4">
                  Every Tuesday • 6:00 PM - 8:00 PM
                </div>
                <div className="text-gray-500 mb-6">
                  Location varies - check our events calendar
                </div>
                <a
                  href="/calendar-static"
                  className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                >
                  View Calendar
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Community Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl font-bold font-archivo-black text-gray-900 mb-8">
                Join Our Community
              </h2>
              <p className="text-xl text-gray-600 mb-12">
                Connect with Kansas City's Bitcoin enthusiasts and stay updated on our events
              </p>
              
              <div className="flex justify-center mb-12">
                <SocialLinks />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 font-archivo-black">Why Join?</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• Learn from Bitcoin experts</li>
                    <li>• Network with local enthusiasts</li>
                    <li>• Stay updated on Bitcoin news</li>
                    <li>• Help with Bitcoin adoption</li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 font-archivo-black">What to Expect</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• Friendly, welcoming atmosphere</li>
                    <li>• All skill levels welcome</li>
                    <li>• Educational discussions</li>
                    <li>• Real-world Bitcoin use cases</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </StaticLayout>
  );
}
