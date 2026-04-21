import { pool } from "@/lib/nostr";
import { nostrRelays, WHITELISTED_PUBKEYS, CLIENT_TAG, LOCATION_TAG } from "@/config";
import { buildDeleteEvent, publishDelete } from "@/utils/pinboardEvents";
import { logger } from "@/utils/logger";

// --- Interfaces ---

export interface Committee {
  id: string;
  pubkey: string;
  dTag: string;
  title: string;
  description: string;
  image?: string;
  meetingSchedule?: string;
  openings: number;
  tags: string[];
  coordinate: string;
  created_at: number;
  rawEvent?: Record<string, unknown>;
}

export interface CommitteeMember {
  id: string;
  pubkey: string;
  committeeCoordinate: string;
  dTag: string;
  role: string;
  name: string;
  email?: string;
  phone?: string;
  nostrPubkey?: string;
  created_at: number;
  rawEvent?: Record<string, unknown>;
}

export interface CommitteeOpening {
  id: string;
  pubkey: string;
  committeeCoordinate: string;
  dTag: string;
  title: string;
  description?: string;
  created_at: number;
  rawEvent?: Record<string, unknown>;
}

// --- Build functions ---

export function buildCommitteeEvent(opts: {
  dTag: string;
  title: string;
  description?: string;
  image?: string;
  meetingSchedule?: string;
  openings?: number;
  topicTags?: string[];
}): Record<string, unknown> {
  const tags: string[][] = [[...CLIENT_TAG], [...LOCATION_TAG], ["d", opts.dTag]];
  if (opts.title) tags.push(["title", opts.title]);
  if (opts.description) tags.push(["description", opts.description]);
  if (opts.image) tags.push(["image", opts.image]);
  if (opts.meetingSchedule) tags.push(["meetingSchedule", opts.meetingSchedule]);
  if (opts.openings !== undefined) tags.push(["openings", String(opts.openings)]);
  if (opts.topicTags) {
    for (const t of opts.topicTags) tags.push(["t", t]);
  }
  return {
    kind: 30068,
    content: opts.description || "",
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

export function buildCommitteeMemberEvent(opts: {
  committeeCoordinate: string;
  dTag: string;
  role: string;
  name: string;
  email?: string;
  phone?: string;
  nostrPubkey?: string;
}): Record<string, unknown> {
  const tags: string[][] = [
    [...CLIENT_TAG],
    ["a", opts.committeeCoordinate],
    ["d", opts.dTag],
    ["role", opts.role],
    ["name", opts.name],
  ];
  if (opts.email) tags.push(["email", opts.email]);
  if (opts.phone) tags.push(["phone", opts.phone]);
  if (opts.nostrPubkey) tags.push(["p", opts.nostrPubkey]);
  return {
    kind: 39068,
    content: "",
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

export function buildCommitteeOpeningEvent(opts: {
  committeeCoordinate: string;
  dTag: string;
  title: string;
  description?: string;
}): Record<string, unknown> {
  const tags: string[][] = [
    [...CLIENT_TAG],
    ["a", opts.committeeCoordinate],
    ["d", opts.dTag],
    ["title", opts.title],
  ];
  if (opts.description) tags.push(["description", opts.description]);
  return {
    kind: 39069,
    content: opts.description || "",
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

// --- Publish functions ---

export async function publishCommittee(signedEvent: Record<string, unknown>): Promise<boolean> {
  try {
    const responses = await pool.publish(nostrRelays, signedEvent as any);
    return responses.some((r) => r.ok);
  } catch {
    return false;
  }
}

export async function publishCommitteeMember(signedEvent: Record<string, unknown>): Promise<boolean> {
  try {
    const responses = await pool.publish(nostrRelays, signedEvent as any);
    return responses.some((r) => r.ok);
  } catch {
    return false;
  }
}

export async function publishCommitteeOpening(signedEvent: Record<string, unknown>): Promise<boolean> {
  try {
    const responses = await pool.publish(nostrRelays, signedEvent as any);
    return responses.some((r) => r.ok);
  } catch {
    return false;
  }
}

// Re-export delete helpers from pinboardEvents for convenience
export { buildDeleteEvent, publishDelete };

// --- Whitelist helper ---

// Resolve the author list at query time so test-injected pubkeys
// (window.__TEST_WHITELIST) are included alongside the config pubkeys.
function getAuthorPubkeys(): string[] {
  const base = WHITELISTED_PUBKEYS;
  if (typeof window !== "undefined" && (window as any).__TEST_WHITELIST) {
    const extra = (window as any).__TEST_WHITELIST as string[];
    const merged = new Set([...base, ...extra]);
    return Array.from(merged);
  }
  return base;
}

// --- Fetch functions ---

// Deduplicate parameterized replaceable events by coordinate (keep latest)
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

export async function fetchCommittees(): Promise<Committee[]> {
  const relays = nostrRelays;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 15000);
    const rawEvents: any[] = [];

    const authors = getAuthorPubkeys();
    pool.request(relays, {
      kinds: [30068],
      authors,
      limit: 100,
    }).subscribe({
      next: (event) => rawEvents.push(event),
      error: () => { clearTimeout(timeout); resolve([]); },
      complete: () => {
        clearTimeout(timeout);
        const authorSet = new Set(authors);
        const filtered = rawEvents.filter((e: any) => authorSet.has(e.pubkey));
        const deduped = deduplicateByCoordinate(filtered, 30068);
        const committees: Committee[] = deduped.map(parseCommitteeEvent).filter(Boolean) as Committee[];
        resolve(committees.sort((a, b) => a.title.localeCompare(b.title)));
      },
    });
  });
}

export async function fetchMembersForAllCommittees(
  committees: Committee[],
): Promise<Map<string, CommitteeMember[]>> {
  const relays = nostrRelays;
  const result = new Map<string, CommitteeMember[]>();

  if (committees.length === 0) return result;

  const coordinates = committees.map((c) => c.coordinate);
  const authors = getAuthorPubkeys();
  const authorSet = new Set(authors);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(result), 15000);
    const rawEvents: any[] = [];

    pool.request(relays, {
      kinds: [39068],
      "#a": coordinates,
      authors,
      limit: 500,
    }).subscribe({
      next: (event) => rawEvents.push(event),
      error: () => { clearTimeout(timeout); resolve(result); },
      complete: () => {
        clearTimeout(timeout);
        const filtered = rawEvents.filter((e: any) => authorSet.has(e.pubkey));
        for (const event of filtered) {
          const member = parseCommitteeMemberEvent(event);
          if (member) {
            const existing = result.get(member.committeeCoordinate) || [];
            existing.push(member);
            result.set(member.committeeCoordinate, existing);
          }
        }
        // Sort each committee's members: chair first, then vice-chair, then members, then by name
        for (const [coord, members] of result.entries()) {
          result.set(coord, members.sort((a, b) => {
            const roleOrder: Record<string, number> = { chair: 0, "vice-chair": 1, member: 2 };
            const diff = (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
            if (diff !== 0) return diff;
            return a.name.localeCompare(b.name);
          }));
        }
        resolve(result);
      },
    });
  });
}

export async function fetchMembersForCommittee(
  committee: Committee,
): Promise<CommitteeMember[]> {
  const relays = nostrRelays;
  const coordinate = committee.coordinate;
  const authors = getAuthorPubkeys();
  const authorSet = new Set(authors);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 15000);
    const rawEvents: any[] = [];

    pool.request(relays, {
      kinds: [39068],
      "#a": [coordinate],
      authors,
      limit: 200,
    }).subscribe({
      next: (event) => rawEvents.push(event),
      error: () => { clearTimeout(timeout); resolve([]); },
      complete: () => {
        clearTimeout(timeout);
        const filtered = rawEvents.filter((e: any) => authorSet.has(e.pubkey));
        const members: CommitteeMember[] = filtered
          .map(parseCommitteeMemberEvent)
          .filter((m): m is CommitteeMember => {
            if (!m) return false;
            // Deduplicate by dTag (keep latest)
            return true;
          });

        // Deduplicate by dTag
        const byDTag = new Map<string, CommitteeMember>();
        for (const m of members) {
          const existing = byDTag.get(m.dTag);
          if (!existing || m.created_at > existing.created_at) {
            byDTag.set(m.dTag, m);
          }
        }

        const deduped = Array.from(byDTag.values());
        deduped.sort((a, b) => {
          const roleOrder: Record<string, number> = { chair: 0, "vice-chair": 1, member: 2 };
          const diff = (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
          if (diff !== 0) return diff;
          return a.name.localeCompare(b.name);
        });

        resolve(deduped);
      },
    });
  });
}

