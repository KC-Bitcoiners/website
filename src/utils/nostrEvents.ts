import { getWhitelistFilter, nostrRelays } from "@/config";
import { pool } from "@/lib/nostr";
import {
  decodePointer,
  finalizeEvent,
  naddrEncode,
} from "applesauce-core/helpers";

export interface NostrCalendarEvent {
  id: string;
  kind: number;
  pubkey: string;
  tags: string[][];
  content: string;
  dTag?: string;
  title?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  created_at: number;
}

/** Fetch calendar events from whitelisted authors across all configured relays. */
export async function fetchNostrCalendarEvents(): Promise<NostrCalendarEvent[]> {
  const filter = getWhitelistFilter();
  const allEvents: NostrCalendarEvent[] = [];

  try {
    const events = await new Promise<NostrCalendarEvent[]>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Request timeout")), 30000);
      const collected: NostrCalendarEvent[] = [];

      pool.request(nostrRelays, filter).subscribe({
        next: (nostrEvent) => {
          collected.push({
            id: nostrEvent.id,
            kind: nostrEvent.kind,
            pubkey: nostrEvent.pubkey,
            tags: nostrEvent.tags || [],
            content: nostrEvent.content,
            dTag: nostrEvent.tags?.find((t: string[]) => t[0] === "d")?.[1],
            title: nostrEvent.tags?.find((t: string[]) => t[0] === "title")?.[1],
            summary: nostrEvent.tags?.find((t: string[]) => t[0] === "summary")?.[1],
            description: nostrEvent.content,
            location: nostrEvent.tags?.find((t: string[]) => t[0] === "location")?.[1],
            start: nostrEvent.tags?.find((t: string[]) => t[0] === "start")?.[1],
            end: nostrEvent.tags?.find((t: string[]) => t[0] === "end")?.[1],
            created_at: nostrEvent.created_at,
          });
        },
        error: (err) => { clearTimeout(timeout); reject(err); },
        complete: () => { clearTimeout(timeout); resolve(collected); },
      });
    });

    // Deduplicate by naddr (kind:pubkey:d-tag coordinate)
    const seen = new Set<string>();
    for (const event of events) {
      if (event.dTag) {
        const naddr = naddrEncode({ kind: event.kind, pubkey: event.pubkey, identifier: event.dTag });
        if (!seen.has(naddr)) {
          allEvents.push(event);
          seen.add(naddr);
        }
      } else {
        // Fallback for events missing a d-tag
        const key = `${event.kind}:${event.pubkey}`;
        if (!seen.has(key)) {
          allEvents.push(event);
          seen.add(key);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to fetch Nostr calendar events:", error);
  }

  return allEvents.sort((a, b) => b.created_at - a.created_at);
}

/** Convert a raw Nostr event into the app's CalendarEvent shape. */
export function convertNostrEventToCalendar(event: NostrCalendarEvent) {
  const startTime = event.start ? parseInt(event.start) : undefined;
  const endTime = event.end ? parseInt(event.end) : undefined;

  return {
    id: `nostr-${event.id}`,
    kind: event.kind,
    pubkey: event.pubkey,
    tags: event.tags,
    content: event.content,
    dTag: event.dTag,
    title: event.title || event.summary || "Untitled Event",
    summary: event.summary || event.title || "Untitled Event",
    description: event.description,
    location: event.location,
    locations: event.location ? [event.location] : [],
    start: startTime?.toString(),
    end: endTime?.toString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    image: event.tags?.find((t: string[]) => t[0] === "image")?.[1],
    hashtags: event.tags?.filter((t: string[]) => t[0] === "t").map((t) => t[1]) || [],
    references: event.tags?.filter((t: string[]) => t[0] === "r").map((t) => t[1]) || [],
    created_at: event.created_at,
  };
}

/** Publish a calendar event to Nostr relays via the NIP-07 extension. */
export async function publishNostrEvent(
  formData: any,
  privateKey?: string,
  pubkey?: string,
  /** Pass the existing dTag when updating a replaceable event. */
  existingDTag?: string,
): Promise<{ success: boolean; eventId?: string; naddr?: string; error?: string }> {
  try {
    const dTag = existingDTag ?? `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userPubkey = pubkey ?? "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0";

    const tags: string[][] = [["d", dTag], ["title", formData.title]];

    if (formData.summary) tags.push(["summary", formData.summary]);
    formData.locations?.forEach((l: string) => tags.push(["location", l]));
    formData.hashtags?.forEach((t: string) => tags.push(["t", t]));
    formData.references?.filter((r: string) => r.startsWith("http")).forEach((r: string) => tags.push(["r", r]));
    if (formData.image) tags.push(["image", formData.image]);

    if (formData.eventType === "all-day") {
      tags.push(["start", Math.floor(new Date(formData.startDate).getTime() / 1000).toString()]);
      if (formData.endDate) {
        tags.push(["end", Math.floor(new Date(`${formData.endDate}T23:59:59`).getTime() / 1000).toString()]);
      }
    } else {
      if (formData.startDate && formData.startTime) {
        tags.push(["start", Math.floor(new Date(`${formData.startDate}T${formData.startTime}`).getTime() / 1000).toString()]);
      }
      if (formData.endDate && formData.endTime) {
        tags.push(["end", Math.floor(new Date(`${formData.endDate}T${formData.endTime}`).getTime() / 1000).toString()]);
      }
    }

    const kind = formData.eventType === "all-day" ? 31922 : 31923;
    const eventTemplate = {
      kind,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: formData.description || formData.title,
    };

    const naddr = naddrEncode({ kind, pubkey: userPubkey, identifier: dTag });

    let signedEvent: any;

    if (window.nostr && pubkey) {
      // Preferred path: NIP-07 extension signing
      signedEvent = await window.nostr.signEvent({ ...eventTemplate, pubkey });
    } else if (privateKey) {
      // Legacy fallback: raw private key (kept for backward compat, not exposed in UI)
      let privateKeyBytes: Uint8Array;
      if (privateKey.startsWith("nsec")) {
        const { type, data } = decodePointer(privateKey);
        if (type !== "nsec") throw new Error("Invalid nsec format");
        privateKeyBytes = data as Uint8Array;
      } else {
        const clean = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
        if (clean.length !== 64) throw new Error("Private key must be 64 hex characters");
        privateKeyBytes = new Uint8Array(clean.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
      }
      signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);
    } else {
      throw new Error("No signing method available — install a NIP-07 extension");
    }

    const responses = await pool.publish(nostrRelays, signedEvent);
    const ok = responses.filter((r) => r.ok);

    if (ok.length > 0) {
      return { success: true, eventId: signedEvent.id, naddr };
    }

    const errs = responses.filter((r) => !r.ok).map((r) => `${r.from}: ${r.message}`).join("; ");
    return { success: false, error: errs || "Failed to publish to relays" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
