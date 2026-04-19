import { writeFileSync } from "fs";
import { resolve } from "path";
import { randomBytes } from "crypto";
import { bech32 } from "@scure/base";
import { schnorr } from "@noble/curves/secp256k1.js";

const ROOT = resolve(__dirname, "..");
const KEYS_PATH = resolve(ROOT, ".test-keys.json");

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function npubEncode(hexPubkey: string): string {
  return bech32.encode("npub", bech32.toWords(hexToBytes(hexPubkey)));
}

function nsecEncode(privkey: string | Uint8Array): string {
  const bytes = typeof privkey === "string" ? hexToBytes(privkey) : privkey;
  return bech32.encode("nsec", bech32.toWords(bytes));
}

export default async function globalSetup() {
  // Generate a fresh keypair for this test run
  const privkeyBytes = randomBytes(32);
  const privkeyHex = bytesToHex(privkeyBytes);
  const pubkeyBytes = schnorr.getPublicKey(privkeyBytes);
  const pubkeyHex = bytesToHex(pubkeyBytes);

  const keys = {
    privkeyHex,
    pubkeyHex,
    npub: npubEncode(pubkeyHex),
    nsec: nsecEncode(privkeyHex),
  };

  writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2));

  console.log(`Generated fresh test key: ${keys.npub}`);
}
