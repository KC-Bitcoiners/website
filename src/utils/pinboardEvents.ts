import { pool } from "@/lib/nostr";
import { nostrRelays, WHITELISTED_PUBKEYS, CLIENT_TAG, LOCATION_TAG } from "@/config";

// In test mode, use the dynamically injected whitelist
function getWhitelistedAuthors(): string[] {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined" && (window as any).__TEST_WHITELIST) {
    return (window as any).__TEST_WHITELIST;
  }
  return WHITELISTED_PUBKEYS;
}

// Pinboard types
export interface Pinboard {
  id: string;
  pubkey: string;
  dTag: string;
  title: string;
  description: string;
  image?: string;
  tags: string[];
  collaborative: boolean;
  coordinate: string;
  created_at: number;
  pinCount?: number;
  rawEvent?: Record<string, unknown>;
}

export interface Pin {
  id: string;
  pubkey: string;
  content: string;
  boardCoordinates: string[];
  // Content reference - one of these will be set
  eventRef?: string; // e tag
  eventRelay?: string;
  coordinateRef?: string; // a tag
  coordinateRelay?: string;
  externalRef?: string; // i tag (NIP-73)
  externalKind?: string; // k tag
  // Metadata
  title?: string;
  tags: string[];
  created_at: number;
  contentType?: ContentType;
  rawEvent?: Record<string, unknown>;
}

export type ContentType =
  | "note"
  | "picture"
  | "video"
  | "article"
  | "bookmark"
  | "weblink"
  | "book"
  | "podcast"
  | "movie"
  | "paper"
  | "location"
  | "pinboard"
  | "unknown";

// Display-level type for UI filtering -- derived from k tag + URL patterns
export type DisplayType = "youtube" | "podcast" | "podcast-episode" | "link" | "book" | "movie" | "paper" | "location" | "newsletter";

export function getDisplayType(pin: Pin): DisplayType {
  // 0. Check content type for article pins
  if (pin.contentType === "article") return "newsletter";

  // 1. Check k tag for non-web types (authoritative per NIP-73)
  const k = pin.externalKind || "";
  if (k === "isbn") return "book";
  if (k === "isan") return "movie";
  if (k === "doi") return "paper";
  if (k === "geo") return "location";
  if (k === "article") return "newsletter";
  if (k === "podcast:item:guid") return "podcast-episode";
  if (k.startsWith("podcast")) return "podcast";

  // 2. For web URLs (k === "web" or no k tag), differentiate by URL pattern
  const url = pin.externalRef || "";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("vimeo.com")) return "youtube";
  if (url.includes("rumble.com")) return "youtube";
  if (url.includes("spotify.com") && url.includes("/episode")) return "podcast-episode";
  if (url.includes("spotify.com") || url.includes("podcast")) return "podcast";
  return "link";
}

export const DISPLAY_TYPE_CONFIG: Record<DisplayType, { icon: string; label: string; color: string; activeColor: string }> = {
  youtube: {
    icon: "▶️",
    label: "Videos",
    color: "bg-red-100 text-red-700",
    activeColor: "bg-red-600 text-white",
  },
  podcast: {
    icon: "🎙️",
    label: "Podcasts",
    color: "bg-purple-100 text-purple-700",
    activeColor: "bg-purple-600 text-white",
  },
  "podcast-episode": {
    icon: "🎵",
    label: "Episodes",
    color: "bg-indigo-100 text-indigo-700",
    activeColor: "bg-indigo-600 text-white",
  },
  link: {
    icon: "🔗",
    label: "Links",
    color: "bg-blue-100 text-blue-700",
    activeColor: "bg-blue-600 text-white",
  },
  book: {
    icon: "📚",
    label: "Books",
    color: "bg-amber-100 text-amber-700",
    activeColor: "bg-amber-600 text-white",
  },
  movie: {
    icon: "🎥",
    label: "Movies",
    color: "bg-pink-100 text-pink-700",
    activeColor: "bg-pink-600 text-white",
  },
  paper: {
    icon: "📄",
    label: "Papers",
    color: "bg-teal-100 text-teal-700",
    activeColor: "bg-teal-600 text-white",
  },
  location: {
    icon: "📍",
    label: "Locations",
    color: "bg-green-100 text-green-700",
    activeColor: "bg-green-600 text-white",
  },
  newsletter: {
    icon: "📰",
    label: "Articles",
    color: "bg-orange-100 text-orange-700",
    activeColor: "bg-orange-600 text-white",
  },
};

