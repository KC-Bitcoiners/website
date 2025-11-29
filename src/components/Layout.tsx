import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import { HamburgerIcon } from "./Icons";
import ThemeToggle from "./ThemeToggle";

function NavLinks({ currentPath }: { currentPath: string }) {
  return (
    <>
      <Link
        href="/"
        className={clsx(
          "font-semibold transition-colors",
          currentPath === "/" ? "bitcoin-orange" : "hover:text-bitcoin-orange"
        )}
      >
        Home
      </Link>
      <Link
        href="/events"
        className={clsx(
          "font-semibold transition-colors",
          currentPath === "/events" ? "bitcoin-orange" : "hover:text-bitcoin-orange"
        )}
      >
        Events
      </Link>
      <Link
        href="/calendar"
        className={clsx(
          "font-semibold transition-colors",
          currentPath === "/calendar" ? "bitcoin-orange" : "hover:text-bitcoin-orange"
        )}
      >
        Calendar
      </Link>
      <Link
        href="/shop"
        className={clsx(
          "font-semibold transition-colors",
          currentPath === "/shop" ? "bitcoin-orange" : "hover:text-bitcoin-orange"
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
      <a
        href="https://btcpay0.voltageapp.io/apps/26q7Q6PpDTZFoUBfpMko6jSzm4od/pos"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-bitcoin-orange font-semibold transition-colors"
      >
        Donations
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
  const router = useRouter();
  const currentPath = router.pathname;

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className={clsx("min-h-screen bg-white dark:bg-black", className)}>
      {/* Header */}
      <header className="bg-white dark:bg-black text-black dark:text-white sticky top-0 z-50 border-b border-gray-200 dark:border-gray-700">
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
              <ThemeToggle />
            </div>

            {/* Mobile menu button and theme toggle */}
            <div className="flex items-center space-x-2 md:hidden">
              <ThemeToggle />
              <button
                className="p-2"
                onClick={toggleMobileMenu}
                aria-label="Toggle mobile menu"
              >
                <HamburgerIcon />
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-200">
              <div
                className="flex flex-col pt-4 space-y-4"
                onClick={() => setMobileMenuOpen(false)}
              >
                <NavLinks currentPath={currentPath} />
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-black dark:bg-black text-gray-400 dark:text-gray-400 py-8">
        <div className="container mx-auto px-6 text-center">
          <p>&copy; 2025 KC Bitcoin Meetup Group - All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
