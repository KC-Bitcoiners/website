import { NostrEvent, EVENT_KINDS } from './nostr';
import { getWhitelistFilter, WHITELISTED_NPUBS } from '@/config/whitelist';
import { nip19 } from 'nostr-tools';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';

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

// Fetch calendar events from nostr relays using WebSocket
export async function fetchNostrCalendarEvents(): Promise<NostrCalendarEvent[]> {
  console.log('📅 Starting to fetch nostr calendar events...');
  
  // Use WebSocket connections to avoid CORS issues like plektos
  const relays = [
    'wss://relay.damus.io',
    'wss://relay.snort.social',
    'wss://nos.lol'
  ];

  const allEvents: NostrCalendarEvent[] = [];

  // Use whitelist filter to only get events from whitelisted users
  const filter = getWhitelistFilter();

  console.log('🎯 Using whitelist calendar events filter:', filter);
  console.log('👥 Only fetching events from whitelisted npubs:', WHITELISTED_NPUBS);

  // Try each relay and collect events, prioritizing Damus
  const primaryRelay = 'wss://relay.damus.io';
  const backupRelays = relays.filter(r => r !== primaryRelay);
  
  // First, fetch from Damus (primary relay)
  console.log(`🔌 Fetching calendar events from primary relay: ${primaryRelay}`);
  let primaryEvents: NostrCalendarEvent[] = [];
  
  try {
    const ws = new WebSocket(primaryRelay);
    
    const eventsPromise = new Promise<NostrCalendarEvent[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log(`⏰ Timeout on ${primaryRelay}`);
        ws.close();
        reject(new Error('Timeout'));
      }, 10000);

      ws.onopen = () => {
        console.log(`✅ Connected to ${primaryRelay} for calendar events`);
        
        // Send REQ message for calendar events
        const reqMessage = JSON.stringify([
          'REQ',
          'calendar-events-sub',
          filter
        ]);
        
        console.log(`📤 Sending calendar REQ to ${primaryRelay}:`, reqMessage);
        ws.send(reqMessage);
      };

      const relayEvents: NostrCalendarEvent[] = [];

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`📨 Calendar message from ${primaryRelay}:`, message);

          if (message[0] === 'EVENT') {
            const [type, subscriptionId, nostrEvent] = message;
            
            if (subscriptionId === 'calendar-events-sub') {
              console.log(`🎯 Found calendar event from ${primaryRelay}:`, nostrEvent);
              
              const calendarEvent: NostrCalendarEvent = {
                id: nostrEvent.id,
                kind: nostrEvent.kind,
                pubkey: nostrEvent.pubkey,
                tags: nostrEvent.tags || [],
                content: nostrEvent.content,
                dTag: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'd')?.[1],
                title: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'title')?.[1],
                summary: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'summary')?.[1],
                description: nostrEvent.content,
                location: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'location')?.[1],
                start: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'start')?.[1],
                end: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'end')?.[1],
                created_at: nostrEvent.created_at,
              };

              relayEvents.push(calendarEvent);
            }
          } else if (message[0] === 'EOSE') {
            console.log(`📭 End of stored calendar events from ${primaryRelay}`);
            clearTimeout(timeout);
            ws.close();
            resolve(relayEvents);
          }
        } catch (error) {
          console.error(`💥 Error parsing calendar message from ${primaryRelay}:`, error);
        }
      };

      ws.onerror = (error) => {
        console.error(`💥 WebSocket error from ${primaryRelay}:`, error);
        clearTimeout(timeout);
        reject(error);
      };

      ws.onclose = () => {
        console.log(`🔌 Closed calendar connection to ${primaryRelay}`);
        clearTimeout(timeout);
        resolve(relayEvents);
      };
    });

    primaryEvents = await eventsPromise;
    console.log(`📊 Got ${primaryEvents.length} events from primary relay`);
  } catch (error) {
    console.warn(`⚠️ Failed to fetch from primary relay ${primaryRelay}:`, error);
  }

  // Add primary events to allEvents
  for (const event of primaryEvents) {
    allEvents.push(event);
    console.log(`➕ Added primary event:`, event.title || 'No title');
  }

  // Create a set of naddrs for deduplication
  const existingNaddrs = new Set<string>();
  for (const event of primaryEvents) {
    if (event.dTag) {
      const naddr = encodeNaddr(event.kind, event.pubkey, event.dTag);
      existingNaddrs.add(naddr);
    }
  }

  console.log(`🔍 Existing naddrs from primary relay: ${existingNaddrs.size}`);

  // Now fetch from backup relays and deduplicate
  for (const relayUrl of backupRelays) {
    console.log(`🔌 Fetching calendar events from backup relay: ${relayUrl}...`);
    
    try {
      const ws = new WebSocket(relayUrl);
      
      // Create a promise that resolves when we get events
      const eventsPromise = new Promise<NostrCalendarEvent[]>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log(`⏰ Timeout on ${relayUrl}`);
          ws.close();
          reject(new Error('Timeout'));
        }, 8000); // Shorter timeout for backup relays

        ws.onopen = () => {
          console.log(`✅ Connected to ${relayUrl} for calendar events`);
          
          // Send REQ message for calendar events
          const reqMessage = JSON.stringify([
            'REQ',
            'calendar-events-sub',
            filter
          ]);
          
          console.log(`📤 Sending calendar REQ to ${relayUrl}:`, reqMessage);
          ws.send(reqMessage);
        };

        const relayEvents: NostrCalendarEvent[] = [];

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log(`📨 Calendar message from ${relayUrl}:`, message);

            if (message[0] === 'EVENT') {
              const [type, subscriptionId, nostrEvent] = message;
              
              if (subscriptionId === 'calendar-events-sub') {
                console.log(`🎯 Found calendar event from ${relayUrl}:`, nostrEvent);
                
                const calendarEvent: NostrCalendarEvent = {
                  id: nostrEvent.id,
                  kind: nostrEvent.kind,
                  pubkey: nostrEvent.pubkey,
                  tags: nostrEvent.tags || [],
                  content: nostrEvent.content,
                  dTag: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'd')?.[1],
                  title: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'title')?.[1],
                  summary: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'summary')?.[1],
                  description: nostrEvent.content,
                  location: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'location')?.[1],
                  start: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'start')?.[1],
                  end: nostrEvent.tags?.find((tag: string[]) => tag[0] === 'end')?.[1],
                  created_at: nostrEvent.created_at,
                };

                relayEvents.push(calendarEvent);
              }
            } else if (message[0] === 'EOSE') {
              console.log(`📭 End of stored calendar events from ${relayUrl}`);
              clearTimeout(timeout);
              ws.close();
              resolve(relayEvents);
            }
          } catch (error) {
            console.error(`💥 Error parsing calendar message from ${relayUrl}:`, error);
          }
        };

        ws.onerror = (error) => {
          console.error(`💥 WebSocket error from ${relayUrl}:`, error);
          clearTimeout(timeout);
          reject(error);
        };

        ws.onclose = () => {
          console.log(`🔌 Closed calendar connection to ${relayUrl}`);
          clearTimeout(timeout);
          resolve(relayEvents);
        };
      });

      // Wait for events or timeout
      const relayEvents = await eventsPromise;
      
      // Add events from this relay, deduplicating by naddr
      for (const event of relayEvents) {
        if (event.dTag) {
          const naddr = encodeNaddr(event.kind, event.pubkey, event.dTag);
          
          if (!existingNaddrs.has(naddr)) {
            allEvents.push(event);
            existingNaddrs.add(naddr);
            console.log(`➕ Added backup event from ${relayUrl}:`, event.title || 'No title');
          } else {
            console.log(`🔁 Duplicate event skipped by naddr:`, event.title || 'No title');
          }
        } else {
          // For events without dTag, use old method as fallback
          const exists = allEvents.some(e => 
            e.dTag === event.dTag && 
            e.pubkey === event.pubkey && 
            e.kind === event.kind
          );

          if (!exists) {
            allEvents.push(event);
            console.log(`➕ Added backup event (no dTag) from ${relayUrl}:`, event.title || 'No title');
          } else {
            console.log(`🔁 Duplicate event skipped (no dTag):`, event.title || 'No title');
          }
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ Failed to fetch calendar events from ${relayUrl}:`, error);
      // Continue to next relay
    }
  }

  console.log(`📊 Total calendar events fetched: ${allEvents.length}`);
  console.log(`📅 Calendar events summary:`, allEvents.map(e => ({ 
    id: e.id, 
    kind: e.kind, 
    title: e.title,
    start: e.start 
  })));

  // Sort events by creation time (newest first)
  return allEvents.sort((a, b) => b.created_at - a.created_at);
}

// Convert nostr calendar events to the app's CalendarEvent format
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
    title: event.title || event.summary || 'Untitled Event',
    summary: event.summary || event.title || 'Untitled Event',
    description: event.description,
    location: event.location,
    locations: event.location ? [event.location] : [],
    start: startTime?.toString(),
    end: endTime?.toString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    image: event.tags?.find((tag: string[]) => tag[0] === 'image')?.[1],
            hashtags: event.tags?.filter((tag: string[]) => tag[0] === 't').map(tag => tag[1]) || [],
    references: event.tags?.filter((tag: string[]) => tag[0] === 'e').map(tag => tag[1]) || [],
    created_at: event.created_at,
  };
}

// Filter events for calendar view
export function filterEventsForTimeRange(events: NostrCalendarEvent[], startDate: Date, endDate: Date) {
  return events.filter(event => {
    if (!event.start) return false;
    
    const eventStart = new Date(parseInt(event.start) * 1000);
    
    // Include event if it overlaps with the time range
    return eventStart <= endDate && (!event.end || new Date(parseInt(event.end) * 1000) >= startDate);
  });
}

// Get upcoming events
export function getUpcomingNostrEvents(events: NostrCalendarEvent[]) {
  const now = new Date();
  return events.filter(event => {
    if (!event.start) return false;
    const eventStart = new Date(parseInt(event.start) * 1000);
    return eventStart >= now;
  });
}

// Get past events
export function getPastNostrEvents(events: NostrCalendarEvent[]) {
  const now = new Date();
  return events.filter(event => {
    if (!event.start) return false;
    const eventStart = new Date(parseInt(event.start) * 1000);
    return eventStart < now;
  });
}

// Generate naddr for a nostr event using proper nostr-tools encoding
export function generateNaddr(event: NostrCalendarEvent): string {
  return encodeNaddr(event.kind, event.pubkey, event.dTag || '');
}

// Proper naddr encoding using nostr-tools library
export function encodeNaddr(kind: number, pubkey: string, identifier: string): string {
  try {
    // Ensure pubkey is a valid 64-character hex string (32 bytes)
    let cleanPubkey = pubkey;
    
    // If pubkey starts with '0x', remove it
    if (cleanPubkey.startsWith('0x')) {
      cleanPubkey = cleanPubkey.slice(2);
    }
    
    // If pubkey is 65 characters (might have extra character), trim it
    if (cleanPubkey.length === 65) {
      cleanPubkey = cleanPubkey.slice(0, 64);
    }
    
    // If pubkey is shorter than 64 characters, pad it (though this shouldn't happen with valid keys)
    if (cleanPubkey.length < 64) {
      cleanPubkey = cleanPubkey.padStart(64, '0');
    }
    
    // Validate hex format
    if (!/^[0-9a-fA-F]{64}$/.test(cleanPubkey)) {
      throw new Error(`Invalid pubkey format: ${cleanPubkey}. Expected 64-character hex string.`);
    }
    
    console.log(`🔧 Cleaned pubkey for naddr: ${cleanPubkey} (original: ${pubkey})`);
    
    const addr = {
      kind: kind,
      pubkey: cleanPubkey,
      identifier: identifier,
    };
    
    const naddr = nip19.naddrEncode(addr);
    console.log(`✅ Generated naddr: ${naddr}`);
    return naddr;
  } catch (error) {
    console.error('Error encoding naddr:', error);
    console.error('Details:', { kind, pubkey, identifier });
    
    // Fallback to simple encoding if nostr-tools fails
    try {
      const fallback = `naddr1${btoa(`${kind}:${pubkey}:${identifier}`).replace(/\+/g, '-').replace(/\//g, '').replace(/=/g, '')}`;
      console.log('Using fallback naddr:', fallback);
      return fallback;
    } catch (fallbackError) {
      console.error('Fallback encoding also failed:', fallbackError);
      // Return a basic identifier as last resort
      return `event-${identifier}`;
    }
  }
}

// Publish a calendar event to nostr relays
export async function publishNostrEvent(
  formData: any,
  privateKey?: string,
  pubkey?: string
): Promise<{ success: boolean; eventId?: string; naddr?: string; error?: string }> {
  try {
    console.log('🚀 Publishing event to nostr:', formData);
    
    // Generate a unique identifier for the event
    const dTag = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Use the provided pubkey for naddr generation
    const userPubkey = pubkey || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0';
    
    // Convert EventFormData to nostr event format
    const tags: string[][] = [];
    
    // Add required tags
    tags.push(['d', dTag]); // Unique identifier
    tags.push(['title', formData.title]);
    
    if (formData.summary) {
      tags.push(['summary', formData.summary]);
    }
    
    if (formData.locations && formData.locations.length > 0) {
      formData.locations.forEach((location: string) => {
        tags.push(['location', location]);
      });
    }
    
    if (formData.hashtags && formData.hashtags.length > 0) {
      formData.hashtags.forEach((tag: string) => {
        tags.push(['t', tag]);
      });
    }
    
    if (formData.references && formData.references.length > 0) {
      formData.references.forEach((ref: string) => {
        if (ref.startsWith('http')) {
          tags.push(['r', ref]);
        }
      });
    }
    
    if (formData.image) {
      tags.push(['image', formData.image]);
    }
    
    // Add time-based tags
    if (formData.eventType === 'all-day') {
      // All-day event (kind 31922)
      tags.push(['start', Math.floor(new Date(formData.startDate).getTime() / 1000).toString()]);
      if (formData.endDate) {
        tags.push(['end', Math.floor(new Date(formData.endDate + 'T23:59:59').getTime() / 1000).toString()]);
      }
    } else {
      // Timed event (kind 31923)
      if (formData.startDate && formData.startTime) {
        const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
        tags.push(['start', Math.floor(startDateTime.getTime() / 1000).toString()]);
      }
      if (formData.endDate && formData.endTime) {
        const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
        tags.push(['end', Math.floor(endDateTime.getTime() / 1000).toString()]);
      }
    }
    
    // Create the nostr event
    const kind = formData.eventType === 'all-day' ? 31922 : 31923;
    const created_at = Math.floor(Date.now() / 1000);
    
    const event = {
      kind: kind,
      created_at: created_at,
      tags: tags,
      content: formData.description || formData.title,
    };
    
    console.log('📝 Created nostr event:', event);
    
    // Generate naddr for the event
    const naddr = encodeNaddr(kind, userPubkey, dTag);
    console.log('🔗 Generated naddr:', naddr);
    
    // Actually publish to relays using WebSocket connections
    const relays = [
      'wss://relay.damus.io',
      'wss://relay.snort.social',
      'wss://nos.lol'
    ];
    
    console.log('📡 Publishing to relays:', relays);
    console.log('📝 Event data:', event);
    
    let publishSuccess = false;
    let publishedEventId = '';
    const publishPromises: Promise<void>[] = [];
    
    // Publish to each relay
    for (const relayUrl of relays) {
      const publishPromise = new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(relayUrl);
        const timeout = setTimeout(() => {
          console.log(`⏰ Publish timeout on ${relayUrl}`);
          ws.close();
          reject(new Error('Publish timeout'));
        }, 10000);
        
        ws.onopen = async () => {
          console.log(`✅ Connected to ${relayUrl} for publishing`);
          
          // Create a properly signed event
          let signedEvent;
          
          if (window.nostr && pubkey) {
            // Use Nostr extension for signing
            console.log(`🔑 Using Nostr extension for signing with pubkey: ${pubkey}`);
            const eventForExtension = {
              ...event,
              pubkey: pubkey
            };
            signedEvent = await window.nostr.signEvent(eventForExtension);
            console.log(`✅ Event signed with extension:`, signedEvent.id);
          } else if (privateKey === 'mock-private-key-for-demo') {
            // For demo purposes, generate a temporary key pair
            const tempSecretKey = generateSecretKey();
            const tempPubkey = getPublicKey(tempSecretKey);
            
            signedEvent = finalizeEvent(event, tempSecretKey);
            console.log(`🔑 Generated temporary keypair for demo:`, {
              pubkey: tempPubkey,
              eventId: signedEvent.id
            });
          } else if (privateKey) {
            // Use provided private key for signing
            // Convert hex string to Uint8Array for nostr-tools
            let privateKeyBytes: Uint8Array;
            
            // Check if it's an nsec
            if (privateKey.startsWith('nsec')) {
              const { type, data } = nip19.decode(privateKey);
              if (type === 'nsec') {
                privateKeyBytes = data as Uint8Array;
              } else {
                throw new Error('Invalid nsec format');
              }
            } else {
              // Convert hex string to Uint8Array
              const cleanHex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
              if (cleanHex.length !== 64) {
                throw new Error('Private key must be 64 hex characters (32 bytes)');
              }
              privateKeyBytes = new Uint8Array(
                cleanHex.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []
              );
            }
            
            signedEvent = finalizeEvent(event, privateKeyBytes);
          } else {
            throw new Error('No private key or extension available for signing');
          }
          
          console.log(`📤 Publishing event to ${relayUrl}:`, signedEvent);
          
          // Send EVENT message
          const publishMessage = JSON.stringify(['EVENT', signedEvent]);
          ws.send(publishMessage);
        };
        
        ws.onmessage = (message) => {
          try {
            const response = JSON.parse(message.data);
            console.log(`📨 Publish response from ${relayUrl}:`, response);
            
            if (response[0] === 'OK') {
              const [, eventId, success, message] = response;
              if (success && eventId) {
                console.log(`✅ Successfully published to ${relayUrl}:`, eventId);
                if (!publishedEventId) {
                  publishedEventId = eventId;
                }
                publishSuccess = true;
                clearTimeout(timeout);
                ws.close();
                resolve();
              } else {
                console.warn(`❌ Publish failed on ${relayUrl}:`, message);
                clearTimeout(timeout);
                ws.close();
                reject(new Error(message || 'Publish failed'));
              }
            }
          } catch (error) {
            console.error(`💥 Error parsing publish response from ${relayUrl}:`, error);
          }
        };
        
        ws.onerror = (error) => {
          console.error(`💥 WebSocket error from ${relayUrl}:`, error);
          clearTimeout(timeout);
          reject(error);
        };
        
        ws.onclose = () => {
          console.log(`🔌 Closed publish connection to ${relayUrl}`);
          clearTimeout(timeout);
          if (!publishSuccess) {
            reject(new Error('Connection closed without successful publish'));
          }
        };
      });
      
      publishPromises.push(publishPromise);
    }
    
    try {
      // Wait for at least one successful publish
      await Promise.race([
        Promise.any(publishPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('All publishes timed out')), 15000))
      ]);
      
      if (publishSuccess && publishedEventId) {
        console.log('✅ Event successfully published to at least one relay!');
        console.log(`  🆔 Event ID: ${publishedEventId}`);
        console.log(`  🔗 Naddr: ${naddr}`);
        console.log(`  📅 Kind: ${kind} (${formData.eventType})`);
        console.log(`  🏷️  D-Tag: ${dTag}`);
        console.log(`  👤 Pubkey: ${userPubkey}`);
        
        return {
          success: true,
          eventId: publishedEventId,
          naddr: naddr
        };
      } else {
        throw new Error('Failed to publish to any relay');
      }
    } catch (error) {
      console.error('💥 All publish attempts failed:', error);
      
      // Check if we got partial success
      if (publishSuccess && publishedEventId) {
        console.log('⚠️ Partial success - event published to some relays');
        return {
          success: true,
          eventId: publishedEventId,
          naddr: naddr
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish to relays'
      };
    }
    
  } catch (error) {
    console.error('💥 Error publishing nostr event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
