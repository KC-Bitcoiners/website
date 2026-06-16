#!/bin/bash

# Simple dev setup script
echo "🏙️  Bitcoin Meetup Site Setup"
echo "============================"

# Get user input
echo
read -p "Enter city name: " CITY
read -p "Enter state abbreviation (e.g., MO, KS, NY): " STATE

if [[ -z "$CITY" || -z "$STATE" ]]; then
    echo "❌ City and state are required!"
    exit 1
fi

echo
echo "🔍 Looking up coordinates for $CITY, $STATE..."

# Simple geocoding approach - no hardcoded states
echo "🔍 Searching for coordinates..."

# Try city with state first
SEARCH_QUERY="${CITY}, ${STATE}, USA"
COORDS=$(curl -s "https://nominatim.openstreetmap.org/search?format=json&q=$(printf '%s' "$SEARCH_QUERY" | jq -sR @uri)&limit=1" | jq -r '.[0] | "\(.lat) \(.lon)"' 2>/dev/null)

# If that fails, try city name only
if [[ -z "$COORDS" || "$COORDS" == "null null" ]]; then
    echo "⚠️  City + state not found, trying city name only..."
    SEARCH_QUERY="${CITY}, USA"
    COORDS=$(curl -s "https://nominatim.openstreetmap.org/search?format=json&q=$(printf '%s' "$SEARCH_QUERY" | jq -sR @uri)&limit=1" | jq -r '.[0] | "\(.lat) \(.lon)"' 2>/dev/null)
fi

if [[ -z "$COORDS" || "$COORDS" == "null null" ]]; then
    echo "❌ Could not find coordinates for $CITY, $STATE"
    exit 1
fi

LAT=$(echo $COORDS | cut -d' ' -f1)
LON=$(echo $COORDS | cut -d' ' -f2)

echo "✅ Found coordinates: $LAT, $LON"

# Image selection
echo
echo "🖼️  Select hero image:"
echo "1) /bitcoinShaka.jpg (default)"
echo "2) /logo.jpeg"
echo "3) Enter custom path"
echo "4) Enter URL (https://...)"
read -p "Choose option (1-4): " IMG_CHOICE

