// Client and server side utilities for Nostr
import { EventStore } from "applesauce-core/event-store";
import { Filter, persistEventsToCache } from "applesauce-core/helpers";
import { createEventLoaderForStore } from "applesauce-loaders/loaders";
import { RelayPool } from "applesauce-relay/pool";
import { KC_BITCOINERS_RELAY } from "../config/const";

// Check if we're on the client side
const isClient = typeof window !== "undefined";

// Conditionally import window.nostrdb.js only on the client
if (isClient) {
  try {
    // window.nostrdb.js auto connects to a local nostr event cache for the browser
    await import("window.nostrdb.js");
  } catch (error) {}
}

export const pool = new RelayPool();
export const eventStore = new EventStore();

// Create cache request function that loads from local cache
// Only use window.nostrdb on the client side
function cacheRequest(filters: Filter[]) {
  if (isClient && window.nostrdb) return window.nostrdb.filters(filters);
  else return Promise.resolve([]);
}

// Only initialize loaders and cache persistence on the client side
if (isClient) {
  // Save all new events to the local cache
  persistEventsToCache(eventStore, (events) => {
    return Promise.allSettled(events.map((event) => window.nostrdb.add(event)));
  });
}

// Create loaders for the event store so profiles can be loaded
createEventLoaderForStore(eventStore, pool, {
  cacheRequest,
  lookupRelays: [
    "wss://purplepag.es/",
    "wss://index.hzrd149.com/",
    "wss://indexer.coracle.social/",
  ],
  extraRelays: [KC_BITCOINERS_RELAY],
});
