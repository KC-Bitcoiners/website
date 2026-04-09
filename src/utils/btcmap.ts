// BTCMap.org API integration
// Fetches real vendor data from btcmap.org and integrates with our map
import { btcmapConfig } from "@/config";

export interface BTCMapVendor {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  lightning: boolean;
  onchain: boolean;
  lightning_address?: string;
  onchain_address?: string;
  phone?: string;
  website?: string;
  email?: string;
  description?: string;
  opening_hours?: string;
  address?: string;
  city?: string;
  country?: string;
  state?: string;
  postcode?: string;
  btcmap_id?: string; // BTCMap element ID for linking to btcmap.org
}

export interface BTCMapResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  elements: Array<{
    type: "node" | "way" | "relation";
    id: number;
    lat?: number;
    lon?: number;
    nodes?: number[];
    members?: Array<{
      type: string;
      ref: number;
      role: string;
    }>;
    tags?: Record<string, string>;
  }>;
}

export const fetchBTCMapVendors = async (bounds?: {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}): Promise<BTCMapVendor[]> => {
  try {
    // Use provided bounds or default from config
    const bbox = bounds || btcmapConfig.defaultBounds;

    // BTCMap Overpass API endpoint - Fixed syntax
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["payment:lightning"="yes"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
        node["payment:onchain"="yes"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
        node["shop"="bitcoin"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
        node["payment:bitcoin"="yes"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
      );
      out geom;
    `;

    const overpassUrl = `${btcmapConfig.overpassUrl}?data=${encodeURIComponent(overpassQuery.trim())}`;

    console.log("🗺️ Fetching BTCMap vendors from:", overpassUrl);

    const response = await fetch(overpassUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": btcmapConfig.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: BTCMapResponse = await response.json();

    console.log("🗺️ BTCMap response features count:", data.elements.length);

    // Convert Overpass data to our vendor format
    const vendors: BTCMapVendor[] = data.elements
      .filter(
        (element) => element.type === "node" && element.lat && element.lon,
      ) // Only process nodes with coordinates
      .map((element) => {
        const tags = element.tags || {};

        return {
          id: element.id.toString(),
          name: tags.name || tags["addr:housename"] || "Unknown Bitcoin Vendor",
          category: tags.shop || tags.amenity || tags.tourism || "Other",
          lat: element.lat!,
          lon: element.lon!,
          lightning:
            tags["payment:lightning"] === "yes" ||
            tags["payment:bitcoin:lightning"] === "yes",
          onchain:
            tags["payment:bitcoin"] === "yes" ||
            tags["payment:onchain"] === "yes",
          lightning_address:
            tags["payment:lightning:address"] || tags["lightning_address"],
          onchain_address:
            tags["payment:bitcoin:address"] || tags["bitcoin_address"],
          phone: tags.phone || tags["contact:phone"],
          website: tags.website || tags.url,
          email: tags.email || tags["contact:email"],
          description: tags.description || tags.note || "",
          opening_hours: tags.opening_hours || tags["opening_hours"],
          address:
            tags["addr:housenumber"] && tags["addr:street"]
              ? `${tags["addr:housenumber"]} ${tags["addr:street"]}`
              : tags["addr:street"] || tags["addr:full_address"],
          city: tags["addr:city"],
          country: tags["addr:country"],
          state: tags["addr:state"] || tags["addr:province"],
          postcode: tags["addr:postcode"] || tags["addr:zip"],
          btcmap_id: element.id.toString(), // Add the BTCMap element ID for linking
        };
      });

    console.log("🗺️ Parsed BTCMap vendors:", vendors.length);
    return vendors;
  } catch (error) {
    console.error("🗺️ Error fetching BTCMap vendors:", error);
    return [];
  }
};