case $IMG_CHOICE in
    1)
        HERO_IMAGE="/bitcoinShaka.jpg"
        ;;
    2)
        HERO_IMAGE="/logo.jpeg"
        ;;
    3)
        read -p "Enter image path: " HERO_IMAGE
        ;;
    4)
        read -p "Enter image URL: " HERO_IMAGE_TEMP
        HERO_IMAGE="$HERO_IMAGE_TEMP"
        # Validate URL format
        if [[ ! "$HERO_IMAGE" =~ ^https?:// ]]; then
            echo "⚠️  Warning: URL should start with http:// or https://"
        fi
        ;;
    *)
        HERO_IMAGE="/bitcoinShaka.jpg"
        ;;
esac

echo "Using hero image: $HERO_IMAGE"

# Logo selection
echo
echo "🎨 Select logo:"
echo "1) /logo.svg (default)"
echo "2) /logo.jpeg"
echo "3) Enter custom path"
echo "4) Enter URL (https://...)"
read -p "Choose option (1-4): " LOGO_CHOICE

case $LOGO_CHOICE in
    1)
        LOGO_IMAGE="/logo.svg"
        ;;
    2)
        LOGO_IMAGE="/logo.jpeg"
        ;;
    3)
        read -p "Enter logo path: " LOGO_IMAGE
        ;;
    4)
        read -p "Enter logo URL: " LOGO_IMAGE
        # Validate URL format
        if [[ ! "$LOGO_IMAGE" =~ ^https?:// ]]; then
            echo "⚠️  Warning: URL should start with http:// or https://"
        fi
        ;;
    *)
        LOGO_IMAGE="/logo.svg"
        ;;
esac

echo "Using logo: $LOGO_IMAGE"

# Create new config
CONFIG_FILE="config-${CITY,,}-${STATE,,}.json"
echo
echo "📝 Creating config: $CONFIG_FILE"

# Backup original config if it exists
if [[ -f "config.json" ]]; then
    cp config.json config.backup.json
    echo "📄 Backed up original config to config.backup.json"
fi

# Generate city-safe name (replace spaces with hyphens, lowercase)
CITY_SAFE=$(echo "$CITY" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')

# Generate new config using jq
cat > "$CONFIG_FILE" << EOF
{
    "site": {
        "title": "${CITY^} Bitcoin Meetup Group",
        "description": "Bitcoin only group focused on fostering relationships and building community in ${CITY^}",
        "organization": {
            "name": "${CITY^} Bitcoiners",
            "location": "$CITY, $STATE",
            "coordinates": {
                "lat": $LAT,
                "lon": $LON
            }
        },
        "externalLinks": {
    "GitHub": {
        "url": "https://github.com/${CITY_SAFE}-bitcoiners/website",
        "icon": "GitHubIcon",
        "ariaLabel": "Visit our GitHub repository"
    }, 
            "meetup": {
                "urlname": "${CITY_SAFE}-bitcoin-meetup-group",
                "url": "https://www.meetup.com/${CITY_SAFE}-bitcoin-meetup-group/"
            }
        },
        "images": {
            "logo": "$LOGO_IMAGE",
            "logoFallback": "/logo.jpeg",
            "hero": "$HERO_IMAGE"
        }
    },
    "nostr": {
        "relays": [
            "wss://relay.damus.io",
            "wss://nos.lol",
            "wss://relay.snort.social",
            "wss://kcbtc.hzrd149.com/"
        ],
        "whitelistedNpubs": [
            "npub16ux4qzg4qjue95vr3q327fzata4n594c9kgh4jmeyn80v8k54nhqg6lra7",
            "npub1nrswn76gtr6apep95rev06y0cylk2t7utqyw9yn5x7qv8atgn3fscmpv2z",
            "npub187w4ykkurr3e89mm0rg5p49x6lveqtq0pp0um7qyk6xyrpeerx3s84exkz",
            "npub1nv5c7sj2zxtjv7uayp2q2mneymm39mfp93wjhl5287y6yp6ey02qrsjhcn",
            "npub1yvscx9vrmpcmwcmydrm8lauqdpngum4ne8xmkgc2d4rcaxrx7tkswdwzdu",
            "npub1skxl292kf4dtrptxcqkghhxznuvzwk647yuzv69upce47sta0washx92vn"
        ]   
    },
  "pages": {
    "home": {
      "title": "${CITY^} Bitcoiners",
      "meta": {
        "title": "${CITY^} Bitcoin Meetup Group",
        "description": "Bitcoin only group focused on fostering relationships and building community in ${CITY^}"
      },
      "hero": {
        "title": "${CITY^} Bitcoiners",
        "description": "We are a Bitcoin only group focused on fostering relationships and building community. We meet twice monthly throughout the ${CITY^} metro area.",
        "topics": {
          "intro": "Whether you're new to Bitcoin or a long time HODLer this group is for you. Meetups include discussions on topics such as:",
          "list": [
            "Economics",
            "Protocol & Software",
            "Digital Wallets",
            "Investing",
            "Mining",
            "And all other topics Bitcoin!"
          ]
        }
      },
      "callToAction": {
        "title": "Ready to Join the Community?",
        "buttons": [
          {
            "text": "Join Our Meetups",
            "url": "https://www.meetup.com/${CITY_SAFE}-bitcoin-meetup-group/",
            "style": "primary"
          },
          {
            "text": "Support Us",
            "url": "#",
            "style": "secondary"
          }
        ]
      }
    },
    "calendar": {
      "title": "Calendar",
      "meta": {
        "title": "Calendar - ${CITY^} Bitcoiners",
        "description": "Community calendar for ${CITY^} Bitcoiners events and meetups"
      },
      "api": {
        "meetup": {
          "graphqlUrl": "https://api.meetup.com/gql-ext",
          "groupName": "${CITY_SAFE}-bitcoin-meetup-group"
        }
      },
      "defaultView": "month",
      "eventColors": [
        "bg-purple-500 border-purple-600",
        "bg-green-500 border-green-600",
        "bg-yellow-500 border-yellow-600",
        "bg-pink-500 border-pink-600",
        "bg-indigo-500 border-indigo-600"
      ],
      "meetupColor": "bg-bitcoin-orange border-bitcoin-orange",
      "defaultColor": "bg-gray-50 border-gray-200",
      "statistics": {
        "total": "Total",
        "upcoming": "Upcoming",
        "past": "Past"
      },
      "defaultEvent": {
        "durationHours": 2,
        "startTime": "12:00",
        "endTime": "14:00"
      }
    },
    "shop": {
      "title": "Bitcoin Vendors",
      "meta": {
        "title": "Bitcoin Vendors - ${CITY^} Bitcoiners",
        "description": "Directory of Bitcoin-accepting businesses in ${CITY^}"
      },
      "description": "Directory of Bitcoin-accepting businesses and vendors in ${CITY^} area",
      "location": "$CITY, $STATE",
      "coordinates": {
        "lat": $LAT,
        "lon": $LON
      },
      "api": {
        "btcmap": {
          "overpassUrl": "https://overpass-api.de/api/interpreter",
          "defaultBounds": {
            "minLat": $(echo "$LAT - 1" | bc),
            "maxLat": $(echo "$LAT + 1" | bc),
            "minLon": $(echo "$LON - 1" | bc),
            "maxLon": $(echo "$LON + 1" | bc)
          },
          "userAgent": "BitcoinVendorDirectory/1.0"
        }
      },
      "map": {
        "center": {
          "lat": $LAT,
          "lon": $LON
        },
        "defaultZoom": 12,
        "boundsPadding": [50, 50]
      },
      "callToAction": {
        "title": "Know a Bitcoin-Accepting Business?",
        "description": "Help grow this decentralized vendor directory! If you know of a local business that accepts Bitcoin, submit their information to the Nostr network.",
        "buttonText": "Submit New Vendor"
      }
    }
  }
}
EOF

echo "✅ Config created: $CONFIG_FILE"

# Set as active config
cp "$CONFIG_FILE" config.json
echo "📄 Set as active config: config.json"

# Run pnpm dev
echo
echo "🚀 Starting development server..."
echo "🌐 Server will be available at: http://localhost:3000"
echo "🛑 Press Ctrl+C to stop"
echo

pnpm dev
