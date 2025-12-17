export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrFilter {
  ids?: string[];
  kinds?: number[];
  authors?: string[];
  since?: number;
  until?: number;
  limit?: number;
  "#d"?: string[];
  [key: `#${string}`]: string[] | number | undefined;
}

// Simple nostr utilities for basic functionality
export class NostrUtils {
  // Create a coordinate for replaceable events
  static createCoordinate(
    kind: number,
    pubkey: string,
    identifier: string,
  ): string {
    return `${kind}:${pubkey}:${identifier}`;
  }

  // Parse a coordinate string
  static parseCoordinate(
    coordinate: string,
  ): { kind: number; pubkey: string; identifier: string } | null {
    const parts = coordinate.split(":");
    if (parts.length !== 3) return null;

    const [kindStr, pubkey, identifier] = parts;
    const kind = parseInt(kindStr, 10);

    if (isNaN(kind) || !pubkey || !identifier) return null;

    return { kind, pubkey, identifier };
  }

  // Get tag value from event
  static getTagValue(
    event: NostrEvent,
    tagName: string,
    index: number = 0,
  ): string | undefined {
    const tag = event.tags.find((tag) => tag[0] === tagName);
    return tag ? tag[index + 1] : undefined;
  }

  // Extract event identifier from tags
  static getEventIdentifier(event: NostrEvent): string | undefined {
    return this.getTagValue(event, "d");
  }

  // Filter events by time range
  static filterByTimeRange(
    events: NostrEvent[],
    startTime?: number,
    endTime?: number,
  ): NostrEvent[] {
    return events.filter((event) => {
      if (startTime && event.created_at < startTime) return false;
      if (endTime && event.created_at > endTime) return false;
      return true;
    });
  }

  // Deduplicate replaceable events (keep latest)
  static deduplicateReplaceableEvents(events: NostrEvent[]): NostrEvent[] {
    const coordinateMap = new Map<string, NostrEvent>();

    events.forEach((event) => {
      // Only process replaceable event kinds
      if (![31922, 31923, 30311, 30312, 30313].includes(event.kind)) {
        // For non-replaceable events, just add them
        coordinateMap.set(`${event.id}`, event);
        return;
      }

      const identifier = this.getEventIdentifier(event);
      if (!identifier) return;

      const coordinate = this.createCoordinate(
        event.kind,
        event.pubkey,
        identifier,
      );
      const existing = coordinateMap.get(coordinate);

      // Keep the newer event
      if (!existing || event.created_at > existing.created_at) {
        coordinateMap.set(coordinate, event);
      }
    });

    return Array.from(coordinateMap.values());
  }

  // Create a basic text note event (kind 1)
  static createTextNote(
    content: string,
    privateKey: string,
  ): Partial<NostrEvent> {
    return {
      kind: 1,
      content,
      tags: [],
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  // Create a calendar event (kind 31922)
  static createCalendarEvent(
    title: string,
    startTime: Date,
    endTime?: Date,
    location?: string,
    description?: string,
    privateKey?: string,
  ): Partial<NostrEvent> {
    const tags: string[][] = [];

    // Add title tag
    tags.push(["title", title]);

    // Add start time
    tags.push(["start", Math.floor(startTime.getTime() / 1000).toString()]);

    // Add end time if provided
    if (endTime) {
      tags.push(["end", Math.floor(endTime.getTime() / 1000).toString()]);
    }

    // Add location if provided
    if (location) {
      tags.push(["location", location]);
    }

    // Generate a unique identifier for this event
    const identifier = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    tags.push(["d", identifier]);

    return {
      kind: 31922,
      content: description || title,
      tags,
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  // Validate event structure
  static validateEvent(event: Partial<NostrEvent>): boolean {
    return !!(
      event.kind &&
      event.content !== undefined &&
      event.created_at &&
      Array.isArray(event.tags)
    );
  }
}

// Export commonly used kinds
export const EVENT_KINDS = {
  METADATA: 0,
  TEXT_NOTE: 1,
  RECOMMEND_SERVER: 2,
  CONTACTS: 3,
  ENCRYPTED_DIRECT_MESSAGE: 4,
  DELETION: 5,
  REACTION: 7,
  CHANNEL_CREATION: 40,
  CHANNEL_METADATA: 41,
  CHANNEL_MESSAGE: 42,
  CHANNEL_HIDE_MESSAGE: 43,
  CHANNEL_MUTEO_USER: 44,
  PRIVATE_DIRECT_MESSAGE: 44,
  WITNESS: 45,
  AUTHENTICATION: 22242,
  LIVE_EVENT: 30311,
  LIVE_EVENT_MESSAGE: 1311,
  INTERACTIVE_ROOM: 30312,
  ROOM_MEETING: 30313,
  CALENDAR_EVENT: 31922,
  CALENDAR_EVENT_RSVP: 31923,
  TIME_BASED_CALENDAR_EVENT: 31924,
  CALENDAR_EVENT_RSVP_STATUS: 31925,
  HTTP_AUTH: 27235,
  PROFILE_BADGE: 30008,
  BADGE_DEFINITION: 30009,
  SEAL: 13,
  GENERIC_REPOST: 16,
  CHANNEL_REPOST: 17,
  REACTION_WRAPPER: 9735,
  ZAP_REQUEST: 9734,
  ZAP: 9735,
  HIGHLIGHT: 9802,
  MISBEHAVIOR: 1984,
  APPLAUSE: 9900,
  CHAT_MESSAGE: 13194,
  PROBLEM_FLAG: 1636,
  REPORT: 1985,
  MODERATION: 1630,
  NOTE_WRAPPED_CONTENT: 1063,
  REQUESTED_ZAP_EVENT: 23194,
  RELAY_LIST: 10002,
  CLIENT_AUTH: 10005,
  FOLLOW_SET: 30000,
  MUTED_SET: 30001,
  PINNED_NOTE_LIST: 30003,
  COMMUNITY_LIST_APPROVED: 30004,
  BLOCK_RELAY_LIST: 30005,
  SEARCH_RELAY_LIST: 30006,
  INTEREST_LIST: 30015,
  EMOJI_LIST: 30030,
  LABEL: 1985,
  BOOKMARK_LIST: 30003,
  COMMUNITY_DEFINITION: 34550,
  RELAY_LIST_METADATA: 10050,
  WILLET: 9000,
  WRAPPER: 65535,
} as const;

export default NostrUtils;
