import React, { useState } from "react";
import { useNostr } from "@/contexts/NostrContext";

interface NostrLoginProps {
  onLoginSuccess?: () => void;
  className?: string;
}

export default function NostrLogin({
  onLoginSuccess,
  className = "",
}: NostrLoginProps) {
  const { loginWithExtension, logout, user, isLoading, hasExtension } =
    useNostr();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtensionLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithExtension();
      onLoginSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect. Please try again.",
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className={`p-4 bg-bitcoin-orange text-white rounded-lg ${className}`}>
        <div className="flex flex-col space-y-2">
          {/* Show display name/picture if available */}
          {user.metadata && (
            <div className="flex items-center gap-2 mb-1">
              {user.metadata.picture && (
                <img
                  src={user.metadata.picture}
                  alt={user.metadata.name ?? "avatar"}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              )}
              <span className="font-semibold text-sm">
                {user.metadata.display_name ?? user.metadata.name ?? "Unknown"}
              </span>
            </div>
          )}
          <div className="text-xs opacity-75 font-mono break-all">{user.npub}</div>
          <button
            onClick={logout}
            className="mt-2 px-4 py-2 bg-white text-bitcoin-orange rounded font-semibold hover:bg-gray-100 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Connect with Nostr
          </h3>
          <p className="text-sm text-gray-500">
            A NIP-07 browser extension is required to sign events.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {hasExtension ? (
          <button
            onClick={handleExtensionLogin}
            disabled={isLoggingIn}
            className="w-full px-4 py-3 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? "Connecting..." : "Connect with Nostr Extension"}
          </button>
        ) : (
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-600">
              No Nostr extension detected. Install one to continue:
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://getalby.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors text-center"
              >
                ⚡ Get Alby (recommended)
              </a>
              <a
                href="https://github.com/fiatjaf/nos2x"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors text-center"
              >
                Get nos2x
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
