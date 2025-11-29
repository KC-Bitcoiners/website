import React, { useState } from 'react';
import { useNostr } from '@/contexts/NostrContext';

export default function UserProfile() {
  const { user, logout } = useNostr();
  const [showProfile, setShowProfile] = useState(false);

  if (!user) {
    return null;
  }

  const truncateNpub = (npub: string) => {
    return `${npub.slice(0, 12)}...${npub.slice(-12)}`;
  };

  const displayName = user.metadata?.display_name || user.metadata?.name || truncateNpub(user.npub);

  return (
    <div className="relative">
      <button
        onClick={() => setShowProfile(!showProfile)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-bitcoin-orange text-white hover:bg-bitcoin-orange-hover transition-colors"
      >
        {user.metadata?.picture ? (
          <img
            src={user.metadata.picture}
            alt={displayName}
            className="w-6 h-6 rounded-full object-cover"
            onError={(e) => {
              // Fallback to default avatar if image fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : (
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-bitcoin-orange rounded-full"></div>
          </div>
        )}
        <span className="text-sm font-medium hidden md:block max-w-32 truncate">
          {displayName}
        </span>
      </button>

      {showProfile && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowProfile(false)}
          />
          
          {/* Profile dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Nostr Profile</h3>
                <button
                  onClick={() => setShowProfile(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                {/* Profile picture and name */}
                <div className="flex items-center space-x-3 pb-3 border-b border-gray-200">
                  {user.metadata?.picture ? (
                    <img
                      src={user.metadata.picture}
                      alt={displayName}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                      <div className="w-8 h-8 bg-bitcoin-orange rounded-full"></div>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-gray-900">{displayName}</div>
                    {user.metadata?.about && (
                      <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {user.metadata.about}
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Public Key</div>
                  <div className="font-mono text-sm text-gray-900 break-all mt-1">
                    {user.npub}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Hex</div>
                  <div className="font-mono text-xs text-gray-600 break-all mt-1">
                    {user.pubkey}
                  </div>
                </div>
                
                <div className="pt-3 border-t border-gray-200">
                  <button
                    onClick={() => {
                      logout();
                      setShowProfile(false);
                    }}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
