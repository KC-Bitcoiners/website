import React, { useState, useRef, useEffect, useCallback } from "react";
import ZapModal from "./ZapModal";
import { pool } from "@/lib/nostr";
import { nostrRelays, CLIENT_TAG, LOCATION_TAG } from "@/config";
import { fetchZapTotal } from "@/utils/zaps";
import { neventEncode } from "@/utils/bech32";

export interface EventAction {
  label: string;
  icon?: string;
  onClick: () => void;
}

type SignerFn = (event: {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
}) => Promise<Record<string, unknown>>;

interface EventActionsProps {
  event: Record<string, unknown>;
  /** Extra actions beyond the defaults */
  extraActions?: EventAction[];
  /** Optional class for the trigger button */
  className?: string;
  /** Callback when user requests delete. If not provided, delete option is hidden. */
  onDelete?: () => void;
  /** Callback when user requests edit. If not provided, edit option is hidden. */
  onEdit?: () => void;
  /** Signer function for zap/repost support. If not provided, those options are hidden. */
  signEvent?: SignerFn;
  /** Current user's pubkey for zap support. */
  pubkey?: string | null;
}

export default function EventActions({
  event,
  extraActions,
  className,
  onDelete,
  onEdit,
  signEvent,
  pubkey,
}: EventActionsProps) {
  const [open, setOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [showZap, setShowZap] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [repostStatus, setRepostStatus] = useState<"idle" | "loading" | "done">("idle");
  const [repostResult, setRepostResult] = useState<{
    nevent: string;
    relays: string[];
  } | null>(null);
  const [zapTotal, setZapTotal] = useState<number | null>(null);
  const [zapRefreshKey, setZapRefreshKey] = useState(0);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch zap total for this event — re-fetches when zapRefreshKey changes
  useEffect(() => {
    const id = event.id as string | undefined;
    if (!id) return;
    let cancelled = false;
    const authorPubkey = event.pubkey as string | undefined;
    fetchZapTotal(id, authorPubkey).then((total) => {
      if (!cancelled && total > 0) setZapTotal(total);
    });
    return () => { cancelled = true; };
  }, [event.id, event.pubkey, zapRefreshKey]);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setShowRaw(false);
      }
    }
    if (open || showRaw) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, showRaw]);

  const eventId = event.id as string | undefined;
  const eventKind = event.kind as number | undefined;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleShare = async () => {
    const text = eventId ? `nostr:${eventId}` : JSON.stringify(event);
    await copyToClipboard(text, "Share link");
    setOpen(false);
  };

  const handleCopyId = async () => {
    if (eventId) {
      await copyToClipboard(eventId, "Event ID");
    }
    setOpen(false);
  };

  const handleCopyRaw = async () => {
    await copyToClipboard(JSON.stringify(event, null, 2), "Raw JSON");
    setOpen(false);
  };

  const handleViewRaw = () => {
    updatePosition();
    setShowRaw(!showRaw);
    setOpen(false);
  };

  // NIP-18 repost handler — publishes a kind 16 (generic repost) event
  const handleRepost = async () => {
    if (!signEvent || !eventId || !event.pubkey) return;
    setRepostStatus("loading");

    try {
      const relayHint = nostrRelays[0] || "wss://relay.damus.io";
      const tags: string[][] = [
        ["e", eventId, relayHint],
        ["p", event.pubkey as string],
      ];
      if (eventKind) tags.push(["k", String(eventKind)]);
      tags.push([...CLIENT_TAG], [...LOCATION_TAG]);

      const unsigned = {
        kind: 16,
        content: "",
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signed = await signEvent(unsigned);
      await pool.publish(nostrRelays, signed as any);

      // Build nevent link for the reposted event
      const nevent = neventEncode({
        id: eventId,
        relays: [relayHint],
        author: event.pubkey as string,
        kind: eventKind,
      });

      setRepostStatus("done");
      setRepostResult({ nevent, relays: nostrRelays });
      setOpen(false);
    } catch {
      setRepostStatus("idle");
      setOpen(false);
    }
  };

  const toggleMenu = () => {
    updatePosition();
    setOpen(!open);
  };

  // Close repost popup
  const closeRepostResult = () => {
    setRepostResult(null);
    setRepostStatus("idle");
  };

  const actions: EventAction[] = [
    // Zap action — show whenever the event has an author pubkey
    ...(event.pubkey
      ? [
          {
            label: "Zap",
            icon: "\u26A1",
            onClick: () => {
              setOpen(false);
              setShowZap(true);
            },
          },
        ]
      : []),
    // NIP-18 repost — only when signer and event id exist
    ...(signEvent && eventId
      ? [
          {
            label: repostStatus === "done" ? "Reposted!" : "Repost",
            icon: "\u21BB",
            onClick: handleRepost,
          },
        ]
      : []),
    {
      label: copied === "Share link" ? "Copied!" : "Share",
      icon: "\u{1F517}",
      onClick: handleShare,
    },
    {
      label: "View Raw Data",
      icon: "{ }",
      onClick: handleViewRaw,
    },
    ...(eventId
      ? [
          {
            label: copied === "Event ID" ? "Copied!" : "Copy Event ID",
            icon: "\u{1F4CB}",
            onClick: handleCopyId,
          },
        ]
      : []),
    {
      label: copied === "Raw JSON" ? "Copied!" : "Copy Raw JSON",
      icon: "\u{1F4C4}",
      onClick: handleCopyRaw,
    },
    // Only show edit/delete when the current user owns this event
    ...(onEdit && pubkey && event.pubkey === pubkey
      ? [
          {
            label: "Edit",
            icon: "\u270F\uFE0F",
            onClick: () => {
              onEdit();
              setOpen(false);
            },
          },
        ]
      : []),
    ...(onDelete && pubkey && event.pubkey === pubkey
      ? [
          {
            label: "Delete",
            icon: "\u{1F5D1}\uFE0F",
            onClick: () => {
              onDelete();
              setOpen(false);
            },
          },
        ]
      : []),
    ...(extraActions || []),
  ];

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={toggleMenu}
        title="Actions"
        className={`px-2.5 py-1.5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700 font-bold text-lg leading-none min-w-[36px] min-h-[36px] flex items-center justify-center ${className || ""}`}
      >
        ...
      </button>

      {/* Zap total badge */}
      {zapTotal !== null && (
        <div className={`text-xs text-bitcoin-orange font-semibold flex items-center gap-0.5 justify-center ${className || ""}`}>
          <span>&#x26A1;</span>
          <span>{zapTotal >= 1000000 ? `${(zapTotal / 1000000).toFixed(1)}M` : zapTotal >= 1000 ? `${(zapTotal / 1000).toFixed(1)}k` : zapTotal}</span>
        </div>
      )}

      {/* Dropdown — fixed positioning to escape overflow clipping */}
      {open && position && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px] z-[9999]"
          style={{ top: position.top, right: position.right }}
        >
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-bitcoin-orange transition-colors flex items-center gap-2"
            >
              {action.icon && (
                <span className="w-5 text-center">{action.icon}</span>
              )}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Raw data panel — fixed positioning */}
      {showRaw && position && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg w-[400px] max-w-[90vw] z-[9999]"
          style={{ top: position.top, right: position.right }}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Raw Event{eventKind ? ` (kind ${eventKind})` : ""}
            </span>
            <button
              onClick={() => setShowRaw(false)}
              className="text-gray-400 hover:text-gray-700 text-xs font-medium"
            >
              Close
            </button>
          </div>
          <pre className="text-xs text-gray-700 overflow-auto whitespace-pre-wrap break-all max-h-64 p-4">
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>
      )}

      {/* Repost success popup — shows relays and nevent link */}
      {repostResult && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={closeRepostResult}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Reposted!</h3>
              <button
                onClick={closeRepostResult}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* nevent link */}
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">Event link</p>
              <a
                href={`https://njump.me/${repostResult.nevent}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-bitcoin-orange hover:underline break-all"
              >
                {repostResult.nevent}
              </a>
            </div>

            {/* Relays published to */}
            <div>
              <p className="text-sm text-gray-500 mb-1">Published to relays:</p>
              <ul className="text-xs text-gray-600 space-y-0.5">
                {repostResult.relays.map((r) => (
                  <li key={r} className="font-mono">{r}</li>
                ))}
              </ul>
            </div>

            <button
              onClick={closeRepostResult}
              className="mt-4 w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Zap modal */}
      {showZap && (
        <ZapModal
          event={event}
          isOpen={showZap}
          onClose={() => setShowZap(false)}
          signEvent={signEvent}
          pubkey={pubkey ?? null}
          onZapConfirmed={() => setZapRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
