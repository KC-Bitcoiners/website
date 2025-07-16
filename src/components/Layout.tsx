import React, { useState } from "react";
import Link from "next/link";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white text-black sticky top-0 z-50 border-b border-gray-200">
        <nav className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="text-xl font-black bitcoin-orange uppercase tracking-wider font-archivo-black"
            >
              KC Bitcoin Meetup Group
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-8">
              <Link
                href="/"
                className="hover:bitcoin-orange font-semibold transition-colors"
              >
                Home
              </Link>
              <a
                href="https://www.meetup.com/kansas-city-bitcoin-meetup-group/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bitcoin-orange font-semibold transition-colors"
              >
                Meetings
              </a>
              <a
                href="https://btcpay0.voltageapp.io/apps/26q7Q6PpDTZFoUBfpMko6jSzm4od/pos"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bitcoin-orange font-semibold transition-colors"
              >
                Donations
              </a>
              <Link
                href="/block-party"
                className="hover:bitcoin-orange font-semibold transition-colors"
              >
                Block Party
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={toggleMobileMenu}
              aria-label="Toggle mobile menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
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

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-200">
              <div className="flex flex-col space-y-3 pt-4">
                <Link
                  href="/"
                  className="hover:bitcoin-orange font-semibold py-2 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <a
                  href="https://www.meetup.com/kansas-city-bitcoin-meetup-group/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:bitcoin-orange font-semibold py-2 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Meetings
                </a>
                <a
                  href="https://btcpay0.voltageapp.io/apps/26q7Q6PpDTZFoUBfpMko6jSzm4od/pos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:bitcoin-orange font-semibold py-2 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Donations
                </a>
                <Link
                  href="/block-party"
                  className="hover:bitcoin-orange font-semibold py-2 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Block Party
                </Link>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-black text-gray-400 py-8">
        <div className="container mx-auto px-6 text-center">
          <p>&copy; 2025 KC Bitcoin Meetup Group - All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
