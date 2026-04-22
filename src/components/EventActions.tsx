import React, { useState, useRef, useEffect, useCallback } from "react";

export interface EventAction {
  label: string;
  icon?: string;
  onClick: () => void;
}

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
}

export default function EventActions({
  event,
  extraActions,
  className,
  onDelete,
  onEdit,
}: EventActionsProps) {
  const [open, setOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const toggleMenu = () => {
    updatePosition();
    setOpen(!open);
  };

  const actions: EventAction[] = [
    {
      label: copied === "Share link" ? "Copied!" : "Share",
      icon: "🔗",
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
            icon: "📋",
            onClick: handleCopyId,
          },
        ]
      : []),
    {
      label: copied === "Raw JSON" ? "Copied!" : "Copy Raw JSON",
      icon: "📄",
      onClick: handleCopyRaw,
    },
    ...(onEdit
      ? [
          {
            label: "Edit",
            icon: "✏️",
            onClick: () => {
              onEdit();
              setOpen(false);
            },
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: "Delete",
            icon: "🗑️",
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
    </div>
  );
}