// All display types in a stable order for filter bar rendering
export const ALL_DISPLAY_TYPES: DisplayType[] = ["youtube", "podcast", "podcast-episode", "link", "book", "movie", "paper", "location", "newsletter"];

/** Result of auto-detecting content kind from a user-pasted value. */
export interface DetectedContent {
  iTag: string;       // value for the "i" tag
  kTag: string;       // value for the "k" tag
  displayType: DisplayType;
}

/**
 * Parse a user-pasted value and determine the correct NIP-73 i/k tags.
 *
 * Supported formats:
 *   https://...                    -> i: full URL,    k: "web"
 *   isbn:978...                    -> i: "isbn:978...", k: "isbn"
 *   doi:10.xxxx                   -> i: "doi:10.xxxx", k: "doi"
 *   isan:xxxx                     -> i: "isan:xxxx",   k: "isan"
 *   podcast:guid:<guid>           -> i: full value,    k: "podcast:guid"
 *   geo:<lat>,<lon>               -> i: "geo:...",     k: "geo"
 */
export function detectContentKind(value: string): DetectedContent {
  const trimmed = value.trim();

  // Spotify episode URL -> podcast episode
  if (/open\.spotify\.com\/episode\//i.test(trimmed)) {
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return { iTag: url, kTag: "podcast:item:guid", displayType: "podcast-episode" };
  }

  // ISBN: "isbn:978..." or bare 10-13 digit number
  if (/^isbn:/i.test(trimmed)) {
    const id = trimmed.slice(5).trim();
    return { iTag: `isbn:${id}`, kTag: "isbn", displayType: "book" };
  }
  const isbnMatch = trimmed.match(/^(\d{10,13}[\dXx])$/);
  if (isbnMatch) {
    return { iTag: `isbn:${isbnMatch[1]}`, kTag: "isbn", displayType: "book" };
  }

  // DOI: "doi:10.xxx" or bare "10.xxxx/yyyy"
  if (/^doi:/i.test(trimmed)) {
    const id = trimmed.slice(4).trim();
    return { iTag: `doi:${id}`, kTag: "doi", displayType: "paper" };
  }
  if (/^10\.\d{4,}\//.test(trimmed)) {
    return { iTag: `doi:${trimmed}`, kTag: "doi", displayType: "paper" };
  }

  // ISAN: "isan:xxxx"
  if (/^isan:/i.test(trimmed)) {
    const id = trimmed.slice(5).trim();
    return { iTag: `isan:${id}`, kTag: "isan", displayType: "movie" };
  }

  // Podcast Episode GUID: "podcast:item:guid:xxxx"
  if (/^podcast:item:guid:/i.test(trimmed)) {
    return { iTag: trimmed, kTag: "podcast:item:guid", displayType: "podcast-episode" };
  }

  // Podcast Feed GUID: "podcast:guid:xxxx"
  if (/^podcast:guid:/i.test(trimmed)) {
    return { iTag: trimmed, kTag: "podcast:guid", displayType: "podcast" };
  }

  // Geo: "geo:lat,lon" or bare "lat,lon"
  if (/^geo:/i.test(trimmed)) {
    return { iTag: trimmed, kTag: "geo", displayType: "location" };
  }
  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(trimmed)) {
    return { iTag: `geo:${trimmed.replace(/\s/g, "")}`, kTag: "geo", displayType: "location" };
  }

  // RSS/Atom feed URL
  if (/\.(xml|rss)(\?|$)/i.test(trimmed) || /\/feed\b/i.test(trimmed)) {
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return { iTag: url, kTag: "podcast", displayType: "podcast" };
  }

  // Default: web URL -- add scheme if missing
  let url = trimmed;
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // Determine display type from URL pattern
  let displayType: DisplayType = "link";
  if (url.includes("youtube.com") || url.includes("youtu.be")) displayType = "youtube";
  else if (url.includes("vimeo.com")) displayType = "youtube";
  else if (url.includes("rumble.com")) displayType = "youtube";
  else if (url.includes("spotify.com") || url.includes("podcast")) displayType = "podcast";
  return { iTag: url, kTag: "web", displayType };
}

