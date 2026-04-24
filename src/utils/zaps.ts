/**
 * NIP-57 Zap utilities — LNURL-pay resolution, zap request construction,
 * and invoice fetching for zapping any Nostr event.
 */
import { bech32 } from "@scure/base";
import { pool } from "@/lib/nostr";
import { nostrRelays } from "@/config";

// ── Types ─────────────────────────────────────────────────────────────

/** LNURL-pay endpoint response (fields we need) */
interface LNURLPayResponse {
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadata: string;
  allowsNostr?: boolean;
  nostrPubkey?: string;
  tag?: string;
}

/** Cached LNURL resolution result */
interface CachedLNURL {
  payResponse: LNURLPayResponse;
  lnurl: string;
  expiresAt: number;
}

// ── Cache ─────────────────────────────────────────────────────────────

const lnurlCache = new Map<string, CachedLNURL>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Profile → Lightning Address ───────────────────────────────────────

/**
 * Fetch kind 0 metadata for a pubkey and extract their lightning address.
 * Returns lud16 (e.g. "user@domain.com") or lud06 (LNURL bech32 string),
 * or undefined if the profile has no lightning address configured.
 */
export async function getLightningAddress(
  pubkey: string,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    const sub = pool
      .request(nostrRelays, {
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      })
      .subscribe({
        next: (event: any) => {
          if (settled) return;
          settled = true;
          try {
            const meta = JSON.parse(event.content);
            resolve(meta.lud16 || meta.lud06 || undefined);
          } catch {
            resolve(undefined);
          }
          sub.unsubscribe();
        },
        error: () => {
          if (!settled) {
            settled = true;
            resolve(undefined);
          }
        },
        complete: () => {
          if (!settled) {
            settled = true;
            resolve(undefined);
          }
        },
      });
    // Timeout after 5s
    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(undefined);
        sub.unsubscribe();
      }
    }, 5000);
  });
}

// ── LNURL Resolution ──────────────────────────────────────────────────

/**
 * Resolve a lightning address or LNURL string to a pay URL and raw lnurl.
 * - lud16 "user@domain.com" → "https://domain/.well-known/lnurlp/user"
 * - lud06 "lnurl1..." → bech32 decode to HTTPS URL
 */
export function resolveLNURL(
  address: string,
): { payUrl: string; lnurl: string } | undefined {
  // lud16: user@domain.com
  if (address.includes("@")) {
    const [user, domain] = address.split("@");
    if (!user || !domain) return undefined;
    const payUrl = `https://${domain}/.well-known/lnurlp/${user}`;
    // Compute the lnurl bech32 encoding of the payUrl for the callback param
    const lnurl = bech32.encode("lnurl", bech32.toWords(new TextEncoder().encode(payUrl)), 2000);
    return { payUrl, lnurl };
  }

  // lud06: already a bech32-encoded lnurl
  if (address.toLowerCase().startsWith("lnurl1")) {
    try {
      const decoded = bech32.decode(address as `${string}1${string}`, 2000);
      const payUrl = new TextDecoder().decode(new Uint8Array(bech32.fromWords(decoded.words)));
      if (!payUrl.startsWith("http")) return undefined;
      return { payUrl, lnurl: address.toLowerCase() };
    } catch {
      return undefined;
    }
  }

  return undefined;
}

// ── LNURL-pay Endpoint ────────────────────────────────────────────────

/**
 * Fetch and validate the LNURL-pay endpoint.
 * Returns undefined if the endpoint doesn't support NIP-57 zaps.
 */
