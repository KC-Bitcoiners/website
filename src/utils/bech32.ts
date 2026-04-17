import { bech32 } from "@scure/base";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

// Lazy-load schnorr to avoid Turbopack ESM resolution issues at import time
let _schnorr: typeof import("@noble/curves/secp256k1.js").schnorr | null = null;

async function getSchnorr() {
  if (!_schnorr) {
    const mod = await import("@noble/curves/secp256k1.js");
    _schnorr = mod.schnorr;
  }
  return _schnorr;
}

export function npubEncode(hexPubkey: string): string {
  return bech32.encode("npub", bech32.toWords(hexToBytes(hexPubkey)));
}

export function npubDecode(npub: string): string {
  const { words } = bech32.decode(npub as `${string}1${string}`);
  return bytesToHex(new Uint8Array(bech32.fromWords(words)));
}

export function nsecEncode(privkey: string | Uint8Array): string {
  const bytes = typeof privkey === "string" ? hexToBytes(privkey) : privkey;
  return bech32.encode("nsec", bech32.toWords(bytes));
}

export function nsecDecode(nsec: string): string {
  const { words } = bech32.decode(nsec as `${string}1${string}`);
  return bytesToHex(new Uint8Array(bech32.fromWords(words)));
}

/** Generate a new Nostr key pair. Returns hex privkey and hex pubkey. */
export async function generateKeyPair(): Promise<{ privkeyHex: string; pubkeyHex: string }> {
  const privkey = randomBytes(32);
  const s = await getSchnorr();
  const pubkey = s.getPublicKey(privkey);
  return {
    privkeyHex: bytesToHex(privkey),
    pubkeyHex: bytesToHex(pubkey),
  };
}

/** Derive the x-only public key from a hex private key. */
export async function getPubkey(privkeyHex: string): Promise<string> {
  const s = await getSchnorr();
  return bytesToHex(s.getPublicKey(hexToBytes(privkeyHex)));
}
