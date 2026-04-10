// Global type declarations for window.nostr extension (NIP-07)
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

export {};