export async function fetchLNURLPayInfo(
  payUrl: string,
  lnurl: string,
): Promise<LNURLPayResponse | undefined> {
  // Check cache
  const cached = lnurlCache.get(lnurl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payResponse;
  }

  try {
    const res = await fetch(payUrl);
    if (!res.ok) return undefined;
    const data: LNURLPayResponse = await res.json();

    if (data.tag !== "payRequest" || !data.allowsNostr) return undefined;

    // Cache the result
    lnurlCache.set(lnurl, {
      payResponse: data,
      lnurl,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return data;
  } catch {
    return undefined;
  }
}

// ── Zap Request Event ─────────────────────────────────────────────────

const ZAP_REQUEST_KIND = 9734;

/**
 * Build an unsigned NIP-57 zap request event (kind 9734).
 */
export function buildZapRequest(params: {
  recipientPubkey: string;
  eventId?: string;
  millisats: number;
  relays: string[];
  content?: string;
}): { kind: number; content: string; tags: string[][]; created_at: number } {
  const tags: string[][] = [
    ["p", params.recipientPubkey],
    ["relays", ...params.relays],
    ["amount", String(params.millisats)],
  ];
  if (params.eventId) tags.push(["e", params.eventId]);

  return {
    kind: ZAP_REQUEST_KIND,
    content: params.content || "",
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

// ── Invoice Fetch (orchestrator) ──────────────────────────────────────

export type SignerFn = (event: {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
}) => Promise<Record<string, unknown>>;

/**
 * Full zap flow: resolve LNURL → build request → sign → fetch invoice.
 * Returns `{ invoice: bolt11 }` on success or `{ error: message }` on failure.
 */
export async function fetchZapInvoice(
  params: {
    recipientPubkey: string;
    eventId?: string;
    millisats: number;
    signEvent: SignerFn;
    content?: string;
  },
): Promise<{ invoice: string; signedRequest?: Record<string, unknown> } | { error: string }> {
  const { recipientPubkey, eventId, millisats, signEvent, content } = params;

  // Step 1: Get lightning address from profile
  const address = await getLightningAddress(recipientPubkey);
  if (!address) return { error: "Author has not set up Lightning payments." };

  // Step 2: Resolve to LNURL-pay URL
  const resolved = resolveLNURL(address);
  if (!resolved) return { error: "Could not resolve Lightning address." };

  // Step 3: Fetch pay info
  const payInfo = await fetchLNURLPayInfo(resolved.payUrl, resolved.lnurl);
  if (!payInfo) return { error: "Lightning address does not support Nostr zaps." };

  // Validate amount range
  if (millisats < payInfo.minSendable || millisats > payInfo.maxSendable) {
    const min = Math.ceil(payInfo.minSendable / 1000);
    const max = Math.floor(payInfo.maxSendable / 1000);
    return { error: `Amount must be between ${min} and ${max} sats.` };
  }

  // Step 4: Build and sign zap request
  const unsigned = buildZapRequest({
    recipientPubkey,
    eventId,
    millisats,
    relays: nostrRelays,
    content,
  });
  let signed: Record<string, unknown>;
  try {
    signed = await signEvent(unsigned);
  } catch {
    return { error: "Failed to sign zap request." };
  }

  // Step 5: Fetch invoice from callback
  const encoded = encodeURIComponent(JSON.stringify(signed));
  const callbackUrl = `${payInfo.callback}?amount=${millisats}&nostr=${encoded}&lnurl=${resolved.lnurl}`;

  try {
    const res = await fetch(callbackUrl);
    if (!res.ok) return { error: `Lightning server error (${res.status}).` };
    const data = await res.json();
    if (!data.pr) return { error: "Invalid response from Lightning server." };
    return { invoice: data.pr as string, signedRequest: signed };
  } catch {
    return { error: "Could not fetch payment invoice." };
  }
}

/** Clear the LNURL cache (useful for testing). */
export function clearLNURLCache(): void {
  lnurlCache.clear();
}

// ── Zap Totals ─────────────────────────────────────────────────────────

/**
 * Extract zap amount in sats from a kind 9735 zap receipt event.
 * Tries the bolt11 invoice first, falls back to description tag.
 */
function extractZapAmount(event: any): number {
  // Try bolt11 tag — parse millisats from the invoice
  const bolt11Tag = event.tags?.find((t: string[]) => t[0] === "bolt11");
  if (bolt11Tag?.[1]) {
    // Try parsing amount= from invoice
    const msatMatch = bolt11Tag[1].match(/amount=(\d+)/);
    if (msatMatch) return Math.floor(parseInt(msatMatch[1]) / 1000);

    // Fallback: amount from invoice prefix (e.g. "lnbc1u" = 100k msats)
    try {
      const invoice = bolt11Tag[1];
      if (invoice.includes("lnbc")) {
        const m = invoice.match(/(\d+)([munp])/);
        if (m) {
          const amt = parseInt(m[1]);
          switch (m[2]) {
            case "p": return Math.floor(amt * 1000);
            case "n": return Math.floor(amt / 10);
            case "u": return Math.floor(amt * 100);
            case "m": return Math.floor(amt * 100000);
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Try amount tag
  const amountTag = event.tags?.find((t: string[]) => t[0] === "amount");
  if (amountTag?.[1]) {
    const msats = parseInt(amountTag[1]);
    if (!isNaN(msats)) return Math.floor(msats / 1000);
  }

  return 0;
}

/**
 * Fetch the total zap amount (in sats) received by a specific event.
 * Queries relays for kind 9735 zap receipts referencing the event ID.
 * Deduplicates across relays by event ID.
 */
export function fetchZapTotal(eventId: string): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    let total = 0;
    const seen = new Set<string>();

    const sub = pool
      .request(nostrRelays, {
        kinds: [9735],
        "#e": [eventId],
        limit: 500,
      })
      .subscribe({
        next: (event: any) => {
          if (seen.has(event.id)) return;
          seen.add(event.id);
          total += extractZapAmount(event);
        },
        error: () => {
          if (!settled) { settled = true; resolve(total); }
        },
        complete: () => {
          if (!settled) { settled = true; resolve(total); }
        },
      });

    // Timeout after 5s — return whatever we collected
    setTimeout(() => {
      if (!settled) { settled = true; resolve(total); }
      sub.unsubscribe();
    }, 5000);
  });
}