export async function fetchOpeningsForAllCommittees(
  committees: Committee[],
): Promise<Map<string, CommitteeOpening[]>> {
  const relays = nostrRelays;
  const result = new Map<string, CommitteeOpening[]>();

  if (committees.length === 0) return result;

  const coordinates = committees.map((c) => c.coordinate);
  const authors = getAuthorPubkeys();
  const authorSet = new Set(authors);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(result), 15000);
    const rawEvents: any[] = [];

    pool.request(relays, {
      kinds: [39069],
      "#a": coordinates,
      authors,
      limit: 500,
    }).subscribe({
      next: (event) => rawEvents.push(event),
      error: () => { clearTimeout(timeout); resolve(result); },
      complete: () => {
        clearTimeout(timeout);
        const filtered = rawEvents.filter((e: any) => authorSet.has(e.pubkey));
        const byDTag = new Map<string, CommitteeOpening>();
        for (const event of filtered) {
          const opening = parseCommitteeOpeningEvent(event);
          if (opening) {
            const key = `${opening.committeeCoordinate}:${opening.dTag}`;
            const existing = byDTag.get(key);
            if (!existing || opening.created_at > existing.created_at) {
              byDTag.set(key, opening);
            }
          }
        }
        for (const opening of byDTag.values()) {
          const existing = result.get(opening.committeeCoordinate) || [];
          existing.push(opening);
          result.set(opening.committeeCoordinate, existing);
        }
        resolve(result);
      },
    });
  });
}

