import { nip19 } from "nostr-tools";

export interface VendorData {
  name: string;
  category: string;
  lightning: string;
  onchain: string;
  lightningAddress?: string;
  onchainAddress?: string;
  notes: string;
  contact: string;
  address: string;
  website?: string;
  phone?: string;
  submittedBy: string;
  submittedAt: string;
}

export interface VendorAttestation {
  id: string;
  kind: number;
  pubkey: string;
  tags: string[][];
  content: string;
  created_at: number;
  dTag?: string;
  vendorData?: VendorData;
}

// Generate naddr for a vendor event using proper nostr-tools encoding
export function generateVendorNaddr(
  kind: number,
  pubkey: string,
  identifier: string,
): string {
  try {
    // Ensure pubkey is a valid 64-character hex string (32 bytes)
    let cleanPubkey = pubkey;

    // If pubkey starts with '0x', remove it
    if (cleanPubkey.startsWith("0x")) {
      cleanPubkey = cleanPubkey.slice(2);
    }

    // If pubkey is 65 characters (might have extra character), trim it
    if (cleanPubkey.length === 65) {
      cleanPubkey = cleanPubkey.slice(0, 64);
    }

    // If pubkey is shorter than 64 characters, pad it (though this shouldn't happen with valid keys)
    if (cleanPubkey.length < 64) {
      cleanPubkey = cleanPubkey.padStart(64, "0");
    }

    // Validate hex format
    if (!/^[0-9a-fA-F]{64}$/.test(cleanPubkey)) {
      throw new Error(
        `Invalid pubkey format: ${cleanPubkey}. Expected 64-character hex string.`,
      );
    }

    console.log(
      `🔧 Cleaned pubkey for vendor naddr: ${cleanPubkey} (original: ${pubkey})`,
    );

    const addr = {
      kind: kind,
      pubkey: cleanPubkey,
      identifier: identifier,
    };

    const naddr = nip19.naddrEncode(addr);
    console.log(`✅ Generated vendor naddr: ${naddr}`);
    return naddr;
  } catch (error) {
    console.error("Error encoding vendor naddr:", error);
    console.error("Details:", { kind, pubkey, identifier });

    // Fallback to simple encoding if nostr-tools fails
    try {
      const fallback = `naddr1${btoa(`${kind}:${pubkey}:${identifier}`).replace(/\+/g, "-").replace(/\//g, "").replace(/=/g, "")}`;
      console.log("Using fallback vendor naddr:", fallback);
      return fallback;
    } catch (fallbackError) {
      console.error(
        "Fallback vendor naddr encoding also failed:",
        fallbackError,
      );
      // Return a basic identifier as last resort
      return `vendor-${identifier}`;
    }
  }
}

