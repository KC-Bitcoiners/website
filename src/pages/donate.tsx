import { nostrRelays, WHITELISTED_PUBKEYS, basePath } from "@/config";
import EventActions from "@/components/EventActions";
import { pool } from "@/lib/nostr";
import {
  getZapGoalAmount,
  getZapGoalClosedAt,
  getZapGoalRelays,
  isValidZapGoal,
  ZAP_GOAL_KIND,
} from "@/utils/zapGoals";
import { Filter } from "applesauce-core/helpers";
import { kinds, NostrEvent } from "applesauce-core/helpers/event";
import {
  getEventPointerForEvent,
  neventEncode,
} from "applesauce-core/helpers/pointers";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

export interface Zapraiser {
  goal: NostrEvent;
  current: number;
  author?: {
    name?: string;
    display_name?: string;
    picture?: string;
    about?: string;
  };
}

export interface ZapReceipt {
  id: string;
  pubkey: string;
  amount: number;
  zapraiserId: string;
  created_at: number;
}

// Progress bar component with smooth animation
const ProgressBar = ({
  current,
  goal,
  label,
}: {
  current: number;
  goal: number;
  label: string;
}) => {
  const targetPercentage = Math.min((current / goal) * 100, 100);
  const [displayPercentage, setDisplayPercentage] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);

  // Reset animation when target changes
  useEffect(() => {
    console.log("🔹 ProgressBar useEffect triggered", {
      current,
      goal,
      targetPercentage,
      displayPercentage,
    });

    // Force a new animation by incrementing the key
    setAnimationKey((prev) => prev + 1);

    // Reset to 0
    setDisplayPercentage(0);
    console.log("🔹 Reset to 0%");

    // Start animation after a delay
    const timer = setTimeout(() => {
      console.log("🔹 Starting animation to", targetPercentage);
      setDisplayPercentage(targetPercentage);
    }, 300);

    return () => clearTimeout(timer);
  }, [targetPercentage]);

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm text-gray-600">
          {current.toLocaleString()} / {goal.toLocaleString()} sats (
          {targetPercentage.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          key={animationKey}
          className="bg-bitcoin-orange h-3 rounded-full"
          style={{
            width: `${displayPercentage}%`,
            transition: displayPercentage === 0 ? "none" : "width 3s ease-out",
          }}
        />
      </div>
    </div>
  );
};

