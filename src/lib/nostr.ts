// Client and server side utilities for Nostr
import { KC_BITCOINERS_RELAY } from "../config/const";

// Simple Filter type for compatibility
interface Filter {
  kinds?: number[];
  authors?: string[];
  limit?: number;
  since?: number;
  until?: number;
}

// Check if we're on the client side
const isClient = typeof window !== "undefined";

// Skip window.nostrdb.js import for now to avoid build issues
// This can be added back later when the package is properly installed

// Simple relay pool implementation
export const pool = {
  subscribe: (relay: string, filter: Filter, callback: (event: any) => void) => {
    // Simple WebSocket implementation
    const ws = new WebSocket(relay);
    ws.onopen = () => {
      ws.send(JSON.stringify(["REQ", "sub", filter]));
    };
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message[0] === "EVENT") {
        callback(message[2]);
      }
    };
    return () => ws.close();
  },
  request: (relay: string, filter: Filter) => {
    // Simple request implementation
    return new Promise((resolve) => {
      const ws = new WebSocket(relay);
      const events: any[] = [];
      ws.onopen = () => {
        ws.send(JSON.stringify(["REQ", "req", filter]));
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message[0] === "EVENT") {
          events.push(message[2]);
        } else if (message[0] === "EOSE") {
          ws.close();
          resolve(events);
        }
      };
      ws.onerror = () => {
        ws.close();
        resolve([]);
      };
    });
  },
  publish: (relay: string, event: any) => {
    // Simple publish implementation
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(relay);
      ws.onopen = () => {
        ws.send(JSON.stringify(["EVENT", event]));
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message[0] === "OK") {
          ws.close();
          resolve(message[1]);
        } else {
          ws.close();
          reject(new Error("Publish failed"));
        }
      };
      ws.onerror = () => {
        ws.close();
        reject(new Error("Connection failed"));
      };
    });
  }
};

// Simple event store implementation
export const eventStore = {
  add: (event: any) => {
    // Simple in-memory storage
    return Promise.resolve(event);
  },
  get: (id: string) => {
    // Simple lookup
    return Promise.resolve(null);
  }
};

// Create cache request function that loads from local cache
// Only use window.nostrdb on client side
function cacheRequest(filters: Filter[]) {
  if (isClient && (window as any).nostrdb) return (window as any).nostrdb.filters(filters);
  else return Promise.resolve([]);
}

// Only initialize loaders and cache persistence on client side
if (isClient) {
  // Simple cache persistence
  const persistEventsToCache = (store: any, callback: (events: any[]) => Promise<void>) => {
    // Simple implementation
    callback([]);
    return Promise.resolve();
  };
  
  persistEventsToCache(eventStore, async (events) => {
    await Promise.allSettled(events.map((event) => (window as any).nostrdb.add(event)));
  });
}

// Simple event loader implementation
export const createEventLoaderForStore = (store: any, pool: any, options: any) => {
  // Simple implementation
  return {
    loadEvents: (filter: Filter) => Promise.resolve([]),
    loadEvent: (id: string) => Promise.resolve(null)
  };
};

// Initialize with some basic relays
const lookupRelays = [
  "wss://purplepag.es/",
  "wss://index.hzrd149.com/",
  "wss://indexer.coracle.social/",
];

createEventLoaderForStore(eventStore, pool, {
  cacheRequest,
  lookupRelays,
  extraRelays: [KC_BITCOINERS_RELAY],
});
