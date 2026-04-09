import { isWhitelisted, nostrRelays } from "@/config";
import { npubEncode } from "applesauce-core/helpers";
import { pool } from "@/lib/nostr";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

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
  // Note: private keys are intentionally never stored here.
  // All signing is delegated to the NIP-07 browser extension.
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

export function NostrProvider({ children }: NostrProviderProps) {
  const [user, setUser] = useState<NostrUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasExtension, setHasExtension] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasExtension(!!window.nostr);
    }

    // Restore session — only pubkey/npub/metadata, never a private key
    const stored = localStorage.getItem("nostr_user");
    if (stored) {
      try {
        const userData = JSON.parse(stored);
        // Discard any legacy stored private key
        const { privateKey: _dropped, ...safeUser } = userData;
        setUser(safeUser);
      } catch {
        localStorage.removeItem("nostr_user");
      }
    }
    setIsLoading(false);
  }, []);

  /** Fetch kind:0 metadata for a pubkey via the relay pool. */
  const fetchUserMetadata = async (
    pubkey: string,
  ): Promise<NostrUser["metadata"] | null> => {
    return new Promise((resolve) => {
      const filter = { kinds: [0], authors: [pubkey], limit: 1 };
      const events: any[] = [];

      const timeout = setTimeout(() => resolve(null), 8000);

      pool.request(nostrRelays, filter).subscribe({
        next: (event) => events.push(event),
        error: () => {
          clearTimeout(timeout);
          resolve(null);
        },
        complete: () => {
          clearTimeout(timeout);
          if (events.length === 0) { resolve(null); return; }
          // Take most recent in case multiple relays return duplicates
          const latest = events.sort((a, b) => b.created_at - a.created_at)[0];
          try {
            resolve(JSON.parse(latest.content));
          } catch {
            resolve(null);
          }
        },
      });
    });
  };

  const loginWithExtension = async () => {
    if (!window.nostr) {
      throw new Error(
        "No Nostr extension found. Please install Alby, nos2x, or another NIP-07 extension.",
      );
    }

    const pubkey = await window.nostr.getPublicKey();
    const npub = npubEncode(pubkey);

    if (!isWhitelisted(npub)) {
      throw new Error(
        "This account is not authorised. Only whitelisted pubkeys can create events.",
      );
    }

    const userData: NostrUser = { pubkey, npub };
    setUser(userData);
    localStorage.setItem("nostr_user", JSON.stringify(userData));

    // Fetch display metadata in the background
    fetchUserMetadata(pubkey).then((metadata) => {
      if (metadata) {
        const withMeta = { ...userData, metadata };
        setUser(withMeta);
        localStorage.setItem("nostr_user", JSON.stringify(withMeta));
      }
    });
  };

  const refreshMetadata = async () => {
    if (!user?.pubkey) return;
    const metadata = await fetchUserMetadata(user.pubkey);
    if (metadata) {
      const updated = { ...user, metadata };
      setUser(updated);
      localStorage.setItem("nostr_user", JSON.stringify(updated));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("nostr_user");
  };

  return (
    <NostrContext.Provider
      value={{ user, loginWithExtension, logout, isLoading, hasExtension, refreshMetadata }}
    >
      {children}
    </NostrContext.Provider>
  );
}

export function useNostr(): NostrContextType {
  const context = useContext(NostrContext);
  if (context === undefined) {
    throw new Error("useNostr must be used within a NostrProvider");
  }
  return context;
}
