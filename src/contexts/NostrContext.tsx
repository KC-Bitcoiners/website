import { isWhitelisted, nostrRelays } from "@/config";
import {
  generateKeyPair,
  getPubkey,
  npubEncode,
  nsecEncode,
  nsecDecode,
} from "@/utils/bech32";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

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
  login: (privateKeyOrNsec?: string) => Promise<{ nsec: string } | undefined>;
  loginWithExtension: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  hasExtension: boolean;
  refreshMetadata: () => Promise<void>;
  signEvent: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<Record<string, unknown>>;
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

    const storedUser = localStorage.getItem("nostr_user");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      } catch (error) {
        console.error("Failed to parse stored user data:", error);
        localStorage.removeItem("nostr_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (
    privateKeyOrNsec?: string,
  ): Promise<{ nsec: string } | undefined> => {
    try {
      let privkeyHex: string;
      let pubkeyHex: string;
      const isGenerated = !privateKeyOrNsec;

      if (privateKeyOrNsec) {
        // Decode nsec to hex, or use hex directly
        if (privateKeyOrNsec.startsWith("nsec1")) {
          privkeyHex = nsecDecode(privateKeyOrNsec);
        } else {
          privkeyHex = privateKeyOrNsec;
        }
        pubkeyHex = await getPubkey(privkeyHex);
      } else {
        // Generate new key pair
        const keyPair = await generateKeyPair();
        privkeyHex = keyPair.privkeyHex;
        pubkeyHex = keyPair.pubkeyHex;
      }

      const npub = npubEncode(pubkeyHex);
      const nsec = nsecEncode(privkeyHex);

      // Only check whitelist for existing keys, not newly generated ones
      if (!isGenerated && !isWhitelisted(pubkeyHex)) {
        throw new Error(
          "This account is not whitelisted. Only whitelisted users can publish content.",
        );
      }

      const userData: NostrUser = {
        pubkey: pubkeyHex,
        npub,
        privateKey: nsec,
      };

      setUser(userData);
      localStorage.setItem("nostr_user", JSON.stringify(userData));

      // Return nsec for newly generated accounts so UI can display it
      return isGenerated ? { nsec } : undefined;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const fetchUserMetadata = async (pubkey: string) => {
    try {
      const relays = nostrRelays;

      const filter = {
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      };

      for (const relayUrl of relays) {
        try {
          const ws = new WebSocket(relayUrl);

          const metadataPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              ws.close();
              reject(new Error("Timeout"));
            }, 5000);

            ws.onopen = () => {
              ws.send(JSON.stringify(["REQ", "metadata-sub", filter]));
            };

            ws.onmessage = (event) => {
              try {
                const message = JSON.parse(event.data);

                if (message[0] === "EVENT") {
                  const [, subscriptionId, nostrEvent] = message;

                  if (subscriptionId === "metadata-sub") {
                    clearTimeout(timeout);
                    try {
                      const metadata = JSON.parse(nostrEvent.content);
                      ws.close();
                      resolve(metadata);
                    } catch (parseError) {
                      ws.close();
                      reject(parseError);
                    }
                  }
                } else if (message[0] === "EOSE") {
                  clearTimeout(timeout);
                  ws.close();
                  reject(new Error("No metadata found"));
                }
              } catch (error) {
                clearTimeout(timeout);
                ws.close();
                reject(error);
              }
            };

            ws.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("WebSocket error"));
            };

            ws.onclose = () => {
              clearTimeout(timeout);
            };
          });

          return await metadataPromise;
        } catch {
          // Continue to next relay
        }
      }

      return null;
    } catch {
      return null;
    }
  };

  const loginWithExtension = async () => {
    if (!window.nostr) {
      throw new Error(
        "No nostr extension found. Please install a nostr extension like Alby, Snort, or Nos2x.",
      );
    }

    try {
      const pubkey = await window.nostr.getPublicKey();
      const npub = npubEncode(pubkey);

      if (!isWhitelisted(pubkey)) {
        throw new Error(
          "This account is not whitelisted. Only whitelisted users can publish content.",
        );
      }

      const userData: NostrUser = {
        pubkey,
        npub,
      };

      setUser(userData);
      localStorage.setItem("nostr_user", JSON.stringify(userData));

      fetchUserMetadata(pubkey).then((metadata) => {
        if (metadata) {
          setUser((prev) => (prev ? { ...prev, metadata } : null));
          localStorage.setItem(
            "nostr_user",
            JSON.stringify({ ...userData, metadata }),
          );
        }
      });
    } catch (error) {
      console.error("Extension login failed:", error);
      throw error;
    }
  };

  const refreshMetadata = async () => {
    if (!user?.pubkey) return;

    try {
      const metadata = await fetchUserMetadata(user.pubkey);
      if (metadata) {
        const updatedUser = { ...user, metadata };
        setUser(updatedUser);
        localStorage.setItem("nostr_user", JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error("Failed to refresh metadata:", error);
    }
  };

  const signEvent = async (event: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<Record<string, unknown>> => {
    // If user logged in with nsec/private key, sign locally
    if (user?.privateKey) {
      const privkeyHex = nsecDecode(user.privateKey);
      const pubkey = await getPubkey(privkeyHex);
      const fullEvent = { ...event, pubkey };
      // Serialize and hash
      const serialized = JSON.stringify([0, fullEvent.pubkey, fullEvent.created_at, fullEvent.kind, fullEvent.tags, fullEvent.content]);
      const msgBytes = new TextEncoder().encode(serialized);
      const hashBytes = await crypto.subtle.digest("SHA-256", msgBytes);
      const id = Array.from(new Uint8Array(hashBytes)).map(b => b.toString(16).padStart(2, "0")).join("");
      // Sign with schnorr
      const s = await import("@noble/curves/secp256k1.js").then(m => m.schnorr);
      const sig = s.sign(id, privkeyHex);
      return { ...fullEvent, id, sig: sig.toHex() };
    }
    // Fallback to extension
    if (window.nostr) {
      const pk = await window.nostr.getPublicKey();
      return window.nostr.signEvent({ ...event, pubkey: pk });
    }
    throw new Error("No signing method available. Login with nsec or install a Nostr extension.");
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("nostr_user");
  };

  const value: NostrContextType = {
    user,
    login,
    loginWithExtension,
    logout,
    isLoading,
    hasExtension,
    refreshMetadata,
    signEvent,
  };

  return (
    <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
  );
}

export function useNostr(): NostrContextType {
  const context = useContext(NostrContext);
  if (context === undefined) {
    throw new Error("useNostr must be used within a NostrProvider");
  }
  return context;
}
