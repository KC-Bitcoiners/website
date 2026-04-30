/**
 * BTC/fiat price conversion utilities.
 * Fetches BTC price from CoinGecko free API, caches for 5 minutes.
 */

// In-memory cache
let cachedRate: { usdPerBtc: number; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Fetch current BTC/USD price, using cache when fresh */
export async function getBtcUsdRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL) {
    return cachedRate.usdPerBtc;
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    );
    const data = await res.json();
    const usdPerBtc = data?.bitcoin?.usd;
    if (typeof usdPerBtc === "number" && usdPerBtc > 0) {
      cachedRate = { usdPerBtc, fetchedAt: Date.now() };
      return usdPerBtc;
    }
    throw new Error("Invalid price data");
  } catch {
    // Return cached value even if stale, or a reasonable fallback
    if (cachedRate) return cachedRate.usdPerBtc;
    // Fallback: ~$95,000/BTC (update periodically)
    return 95000;
  }
}

/** Convert a fiat amount to satoshis using current BTC price */
export async function fiatToSats(
  amount: number,
  currency: string,
): Promise<number> {
  const upper = currency.toUpperCase();
  if (upper === "SATS") return Math.round(amount);
  if (upper === "BTC") return Math.round(amount * 100_000_000);

  // For fiat currencies, assume USD for now (can add EUR/GBP rates later)
  const usdPerBtc = await getBtcUsdRate();
  // Convert to USD first if needed, then to sats
  // Simplification: treat all fiat as USD for conversion
  const satsPerUsd = 100_000_000 / usdPerBtc;
  return Math.round(amount * satsPerUsd);
}

/** Format sats amount for display */
export function formatSats(sats: number): string {
  return sats.toLocaleString() + " sats";
}
