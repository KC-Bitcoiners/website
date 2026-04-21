import { pool } from "@/lib/nostr";
import { nostrRelays, organization } from "@/config";

const CLIENT_TAG = ["client", "bodarc"] as const;
const LOCATION_TAG = ["location", organization.location] as const;

export interface NewsletterEvent {
  kind: 30023;
  content: string;
  tags: string[][];
  created_at: number;
}

export function buildNewsletterEvent(opts: {
  title: string;
  content: string;
  description?: string;
  tags?: string[];
  dTag?: string;
}): NewsletterEvent {
  const dTag =
    opts.dTag ||
    opts.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 64);

  const tags: string[][] = [
    [...CLIENT_TAG],
    [...LOCATION_TAG],
    ["d", dTag],
    ["title", opts.title],
    ["published_at", Math.floor(Date.now() / 1000).toString()],
  ];

  if (opts.description) {
    tags.push(["summary", opts.description]);
  }

  if (opts.tags) {
    for (const t of opts.tags) tags.push(["t", t]);
  }

  return {
    kind: 30023,
    content: opts.content,
    tags,
    created_at: Math.floor(Date.now() / 1000),
  };
}

export async function publishNewsletter(
  signedEvent: Record<string, unknown>
): Promise<boolean> {
  try {
    const responses = await pool.publish(nostrRelays, signedEvent as any);
    return responses.some((r) => r.ok);
  } catch {
    return false;
  }
}