// Deduplicate replaceable events by coordinate (keep latest)
function deduplicateByCoordinate(events: any[], kind: number): any[] {
  const map = new Map<string, any>();
  for (const event of events) {
    const dTag = event.tags?.find((t: string[]) => t[0] === "d")?.[1] || "";
    const coord = `${kind}:${event.pubkey}:${dTag}`;
    const existing = map.get(coord);
    if (!existing || event.created_at > existing.created_at) {
      map.set(coord, event);
    }
  }
  return Array.from(map.values());
}

// Fetch pinboards from whitelisted users only
export async function fetchPinboards(): Promise<Pinboard[]> {
  const relays = nostrRelays;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 15000);
    const rawEvents: any[] = [];

    pool.request(relays, {
      kinds: [30067],
      authors: getWhitelistedAuthors(),
      limit: 100,
    }).subscribe({
      next: (event) => rawEvents.push(event),
      error: () => { clearTimeout(timeout); resolve([]); },
      complete: () => {
        clearTimeout(timeout);
        // Client-side author filter (belts-and-suspenders: some relays ignore `authors`)
        const authorSet = new Set(getWhitelistedAuthors());
        const filtered = rawEvents.filter((e: any) => authorSet.has(e.pubkey));
        const deduped = deduplicateByCoordinate(filtered, 30067);
        const pinboards: Pinboard[] = deduped.map(parsePinboardEvent).filter(Boolean) as Pinboard[];
        resolve(pinboards.sort((a, b) => b.created_at - a.created_at));
      },
    });
  });
}

// Fetch ALL pins from ALL whitelisted user pinboards (for Featured view)
export async function fetchFeaturedPins(): Promise<Pin[]> {
  const relays = nostrRelays;

  const authors = getWhitelistedAuthors();
  if (authors.length === 0) return [];

  // Fetch all kind 39067 events from whitelisted authors
  // then filter client-side to only include pins referencing our boards
  const boards = await fetchPinboards();
  const boardCoords = new Set(boards.map((b) => b.coordinate));
  const authorSet = new Set(authors);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 15000);
    const rawEvents: any[] = [];

    pool.request(relays, {
      kinds: [39067],
      authors,
      limit: 500,
    }).subscribe({
      next: (event) => rawEvents.push(event),
      error: () => { clearTimeout(timeout); resolve([]); },
      complete: () => {
        clearTimeout(timeout);
        // Client-side author filter (belts-and-suspenders: some relays ignore `authors`)
        const filtered = rawEvents.filter((e: any) => authorSet.has(e.pubkey));
        const deduped = deduplicateByCoordinate(filtered, 39067);
        const pins: Pin[] = [];
        for (const event of deduped) {
          const pin = parsePinEvent(event);
          // Only include pins that reference one of our boards
          if (pin && pin.boardCoordinates.some((c) => boardCoords.has(c))) {
            pins.push(pin);
          }
        }
        resolve(pins.sort((a, b) => b.created_at - a.created_at));
      },
    });
  });
}

// Fetch pins for a specific board
export async function fetchPinsForBoard(board: Pinboard): Promise<Pin[]> {
  const relays = nostrRelays;
  const coordinate = board.coordinate;
  const whitelistedAuthors = getWhitelistedAuthors();
  const authorSet = new Set(whitelistedAuthors);

  // Always apply whitelist filtering at relay level
  // For non-collaborative boards, further restrict to board owner
  const authors = board.collaborative
    ? whitelistedAuthors
    : [board.pubkey].filter((p) => authorSet.has(p));
  const filter: any = {
    kinds: [39067],
    authors,
    limit: 200,
  };

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 15000);
    const rawEvents: any[] = [];

    pool.request(relays, filter).subscribe({
      next: (event) => rawEvents.push(event),
      error: () => { clearTimeout(timeout); resolve([]); },
      complete: () => {
        clearTimeout(timeout);
        // Belt-and-suspenders: client-side whitelist check
        const filtered = rawEvents.filter((e: any) => authorSet.has(e.pubkey));
        const deduped = deduplicateByCoordinate(filtered, 39067);
        const pins: Pin[] = [];
        for (const event of deduped) {
          const pin = parsePinEvent(event);
          if (pin && pin.boardCoordinates.includes(coordinate)) {
            pins.push(pin);
          }
        }
        resolve(pins.sort((a, b) => b.created_at - a.created_at));
      },
    });
  });
}

