import React, { useState } from "react";
import {
  CommitteeOpening,
  buildCommitteeOpeningEvent,
  publishCommitteeOpening,
} from "@/utils/committeeEvents";

interface CommitteeOpeningFormModalProps {
  committeeCoordinate: string;
  editOpening?: CommitteeOpening | null;
  onDone: () => void;
  onCancel: () => void;
  pubkey?: string;
  signEvent?: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<Record<string, unknown>>;
}

export default function CommitteeOpeningFormModal({
  committeeCoordinate,
  editOpening,
  onDone,
  onCancel,
  pubkey,
  signEvent,
}: CommitteeOpeningFormModalProps) {
  const isEditing = !!editOpening;
  const [title, setTitle] = useState(editOpening?.title || "");
  const [description, setDescription] = useState(editOpening?.description || "");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const handlePublish = async () => {
    if (!title.trim()) { setError("Title is required"); return; }

    setPublishing(true);
    setError("");

    try {
      if (!pubkey && !window.nostr) {
        setError("You must be logged in to publish.");
        setPublishing(false);
        return;
      }

      const dTag = isEditing
        ? editOpening!.dTag
        : `opening-${Date.now().toString(36)}`;

      const unsignedEvent = buildCommitteeOpeningEvent({
        committeeCoordinate,
        dTag,
        title: title.trim(),
        description: description.trim() || undefined,
      });

      let signedEvent;
      if (signEvent && pubkey) {
        signedEvent = await signEvent(unsignedEvent as { kind: number; content: string; tags: string[][]; created_at: number });
      } else if (window.nostr) {
        const pk = await window.nostr.getPublicKey();
        signedEvent = await window.nostr.signEvent({ ...unsignedEvent, pubkey: pk });
      }
      const success = await publishCommitteeOpening(signedEvent);

      if (success) {
        onDone();
      } else {
        setError("Failed to publish to relays. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
    setPublishing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
        data-testid="opening-form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          {isEditing ? "Edit Opening" : "Add Opening"}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              data-testid="opening-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Treasurer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              data-testid="opening-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the role, responsibilities, qualifications..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            data-testid="opening-cancel"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="opening-publish"
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 px-4 py-2 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors disabled:opacity-50"
          >
            {publishing ? "Publishing..." : isEditing ? "Update" : "Add Opening"}
          </button>
        </div>
      </div>
    </div>
  );
}
