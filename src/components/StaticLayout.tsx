import React from "react";
import Link from "next/link";
import SocialLinks from "./SocialLinks";
import BitcoinLogo from "./BitcoinLogo";

interface StaticLayoutProps {
  children: React.ReactNode;
}

const StaticLayout: React.FC<StaticLayoutProps> = ({ 
  children
}) => {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  return (
    <div className="min-h-screen bg-gradient-to-br from-bitcoin-orange/5 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 backdrop-blur-lg bg-opacity-95">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <BitcoinLogo className="w-8 h-8" />
              <span className="text-xl font-bold font-archivo-black text-gray-900">
                KC Bitcoiners
              </span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link
                href="/"
                className={`text-sm font-medium transition-colors hover:text-bitcoin-orange ${
                  currentPath === '/' ? 'text-bitcoin-orange' : 'text-gray-600'
                }`}
              >
                Home
              </Link>
              <Link
                href="/calendar-static"
                className={`text-sm font-medium transition-colors hover:text-bitcoin-orange ${
                  currentPath === '/calendar-static' ? 'text-bitcoin-orange' : 'text-gray-600'
                }`}
              >
                Events
              </Link>
              <Link
                href="/events"
                className={`text-sm font-medium transition-colors hover:text-bitcoin-orange ${
                  currentPath === '/events' ? 'text-bitcoin-orange' : 'text-gray-600'
                }`}
              >
                Learn
              </Link>
              <Link
                href="/shop"
                className={`text-sm font-medium transition-colors hover:text-bitcoin-orange ${
                  currentPath === '/shop' ? 'text-bitcoin-orange' : 'text-gray-600'
                }`}
              >
                Shop
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button className="p-2 rounded-lg hover:bg-gray-100">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* About Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 font-archivo-black">
                About KC Bitcoiners
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                We're a community of Bitcoin enthusiasts in Kansas City dedicated to 
                education, adoption, and building Bitcoin ecosystem. Join us for 
                weekly meetups, workshops, and networking events.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4 font-archivo-black">
                Quick Links
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/" className="text-gray-600 hover:text-bitcoin-orange transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/calendar-static" className="text-gray-600 hover:text-bitcoin-orange transition-colors">
                    Events Calendar
                  </Link>
                </li>
                <li>
                  <Link href="/events" className="text-gray-600 hover:text-bitcoin-orange transition-colors">
                    Learn Bitcoin
                  </Link>
                </li>
                <li>
                  <Link href="/shop" className="text-gray-600 hover:text-bitcoin-orange transition-colors">
                    Bitcoin Shop
                  </Link>
                </li>
              </ul>
            </div>

            {/* Social Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4 font-archivo-black">
                Connect With Us
              </h3>
              <div className="flex space-x-4">
                <SocialLinks />
              </div>
              <p className="text-gray-600 text-sm mt-4">
                Follow us on social media for updates and announcements.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 mt-8 pt-8 text-center">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} KC Bitcoiners. Built with ❤️ for Bitcoin.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StaticLayout;