// Three dot menu component for note ID
const NoteIdMenu = ({ noteId }: { noteId: string }) => {
  const [showMenu, setShowMenu] = useState(false);

  const copyNoteId = () => {
    navigator.clipboard.writeText(noteId);
    setShowMenu(false);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-1 rounded-full hover:bg-gray-100"
      >
        <svg
          className="w-5 h-5 text-gray-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-700">
              <div className="font-medium">Note ID</div>
              <div className="text-xs text-gray-500 truncate">{noteId}</div>
            </div>
            <button
              onClick={copyNoteId}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
            >
              Copy Note ID
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// QR Code component for note ID (njump.me URL)
const NoteQRCode = ({
  goal,
  relays,
}: {
  goal: NostrEvent;
  relays?: string[];
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const pointer = useMemo(
    () => getEventPointerForEvent(goal, relays),
    [goal, relays],
  );

  useEffect(() => {
    // Generate QR code for the njump.me URL with encoded nevent
    const nevent = neventEncode(pointer);
    const url = `https://njump.me/${nevent}`;
    QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        setQrCodeUrl(url);
      })
      .catch((err) => {
        console.error("Error generating QR code:", err);
      });
  }, [goal, relays]);

  return (
    <div className="flex justify-center">
      {qrCodeUrl && (
        <div className="p-2 bg-white border border-gray-200 rounded-lg">
          <img
            src={qrCodeUrl}
            alt="QR Code for zapping"
            className="w-32 h-32"
          />
        </div>
      )}
    </div>
  );
};

// QR Code component for nostr:nevent URI
const NoteIdQRCode = ({
  goal,
  relays,
}: {
  goal: NostrEvent;
  relays?: string[];
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const pointer = useMemo(
    () => getEventPointerForEvent(goal, relays),
    [goal, relays],
  );

  useEffect(() => {
    // Convert note ID to a proper nevent format using nip19
    const nevent = neventEncode(pointer);

    QRCode.toDataURL(nevent, {
      width: 200,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        setQrCodeUrl(url);
      })
      .catch((err) => {
        console.error("Error generating QR code:", err);
      });
  }, [goal, relays, pointer]);

  return (
    <div className="flex justify-center">
      {qrCodeUrl && (
        <div className="p-2 bg-white border border-gray-200 rounded-lg">
          <img
            src={qrCodeUrl}
            alt="QR Code for nostr URI"
            className="w-32 h-32"
          />
        </div>
      )}
    </div>
  );
};

// Zapraiser Card Component
const ZapraiserCard = ({
  zapraiser,
  index,
}: {
  zapraiser: Zapraiser;
  index: number;
}) => {
  const goalAmount = getZapGoalAmount(zapraiser.goal) || 0;
  const percentage =
    goalAmount > 0 ? (zapraiser.current / goalAmount) * 100 : 0;
  const remaining = Math.max(0, goalAmount - zapraiser.current);

  return (
    <div
      key={zapraiser.goal.id}
      className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-all"
      style={{
        opacity: 1,
        transform: "translateY(0)",
        animation: `fadeIn 0.5s ease-in-out ${index * 0.1}s both`,
        animationFillMode: "both",
      }}
    >
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Left Column: Metadata, Note Text, and Progress Bar */}
        <div className="flex-grow min-w-0">
          {/* Author Info */}
          <div className="flex items-center mb-4">
            {zapraiser.author?.picture && (
              <img
                src={zapraiser.author.picture}
                alt={zapraiser.author.name || "Author"}
                className="w-12 h-12 rounded-full mr-3"
              />
            )}
            <div>
              <h3 className="font-semibold text-gray-900">
                {zapraiser.author?.name ||
                  zapraiser.author?.display_name ||
                  "Anonymous"}
              </h3>
              <p className="text-sm text-gray-500">
                {new Date(
                  zapraiser.goal.created_at * 1000,
                ).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Zapraiser Content */}
          <div className="mb-4 text-left">
            <p className="text-gray-800 whitespace-pre-wrap">
              {zapraiser.goal.content}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <ProgressBar
              key={`${zapraiser.goal.id}-${zapraiser.current}`}
              current={zapraiser.current}
              goal={goalAmount}
              label="Progress"
            />
          </div>
        </div>

        {/* Right Column: QR Code and Three Dot Menu */}
        <div className="flex items-center gap-2">
          {/* QR Code */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-xs text-gray-500">Scan to zap</div>
            <NoteQRCode
              goal={zapraiser.goal}
              relays={getZapGoalRelays(zapraiser.goal)}
            />
          </div>

          {/* Event actions */}
          <EventActions event={zapraiser.goal as Record<string, unknown>} />
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>
            {zapraiser.current > 0
              ? `${percentage.toFixed(1)}% funded`
              : "No zaps yet"}
          </span>
          <span>
            {remaining > 0
              ? `${remaining.toLocaleString()} sats remaining`
              : "Goal reached! 🎉"}
          </span>
        </div>
      </div>
    </div>
  );
};

// Fetch zapraisers from whitelisted users (NIP-75 zap goals)
async function fetchZapraisers(): Promise<Zapraiser[]> {
  console.log("🔍 Starting to fetch zap goals...");

  const filter = {
    kinds: [ZAP_GOAL_KIND], // NIP-75 zap goals
    authors: WHITELISTED_PUBKEYS,
    limit: 100,
  };

  console.log("🎯 Using zap goals filter:", filter);
  console.log("🌐 Using relays:", nostrRelays);

  const zapraisers: Zapraiser[] = [];

  try {
    const eventsPromise = new Promise<NostrEvent[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log("⏰ Request timeout");
        reject(new Error("Request timeout"));
      }, 30000); // 30 second timeout

      const events: NostrEvent[] = [];

      pool.request(nostrRelays, filter).subscribe({
        next: (nostrEvent: NostrEvent) => {
          console.log(`🎯 Found potential zap goal:`, nostrEvent.id);

          // Validate it's a valid zap goal event
          if (isValidZapGoal(nostrEvent)) {
            events.push(nostrEvent);
            const amount = getZapGoalAmount(nostrEvent);
            console.log(
              `➕ Added zap goal: ${nostrEvent.content.substring(0, 50)}... Goal: ${amount} sats`,
            );
          } else {
            console.log(`⏭ Skipping invalid zap goal: ${nostrEvent.id}`);
          }
        },
        error: (error) => {
          console.error("💥 Error fetching zap goals:", error);
          clearTimeout(timeout);
          reject(error);
        },
        complete: () => {
          console.log("📭 End of stored zap goals");
          clearTimeout(timeout);
          resolve(events);
        },
      });
    });

    const events = await eventsPromise;

    // Convert events to Zapraiser format using helper functions
    for (const event of events) {
      if (!isValidZapGoal(event)) continue;

      const amount = getZapGoalAmount(event);
      if (amount === null) continue;

      const zapraiser: Zapraiser = {
        goal: event,
        current: 0,
      };

      zapraisers.push(zapraiser);
    }
  } catch (error) {
    console.warn("⚠️ Failed to fetch zap goals:", error);
  }

  console.log(`📊 Total zap goals fetched: ${zapraisers.length}`);
  return zapraisers;
}

