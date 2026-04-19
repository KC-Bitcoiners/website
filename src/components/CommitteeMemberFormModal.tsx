import React, { useState } from "react";
import {
  CommitteeMember,
  buildCommitteeMemberEvent,
  publishCommitteeMember,
} from "@/utils/committeeEvents";

interface CommitteeMemberFormModalProps {
  committeeCoordinate: string;
  editMember?: CommitteeMember | null;
  onDone: () => void;
  onCancel: () => void;
  pubkey?: string;
  signEvent?: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<Record<string, unknown>>;
}

export default function CommitteeMemberFormModal({
  committeeCoordinate,
  editMember,
  onDone,
  onCancel,
  pubkey,
  signEvent,
}: CommitteeMemberFormModalProps) {
  const isEditing = !!editMember;
  const [name, setName] = useState(editMember?.name || "");
  const [role, setRole] = useState(editMember?.role || "");
  const [email, setEmail] = useState(editMember?.email || "");
  const [phone, setPhone] = useState(editMember?.phone || "");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const handlePublish = async () => {
    if (!name.trim()) { setError("Name is required"); return; }

    setPublishing(true);
    setError("");

    try {
      if (!pubkey && !window.nostr) {
        setError("You must be logged in to publish.");
        setPublishing(false);
        return;
      }

      // Generate dTag: slug from name + random suffix (or reuse for edits)
      const dTag = isEditing
        ? editMember!.dTag
        : `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${Date.now().toString(36)}`;

      const unsignedEvent = buildCommitteeMemberEvent({
        committeeCoordinate,
        dTag,
        role,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      let signedEvent;
      if (signEvent && pubkey) {
        signedEvent = await signEvent(unsignedEvent as { kind: number; content: string; tags: string[][]; created_at: number });
      } else if (window.nostr) {
        const pk = await window.nostr.getPublicKey();
        signedEvent = await window.nostr.signEvent({ ...unsignedEvent, pubkey: pk });
      }
      const success = await publishCommitteeMember(signedEvent);

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
        data-testid="member-form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          {isEditing ? "Edit Member" : "Add Member"}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              data-testid="member-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input
              data-testid="member-role"
              type="text"
              list="role-suggestions"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Chair, Vice Chair, Secretary..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
            <datalist id="role-suggestions">
              <option value="Chair" />
              <option value="Vice Chair" />
              <option value="Secretary" />
              <option value="Treasurer" />
              <option value="Member" />
              <option value="Committee Member" />
              <option value="Parliamentarian" />
              <option value="Sergeant at Arms" />
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              data-testid="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              data-testid="member-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(816) 555-0000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            data-testid="member-cancel"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="member-publish"
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 px-4 py-2 bg-bitcoin-orange text-white rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors disabled:opacity-50"
          >
            {publishing ? "Publishing..." : isEditing ? "Update" : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}
