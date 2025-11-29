import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { nip19 } from 'nostr-tools';
import { isWhitelisted } from '@/config/whitelist';

// NIP-07 interface for browser extensions
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: any): Promise<any>;
      getRelays(): Promise<any>;
      nip04?: {
        encrypt?(pubkey: string, plaintext: string): Promise<string>;
        decrypt?(pubkey: string, ciphertext: string): Promise<string>;
      };
      nip44?: {
        encrypt?(pubkey: string, plaintext: string): Promise<string>;
        decrypt?(pubkey: string, ciphertext: string): Promise<string>;
      };
    };
  }
}

export interface NostrUser {
  pubkey: string;
  npub: string;
  privateKey?: string;
  metadata?: {
    name?: string;
    display_name?: string;
    picture?: string;
    about?: string;
    nip05?: string;
  };
}

interface NostrContextType {
  user: NostrUser | null;
  login: (privateKeyOrNsec?: string) => Promise<void>;
  loginWithExtension: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  hasExtension: boolean;
  refreshMetadata: () => Promise<void>;
}

const NostrContext = createContext<NostrContextType | undefined>(undefined);

interface NostrProviderProps {
  children: ReactNode;
}

// Simple utility to generate a random hex string
function generatePrivateKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Simple utility to derive public key from private key (simplified)
async function getPublicKey(privateKey: string): Promise<string> {
  // This is a simplified version - in production you'd use proper secp256k1
  // For demo purposes, we'll use a hash of the private key
  const encoder = new TextEncoder();
  const data = encoder.encode(privateKey);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function NostrProvider({ children }: NostrProviderProps) {
  const [user, setUser] = useState<NostrUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasExtension, setHasExtension] = useState(false);

  useEffect(() => {
    // Check for NIP-07 extension availability
    setHasExtension(!!window.nostr);
    
    // Check for stored user data on mount
    const storedUser = localStorage.getItem('nostr_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('nostr_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (privateKeyOrNsec?: string) => {
    try {
      let privateKey: string;
      let pubkey: string;

      if (privateKeyOrNsec) {
        // Try to decode as nsec first
        if (privateKeyOrNsec.startsWith('nsec')) {
          try {
            const { type, data } = nip19.decode(privateKeyOrNsec);
            if (type === 'nsec') {
              // Convert Uint8Array to hex string
              privateKey = Array.from(data as Uint8Array, byte => byte.toString(16).padStart(2, '0')).join('');
            } else {
              throw new Error('Invalid nsec format');
            }
          } catch (decodeError) {
            throw new Error('Failed to decode nsec');
          }
        } else {
          // Treat as hex private key
          privateKey = privateKeyOrNsec;
        }
      } else {
        // Generate new key pair
        privateKey = generatePrivateKey();
      }

      // Derive public key
      pubkey = await getPublicKey(privateKey);
      
      // Create npub encoding - use the hex string directly
      const npub = nip19.npubEncode(pubkey);

      // Check if user is whitelisted
      if (!isWhitelisted(npub)) {
        console.log('🚫 User not whitelisted:', npub);
        throw new Error('This account is not whitelisted for calendar events. Only whitelisted users can access the calendar.');
      }

      console.log('✅ User is whitelisted:', npub);

      const userData: NostrUser = {
        pubkey,
        npub,
        privateKey, // Store for signing events
      };

      setUser(userData);
      localStorage.setItem('nostr_user', JSON.stringify(userData));
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const fetchUserMetadata = async (pubkey: string) => {
    console.log('🔍 Fetching metadata for pubkey:', pubkey);
    
    try {
      // Follow plektos implementation - use WebSocket connections to relays
      // This avoids CORS issues entirely
      const relays = [
        'wss://relay.damus.io',
        'wss://relay.snort.social',
        'wss://nos.lol'
      ];

      console.log('🌐 Connecting to relays for metadata:', relays);

      // Create filter for kind 0 (metadata) events
      const filter = {
        kinds: [0],
        authors: [pubkey],
        limit: 1
      };

      console.log('📤 Using metadata filter:', filter);

      // Try each relay until we get metadata
      for (const relayUrl of relays) {
        console.log(`🔌 Connecting to relay: ${relayUrl}`);
        
        try {
          // Create WebSocket connection
          const ws = new WebSocket(relayUrl);
          
          // Create a promise that resolves when we get the metadata
          const metadataPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              console.log(`⏰ Timeout on ${relayUrl}`);
              ws.close();
              reject(new Error('Timeout'));
            }, 5000);

            ws.onopen = () => {
              console.log(`✅ Connected to ${relayUrl}`);
              
              // Send REQ message for metadata
              const reqMessage = JSON.stringify([
                'REQ',
                'metadata-sub',
                filter
              ]);
              
              console.log(`📤 Sending REQ to ${relayUrl}:`, reqMessage);
              ws.send(reqMessage);
            };

            ws.onmessage = (event) => {
              try {
                const message = JSON.parse(event.data);
                console.log(`📨 Message from ${relayUrl}:`, message);

                if (message[0] === 'EVENT') {
                  const [type, subscriptionId, nostrEvent] = message;
                  
                  if (subscriptionId === 'metadata-sub') {
                    clearTimeout(timeout);
                    console.log(`🎯 Found metadata event from ${relayUrl}:`, nostrEvent);
                    
                    try {
                      const metadata = JSON.parse(nostrEvent.content);
                      console.log(`✅ Successfully parsed metadata from ${relayUrl}:`, metadata);
                      
                      if (metadata.picture) {
                        console.log(`🖼️ Found picture URL: ${metadata.picture}`);
                      } else {
                        console.log(`⚠️ No picture in metadata for ${pubkey}`);
                      }
                      
                      ws.close();
                      resolve(metadata);
                    } catch (parseError) {
                      console.error(`❌ Failed to parse metadata content:`, parseError);
                      console.log('Raw content:', nostrEvent.content);
                      reject(parseError);
                    }
                  }
                } else if (message[0] === 'EOSE') {
                  console.log(`📭 End of stored events from ${relayUrl}`);
                  clearTimeout(timeout);
                  ws.close();
                  reject(new Error('No metadata found'));
                }
              } catch (error) {
                console.error(`💥 Error parsing message from ${relayUrl}:`, error);
              }
            };

            ws.onerror = (error) => {
              console.error(`💥 WebSocket error from ${relayUrl}:`, error);
              clearTimeout(timeout);
              reject(error);
            };

            ws.onclose = () => {
              console.log(`🔌 Closed connection to ${relayUrl}`);
              clearTimeout(timeout);
            };
          });

          // Wait for metadata or timeout
          return await metadataPromise;
        } catch (error) {
          console.warn(`⚠️ Failed to connect to ${relayUrl}:`, error);
          // Continue to next relay
        }
      }

      console.log(`❌ No metadata found for pubkey ${pubkey} from any relay`);
      return null;
    } catch (error) {
      console.error('💥 Critical error in fetchUserMetadata:', error);
      return null;
    }
  };

  const loginWithExtension = async () => {
    if (!window.nostr) {
      throw new Error('No nostr extension found. Please install a nostr extension like Alby, Snort, or Nos2x.');
    }

    try {
      // Request public key from extension
      const pubkey = await window.nostr.getPublicKey();
      const npub = nip19.npubEncode(pubkey);

      // Check if the user is whitelisted
      if (!isWhitelisted(npub)) {
        console.log('🚫 User not whitelisted:', npub);
        throw new Error('This account is not whitelisted for calendar events. Only whitelisted users can access the calendar.');
      }

      console.log('✅ User is whitelisted:', npub);

      const userData: NostrUser = {
        pubkey,
        npub,
        // No private key when using extension - extension handles signing
      };

      setUser(userData);
      localStorage.setItem('nostr_user', JSON.stringify(userData));

      // Fetch metadata in background
      fetchUserMetadata(pubkey).then(metadata => {
        if (metadata) {
          setUser(prev => prev ? { ...prev, metadata } : null);
          localStorage.setItem('nostr_user', JSON.stringify({ ...userData, metadata }));
        }
      });
    } catch (error) {
      console.error('Extension login failed:', error);
      throw new Error('Failed to connect to nostr extension. Please try again.');
    }
  };

  const refreshMetadata = async () => {
    if (!user?.pubkey) return;
    
    try {
      const metadata = await fetchUserMetadata(user.pubkey);
      if (metadata) {
        const updatedUser = { ...user, metadata };
        setUser(updatedUser);
        localStorage.setItem('nostr_user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Failed to refresh metadata:', error);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nostr_user');
  };

  const value: NostrContextType = {
    user,
    login,
    loginWithExtension,
    logout,
    isLoading,
    hasExtension,
    refreshMetadata,
  };

  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  );
}

export function useNostr(): NostrContextType {
  const context = useContext(NostrContext);
  if (context === undefined) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  return context;
}