// --- Parse helpers ---

function parseCommitteeEvent(event: any): Committee | null {
  const dTag = event.tags?.find((t: string[]) => t[0] === "d")?.[1];
  if (!dTag) return null;

  const title = event.tags?.find((t: string[]) => t[0] === "title")?.[1] || dTag;
  const description = event.tags?.find((t: string[]) => t[0] === "description")?.[1] || event.content || "";
  const image = event.tags?.find((t: string[]) => t[0] === "image")?.[1];
  const meetingSchedule = event.tags?.find((t: string[]) => t[0] === "meetingSchedule")?.[1];
  const openingsStr = event.tags?.find((t: string[]) => t[0] === "openings")?.[1];
  const openings = openingsStr ? parseInt(openingsStr, 10) : 0;
  const tags = event.tags?.filter((t: string[]) => t[0] === "t").map((t: string[]) => t[1]) || [];

  return {
    id: event.id,
    pubkey: event.pubkey,
    dTag,
    title,
    description,
    image,
    meetingSchedule,
    openings: isNaN(openings) ? 0 : openings,
    tags,
    coordinate: `30068:${event.pubkey}:${dTag}`,
    created_at: event.created_at,
    rawEvent: event,
  };
}

function parseCommitteeMemberEvent(event: any): CommitteeMember | null {
  const aTag = event.tags?.find((t: string[]) => t[0] === "a" || t[0] === "A")?.[1];
  const dTag = event.tags?.find((t: string[]) => t[0] === "d")?.[1];
  const name = event.tags?.find((t: string[]) => t[0] === "name")?.[1];

  if (!aTag || !dTag || !name) return null;

  const roleRaw = event.tags?.find((t: string[]) => t[0] === "role")?.[1] || "member";
  const role = roleRaw;
  const email = event.tags?.find((t: string[]) => t[0] === "email")?.[1];
  const phone = event.tags?.find((t: string[]) => t[0] === "phone")?.[1];
  const nostrPubkey = event.tags?.find((t: string[]) => t[0] === "p")?.[1];

  return {
    id: event.id,
    pubkey: event.pubkey,
    committeeCoordinate: aTag,
    dTag,
    role,
    name,
    email,
    phone,
    nostrPubkey,
    created_at: event.created_at,
    rawEvent: event,
  };
}

function parseCommitteeOpeningEvent(event: any): CommitteeOpening | null {
  const aTag = event.tags?.find((t: string[]) => t[0] === "a" || t[0] === "A")?.[1];
  const dTag = event.tags?.find((t: string[]) => t[0] === "d")?.[1];
  const title = event.tags?.find((t: string[]) => t[0] === "title")?.[1];

  if (!aTag || !dTag || !title) return null;

  const description = event.tags?.find((t: string[]) => t[0] === "description")?.[1] || event.content || "";

  return {
    id: event.id,
    pubkey: event.pubkey,
    committeeCoordinate: aTag,
    dTag,
    title,
    description: description || undefined,
    created_at: event.created_at,
    rawEvent: event,
  };
}
