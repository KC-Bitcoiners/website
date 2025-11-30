// BTCMap.org API integration
// Fetches real vendor data from btcmap.org and integrates with our map

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
    // Default bounds for Kansas City area if not provided
    const defaultBounds = {
      minLat: 38.5,
      maxLat: 39.5,
      minLon: -95.5,
      maxLon: -93.5
    };

    const bbox = bounds || defaultBounds;
    
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
    
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery.trim())}`;
    
    console.log('🗺️ Fetching BTCMap vendors from:', overpassUrl);
    
    const response = await fetch(overpassUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BitcoinVendorDirectory/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data: BTCMapResponse = await response.json();
    
    console.log('🗺️ BTCMap response features count:', data.elements.length);
    
    // Convert Overpass data to our vendor format
    const vendors: BTCMapVendor[] = data.elements
      .filter(element => element.type === 'node' && element.lat && element.lon) // Only process nodes with coordinates
      .map(element => {
      const tags = element.tags || {};
      
      return {
        id: element.id.toString(),
        name: tags.name || tags['addr:housename'] || 'Unknown Bitcoin Vendor',
        category: tags.shop || tags.amenity || tags.tourism || 'Other',
        lat: element.lat!,
        lon: element.lon!,
        lightning: tags['payment:lightning'] === 'yes' || tags['payment:bitcoin:lightning'] === 'yes',
        onchain: tags['payment:bitcoin'] === 'yes' || tags['payment:onchain'] === 'yes',
        lightning_address: tags['payment:lightning:address'] || tags['lightning_address'],
        onchain_address: tags['payment:bitcoin:address'] || tags['bitcoin_address'],
        phone: tags.phone || tags['contact:phone'],
        website: tags.website || tags.url,
        email: tags.email || tags['contact:email'],
        description: tags.description || tags.note || '',
        opening_hours: tags.opening_hours || tags['opening_hours'],
        address: tags['addr:housenumber'] && tags['addr:street'] 
          ? `${tags['addr:housenumber']} ${tags['addr:street']}`
          : tags['addr:street'] || tags['addr:full_address'],
        city: tags['addr:city'],
        country: tags['addr:country'],
        state: tags['addr:state'] || tags['addr:province'],
        postcode: tags['addr:postcode'] || tags['addr:postcode']
      };
    });
    
    console.log('🗺️ Parsed BTCMap vendors:', vendors.length);
    return vendors;
    
  } catch (error) {
    console.error('🗺️ Error fetching BTCMap vendors:', error);
    return [];
  }
};

// Fallback test data for development
export const getTestBTCMapVendors = (): BTCMapVendor[] => [
  {
    id: 'test1',
    name: 'The Coffee House',
    category: 'Cafe',
    lat: 39.0997,
    lon: -94.5786,
    lightning: true,
    onchain: true,
    lightning_address: 'coffee@bitcoin.com',
    onchain_address: 'bc1qwerty...',
    phone: '+1-555-123-4567',
    website: 'https://coffeehouse.com',
    description: 'Bitcoin-friendly coffee shop',
    opening_hours: 'Mon-Fri 7am-6pm',
    address: '123 Main St',
    city: 'Kansas City',
    state: 'MO'
  },
  {
    id: 'test2',
    name: 'Bitcoin Pizza',
    category: 'Restaurant',
    lat: 39.03219,
    lon: -94.58101,
    lightning: false,
    onchain: true,
    onchain_address: 'bc1example...',
    description: 'Accepts Bitcoin payments',
    opening_hours: 'Mon-Sun 11am-10pm',
    address: '456 Oak St',
    city: 'Kansas City',
    state: 'MO'
  },
  {
    id: 'test3',
    name: 'Crypto Electronics',
    category: 'Retail',
    lat: 39.0833,
    lon: -94.6033,
    lightning: true,
    onchain: true,
    lightning_address: 'crypto@lightning.com',
    onchain_address: 'bc1crypto...',
    phone: '+1-555-987-6543',
    website: 'https://cryptoelectronics.com',
    description: 'Computer store with Bitcoin payments',
    opening_hours: 'Mon-Sat 10am-8pm',
    address: '789 Tech Blvd',
    city: 'Kansas City',
    state: 'MO'
  }
];