// Create a pin event (kind 39067) - returns unsigned event for signing
export function buildPinEvent(opts: {
  boardCoordinate: string;
  content: string;
  title?: string;
  externalRef?: string;
  externalKind?: string;
  eventRef?: string;
  eventRelay?: string;
  articleCoordinate?: string;
  tags?: string[];
  dTag?: string;
}): Record<string, unknown> {
  const tags: string[][] = [
    [...CLIENT_TAG],
    [...LOCATION_TAG],
    ["A", opts.boardCoordinate],
  ];

  // d tag is required for parameterized replaceable events (kind 39067)
  // Generate one from title/url if not provided
  const dTag = opts.dTag || opts.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64) || Math.random().toString(36).slice(2);
  tags.push(["d", dTag]);

  if (opts.externalRef) {
    tags.push(["i", opts.externalRef]);
  }
  if (opts.externalKind) {
    tags.push(["k", opts.externalKind]);
  }
  if (opts.eventRef) {
    const eTag = ["e", opts.eventRef];
    if (opts.eventRelay) eTag.push(opts.eventRelay);
    tags.push(eTag);
  }
  if (opts.articleCoordinate) {
    tags.push(["a", opts.articleCoordinate]);
  }
  if (opts.title) tags.push(["title", opts.title]);
  if (opts.tags) {
    for (const t of opts.tags) tags.push(["t", t]);
  }

  return {
    kind: 39067,
    content: opts.content,
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

// Publish a signed pin event to relays
export async function publishPin(signedEvent: Record<string, unknown>): Promise<boolean> {
  try {
    const responses = await pool.publish(nostrRelays, signedEvent as any);
    return responses.some((r) => r.ok);
  } catch {
    return false;
  }
}

// Build a kind 30067 pinboard event (unsigned, for signing via NIP-07)
export function buildPinboardEvent(opts: {
  dTag: string;
  title: string;
  description?: string;
  content?: string;
}): Record<string, unknown> {
  const tags: string[][] = [[...CLIENT_TAG], ["d", opts.dTag]];
  if (opts.title) tags.push(["title", opts.title]);
  if (opts.description) tags.push(["description", opts.description]);
  return {
    kind: 30067,
    content: opts.content || opts.description || "",
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

// Publish a signed pinboard event to relays
export async function publishPinboard(signedEvent: Record<string, unknown>): Promise<boolean> {
  try {
    const responses = await pool.publish(nostrRelays, signedEvent as any);
    return responses.some((r) => r.ok);
  } catch {
    return false;
  }
}

// Build a NIP-09 deletion request (kind 5) targeting a specific pin
export function buildDeleteEvent(opts: {
  eventId: string;
  eventKind: number;
  reason?: string;
}): Record<string, unknown> {
  const tags: string[][] = [
    [...CLIENT_TAG],
    ["e", opts.eventId],
    ["k", String(opts.eventKind)],
  ];

  return {
    kind: 5,
    content: opts.reason || "",
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

// Publish a signed deletion request to relays
export async function publishDelete(signedEvent: Record<string, unknown>): Promise<boolean> {
  try {
    const responses = await pool.publish(nostrRelays, signedEvent as any);
    return responses.some((r) => r.ok);
  } catch {
    return false;
  }
}

// Parse a kind 30067 event into a Pinboard
function parsePinboardEvent(event: any): Pinboard | null {
  const dTag = event.tags?.find((t: string[]) => t[0] === "d")?.[1];
  if (!dTag) return null;

  const title = event.tags?.find((t: string[]) => t[0] === "title")?.[1] || dTag;
  const description = event.tags?.find((t: string[]) => t[0] === "description")?.[1] || event.content || "";
  const image = event.tags?.find((t: string[]) => t[0] === "image")?.[1];
  const tags = event.tags?.filter((t: string[]) => t[0] === "t").map((t: string[]) => t[1]) || [];
  const collaborative = event.tags?.some((t: string[]) => t[0] === "collaborative") || false;

  return {
    id: event.id,
    pubkey: event.pubkey,
    dTag,
    title,
    description,
    image,
    tags,
    collaborative,
    coordinate: `30067:${event.pubkey}:${dTag}`,
    created_at: event.created_at,
    rawEvent: event,
  };
}

// Parse a kind 39067 event into a Pin
function parsePinEvent(event: any): Pin | null {
  const boardCoordinates = event.tags
    ?.filter((t: string[]) => t[0] === "A")
    .map((t: string[]) => t[1]) || [];

  const eTag = event.tags?.find((t: string[]) => t[0] === "e");
  const aTag = event.tags?.find((t: string[]) => t[0] === "a" && !t[1]?.startsWith("30067:"));
  const iTag = event.tags?.find((t: string[]) => t[0] === "i");
  const kTag = event.tags?.find((t: string[]) => t[0] === "k");

  const pin: Pin = {
    id: event.id,
    pubkey: event.pubkey,
    content: event.content || "",
    boardCoordinates,
    tags: event.tags?.filter((t: string[]) => t[0] === "t").map((t: string[]) => t[1]) || [],
    created_at: event.created_at,
    title: event.tags?.find((t: string[]) => t[0] === "title")?.[1],
    rawEvent: event,
  };

  if (eTag) {
    pin.eventRef = eTag[1];
    pin.eventRelay = eTag[2];
    pin.contentType = "note";
    // Check for k tag to override content type (e.g. k=article for newsletter pins)
    if (kTag) {
      pin.externalKind = kTag[1];
      if (kTag[1] === "article") pin.contentType = "article";
    }
    // Also store article coordinate if present
    if (aTag) {
      pin.coordinateRef = aTag[1];
      pin.coordinateRelay = aTag[2];
    }
  } else if (aTag) {
    pin.coordinateRef = aTag[1];
    pin.coordinateRelay = aTag[2];
    const kind = parseInt(aTag[1].split(":")[0], 10);
    if (kind === 30023) pin.contentType = "article";
    else if (kind === 39701) pin.contentType = "bookmark";
    else if (kind === 30067) pin.contentType = "pinboard";
    else pin.contentType = "unknown";
  } else if (iTag) {
    pin.externalRef = iTag[1];
    pin.externalKind = kTag?.[1];
    const kind = pin.externalKind || "";
    if (kind === "web") pin.contentType = "weblink";
    else if (kind === "isbn") pin.contentType = "book";
    else if (kind.startsWith("podcast")) pin.contentType = "podcast";
    else if (kind === "isan") pin.contentType = "movie";
    else if (kind === "doi") pin.contentType = "paper";
    else if (kind === "geo") pin.contentType = "location";
    else pin.contentType = "weblink";
  } else {
    return null;
  }

  return pin;
}

// Content type helpers
export function getContentTypeIcon(type?: ContentType): string {
  switch (type) {
    case "note": return "Nt";
    case "picture": return "Pi";
    case "video": return "Vd";
    case "article": return "Ar";
    case "bookmark": return "Bm";
    case "weblink": return "Ln";
    case "book": return "Bk";
    case "podcast": return "Pc";
    case "movie": return "Mv";
    case "paper": return "Pp";
    case "location": return "Lo";
    case "pinboard": return "Pb";
    default: return "??";
  }
}

export function getContentTypeLabel(type?: ContentType): string {
  switch (type) {
    case "note": return "Note";
    case "picture": return "Picture";
    case "video": return "Video";
    case "article": return "Article";
    case "bookmark": return "Bookmark";
    case "weblink": return "Link";
    case "book": return "Book";
    case "podcast": return "Podcast";
    case "movie": return "Movie";
    case "paper": return "Paper";
    case "location": return "Location";
    case "pinboard": return "Board";
    default: return "Resource";
  }
}

export function getContentTypeColor(type?: ContentType): string {
  switch (type) {
    case "note": return "bg-gray-100 text-gray-700";
    case "picture": return "bg-green-100 text-green-700";
    case "video": return "bg-red-100 text-red-700";
    case "article": return "bg-blue-100 text-blue-700";
    case "weblink": return "bg-indigo-100 text-indigo-700";
    case "book": return "bg-amber-100 text-amber-700";
    case "podcast": return "bg-purple-100 text-purple-700";
    case "movie": return "bg-pink-100 text-pink-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

export function getPinUrl(pin: Pin): string | null {
  if (pin.externalRef) return pin.externalRef;
  return null;
}