// Fetch zap receipts for a specific zap goal
async function fetchZapReceipts(goal: NostrEvent): Promise<ZapReceipt[]> {
  console.log(`🔍 Fetching zap receipts for zap goal: ${goal.id}`);

  const relays = getZapGoalRelays(goal);
  const closedAt = getZapGoalClosedAt(goal);
  const filter: Filter = {
    kinds: [kinds.Zap], // Zap receipts
    "#e": [goal.id], // Filter for receipts referencing this zap goal
  };

  // Set upper limit on zaps
  if (closedAt) filter.until = closedAt;

  console.log("🎯 Using zap receipts filter:", filter);
  console.log("🌐 Using goal relays:", relays);

  const receipts: ZapReceipt[] = [];
  const receiptIds = new Set<string>(); // Track unique receipt IDs to prevent duplicates

  try {
    const eventsPromise = new Promise<any[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log("⏰ Zap receipts timeout");
        reject(new Error("Request timeout"));
      }, 15000); // 15 second timeout

      const events: any[] = [];

      // Use the relays from the goal event, fallback to nostrRelays if empty
      const relaysToUse = relays.length > 0 ? relays : nostrRelays;

      pool.request(relaysToUse, filter).subscribe({
        next: (nostrEvent) => {
          console.log(`🎯 Found zap receipt:`, nostrEvent.id);

          // Filter by closed_at if present - only count zaps before closed_at
          if (closedAt && nostrEvent.created_at > closedAt) {
            console.log(
              `⏭ Skipping zap receipt after closed_at: ${nostrEvent.id}`,
            );
            return;
          }

          // Extract amount from bolt11 tag or description tag
          const amount = extractZapAmount(nostrEvent);
          if (amount > 0) {
            // Skip duplicates
            if (receiptIds.has(nostrEvent.id)) {
              console.log(`⏭ Skipping duplicate receipt: ${nostrEvent.id}`);
              return;
            }

            receiptIds.add(nostrEvent.id);

            const receipt: ZapReceipt = {
              id: nostrEvent.id,
              pubkey: nostrEvent.pubkey,
              created_at: nostrEvent.created_at,
              amount: amount,
              zapraiserId: goal.id,
            };

            events.push(receipt);
            receipts.push(receipt);
            console.log(`➕ Added zap receipt: ${amount} sats`);
          }
        },
        error: (error) => {
          console.error("💥 Error fetching zap receipts:", error);
          clearTimeout(timeout);
          reject(error);
        },
        complete: () => {
          console.log("📭 End of stored zap receipts");
          clearTimeout(timeout);
          resolve(events);
        },
      });
    });

    await eventsPromise;
    console.log(`📊 Total zap receipts for ${goal.id}: ${receipts.length}`);
  } catch (error) {
    console.warn(`⚠️ Failed to fetch zap receipts for ${goal.id}:`, error);
  }

  return receipts;
}

