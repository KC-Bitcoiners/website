import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import { HamburgerIcon } from "./Icons";
import { useNostr } from "@/contexts/NostrContext";
import UserProfile from "./UserProfile";
import NostrLogin from "./NostrLogin";
import SocialLinks from "./SocialLinks";
// Simple URL utility function
const ensureHttpURL = (url: string) => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
};
import { KC_BITCOINERS_RELAY } from "../config/const";

function NavLinks({ currentPath }: { currentPath: string }) {
  return (
    <>
      <Link
        href="/"
        className={clsx(
          "font-semibold transition-colors",
          currentPath === "/" ? "bitcoin-orange" : "hover:text-bitcoin-orange",
        )}
      >
        Home
      </Link>
      {/* <Link
        href="/events"
        className={clsx(
          "font-semibold transition-colors",
          currentPath === "/events"
            ? "bitcoin-orange"
            : "hover:text-bitcoin-orange",
        )}
      >
        Events
      </Link> */}
      <Link
        href="/calendar"
        className={clsx(
          "font-semibold transition-colors",
          currentPath === "/calendar"
            ? "bitcoin-orange"
            : "hover:text-bitcoin-orange",
        )}
      >
        Calendar
      </Link>
      <Link
        href="/shop"
        className={clsx(
          "font-semibold transition-colors",
          currentPath === "/shop"
            ? "bitcoin-orange"
            : "hover:text-bitcoin-orange",
        )}
      >
        Shop
      </Link>
      <a
        href="https://www.meetup.com/kansas-city-bitcoin-meetup-group/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-bitcoin-orange font-semibold transition-colors"
      >
        Meetup.com
      </a>
    </>
  );
}

interface LayoutProps {
  className?: string;
  children: React.ReactNode;
}

export default function Layout({ children, className }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { user, isLoading } = useNostr();
  const router = useRouter();
  const currentPath = router.pathname;

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className={clsx("min-h-screen bg-white", className)}>
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
            <div className="hidden md:flex items-center space-x-8">
              <NavLinks currentPath={currentPath} />
              {/* User Profile or Login */}
              {!isLoading && (
                <div className="flex items-center">
                  {user ? (
                    <UserProfile />
                  ) : (
                    <button
                      onClick={() => setShowLoginModal(true)}
                      className="px-4 py-2 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors"
                    >
                      Connect Nostr
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={toggleMobileMenu}
              aria-label="Toggle mobile menu"
            >
              <HamburgerIcon />
            </button>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-200">
              <div
                className="flex flex-col pt-4 space-y-4"
                onClick={() => setMobileMenuOpen(false)}
              >
                <NavLinks currentPath={currentPath} />
                {/* Mobile User Profile or Login */}
                {!isLoading && (
                  <div className="pt-4 border-t border-gray-200">
                    {user ? (
                      <div className="px-2">
                        <UserProfile />
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowLoginModal(true)}
                        className="w-full px-4 py-2 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors"
                      >
                        Connect Nostr
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Connect to Nostr
                </h2>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <NostrLogin onLoginSuccess={() => setShowLoginModal(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-black text-gray-400 py-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <p>&copy; 2025 KC Bitcoin Meetup Group - All Rights Reserved.</p>
            <SocialLinks />
          </div>
        </div>
      </footer>
    </div>
  );
}