// Fetch vendor attestations from nostr relays
export async function fetchVendorAttestations(): Promise<VendorAttestation[]> {
  console.log("🏪 Starting to fetch vendor attestations...");

  // Use WebSocket connections to avoid CORS issues
  const relays = [
    "wss://relay.damus.io",
    "wss://relay.snort.social",
    "wss://nos.lol",
  ];

  const allEvents: VendorAttestation[] = [];

  // Filter for vendor attestations (kind 30023 with vendor tags)
  const filter = {
    kinds: [30023],
    "#t": ["vendor"],
    limit: 100,
  };

  console.log("🎯 Using vendor attestation filter:", filter);

  // Try each relay and collect events, prioritizing Damus
  const primaryRelay = "wss://relay.damus.io";
  const backupRelays = relays.filter((r) => r !== primaryRelay);

  // First, fetch from Damus (primary relay)
  console.log(
    `🔌 Fetching vendor attestations from primary relay: ${primaryRelay}`,
  );
  let primaryEvents: VendorAttestation[] = [];

  try {
    const ws = new WebSocket(primaryRelay);

    const eventsPromise = new Promise<VendorAttestation[]>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log(`⏰ Timeout on ${primaryRelay}`);
          ws.close();
          reject(new Error("Timeout"));
        }, 10000);

        ws.onopen = () => {
          console.log(
            `✅ Connected to ${primaryRelay} for vendor attestations`,
          );

          // Send REQ message for vendor attestations
          const reqMessage = JSON.stringify([
            "REQ",
            "vendor-attestations-sub",
            filter,
          ]);

          console.log(`📤 Sending vendor REQ to ${primaryRelay}:`, reqMessage);
          ws.send(reqMessage);
        };

        const relayEvents: VendorAttestation[] = [];

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log(
              `📨 Vendor attestation message from ${primaryRelay}:`,
              message,
            );

            if (message[0] === "EVENT") {
              const [type, subscriptionId, nostrEvent] = message;

              if (subscriptionId === "vendor-attestations-sub") {
                console.log(
                  `🎯 Found vendor attestation from ${primaryRelay}:`,
                  nostrEvent,
                );

                const vendorAttestation: VendorAttestation = {
                  id: nostrEvent.id,
                  kind: nostrEvent.kind,
                  pubkey: nostrEvent.pubkey,
                  tags: nostrEvent.tags || [],
                  content: nostrEvent.content,
                  dTag: nostrEvent.tags?.find(
                    (tag: string[]) => tag[0] === "d",
                  )?.[1],
                  created_at: nostrEvent.created_at,
                };

                // Parse vendor data from content
                try {
                  const vendorData = JSON.parse(
                    nostrEvent.content,
                  ) as VendorData;
                  vendorAttestation.vendorData = vendorData;
                } catch (parseError) {
                  console.warn(
                    "Failed to parse vendor data content:",
                    parseError,
                  );
                }

                relayEvents.push(vendorAttestation);
              }
            } else if (message[0] === "EOSE") {
              console.log(
                `📭 End of stored vendor attestations from ${primaryRelay}`,
              );
              clearTimeout(timeout);
              ws.close();
              resolve(relayEvents);
            }
          } catch (error) {
            console.error(
              `💥 Error parsing vendor attestation message from ${primaryRelay}:`,
              error,
            );
          }
        };

        ws.onerror = (error) => {
          console.error(`💥 WebSocket error from ${primaryRelay}:`, error);
          clearTimeout(timeout);
          reject(error);
        };

        ws.onclose = () => {
          console.log(
            `🔌 Closed vendor attestation connection to ${primaryRelay}`,
          );
          clearTimeout(timeout);
          resolve(relayEvents);
        };
      },
    );

    primaryEvents = await eventsPromise;
    console.log(
      `📊 Got ${primaryEvents.length} vendor attestations from primary relay`,
    );
  } catch (error) {
    console.warn(
      `⚠️ Failed to fetch vendor attestations from primary relay ${primaryRelay}:`,
      error,
    );
  }

  // Add primary events to allEvents
  for (const event of primaryEvents) {
    allEvents.push(event);
    console.log(
      `➕ Added primary vendor attestation:`,
      event.vendorData?.name || "No name",
    );
  }

  // Create a set of naddrs for deduplication
  const existingNaddrs = new Set<string>();
  for (const event of primaryEvents) {
    if (event.dTag) {
      const naddr = generateVendorNaddr(event.kind, event.pubkey, event.dTag);
      existingNaddrs.add(naddr);
    }
  }

  console.log(
    `🔍 Existing vendor naddrs from primary relay: ${existingNaddrs.size}`,
  );

  // Now fetch from backup relays and deduplicate
  for (const relayUrl of backupRelays) {
    console.log(
      `🔌 Fetching vendor attestations from backup relay: ${relayUrl}...`,
    );

    try {
      const ws = new WebSocket(relayUrl);

      const eventsPromise = new Promise<VendorAttestation[]>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log(`⏰ Timeout on ${relayUrl}`);
            ws.close();
            reject(new Error("Timeout"));
          }, 8000);

          ws.onopen = () => {
            console.log(`✅ Connected to ${relayUrl} for vendor attestations`);

            const reqMessage = JSON.stringify([
              "REQ",
              "vendor-attestations-sub",
              filter,
            ]);

            console.log(`📤 Sending vendor REQ to ${relayUrl}:`, reqMessage);
            ws.send(reqMessage);
          };

          const relayEvents: VendorAttestation[] = [];

          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              console.log(
                `📨 Vendor attestation message from ${relayUrl}:`,
                message,
              );

              if (message[0] === "EVENT") {
                const [type, subscriptionId, nostrEvent] = message;

                if (subscriptionId === "vendor-attestations-sub") {
                  console.log(
                    `🎯 Found vendor attestation from ${relayUrl}:`,
                    nostrEvent,
                  );

                  const vendorAttestation: VendorAttestation = {
                    id: nostrEvent.id,
                    kind: nostrEvent.kind,
                    pubkey: nostrEvent.pubkey,
                    tags: nostrEvent.tags || [],
                    content: nostrEvent.content,
                    dTag: nostrEvent.tags?.find(
                      (tag: string[]) => tag[0] === "d",
                    )?.[1],
                    created_at: nostrEvent.created_at,
                  };

                  // Parse vendor data from content
                  try {
                    const vendorData = JSON.parse(
                      nostrEvent.content,
                    ) as VendorData;
                    vendorAttestation.vendorData = vendorData;
                  } catch (parseError) {
                    console.warn(
                      "Failed to parse vendor data content:",
                      parseError,
                    );
                  }

                  relayEvents.push(vendorAttestation);
                }
              } else if (message[0] === "EOSE") {
                console.log(
                  `📭 End of stored vendor attestations from ${relayUrl}`,
                );
                clearTimeout(timeout);
                ws.close();
                resolve(relayEvents);
              }
            } catch (error) {
              console.error(
                `💥 Error parsing vendor attestation message from ${relayUrl}:`,
                error,
              );
            }
          };

          ws.onerror = (error) => {
            console.error(`💥 WebSocket error from ${relayUrl}:`, error);
            clearTimeout(timeout);
            reject(error);
          };

          ws.onclose = () => {
            console.log(
              `🔌 Closed vendor attestation connection to ${relayUrl}`,
            );
            clearTimeout(timeout);
            resolve(relayEvents);
          };
        },
      );

      const relayEvents = await eventsPromise;

      // Add events from this relay, deduplicating by naddr
      for (const event of relayEvents) {
        if (event.dTag) {
          const naddr = generateVendorNaddr(
            event.kind,
            event.pubkey,
            event.dTag,
          );

          if (!existingNaddrs.has(naddr)) {
            allEvents.push(event);
            existingNaddrs.add(naddr);
            console.log(
              `➕ Added backup vendor attestation from ${relayUrl}:`,
              event.vendorData?.name || "No name",
            );
          } else {
            console.log(
              `🔁 Duplicate vendor attestation skipped by naddr:`,
              event.vendorData?.name || "No name",
            );
          }
        } else {
          // For events without dTag, use old method as fallback
          const exists = allEvents.some(
            (e) =>
              e.dTag === event.dTag &&
              e.pubkey === event.pubkey &&
              e.kind === event.kind,
          );

          if (!exists) {
            allEvents.push(event);
            console.log(
              `➕ Added backup vendor attestation (no dTag) from ${relayUrl}:`,
              event.vendorData?.name || "No name",
            );
          } else {
            console.log(
              `🔁 Duplicate vendor attestation skipped (no dTag):`,
              event.vendorData?.name || "No name",
            );
          }
        }
      }
    } catch (error) {
      console.warn(
        `⚠️ Failed to fetch vendor attestations from ${relayUrl}:`,
        error,
      );
    }
  }

  console.log(`📊 Total vendor attestations fetched: ${allEvents.length}`);
  console.log(
    `🏪 Vendor attestations summary:`,
    allEvents.map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.vendorData?.name,
      category: e.vendorData?.category,
    })),
  );

  // Sort events by creation time (newest first)
  return allEvents.sort((a, b) => b.created_at - a.created_at);
}

// Convert vendor attestations to shop item format for display
export function convertVendorAttestationToShopItem(
  attestation: VendorAttestation,
): ShopItem | null {
  if (!attestation.vendorData) {
    return null;
  }

  const vendor = attestation.vendorData;

  return {
    Category: vendor.category,
    Vendor: vendor.name,
    Lightning: vendor.lightning,
    "On-Chain": vendor.onchain,
    Notes: vendor.notes,
    Contact: vendor.contact,
  };
}

// Add ShopItem interface for compatibility
interface ShopItem {
  Category: string;
  Vendor: string;
  Lightning: string;
  "On-Chain": string;
  Notes: string;
  Contact: string;
}