// Extract zap amount from a zap receipt event
function extractZapAmount(event: any): number {
  // Try to find amount in bolt11 tag
  const bolt11Tag = event.tags?.find((tag: string[]) => tag[0] === "bolt11");
  if (bolt11Tag && bolt11Tag[1]) {
    // Parse amount from bolt11 invoice - look for milli-satoshis pattern
    const msatMatch = bolt11Tag[1].match(/amount=(\d+)/);
    if (msatMatch) {
      // Convert from millisatoshis to satoshis
      const msats = parseInt(msatMatch[1]);
      return Math.floor(msats / 1000);
    }

    // Alternative: try to extract from the invoice data directly
    try {
      const invoice = bolt11Tag[1];
      if (invoice.includes("lnbc")) {
        // Fallback: try to match amount followed by unit
        const fallbackMatch = invoice.match(/(\d+)([munp])/);
        if (fallbackMatch) {
          const amount = parseInt(fallbackMatch[1]);
          const unit = fallbackMatch[2];

          switch (unit) {
            // case 'p': return Math.floor(amount / 10);
            case "n":
              return Math.floor(amount / 10);
            case "u":
              return Math.floor(amount * 100);
            // case 'm': return Math.floor(amount * 100000);
            default:
              return Math.floor(amount * 100000000);
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  return 0;
}

// Fetch user metadata
async function fetchUserMetadata(pubkey: string) {
  console.log("🔍 Fetching metadata for pubkey:", pubkey);

  const filter = {
    kinds: [0],
    authors: [pubkey],
    limit: 1,
  };

  try {
    const eventsPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Metadata timeout"));
      }, 5000);

      pool.request(nostrRelays, filter).subscribe({
        next: (nostrEvent) => {
          clearTimeout(timeout);
          try {
            const metadata = JSON.parse(nostrEvent.content);
            resolve(metadata);
          } catch (e) {
            resolve({});
          }
        },
        error: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        complete: () => {
          clearTimeout(timeout);
          resolve({});
        },
      });
    });

    return await eventsPromise;
  } catch (error) {
    console.warn(`⚠️ Failed to fetch metadata for ${pubkey}:`, error);
    return {};
  }
}

export default function DonatePage() {
  const [zapraisers, setzapraisers] = useState<Zapraiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add a global animation style
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Auto-refresh zap receipts every 30 seconds
  useEffect(() => {
    if (zapraisers.length === 0) return; // Don't refresh if no zapraisers

    const interval = setInterval(async () => {
      console.log("🔄 Auto-refreshing zap receipts...");

      // Update each zapraiser with new zap receipts
      const updatedzapraisers = await Promise.all(
        zapraisers.map(async (zapraiser: Zapraiser) => {
          // Fetch fresh zap receipts for this zap goal
          const receipts = await fetchZapReceipts(zapraiser.goal);
          const totalZapped = receipts.reduce(
            (sum, receipt) => sum + receipt.amount,
            0,
          );

          return {
            ...zapraiser,
            current: totalZapped,
          };
        }),
      );

      // Update state with new progress
      setzapraisers(updatedzapraisers);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [zapraisers]); // Only run interval when zapraisers are loaded

  useEffect(() => {
    async function loadzapraisers() {
      try {
        setLoading(true);
        setError(null);

        // Fetch zapraisers
        const zapraisersData = await fetchZapraisers();

        // For each zapraiser, fetch its zap receipts and author metadata
        const zapraisersWithProgress = await Promise.all(
          zapraisersData.map(async (zapraiser: Zapraiser) => {
            // Fetch zap receipts for this zap goal using its relays
            const receipts = await fetchZapReceipts(zapraiser.goal);
            const totalZapped = receipts.reduce(
              (sum, receipt) => sum + receipt.amount,
              0,
            );

            // Fetch author metadata
            const authorMetadata = await fetchUserMetadata(
              zapraiser.goal.pubkey,
            );

            return {
              ...zapraiser,
              current: totalZapped,
              author: authorMetadata,
            };
          }),
        );

        // Sort by creation time (newest first)
        zapraisersWithProgress.sort(
          (a: Zapraiser, b: Zapraiser) => b.goal.created_at - a.goal.created_at,
        );

        setzapraisers(zapraisersWithProgress);
      } catch (err) {
        console.error("Failed to load zapraisers:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load zapraisers",
        );
      } finally {
        setLoading(false);
      }
    }

    loadzapraisers();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8 font-archivo-black">Donate</h1>
          <div className="bitcoin-shaka-container">
            <img
              src={`${basePath}/bitcoinShaka.jpg`}
              alt="Loading..."
              className="bitcoin-shaka-spinner"
            />
          </div>
          <p className="mt-4 text-gray-600">Loading zapraisers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8 font-archivo-black">Donate</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-600">
              Unable to load zapraisers at this time.
            </p>
            <p className="text-sm text-red-500 mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* zapraisers Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-8 font-archivo-black bitcoin-orange text-center">
          Active Zapraisers
        </h2>

        {zapraisers.length > 0 ? (
          <div className="space-y-8">
            {zapraisers.map((zapraiser, index) => (
              <ZapraiserCard
                key={zapraiser.goal.id}
                zapraiser={zapraiser}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600 text-lg mb-4">
              No active zapraisers found
            </p>
            <p className="text-gray-500">
              Check back later for new fundraising campaigns from our community
              members.
            </p>
          </div>
        )}
      </section>

      {/* Info Section */}
      <section className="mt-16 bg-gradient-to-r from-gray-50 to-orange-50 border border-gray-200 rounded-lg p-8">
        <h3 className="text-2xl font-bold mb-4 font-archivo-black">
          How to Zap
        </h3>
        <div className="prose max-w-none text-gray-700">
          <ol className="list-decimal list-inside space-y-2">
            <li>Copy the note ID from any zapraiser above</li>
            <li>
              Paste it into your favorite Nostr client (like Snort, Coracle, or
              Damus)
            </li>
            <li>Click the zap button and enter your amount</li>
            <li>Send your sats and watch the progress bar update!</li>
          </ol>
          <p className="mt-4">
            Only whitelisted community members can create zapraisers, ensuring
            all campaigns are from trusted sources.
          </p>
          <p>
            Support our community with Bitcoin zaps! These zapraisers are
            fundraising campaigns from trusted community members. Every sat
            counts towards building a stronger Bitcoin ecosystem.
          </p>
        </div>
      </section>
    </div>
  );
}
