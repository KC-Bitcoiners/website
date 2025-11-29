import React, { useState } from 'react';
import { useNostr } from '@/contexts/NostrContext';

interface NostrLoginProps {
  onLoginSuccess?: () => void;
  className?: string;
}

export default function NostrLogin({ onLoginSuccess, className = '' }: NostrLoginProps) {
  const { login, loginWithExtension, logout, user, isLoading, hasExtension } = useNostr();
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtensionLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithExtension();
      onLoginSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to extension. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await login(); // Generate new key pair
      onLoginSuccess?.();
    } catch (err) {
      setError('Failed to create account. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleKeyLogin = async () => {
    if (!privateKeyInput.trim()) {
      setError('Please enter a private key or nsec');
      return;
    }

    setIsLoggingIn(true);
    setError(null);
    try {
      await login(privateKeyInput.trim());
      onLoginSuccess?.();
      setPrivateKeyInput('');
      setShowKeyInput(false);
    } catch (err) {
      setError('Invalid private key format. Please check and try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setPrivateKeyInput('');
    setShowKeyInput(false);
    setError(null);
    // The actual logout is handled by the context
  };

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className={`p-4 bg-bitcoin-orange text-white rounded-lg ${className}`}>
        <div className="flex flex-col space-y-2">
          <div className="text-sm font-semibold">Logged in as:</div>
          <div className="font-mono text-xs break-all">{user.npub}</div>
          <div className="text-xs opacity-75">Pubkey: {user.pubkey.slice(0, 16)}...</div>
          <button
            onClick={() => {
              logout();
              handleLogout();
            }}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect with Nostr</h3>
          <p className="text-sm text-gray-600">Sign in to access nostr features</p>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {!showKeyInput ? (
          <div className="space-y-3">
            {hasExtension && (
              <button
                onClick={handleExtensionLogin}
                disabled={isLoggingIn}
                className="w-full px-4 py-3 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? 'Connecting...' : 'Connect with Nostr Extension'}
              </button>
            )}
            
            <button
              onClick={handleQuickLogin}
              disabled={isLoggingIn}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? 'Creating Account...' : 'Create New Account'}
            </button>
            
            <button
              onClick={() => setShowKeyInput(true)}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Use Existing Key
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="privateKey" className="block text-sm font-medium text-gray-700 mb-2">
                Private Key or nsec
              </label>
              <textarea
                id="privateKey"
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                placeholder="Enter your private key or nsec..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent font-mono text-sm"
                rows={3}
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleKeyLogin}
                disabled={isLoggingIn}
                className="flex-1 px-4 py-2 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? 'Signing In...' : 'Sign In'}
              </button>
              
              <button
                onClick={() => {
                  setShowKeyInput(false);
                  setPrivateKeyInput('');
                  setError(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 text-center">
          Your keys are stored locally in your browser
        </div>
      </div>
    </div>
  );
}
