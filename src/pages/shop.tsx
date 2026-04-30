import { logger } from "@/utils/logger";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import VendorForm from "@/components/VendorForm";
import EventActions from "@/components/EventActions";
import { useNostr } from "@/contexts/NostrContext";
import { fetchBTCMapVendors, BTCMapVendor } from "@/utils/btcmap";
import { pool } from "@/lib/nostr";
import { config, nostrRelays, getWhitelistFilter, siteConfig } from "@/config";
import { fetchZapTotal } from "@/utils/zaps";
import type { Icon, LatLngBounds, DivIcon } from "leaflet";
import { getEventHash, type NostrEvent } from "applesauce-core/helpers/event";
import ListingCard from "@/components/ListingCard";
import ListingForm from "@/components/ListingForm";
import ListingDetailModal from "@/components/ListingDetailModal";
import CartBadge from "@/components/CartBadge";
import ZapModal from "@/components/ZapModal";
import { CartProvider, useCart } from "@/contexts/CartContext";
import type { CartItem } from "@/contexts/CartContext";

/** Extended cart item with converted sats total for checkout */
interface CheckoutItem extends CartItem {
  satsTotal: number;
}
import { fiatToSats } from "@/utils/prices";
import { sendOrderDM } from "@/utils/orderDM";
import { nsecDecode } from "@/utils/bech32";
import {
  fetchClassifiedListings,
} from "@/utils/classifiedEvents";
import type { ClassifiedListing } from "@/types/classifieds";

// Relay configuration for Nostr operations
const RELAYS = nostrRelays;

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);

const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});

// Import Leaflet components only on client side
let LeafletIcon: typeof Icon | null = null;
let LeafletLatLngBounds: typeof LatLngBounds | null = null;
let LeafletDivIcon: typeof DivIcon | null = null;

interface NostrVendor {
  id: string;
  name: string;
  category: string;
  lightning: boolean;
  onchain: boolean;
  lightningAddress?: string;
  onchainAddress?: string;
  address: string;
  lat?: number;
  lon?: number;
  email?: string;
  twitter?: string;
  phone?: string;
  website?: string;
  description?: string;
  openingHours?: string;
  images?: string[];
  npub: string;
  eventId: string;
  createdAt: number;
  dTag: string; // Store the dTag for replaceable events
  // For submitter profile info
  submitterName?: string;
  submitterPicture?: string;
  rawEvent?: Record<string, unknown>;
}

type SortField = keyof NostrVendor | "submitterName" | "zaps";
type SortDirection = "asc" | "desc";

export default function ShopPage() {
  return (
    <CartProvider>
      <ShopContent />
    </CartProvider>
  );
}

