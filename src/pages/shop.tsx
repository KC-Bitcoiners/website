import { useState, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import VendorForm from "@/components/VendorForm";
import { useNostr } from "@/contexts/NostrContext";
import { fetchBTCMapVendors, BTCMapVendor } from "@/utils/btcmap";
import { pool } from "@/lib/nostr";
import type { Icon, LatLngBounds, DivIcon } from "leaflet";
// Simple event hash function for compatibility
const getEventHash = (event: any): string => {
  // This is a simplified placeholder - in a real implementation you'd use proper event hashing
  return "placeholder_hash"; // Return placeholder
};

// Simple NostrEvent type for compatibility
interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}
import { shopConfig, getNostrRelays, getMapCenter } from "@/config";

// Relay configuration for Nostr operations (now sourced from config)
const RELAYS = getNostrRelays();

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
}

type SortField = keyof NostrVendor | "submitterName";
type SortDirection = "asc" | "desc";

export default function ShopPage() {
  const { user } = useNostr();
  const [sortField, setSortField] = useState<SortField>("name");
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

  // Nostr vendors state
  const [nostrVendors, setNostrVendors] = useState<NostrVendor[]>([]);
  const [isLoadingNostr, setIsLoadingNostr] = useState(false);
  const [nostrError, setNostrError] = useState<string | null>(null);

  // BTCMap vendors state
  const [btcMapVendors, setBTCMapVendors] = useState<BTCMapVendor[]>([]);
  const [isLoadingBTCMap, setIsLoadingBTCMap] = useState(false);
  const [btcMapError, setBTCMapError] = useState<string | null>(null);

  // Fetch vendor profile info
  const fetchSubmitterProfile = async (
    npub: string,
  ): Promise<{ name?: string; picture?: string }> => {
    try {
      const relays = ["wss://relay.damus.io", "wss://nos.lol"];

      const filter = {
        kinds: [0], // Metadata event
        authors: [npub],
      };

        const events = await pool.request(relays[0], filter);
        if (events && Array.isArray(events) && events.length > 0) {
          const metadata = JSON.parse(events[0].content);
          return {
            name: metadata.name,
            picture: metadata.picture,
          };
        }
    } catch (error) {
      console.warn("Failed to fetch profile for", npub, error);
    }
    return {};
  };

  // Fetch nostr vendors on component mount and when success message changes
  useEffect(() => {
    const fetchNostrVendors = async () => {
      setIsLoadingNostr(true);
      setNostrError(null);

      try {
        const relays = [
          "wss://relay.damus.io",
          "wss://nos.lol",
          "wss://relay.snort.social",
        ];

        const filter = {
          kinds: [30333], // Custom Bitcoin Vendor Directory kind
          limit: 100,
        };

        // Simple timeout for the request
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Request timeout"));
          }, 30000);
        });

        try {
          const events = await Promise.race([
            pool.request(relays[0], filter) as Promise<NostrEvent[]>,
            timeoutPromise
          ]);
          
          console.log(
            "📝 Fetching nostr events:",
            events.length,
            "total events found",
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
              };

              vendors.push(vendor);
            } catch (parseError) {
              console.warn("Failed to parse vendor event:", event.id, parseError);
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
          console.error("Error fetching nostr vendors:", error);
          setNostrError(
            error instanceof Error
              ? error.message
              : "Failed to fetch nostr vendors",
          );
        } finally {
          setIsLoadingNostr(false);
        }
      } catch (error) {
        console.error("Error in fetchNostrVendors:", error);
        setNostrError(
          error instanceof Error
            ? error.message
            : "Failed to fetch nostr vendors",
        );
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
        console.log("🗺️ Fetching BTCMap vendors...");
        const btcMapData = await fetchBTCMapVendors();
        console.log("🗺️ BTCMap vendors fetched:", btcMapData.length);
        setBTCMapVendors(btcMapData);
      } catch (error) {
        console.error("🗺️ Error fetching BTCMap vendors:", error);
        setBTCMapError("Failed to fetch BTCMap vendors");
        setBTCMapVendors([]);
      } finally {
        setIsLoadingBTCMap(false);
      }
    };

    fetchBTCMapData();
  }, []);

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
  }, [nostrVendors, btcMapVendors, filters, sortField, sortDirection]);

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
      if (!window.nostr) {
        throw new Error(
          "Nostr extension not found. Please install a Nostr extension like Nos2x or Snort.",
        );
      }
      const signedEvent = await window.nostr.signEvent(deleteEventTemplate);

      // Add the ID to the signed event
      const deleteEvent = {
        ...signedEvent,
        id: signedEvent.id || getEventHash(signedEvent),
      };

      // Publish the delete event to relays
      const responses = await pool.publish(RELAYS[0], deleteEvent) as Array<{
        ok: boolean;
        from: string;
        message: string;
      }>;

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
      console.error("Error deleting vendor:", error);
      alert("Failed to delete vendor. Please try again.");
    }
  };

  // Create custom pin icon
  const createPinIcon = (
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
  };

  // Render sort indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return sortDirection === "asc" ? (
      <span className="text-bitcoin-orange">↑</span>
    ) : (
      <span className="text-bitcoin-orange">↓</span>
    );
  };

  const sortableFields: { key: SortField; label: string }[] = [
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

  return (
    <div className="container mx-auto px-4 py-12">
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
                {shopConfig.filters.name}
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
                {shopConfig.filters.category}
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
                {shopConfig.filters.submitter}
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
                {shopConfig.filters.sortBy}
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
              <div
                className="rounded-lg overflow-hidden"
                style={{ height: "500px" }}
              >
                <MapContainer
                  center={[getMapCenter().lat, getMapCenter().lon]} // Map center from config
                  zoom={shopConfig.map.defaultZoom}
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
                  boundsOptions={{ padding: shopConfig.map.boundsPadding as [number, number] }}
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

                  {/* Edit/Delete buttons for owners */}
                  {user && "npub" in vendor && vendor.npub === user.pubkey && (
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => {
                          setEditVendor(vendor as NostrVendor);
                          setIsEdit(true);
                          setShowVendorForm(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit vendor"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to delete "${vendor.name}"? This action cannot be undone.`,
                            )
                          ) {
                            handleDeleteVendor(vendor as NostrVendor);
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete vendor"
                      >
                        🗑️
                      </button>
                    </div>
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
                          className="w-6 h-6 rounded-full"
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

      {/* Error State */}
      {!isLoadingNostr &&
        !isLoadingBTCMap &&
        nostrVendors.length === 0 &&
        btcMapVendors.length === 0 && (
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
          {shopConfig.callToAction.title}
        </h3>
        <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
          {shopConfig.callToAction.description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => setShowVendorForm(true)}
            className="px-6 py-3 bg-bitcoin-orange text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:ring-offset-2"
          >
            {shopConfig.callToAction.buttonText}
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
    </div>
  );
}
