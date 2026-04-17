import React, { useState, useRef, useEffect } from "react";

export interface EventAction {
  label: string;
  icon?: string;
  onClick: () => void;
}

interface EventActionsProps {
  event: Record<string, unknown>;
  extraActions?: EventAction[];
  className?: string;
  onDelete?: () => void;
  onEdit?: () => void;
}

export default function EventActions({ event, extraActions, className, onDelete, onEdit }: EventActionsProps) {
  const [open, setOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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
    const text = eventId
      ? `nostr:${eventId}`
      : JSON.stringify(event);
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
    setShowRaw(!showRaw);
    setOpen(false);
  };

  const actions: EventAction[] = [
    {
      label: copied === "Share link" ? "Copied!" : "Share",
      icon: "->",
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
            icon: "[ ]",
            onClick: handleCopyId,
          },
        ]
      : []),
    {
      label: copied === "Raw JSON" ? "Copied!" : "Copy Raw JSON",
      icon: "{}",
      onClick: handleCopyRaw,
    },
    ...(onEdit
      ? [
          {
            label: "Edit",
            icon: "Ed",
            onClick: () => { onEdit(); setOpen(false); },
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: "Delete",
            icon: "Del",
            onClick: () => { onDelete(); setOpen(false); },
          },
        ]
      : []),
    ...(extraActions || []),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="Actions"
        className={`px-2 py-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700 font-bold text-lg leading-none ${className || ""}`}
      >
        ...
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-bitcoin-orange transition-colors flex items-center gap-2"
            >
              {action.icon && <span className="w-5 text-center">{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {showRaw && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-[400px] max-w-[90vw]">
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
    </div>
  );
}
