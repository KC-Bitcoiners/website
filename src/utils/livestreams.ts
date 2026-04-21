import { pool } from "@/lib/nostr";
import { nostrRelays, WHITELISTED_PUBKEYS } from "@/config";

export interface Livestream {
  id: string;
  pubkey: string;
  dTag: string;
  title: string;
  summary: string;
  image: string;
  streamingUrl: string;
  status: string;
  starts: string;
  recording: string;
  host: { pubkey: string; relay?: string; role?: string };
  created_at: number;
}

function getTag(tags: string[][], name: string): string {
  return tags.find((t) => t[0] === name)?.[1] || "";
}

function parseLivestream(event: any): Livestream {
  const hostTag = event.tags.find((t: string[]) => t[0] === "p");
  return {
    id: event.id,
    pubkey: event.pubkey,
    dTag: getTag(event.tags, "d"),
    title: getTag(event.tags, "title"),
    summary: getTag(event.tags, "summary"),
    image: getTag(event.tags, "image"),
    streamingUrl: getTag(event.tags, "streaming"),
    status: getTag(event.tags, "status"),
    starts: getTag(event.tags, "starts"),
    recording: getTag(event.tags, "recording"),
    host: hostTag
      ? { pubkey: hostTag[1], relay: hostTag[2], role: hostTag[3] }
      : { pubkey: event.pubkey },
    created_at: event.created_at,
  };
}

export async function fetchLivestreams(): Promise<Livestream[]> {
  const relays = nostrRelays;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve([]), 15000);
    const rawEvents: any[] = [];

    pool
      .request(relays, {
        kinds: [30311],
        "#p": WHITELISTED_PUBKEYS,
        limit: 50,
      })
      .subscribe({
        next: (event) => rawEvents.push(event),
        error: () => {
          clearTimeout(timeout);
          resolve([]);
        },
        complete: () => {
          clearTimeout(timeout);

          // Deduplicate by d tag (keep most recent)
          const seen = new Map<string, any>();
          for (const e of rawEvents) {
            const d = getTag(e.tags, "d");
            const existing = seen.get(d);
            if (!existing || e.created_at > existing.created_at) {
              seen.set(d, e);
            }
          }

          const liveStreams = Array.from(seen.values())
            .map(parseLivestream)
            .filter((s) => s.status === "live")
            .sort((a, b) => b.created_at - a.created_at);

          resolve(liveStreams.slice(0, 1));
        },
      });
  });
}