function ShopContent() {
  const { user, signEvent } = useNostr();
  const { addToCart, isInCart } = useCart();
  const [view, setView] = useState<"vendors" | "listings">("listings");
  const [sortField, setSortField] = useState<SortField>("zaps");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filters, setFilters] = useState<Record<string, string>>({
    name: "",
    category: "",
    submitterName: "",
  });
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<{
    eventId: string;
    naddr: string;
  } | null>(null);
  const [editVendor, setEditVendor] = useState<NostrVendor | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const vendorCardRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // Zap totals for sorting vendors
  const [vendorZapTotals, setVendorZapTotals] = useState<Record<string, number>>({});

  // Nostr vendors state
  const [nostrVendors, setNostrVendors] = useState<NostrVendor[]>([]);
  const [isLoadingNostr, setIsLoadingNostr] = useState(false);
  const [nostrError, setNostrError] = useState<string | null>(null);

  // BTCMap vendors state
  const [btcMapVendors, setBTCMapVendors] = useState<BTCMapVendor[]>([]);
  const [isLoadingBTCMap, setIsLoadingBTCMap] = useState(false);
  const [btcMapError, setBTCMapError] = useState<string | null>(null);

  // Classified listings state
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [showListingForm, setShowListingForm] = useState(false);
  const [editListing, setEditListing] = useState<ClassifiedListing | null>(null);
  const [isEditListing, setIsEditListing] = useState(false);
  const [listingSuccess, setListingSuccess] = useState<{
    eventId: string;
    naddr: string;
  } | null>(null);
  const [selectedListing, setSelectedListing] = useState<ClassifiedListing | null>(null);

  // Buy Now — zap target for instant purchase
  const [zapTarget, setZapTarget] = useState<{
    pubkey: string;
    eventId: string;
    amount: number;
  } | null>(null);

  // Cart checkout queue — items to zap sequentially
  const [checkoutQueue, setCheckoutQueue] = useState<CheckoutItem[]>([]);
  const { items: cartItems, removeFromCart } = useCart();

  /** Start cart checkout: convert prices to sats and queue items */
  const handleCheckout = useCallback(async () => {
    if (cartItems.length === 0) return;
    const queue: CheckoutItem[] = [];
    for (const item of cartItems) {
      if (!item.price) continue; // skip free items
      const sats = await fiatToSats(
        parseFloat(item.price.amount) * item.quantity,
        item.price.currency,
      );
      queue.push({ ...item, satsTotal: sats });
    }
    setCheckoutQueue(queue);
  }, [cartItems]);

  // When checkout queue has items and no active zap, start the first one
  useEffect(() => {
    if (checkoutQueue.length > 0 && !zapTarget) {
      const next = checkoutQueue[0];
      setZapTarget({
        pubkey: next.pubkey,
        eventId: next.listingId,
        amount: next.satsTotal,
      });
    }
  }, [checkoutQueue, zapTarget]);

  /** After a zap is confirmed during checkout, advance the queue */
  const handleCheckoutZapConfirmed = useCallback(() => {
    if (checkoutQueue.length > 0) {
      const paidItem = checkoutQueue[0];
      // Send order DM to seller
      if (user?.pubkey) {
        const listing = listings.find((l) => l.id === paidItem.listingId);
        if (listing) {
          const buyerPrivkeyHex = user.privateKey ? nsecDecode(user.privateKey) : undefined;
          sendOrderDM({
            sellerPubkey: paidItem.pubkey,
            buyerPubkey: user.pubkey,
            listingTitle: paidItem.title,
            listingCoordinate: `30402:${paidItem.pubkey}:${listings.find((l) => l.id === paidItem.listingId)?.dTag || ""}`,
            amountSats: paidItem.satsTotal,
            buyerPrivkeyHex,
          });
        }
      }
      // Remove paid item from cart and queue
      removeFromCart(paidItem.listingId);
      const remaining = checkoutQueue.slice(1);
      setCheckoutQueue(remaining);
      setZapTarget(null);
    }
  }, [checkoutQueue, removeFromCart, listings, user?.pubkey]);

  /** Cancel checkout — clear queue and zap target */
  const handleCheckoutCancel = useCallback(() => {
    // Remove just the current item from queue, try next
    if (checkoutQueue.length > 0) {
      const remaining = checkoutQueue.slice(1);
      setCheckoutQueue(remaining);
      setZapTarget(null);
    } else {
      setZapTarget(null);
    }
  }, [checkoutQueue]);

  // Classifieds filter/sort state
  const [listingSearch, setListingSearch] = useState("");
  const [listingCategory, setListingCategory] = useState("");
  const [listingSeller, setListingSeller] = useState("");
  const [listingStatus, setListingStatus] = useState<"all" | "active" | "sold">("all");
  const [listingSort, setListingSort] = useState<"newest" | "oldest" | "price_low" | "price_high" | "zaps">("newest");
  const [listingZapTotals, setListingZapTotals] = useState<Record<string, number>>({});
  // Profile info for listing authors: pubkey → {name, picture}
  const [listingProfiles, setListingProfiles] = useState<Record<string, { name?: string; picture?: string }>>({});

  // Fetch zap totals for Nostr vendors when they load
  useEffect(() => {
    if (nostrVendors.length === 0) return;
    let cancelled = false;
    const totals: Record<string, number> = {};
    Promise.all(
      nostrVendors.map((v) =>
        fetchZapTotal(v.id, v.rawEvent?.pubkey as string | undefined).then((t) => { if (t > 0) totals[v.id] = t; }),
      ),
    ).then(() => { if (!cancelled) setVendorZapTotals(totals); });
    return () => { cancelled = true; };
  }, [nostrVendors]);

  // Fetch vendor profile info
  const fetchSubmitterProfile = async (
    npub: string,
  ): Promise<{ name?: string; picture?: string }> => {
    try {
      const relays = nostrRelays;

      const filter = {
        kinds: [0], // Metadata event
        authors: [npub],
      };

      const eventsPromise = new Promise<NostrEvent[]>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Request timeout"));
        }, 10000); // 10 second timeout

        const events: NostrEvent[] = [];

        pool.request(relays, filter).subscribe({
          next: (event: NostrEvent) => {
            events.push(event);
          },
          error: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          complete: () => {
            clearTimeout(timeout);
            resolve(events);
          },
        });
      });

      const events = await eventsPromise;
      if (events.length > 0) {
        const metadata = JSON.parse(events[0].content);
        return {
          name: metadata.name,
          picture: metadata.picture,
        };
      }
    } catch (error) {
      logger.warn(`Failed to fetch profile for ${npub}`, error);
    }
    return {};
  };

  // Fetch nostr vendors on component mount and when success message changes
  useEffect(() => {
    const fetchNostrVendors = async () => {
      setIsLoadingNostr(true);
      setNostrError(null);

      try {
        const relays = nostrRelays;

        // Use whitelist filter to only get events from whitelisted users
        const whitelistFilter = getWhitelistFilter();

        // Modify the whitelist filter for vendor events (kind 30333 instead of calendar kinds)
        const filter = {
          ...whitelistFilter,
          kinds: [30333], // Custom Bitcoin Vendor Directory kind
          limit: 100,
        };

        const eventsPromise = new Promise<NostrEvent[]>((resolve, reject) => {
          const timeout = setTimeout(() => {
            logger.debug(`⏰ Request timeout`);
            reject(new Error("Request timeout"));
          }, 30000); // 30 second timeout for all relays

          const events: NostrEvent[] = [];

          pool.request(relays, filter).subscribe({
            next: (event: NostrEvent) => {
              events.push(event);
            },
            error: (error) => {
              logger.error(`💥 Error fetching vendor events:`, error);
              clearTimeout(timeout);
              reject(error);
            },
            complete: () => {
              logger.debug(`📭 End of stored vendor events`);
              clearTimeout(timeout);
              resolve(events);
            },
          });
        });

        const events = await eventsPromise;
        console.log(
          "📝 Fetching nostr vendor events:",
          events.length,
          "total events found from whitelisted authors only",
        );

        const vendors: NostrVendor[] = [];
        let skippedEvents = 0;

        for (const event of events) {
          try {
            let data;
            try {
              data = JSON.parse(event.content);
            } catch {
              // Quietly skip invalid JSON events - these are likely not vendor events
              skippedEvents++;
              continue;
            }

            // Extract dTag from tags for replaceable events
            const dTag =
              event.tags.find((tag: string[]) => tag[0] === "d")?.[1] ||
              `vendor-${event.id}`;

            // Parse lat/lon from location tag if available
            let lat: number | undefined;
            let lon: number | undefined;
            const locationTag = event.tags.find(
              (tag: string[]) => tag[0] === "location",
            );
            if (locationTag && locationTag[1]) {
              const coords = locationTag[1].split(",");
              if (coords.length === 2) {
                lat = parseFloat(coords[0]);
                lon = parseFloat(coords[1]);
              }
            }

            // Get submitter profile info
            const profileInfo = await fetchSubmitterProfile(event.pubkey);

            const vendor: NostrVendor = {
              id: data.id || event.id,
              name: data.name || "Unknown Vendor",
              category: data.category || "General",
              lightning: data.lightning || false,
              onchain: data.onchain || false,
              lightningAddress: data.lightningAddress,
              onchainAddress: data.onchainAddress,
              address: data.address || "No address provided",
              lat,
              lon,
              email: data.email,
              twitter: data.twitter,
              phone: data.phone,
              website: data.website,
              description: data.description,
              openingHours: data.openingHours,
              images: data.images,
              npub: event.pubkey,
              eventId: event.id,
              createdAt: event.created_at,
              dTag, // Store the dTag for replaceable events
              submitterName: profileInfo.name,
              submitterPicture: profileInfo.picture,
              rawEvent: event as Record<string, unknown>,
            };

            vendors.push(vendor);
          } catch (parseError) {
            logger.warn(
              `Failed to parse vendor event: ${event.id}`,
              parseError,
            );
          }
        }

        // Sort by creation date (newest first) by default
        vendors.sort((a, b) => b.createdAt - a.createdAt);
        setNostrVendors(vendors);

        // Log summary
        if (skippedEvents > 0) {
          console.log(
            `📊 Nostr vendor summary: ${vendors.length} valid vendors, ${skippedEvents} non-vendor events skipped`,
          );
        } else {
          console.log(
            `📊 Nostr vendor summary: ${vendors.length} valid vendors found`,
          );
        }
      } catch (error) {
        logger.error("Error fetching nostr vendors:", error);
        setNostrError(
          error instanceof Error
            ? error.message
            : "Failed to fetch nostr vendors",
        );
      } finally {
        setIsLoadingNostr(false);
      }
    };

    fetchNostrVendors();
  }, [successMessage]);

  // Initialize Leaflet components only on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("leaflet").then((leaflet) => {
        LeafletIcon = leaflet.Icon;
        LeafletLatLngBounds = leaflet.LatLngBounds;
        LeafletDivIcon = leaflet.DivIcon;

        // Fix for default markers in react-leaflet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (LeafletIcon.Default.prototype as any)._getIconUrl;
        LeafletIcon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });
      });
    }
  }, []);

  // Fetch BTCMap vendors
  useEffect(() => {
    const fetchBTCMapData = async () => {
      setIsLoadingBTCMap(true);
      setBTCMapError(null);

      try {
        logger.debug("🗺️ Fetching BTCMap vendors...");
        const btcMapData = await fetchBTCMapVendors();
        logger.debug("🗺️ BTCMap vendors fetched:", btcMapData.length);
        setBTCMapVendors(btcMapData);
      } catch (error) {
        logger.error("🗺️ Error fetching BTCMap vendors:", error);
        setBTCMapError("Failed to fetch BTCMap vendors");
        setBTCMapVendors([]);
      } finally {
        setIsLoadingBTCMap(false);
      }
    };

    fetchBTCMapData();
  }, []);

  // Fetch classified listings when on the listings tab
  useEffect(() => {
    if (view !== "listings") return;
    const fetchListings = async () => {
      setIsLoadingListings(true);
      setListingsError(null);
      try {
        const data = await fetchClassifiedListings();
        setListings(data);
      } catch (error) {
        setListingsError(
          error instanceof Error ? error.message : "Failed to fetch listings",
        );
      } finally {
        setIsLoadingListings(false);
      }
    };
    fetchListings();
  }, [view, listingSuccess]);

  // Fetch profiles for listing authors
  useEffect(() => {
    if (listings.length === 0) return;
    const uniquePubkeys = [...new Set(listings.map((l) => l.pubkey))];
    // Skip pubkeys we already fetched
    const missing = uniquePubkeys.filter((pk) => !listingProfiles[pk]);
    if (missing.length === 0) return;

    let cancelled = false;
    const profiles: Record<string, { name?: string; picture?: string }> = {};
    Promise.all(
      missing.map(async (pk) => {
        try {
          const events = await new Promise<NostrEvent[]>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("timeout")), 8000);
            const collected: NostrEvent[] = [];
            pool.request(nostrRelays, { kinds: [0], authors: [pk], limit: 1 }).subscribe({
              next: (e) => collected.push(e),
              error: (err) => { clearTimeout(timeout); reject(err); },
              complete: () => { clearTimeout(timeout); resolve(collected); },
            });
          });
          if (events.length > 0) {
            const meta = JSON.parse(events[0].content);
            profiles[pk] = { name: meta.name || meta.display_name, picture: meta.picture };
          }
        } catch {
          // Profile fetch failed, skip silently
        }
      }),
    ).then(() => {
      if (!cancelled && Object.keys(profiles).length > 0) {
        setListingProfiles((prev) => ({ ...prev, ...profiles }));
      }
    });
    return () => { cancelled = true; };
  }, [listings]);

  // Fetch zap totals for classified listings
  useEffect(() => {
    if (listings.length === 0) return;
    let cancelled = false;
    const totals: Record<string, number> = {};
    Promise.all(
      listings.map((l) =>
        fetchZapTotal(l.id, l.pubkey).then((t) => { if (t > 0) totals[l.id] = t; }),
      ),
    ).then(() => { if (!cancelled) setListingZapTotals(totals); });
    return () => { cancelled = true; };
  }, [listings]);

  // Apply filters and sorting to all vendors
  const filteredAndSortedVendors = useMemo(() => {
    let result = [...nostrVendors, ...btcMapVendors];

    // Apply filters
    Object.keys(filters).forEach((key) => {
      const filterValue = filters[key].toLowerCase();
      if (filterValue) {
        result = result.filter((vendor) => {
          if (key === "submitterName") {
            // Handle both Nostr and BTCMap vendors
            if (filterValue === "btcmap") {
              // Show only BTCMap vendors
              return !("submitterName" in vendor);
            } else {
              // Show Nostr vendors with matching submitter name
              return (
                "submitterName" in vendor &&
                (vendor.submitterName || "").toLowerCase().includes(filterValue)
              );
            }
          }
          return (
            vendor[key as keyof (NostrVendor | BTCMapVendor)]?.toString() || ""
          )
            .toLowerCase()
            .includes(filterValue);
        });
      }
    });

    // Apply sorting
    result.sort((a, b) => {
      // Zap sorting — sort by zap total (desc by default)
      if (sortField === "zaps") {
        const aZaps = ("id" in a) ? (vendorZapTotals[a.id] || 0) : 0;
        const bZaps = ("id" in b) ? (vendorZapTotals[b.id] || 0) : 0;
        return sortDirection === "desc" ? bZaps - aZaps : aZaps - bZaps;
      }

      let aValue: string | number | undefined = a[
        sortField as keyof (NostrVendor | BTCMapVendor)
      ] as string | number | undefined;
      let bValue: string | number | undefined = b[
        sortField as keyof (NostrVendor | BTCMapVendor)
      ] as string | number | undefined;

      if (sortField === "submitterName") {
        if ("submitterName" in a) {
          aValue = a.submitterName || "";
        } else {
          aValue = "BTCMap"; // Sort BTCMap vendors as "BTCMap"
        }

        if ("submitterName" in b) {
          bValue = b.submitterName || "";
        } else {
          bValue = "BTCMap"; // Sort BTCMap vendors as "BTCMap"
        }
      }

      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Handle undefined/null values
      if (aValue === undefined || aValue === null) aValue = "";
      if (bValue === undefined || bValue === null) bValue = "";

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [nostrVendors, btcMapVendors, filters, sortField, sortDirection, vendorZapTotals]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Handle filter change
  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Scroll to vendor card when map pin is clicked
  const scrollToVendor = (vendorId: string) => {
    const element = vendorCardRefs.current[vendorId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add highlight effect
      element.classList.add("ring-4", "ring-bitcoin-orange", "ring-opacity-50");
      setTimeout(() => {
        element.classList.remove(
          "ring-4",
          "ring-bitcoin-orange",
          "ring-opacity-50",
        );
      }, 2000);
    }
  };

  // Handle vendor deletion
  const handleDeleteVendor = async (vendor: NostrVendor) => {
    if (!user || !pool) {
      alert("You must be logged in to delete vendors.");
      return;
    }

    try {
      // Create delete event template
      const deleteEventTemplate = {
        kind: 5, // Kind 5 is for deletion events
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["e", vendor.id], // Reference to the event being deleted
          ["k", "30333"], // The kind of the event being deleted
        ],
        content: "Deleted vendor entry",
      };

      // Sign the event using the user's signing method
      const signedEvent = await signEvent(
        deleteEventTemplate as {
          kind: number;
          content: string;
          tags: string[][];
          created_at: number;
        },
      );

      // Add the ID to the signed event
      const signedRecord = signedEvent as Record<string, unknown>;
      const deleteEvent = {
        ...signedEvent,
        id:
          (signedRecord.id as string) ||
          getEventHash(signedEvent as NostrEvent),
      } as NostrEvent;

      // Publish the delete event to relays
      const responses = await pool.publish(RELAYS, deleteEvent);

      // Check if at least one relay accepted the event
      const successfulResponses = responses.filter((r) => r.ok);
      const failedResponses = responses.filter((r) => !r.ok);

      if (successfulResponses.length === 0) {
        const errorMessages = failedResponses
          .map((r) => `${r.from}: ${r.message}`)
          .join("; ");
        throw new Error(`Failed to publish to all relays: ${errorMessages}`);
      }

      if (failedResponses.length > 0) {
        console.warn(
          `⚠️ Failed on ${failedResponses.length} relays:`,
          failedResponses.map((r) => `${r.from}: ${r.message}`),
        );
      }

      // Update local state to remove the deleted vendor
      setNostrVendors((prev) => prev.filter((v) => v.id !== vendor.id));

      // Show success message
      setSuccessMessage({
        eventId: deleteEvent.id,
        naddr: `Deleted "${vendor.name}" from the directory`,
      });
    } catch (error) {
      logger.error("Error deleting vendor:", error);
      alert("Failed to delete vendor. Please try again.");
    }
  };

  // Handle classified listing deletion
  const handleDeleteListing = async (listing: ClassifiedListing) => {
    if (!user || !pool) {
      alert("You must be logged in to delete listings.");
      return;
    }

    try {
      const deleteEventTemplate = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["e", listing.id],
          ["k", "30402"],
        ],
        content: "Deleted classified listing",
      };

      const signedEvent = await signEvent(deleteEventTemplate as any);
      const signedRecord = signedEvent as Record<string, unknown>;
      const deleteEvent = {
        ...signedEvent,
        id:
          (signedRecord.id as string) ||
          getEventHash(signedEvent as NostrEvent),
      } as NostrEvent;

      const responses = await pool.publish(RELAYS, deleteEvent);
      const successfulResponses = responses.filter((r) => r.ok);

      if (successfulResponses.length === 0) {
        throw new Error("Failed to publish to any relay");
      }

      setListings((prev) => prev.filter((l) => l.id !== listing.id));
    } catch (error) {
      logger.error("Error deleting listing:", error);
      alert("Failed to delete listing. Please try again.");
    }
  };

  // Create custom pin icon
  const createPinIcon = useCallback((
    hasLightning: boolean,
    hasOnchain: boolean,
  ): DivIcon | undefined => {
    if (!LeafletDivIcon || typeof window === "undefined") {
      return undefined; // Return undefined if DivIcon is not available (SSR)
    }

    // Use Bitcoin symbol by default, Lightning if available
    const paymentIcon = hasLightning ? "⚡" : "₿";

    const iconHtml = `
      <div class="bg-bitcoin-orange text-white rounded-full shadow-lg flex items-center justify-center text-xl font-bold" style="width: 32px; height: 32px; border: 3px solid white; font-family: system-ui, -apple-system, sans-serif;">
        ${paymentIcon}
      </div>
    `;

    return new LeafletDivIcon({
      html: iconHtml,
      className: "custom-div-icon",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  }, [LeafletDivIcon]);

  // Render sort indicator
  const renderSortIndicator = useCallback((field: SortField) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return sortDirection === "asc" ? (
      <span className="text-bitcoin-orange">↑</span>
    ) : (
      <span className="text-bitcoin-orange">↓</span>
    );
  }, [sortField, sortDirection]);

  const sortableFields: { key: SortField; label: string }[] = [
    { key: "zaps", label: "\u26A1 Zaps" },
    { key: "name", label: "Vendor Name" },
    { key: "category", label: "Category" },
    { key: "submitterName", label: "Submitted By" },
    { key: "createdAt", label: "Date Added" },
  ];

  // Get all unique values for filters (use unfiltered data for submitter options)
  const allNames = Array.from(
    new Set(filteredAndSortedVendors.map((v) => v.name)),
  );
  const allCategories = Array.from(
    new Set(filteredAndSortedVendors.map((v) => v.category)),
  );

  // Get all unique submitter values from unfiltered vendors including "BTCMap" for BTCMap vendors
  const allUnfilteredVendors = [...nostrVendors, ...btcMapVendors];
  const allSubmitters = Array.from(
    new Set([
      ...allUnfilteredVendors
        .filter((v) => "submitterName" in v) // Only Nostr vendors have submitterName
        .map((v) => (v as NostrVendor).submitterName)
        .filter(Boolean),
      ...(allUnfilteredVendors.some((v) => !("submitterName" in v))
        ? ["BTCMap"]
        : []),
    ]),
  );

  // Filter and sort classified listings
  const filteredListings = useMemo(() => {
    let result = [...listings];

    // Hide hidden listings from everyone except the owner
    result = result.filter(
      (l) => l.status !== "hidden" || (user && l.pubkey === user.pubkey),
    );

    // Search filter (title, description, location)
    if (listingSearch.trim()) {
      const q = listingSearch.toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q)) ||
          (l.location && l.location.toLowerCase().includes(q)),
      );
    }

    // Category filter
    if (listingCategory) {
      result = result.filter((l) => l.tags.includes(listingCategory));
    }

    // Seller filter
    if (listingSeller) {
      result = result.filter((l) => l.pubkey === listingSeller);
    }

    // Status filter
    if (listingStatus !== "all") {
      result = result.filter((l) => l.status === listingStatus);
    }

    // Sort
    result.sort((a, b) => {
      switch (listingSort) {
        case "oldest":
          return a.createdAt - b.createdAt;
        case "price_low": {
          const aP = a.price ? parseFloat(a.price.amount) : Infinity;
          const bP = b.price ? parseFloat(b.price.amount) : Infinity;
          return aP - bP;
        }
        case "price_high": {
          const aP = a.price ? parseFloat(a.price.amount) : -Infinity;
          const bP = b.price ? parseFloat(b.price.amount) : -Infinity;
          return bP - aP;
        }
        case "zaps": {
          const aZ = listingZapTotals[a.id] || 0;
          const bZ = listingZapTotals[b.id] || 0;
          return bZ - aZ;
        }
        case "newest":
        default:
          return b.createdAt - a.createdAt;
      }
    });

    return result;
  }, [listings, listingSearch, listingCategory, listingSeller, listingStatus, listingSort, listingZapTotals, user]);

  // Extract unique categories from all listings
  const allListingCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const l of listings) {
      for (const t of l.tags) cats.add(t);
    }
    return Array.from(cats).sort();
  }, [listings]);

  // Unique seller pubkeys from all listings
  const allListingSellers = useMemo(() => {
    const sellers = new Set<string>();
    for (const l of listings) sellers.add(l.pubkey);
    return Array.from(sellers).sort((a, b) => {
      const nameA = listingProfiles[a]?.name || a;
      const nameB = listingProfiles[b]?.name || b;
      return nameA.localeCompare(nameB);
    });
  }, [listings, listingProfiles]);

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Tab Navigation */}
      <div className="flex justify-center gap-4 mb-10">
        <button
          data-testid="tab-vendors"
          onClick={() => setView("vendors")}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            view === "vendors"
              ? "bg-bitcoin-orange text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Vendors
        </button>
        <button
          data-testid="tab-listings"
          onClick={() => setView("listings")}
          className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
            view === "listings"
              ? "bg-bitcoin-orange text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Classifieds
        </button>
      </div>

      {/* ===== VENDORS TAB ===== */}
      {view === "vendors" && (
      <>
      {/* Loading State */}
      {(isLoadingNostr || isLoadingBTCMap) &&
        filteredAndSortedVendors.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-lg text-gray-600 mb-2">
              Fetching vendors from Nostr network and BTCMap...
            </div>
            <div className="animate-spin inline-block w-8 h-8 border-4 border-bitcoin-orange border-t-transparent rounded-full"></div>
          </div>
        )}

      {/* Filter and Sort Controls */}
      {filteredAndSortedVendors.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Filter by Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Vendor Name
              </label>
              <select
                value={filters.name || ""}
                onChange={(e) => handleFilterChange("name", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
              >
                <option value="">All Vendors</option>
                {allNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Category
              </label>
              <select
                value={filters.category || ""}
                onChange={(e) => handleFilterChange("category", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
              >
                <option value="">All Categories</option>
                {allCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Submitter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Submitter
              </label>
              <select
                value={filters.submitterName || ""}
                onChange={(e) =>
                  handleFilterChange("submitterName", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
              >
                <option value="">All Submitters</option>
                {allSubmitters.map((submitterName) => (
                  <option key={submitterName} value={submitterName}>
                    {submitterName}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={sortField}
                onChange={(e) => handleSort(e.target.value as SortField)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
              >
                {sortableFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label} {renderSortIndicator(field.key)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="text-sm text-gray-600">
            Showing{" "}
            <span className="font-semibold text-bitcoin-orange">
              {filteredAndSortedVendors.length}
            </span>{" "}
            vendors total
            <span className="ml-4">
              (
              <span className="font-semibold text-yellow-500">
                {nostrVendors.length}
              </span>{" "}
              from Nostr,
              <span className="font-semibold text-orange-500 ml-1">
                {btcMapVendors.length}
              </span>{" "}
              from BTCMap)
            </span>
          </div>
        </div>
      )}

      {/* Interactive Map */}
      {filteredAndSortedVendors.length > 0 &&
        filteredAndSortedVendors.some((v) => v.lat && v.lon) && (
          <section className="mb-16">
            <div className="bg-white rounded-lg shadow-md p-6">
              {/* Leaflet Map */}
              <div className="rounded-lg overflow-hidden h-64 sm:h-80 md:h-[500px]">
                <MapContainer
                  center={[
                    config.site.organization.coordinates.lat,
                    config.site.organization.coordinates.lon,
                  ]}
                  zoom={12}
                  style={{ height: "100%", width: "100%" }}
                  bounds={
                    LeafletLatLngBounds
                      ? new LeafletLatLngBounds(
                          filteredAndSortedVendors
                            .filter((v) => v.lat && v.lon)
                            .map((v) => [v.lat!, v.lon!] as [number, number]),
                        )
                      : undefined
                  }
                  boundsOptions={{ padding: [50, 50] }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />

                  {filteredAndSortedVendors
                    .filter((vendor) => vendor.lat && vendor.lon)
                    .map((vendor) => {
                      const isNostrVendor = "npub" in vendor;
                      const hasLightning = isNostrVendor
                        ? (vendor as NostrVendor).lightning
                        : (vendor as BTCMapVendor).lightning;
                      const hasOnchain = isNostrVendor
                        ? (vendor as NostrVendor).onchain
                        : (vendor as BTCMapVendor).onchain;

                      return (
                        <Marker
                          key={vendor.id}
                          position={[vendor.lat!, vendor.lon!]}
                          icon={
                            createPinIcon(hasLightning, hasOnchain) ?? undefined
                          }
                          eventHandlers={{
                            click: () => scrollToVendor(vendor.id),
                            mouseover: (e) => {
                              const marker = e.target;
                              marker
                                .bindTooltip(
                                  `${vendor.name} - ${vendor.category}`,
                                  {
                                    permanent: false,
                                    direction: "top",
                                    offset: [0, -20],
                                    className:
                                      "bg-gray-900 text-white px-2 py-1 rounded text-xs border border-gray-700",
                                  },
                                )
                                .openTooltip();
                            },
                          }}
                        >
                          <Popup>
                            <div className="p-2">
                              <h3 className="font-bold text-lg">
                                {vendor.name}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {vendor.category}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {vendor.address}
                              </p>
                              {hasLightning && (
                                <p className="text-sm text-yellow-600">
                                  ⚡ Lightning
                                </p>
                              )}
                              {hasOnchain && (
                                <p className="text-sm text-orange-600">
                                  ₿ On-chain
                                </p>
                              )}
                              <button
                                onClick={() => scrollToVendor(vendor.id)}
                                className="mt-2 text-xs bg-bitcoin-orange text-white px-2 py-1 rounded hover:bg-orange-600"
                              >
                                View Details
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                </MapContainer>
              </div>

              {/* Map Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-semibold text-bitcoin-orange">
                    {
                      filteredAndSortedVendors.filter((v) => v.lat && v.lon)
                        .length
                    }
                  </span>{" "}
                  vendors with locations
                </div>
                <div>
                  <span className="font-semibold text-yellow-500">
                    {
                      filteredAndSortedVendors.filter(
                        (v) =>
                          v.lat &&
                          v.lon &&
                          (("npub" in v && (v as NostrVendor).lightning) ||
                            (!("npub" in v) && (v as BTCMapVendor).lightning)),
                      ).length
                    }
                  </span>{" "}
                  accept Lightning
                </div>
                <div>
                  <span className="font-semibold text-orange-500">
                    {
                      filteredAndSortedVendors.filter(
                        (v) =>
                          v.lat &&
                          v.lon &&
                          (("npub" in v && (v as NostrVendor).onchain) ||
                            (!("npub" in v) && (v as BTCMapVendor).onchain)),
                      ).length
                    }
                  </span>{" "}
                  accept On-chain
                </div>
              </div>
            </div>
          </section>
        )}

      {/* Vendor Cards */}
      {filteredAndSortedVendors.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedVendors.map((vendor) => {
            const isNostrVendor = "npub" in vendor;
            return (
              <div
                key={vendor.id}
                ref={(el) => {
                  vendorCardRefs.current[vendor.id] = el;
                }}
                id={`vendor-card-${vendor.id}`}
                className={`${isNostrVendor ? "bg-purple-900 border-purple-800" : "bg-white border-gray-200"} border rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 hover:border-bitcoin-orange/50 ${isNostrVendor ? "text-white" : ""}`}
              >
                {/* Header with Vendor Name and Payment Methods */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3
                      className={`text-xl font-bold mb-2 ${isNostrVendor ? "text-white" : "text-gray-900"}`}
                    >
                      {vendor.name}
                    </h3>
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-bitcoin-orange text-white rounded">
                      {vendor.category}
                    </span>
                    {(() => {
                      const isNostrVendor = "npub" in vendor;
                      const hasLightning = isNostrVendor
                        ? (vendor as NostrVendor).lightning
                        : (vendor as BTCMapVendor).lightning;
                      const hasOnchain = isNostrVendor
                        ? (vendor as NostrVendor).onchain
                        : (vendor as BTCMapVendor).onchain;

                      return (
                        <>
                          {hasLightning && (
                            <span className="ml-2 inline-block px-2 py-1 text-xs font-medium bg-yellow-500 text-white rounded">
                              ⚡ Lightning
                            </span>
                          )}
                          {hasOnchain && (
                            <span className="ml-2 inline-block px-2 py-1 text-xs font-medium bg-orange-500 text-white rounded">
                              ₿ On-chain
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Event actions */}
                  {"npub" in vendor && (vendor as NostrVendor).rawEvent && (
                    <EventActions
                      event={(vendor as NostrVendor).rawEvent!}
                      signEvent={signEvent}
                      pubkey={user?.pubkey}
                      onEdit={
                        user && vendor.npub === user.pubkey
                          ? () => {
                              setEditVendor(vendor as NostrVendor);
                              setIsEdit(true);
                              setShowVendorForm(true);
                            }
                          : undefined
                      }
                      onDelete={
                        user && vendor.npub === user.pubkey
                          ? () => {
                              if (
                                window.confirm(
                                  `Are you sure you want to delete "${vendor.name}"? This action cannot be undone.`,
                                )
                              ) {
                                handleDeleteVendor(vendor as NostrVendor);
                              }
                            }
                          : undefined
                      }
                    />
                  )}
                </div>

                {/* Description */}
                {vendor.description && (
                  <p
                    className={`${isNostrVendor ? "text-gray-200" : "text-gray-600"} text-sm mb-4`}
                  >
                    {vendor.description}
                  </p>
                )}

                {/* Location */}
                <div
                  className={`flex items-center gap-2 mb-3 ${isNostrVendor ? "text-gray-200" : "text-gray-700"}`}
                >
                  <span className="text-lg">📍</span>
                  <span className="text-sm">{vendor.address}</span>
                </div>

                {/* Contact Information */}
                <div
                  className={`space-y-2 text-sm mb-4 ${isNostrVendor ? "text-gray-200" : "text-gray-700"}`}
                >
                  {(() => {
                    const isNostrVendor = "npub" in vendor;

                    if (isNostrVendor) {
                      const nostrVendor = vendor as NostrVendor;
                      return (
                        <>
                          {nostrVendor.lightningAddress && (
                            <div className="flex items-center gap-2">
                              <span className="text-yellow-500">⚡</span>
                              <a
                                href={`lightning:${nostrVendor.lightningAddress}`}
                                className="text-blue-600 hover:underline truncate"
                              >
                                {nostrVendor.lightningAddress}
                              </a>
                            </div>
                          )}

                          {nostrVendor.onchainAddress && (
                            <div className="flex items-center gap-2">
                              <span className="text-orange-500">₿</span>
                              <a
                                href={`bitcoin:${nostrVendor.onchainAddress}`}
                                className="text-blue-600 hover:underline truncate font-mono"
                              >
                                {nostrVendor.onchainAddress?.substring(0, 16)}
                                ...
                              </a>
                            </div>
                          )}

                          {nostrVendor.email && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">📧</span>
                              <a
                                href={`mailto:${nostrVendor.email}`}
                                className="text-blue-600 hover:underline"
                              >
                                {nostrVendor.email}
                              </a>
                            </div>
                          )}

                          {nostrVendor.website && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">🌐</span>
                              <a
                                href={nostrVendor.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate"
                              >
                                {nostrVendor.website?.replace(
                                  /^https?:\/\//,
                                  "",
                                )}
                              </a>
                            </div>
                          )}

                          {nostrVendor.openingHours && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">🕒</span>
                              <span className="text-gray-700">
                                {nostrVendor.openingHours}
                              </span>
                            </div>
                          )}
                        </>
                      );
                    } else {
                      const btcMapVendor = vendor as BTCMapVendor;
                      return (
                        <>
                          {btcMapVendor.phone && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">📞</span>
                              <a
                                href={`tel:${btcMapVendor.phone}`}
                                className="text-blue-600 hover:underline"
                              >
                                {btcMapVendor.phone}
                              </a>
                            </div>
                          )}

                          {btcMapVendor.website && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">🌐</span>
                              <a
                                href={btcMapVendor.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate"
                              >
                                {btcMapVendor.website?.replace(
                                  /^https?:\/\//,
                                  "",
                                )}
                              </a>
                            </div>
                          )}

                          {btcMapVendor.email && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">📧</span>
                              <a
                                href={`mailto:${btcMapVendor.email}`}
                                className="text-blue-600 hover:underline"
                              >
                                {btcMapVendor.email}
                              </a>
                            </div>
                          )}

                          {btcMapVendor.opening_hours && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">🕒</span>
                              <span className="text-gray-700">
                                {btcMapVendor.opening_hours}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-blue-500">🗺️</span>
                            <span className="text-xs text-blue-600 font-medium">
                              BTCMap Vendor
                            </span>
                          </div>

                          {btcMapVendor.btcmap_id && (
                            <div className="flex items-center gap-2 mt-2">
                              <a
                                href={`https://btcmap.org/elements/${btcMapVendor.btcmap_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
                              >
                                <span>🔗</span>
                                Open in BTCMap
                              </a>
                            </div>
                          )}
                        </>
                      );
                    }
                  })()}
                </div>

                {/* Footer with Submitter Info */}
                {"npub" in vendor && (
                  <div
                    className={`mt-4 pt-4 border-t ${isNostrVendor ? "border-purple-700" : "border-gray-100"} flex justify-between items-center`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Submitter Profile Picture */}
                      {vendor.submitterPicture ? (
                        <img
                          src={vendor.submitterPicture}
                          alt={vendor.submitterName || "Submitter"}
                          width={24}
                          height={24}
                          className="w-6 h-6 rounded-full"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                          ?
                        </div>
                      )}
                      <div
                        className={`text-xs ${isNostrVendor ? "text-gray-300" : "text-gray-500"}`}
                      >
                        Submitted by{" "}
                        {vendor.submitterName ? (
                          <a
                            href={`https://nostrudel.ninja/u/${vendor.npub}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-bitcoin-orange hover:underline font-medium"
                          >
                            {vendor.submitterName}
                          </a>
                        ) : (
                          <a
                            href={`https://nostrudel.ninja/u/${vendor.npub}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-bitcoin-orange hover:underline"
                          >
                            {vendor.npub.substring(0, 8)}...
                          </a>
                        )}
                      </div>
                    </div>
                    <div
                      className={`text-xs ${isNostrVendor ? "text-gray-400" : "text-gray-400"}`}
                    >
                      {new Date(vendor.createdAt * 1000).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State - No Vendors Found */}
      {!isLoadingNostr &&
        !isLoadingBTCMap &&
        nostrVendors.length === 0 &&
        btcMapVendors.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏪</div>
            <div className="text-xl font-bold text-gray-800 mb-2">
              No Bitcoin Vendors Found
            </div>
            <div className="text-lg text-gray-600 mb-6">
              Be the first to add a Bitcoin-accepting business to our directory!
            </div>
            <div className="bg-gradient-to-r from-bitcoin-orange/10 to-orange-100 border border-bitcoin-orange/20 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-gray-800 mb-3">
                🚀 Add Your First Vendor
              </h3>
              <p className="text-gray-600 mb-4">
                Help grow the Bitcoin ecosystem in{" "}
                {siteConfig.organization.location} by submitting local
                businesses that accept Bitcoin payments.
              </p>
              <button
                onClick={() => setShowVendorForm(true)}
                className="px-6 py-3 bg-bitcoin-orange text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:ring-offset-2"
              >
                Submit New Vendor
              </button>
            </div>
          </div>
        )}

      {/* Error State */}
      {!isLoadingNostr &&
        !isLoadingBTCMap &&
        nostrVendors.length === 0 &&
        btcMapVendors.length === 0 &&
        (nostrError || btcMapError) && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">⚠️</div>
            <div className="text-lg text-gray-600 mb-2">
              Unable to load vendor data
            </div>
            <div className="text-sm text-gray-500">
              {nostrError || btcMapError || "No vendors found"}
            </div>
          </div>
        )}

      {/* Success Message */}
      {successMessage && (
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <h3 className="text-xl font-bold mb-4 font-archivo-black text-green-800">
            Vendor Submitted Successfully!
          </h3>
          <p className="text-green-600 mb-4">
            Your vendor submission has been published to the Nostr network.
          </p>
          <div className="space-y-2 text-sm text-green-700">
            <p>
              <strong>Event ID:</strong>{" "}
              {successMessage.eventId.substring(0, 20)}...
            </p>
            <p className="break-all">
              <strong>Nostr Address:</strong> {successMessage.naddr}
            </p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Call to Action */}
      <section className="mt-16 bg-gradient-to-r from-gray-50 to-orange-50 border border-gray-200 rounded-lg p-8 text-center">
        <h3 className="text-2xl font-bold mb-4 font-archivo-black">
          Know a Bitcoin-Accepting Business?
        </h3>
        <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
          Help grow this decentralized vendor directory! If you know of a local
          business that accepts Bitcoin, submit their information to the Nostr
          network.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => setShowVendorForm(true)}
            className="px-6 py-3 bg-bitcoin-orange text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:ring-offset-2"
          >
            Submit New Vendor
          </button>
          {!user && (
            <p className="text-sm text-gray-500 self-center">
              Connect your Nostr account to submit vendors
            </p>
          )}
        </div>
      </section>

      {/* Vendor Form Modal */}
      {showVendorForm && (
        <VendorForm
          onClose={() => {
            setShowVendorForm(false);
            setEditVendor(null);
            setIsEdit(false);
          }}
          onSuccess={(data) => {
            setSuccessMessage(data);
            setShowVendorForm(false);
            setEditVendor(null);
            setIsEdit(false);
          }}
          editVendor={editVendor}
          isEdit={isEdit}
        />
      )}
      </>
      )}

      {/* ===== CLASSIFIEDS TAB ===== */}
      {view === "listings" && (
        <>
          {/* Loading State */}
          {isLoadingListings && listings.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <div className="text-lg text-gray-600 mb-2">
                Loading classified listings...
              </div>
              <div className="animate-spin inline-block w-8 h-8 border-4 border-bitcoin-orange border-t-transparent rounded-full"></div>
            </div>
          )}

          {/* Filter and Sort Controls */}
          {listings.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
                  <input
                    type="text"
                    data-testid="listing-search"
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                    placeholder="Search listings..."
                  />
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    data-testid="listing-category-filter"
                    value={listingCategory}
                    onChange={(e) => setListingCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                  >
                    <option value="">All Categories</option>
                    {allListingCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seller Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seller
                  </label>
                  <select
                    data-testid="listing-seller-filter"
                    value={listingSeller}
                    onChange={(e) => setListingSeller(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                  >
                    <option value="">All Sellers</option>
                    {allListingSellers.map((pk) => (
                      <option key={pk} value={pk}>
                        {listingProfiles[pk]?.name || pk.substring(0, 12) + "..."}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    data-testid="listing-status-filter"
                    value={listingStatus}
                    onChange={(e) =>
                      setListingStatus(e.target.value as "all" | "active" | "sold")
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="sold">Sold</option>
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <select
                    data-testid="listing-sort"
                    value={listingSort}
                    onChange={(e) =>
                      setListingSort(
                        e.target.value as "newest" | "oldest" | "price_low" | "price_high",
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                  >
                    <option value="zaps">⚡ Zaps</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {/* Results Count */}
              <div className="text-sm text-gray-600">
                Showing{" "}
                <span className="font-semibold text-bitcoin-orange">
                  {filteredListings.length}
                </span>{" "}
                of {listings.length} listings
              </div>
            </div>
          )}

          {/* Listings Grid */}
          {filteredListings.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  zapTotal={listingZapTotals[listing.id] || 0}
                  sellerProfile={listingProfiles[listing.pubkey]}
                  onClick={() => setSelectedListing(listing)}
                  onDelete={
                    user && listing.pubkey === user.pubkey
                      ? () => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete "${listing.title}"?`,
                            )
                          ) {
                            handleDeleteListing(listing);
                          }
                        }
                      : undefined
                  }
                  onEdit={
                    user && listing.pubkey === user.pubkey
                      ? () => {
                          setEditListing(listing);
                          setIsEditListing(true);
                          setShowListingForm(true);
                        }
                      : undefined
                  }
                  onAddToCart={() => addToCart(listing)}
                  onBuyNow={
                    listing.price
                      ? async () => {
                          const amount = await fiatToSats(
                            parseFloat(listing.price!.amount),
                            listing.price!.currency,
                          );
                          setZapTarget({
                            pubkey: listing.pubkey,
                            eventId: listing.id,
                            amount,
                          });
                        }
                      : undefined
                  }
                  pubkey={user?.pubkey}
                />
              ))}
            </div>
          )}

          {/* No results after filtering */}
          {listings.length > 0 && filteredListings.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-lg text-gray-600">
                No listings match your filters.
              </p>
              <button
                onClick={() => {
                  setListingSearch("");
                  setListingCategory("");
                  setListingSeller("");
                  setListingStatus("all");
                }}
                className="mt-3 text-bitcoin-orange hover:underline text-sm"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Empty State (no listings at all) */}
          {!isLoadingListings && listings.length === 0 && !listingsError && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <div className="text-xl font-bold text-gray-800 mb-2">
                No Classified Listings Yet
              </div>
              <div className="text-lg text-gray-600 mb-6">
                Be the first to post a classified listing!
              </div>
              <button
                onClick={() => setShowListingForm(true)}
                className="px-6 py-3 bg-bitcoin-orange text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Create Listing
              </button>
            </div>
          )}

          {/* Error State */}
          {!isLoadingListings && listings.length === 0 && listingsError && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">⚠️</div>
              <div className="text-lg text-gray-600 mb-2">
                Unable to load listings
              </div>
              <div className="text-sm text-gray-500">{listingsError}</div>
            </div>
          )}

          {/* Listing Success Message */}
          {listingSuccess && (
            <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <h3 className="text-xl font-bold mb-4 font-archivo-black text-green-800">
                Listing Published Successfully!
              </h3>
              <div className="space-y-2 text-sm text-green-700">
                <p>
                  <strong>Event ID:</strong>{" "}
                  {listingSuccess.eventId.substring(0, 20)}...
                </p>
                <p className="break-all">
                  <strong>Nostr Address:</strong> {listingSuccess.naddr}
                </p>
              </div>
              <button
                onClick={() => setListingSuccess(null)}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* CTA for Listings */}
          <section className="mt-16 bg-gradient-to-r from-gray-50 to-orange-50 border border-gray-200 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold mb-4 font-archivo-black">
              Have Something to Sell?
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Post a classified listing on the Nostr network. Bitcoiners can buy,
              sell, and trade goods and services.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowListingForm(true)}
                className="px-6 py-3 bg-bitcoin-orange text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:ring-offset-2"
              >
                Create Listing
              </button>
              {!user && (
                <p className="text-sm text-gray-500 self-center">
                  Connect your Nostr account to create listings
                </p>
              )}
            </div>
          </section>

          {/* Listing Form Modal */}
          {showListingForm && (
            <ListingForm
              onClose={() => {
                setShowListingForm(false);
                setEditListing(null);
                setIsEditListing(false);
              }}
              onSuccess={(data) => {
                setListingSuccess(data);
                setShowListingForm(false);
                setEditListing(null);
                setIsEditListing(false);
              }}
              editListing={editListing}
              isEdit={isEditListing}
            />
          )}

          {/* Listing Detail Modal */}
          {selectedListing && (
            <ListingDetailModal
              listing={selectedListing}
              sellerProfile={listingProfiles[selectedListing.pubkey]}
              onClose={() => setSelectedListing(null)}
              onDelete={
                user && selectedListing.pubkey === user.pubkey
                  ? () => {
                      if (
                        window.confirm(
                          `Are you sure you want to delete "${selectedListing.title}"?`,
                        )
                      ) {
                        handleDeleteListing(selectedListing);
                        setSelectedListing(null);
                      }
                    }
                  : undefined
              }
              onEdit={
                user && selectedListing.pubkey === user.pubkey
                  ? () => {
                      setEditListing(selectedListing);
                      setIsEditListing(true);
                      setShowListingForm(true);
                      setSelectedListing(null);
                    }
                  : undefined
              }
              onAddToCart={() => addToCart(selectedListing)}
              onBuyNow={
                selectedListing.price
                  ? async () => {
                      const amount = await fiatToSats(
                        parseFloat(selectedListing.price!.amount),
                        selectedListing.price!.currency,
                      );
                      setZapTarget({
                        pubkey: selectedListing.pubkey,
                        eventId: selectedListing.id,
                        amount,
                      });
                    }
                  : undefined
              }
            />
          )}

          {/* Cart Badge (floating, shop pages only) */}
          <CartBadge onCheckout={handleCheckout} />

          {/* Zap Modal for Buy Now / Checkout */}
          {zapTarget && (
            <ZapModal
              event={{ id: zapTarget.eventId, pubkey: zapTarget.pubkey, kind: 30402, content: "", tags: [], created_at: Math.floor(Date.now() / 1000) }}
              isOpen={true}
              defaultAmount={zapTarget.amount}
              onClose={checkoutQueue.length > 0 ? handleCheckoutCancel : () => setZapTarget(null)}
              signEvent={signEvent}
              pubkey={user?.pubkey ?? null}
              onZapConfirmed={
                checkoutQueue.length > 0
                  ? handleCheckoutZapConfirmed
                  : () => {
                      // Buy Now — send order DM to seller
                      console.log("[Shop] onZapConfirmed fired", { zapTarget, userPubkey: user?.pubkey });
                      if (zapTarget && user?.pubkey) {
                        const listing = listings.find((l) => l.id === zapTarget.eventId);
                        console.log("[Shop] Found listing for zap:", listing?.title);
                        if (listing) {
                          console.log("[Shop] Sending order DM...", {
                            seller: listing.pubkey.slice(0, 12),
                            buyer: user.pubkey.slice(0, 12),
                            title: listing.title,
                            amount: zapTarget.amount,
                          });
                          const buyerPrivkeyHex = user.privateKey ? nsecDecode(user.privateKey) : undefined;
                          sendOrderDM({
                            sellerPubkey: listing.pubkey,
                            buyerPubkey: user.pubkey,
                            listingTitle: listing.title,
                            listingCoordinate: listing.coordinate,
                            amountSats: zapTarget.amount,
                            buyerPrivkeyHex,
                          }).then((ok) => {
                            console.log("[Shop] Order DM result:", ok);
                          }).catch((err) => {
                            console.error("[Shop] Order DM error:", err);
                          });
                        }
                      }
                      setZapTarget(null);
                    }
              }
            />
          )}
        </>
      )}
    </div>
  );
}
