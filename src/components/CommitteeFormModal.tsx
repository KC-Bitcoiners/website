import React, { useState } from "react";
import {
  Committee,
  buildCommitteeEvent,
  publishCommittee,
} from "@/utils/committeeEvents";

interface CommitteeFormModalProps {
  editCommittee?: Committee | null;
  onDone: () => void;
  onCancel: () => void;
  pubkey?: string;
  signEvent?: (event: {
    kind: number;
    content: string;
    tags: string[][];
    created_at: number;
  }) => Promise<Record<string, unknown>>;
}

export default function CommitteeFormModal({
  editCommittee,
  onDone,
  onCancel,
  pubkey,
  signEvent,
}: CommitteeFormModalProps) {
  const isEditing = !!editCommittee;
  const [title, setTitle] = useState(editCommittee?.title || "");
  const [dTag, setDTag] = useState(editCommittee?.dTag || "");
  const [description, setDescription] = useState(
    editCommittee?.description || "",
  );
  const [meetingSchedule, setMeetingSchedule] = useState(
    editCommittee?.meetingSchedule || "",
  );
  const [openings, setOpenings] = useState(editCommittee?.openings || 0);
  const [image, setImage] = useState(editCommittee?.image || "");
  const [topicTags, setTopicTags] = useState(
    editCommittee?.tags?.join(", ") || "",
  );
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const handleTitleChange = (val: string) => {
    setTitle(val);
    // Auto-generate slug from title if not editing
    if (!isEditing && !dTag) {
      setDTag(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 64),
      );
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!dTag.trim()) {
      setError("Slug is required");
      return;
    }

    setPublishing(true);
    setError("");

    try {
      if (!pubkey && !window.nostr) {
        setError("You must be logged in to publish.");
        setPublishing(false);
        return;
      }

      const tagList = topicTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const unsignedEvent = buildCommitteeEvent({
        dTag: dTag.trim(),
        title: title.trim(),
        description: description.trim(),
        image: image.trim() || undefined,
        meetingSchedule: meetingSchedule.trim() || undefined,
        openings,
        topicTags: tagList,
      });

      let signedEvent;
      if (signEvent && pubkey) {
        signedEvent = await signEvent(
          unsignedEvent as {
            kind: number;
            content: string;
            tags: string[][];
            created_at: number;
          },
        );
      } else if (window.nostr) {
        const pk = await window.nostr.getPublicKey();
        signedEvent = await window.nostr.signEvent({
          ...unsignedEvent,
          pubkey: pk,
        });
      }
      const success = await publishCommittee(signedEvent);

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
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
        data-testid="committee-form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          {isEditing ? "Edit Committee" : "Create Committee"}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              data-testid="committee-title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Events Committee"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug *
            </label>
            <input
              data-testid="committee-slug"
              type="text"
              value={dTag}
              onChange={(e) =>
                setDTag(e.target.value.replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="e.g. events"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent font-mono"
              disabled={isEditing}
            />
            <p className="text-xs text-gray-500 mt-1">
              Used as a unique identifier (lowercase, dashes only)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              data-testid="committee-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this committee do?"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Schedule
            </label>
            <input
              data-testid="committee-schedule"
              type="text"
              value={meetingSchedule}
              onChange={(e) => setMeetingSchedule(e.target.value)}
              placeholder="e.g. First Thursday at 7 PM"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Open Positions
            </label>
            <input
              data-testid="committee-openings"
              type="number"
              value={openings}
              onChange={(e) => setOpenings(parseInt(e.target.value, 10) || 0)}
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image URL
            </label>
            <input
              data-testid="committee-image"
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              data-testid="committee-tags"
              type="text"
              value={topicTags}
              onChange={(e) => setTopicTags(e.target.value)}
              placeholder="governance, fundraising, outreach"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            data-testid="committee-cancel"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="committee-publish"
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 px-4 py-2 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors disabled:opacity-50"
          >
            {publishing ? "Publishing..." : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
