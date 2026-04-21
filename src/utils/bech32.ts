import { bech32, bech32m } from "@scure/base";

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

/** Encode a Nostr address (naddr) for parameterized replaceable events. */
export function naddrEncode(opts: { d: string; pubkey: string; kind: number; relays?: string[] }): string {
  const tlv: { type: number; value: Uint8Array }[] = [];

  // Type 0: special (d-tag value, utf-8)
  tlv.push({ type: 0, value: new TextEncoder().encode(opts.d) });

  // Type 2: author (pubkey hex → 32 bytes)
  tlv.push({ type: 2, value: hexToBytes(opts.pubkey) });

  // Type 3: relays (utf-8)
  if (opts.relays) {
    for (const relay of opts.relays) {
      tlv.push({ type: 3, value: new TextEncoder().encode(relay) });
    }
  }

  // Type 1: kind (4-byte big-endian unsigned integer)
  const kindBytes = new Uint8Array(4);
  kindBytes[0] = (opts.kind >> 24) & 0xff;
  kindBytes[1] = (opts.kind >> 16) & 0xff;
  kindBytes[2] = (opts.kind >> 8) & 0xff;
  kindBytes[3] = opts.kind & 0xff;
  tlv.push({ type: 1, value: kindBytes });

  // Encode TLV: type (1 byte) + length (varint) + value
  // Varint: 7 bits per byte, MSB = continuation bit
  const totalLen = tlv.reduce((sum, entry) => sum + 1 + varintSize(entry.value.length) + entry.value.length, 0);
  const buf = new Uint8Array(totalLen);
  let offset = 0;
  for (const entry of tlv) {
    buf[offset++] = entry.type;
    offset = writeVarint(buf, offset, entry.value.length);
    buf.set(entry.value, offset);
    offset += entry.value.length;
  }

  return bech32m.encode("naddr", bech32m.toWords(buf), false);
}

function varintSize(n: number): number {
  let size = 0;
  let v = n;
  do { size++; v >>>= 7; } while (v > 0);
  return size;
}

function writeVarint(buf: Uint8Array, offset: number, n: number): number {
  let v = n;
  while (v > 0x7f) {
    buf[offset++] = (v & 0x7f) | 0x80;
    v >>>= 7;
  }
  buf[offset++] = v & 0x7f;
  return offset;
}
