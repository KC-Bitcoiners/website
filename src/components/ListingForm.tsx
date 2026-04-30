import { useNostr } from "@/contexts/NostrContext";
import { naddrEncode } from "applesauce-core/helpers";
import { useEffect, useState } from "react";
import { XIcon } from "./Icons";
import {
  buildClassifiedEvent,
  publishClassified,
} from "@/utils/classifiedEvents";
import type { ClassifiedListing, ListingCondition, ShippingType } from "@/types/classifieds";
import { logger } from "@/utils/logger";
import { pool } from "@/lib/nostr";
import { nostrRelays } from "@/config";

interface ListingFormProps {
  onClose: () => void;
  onSuccess: (data: { eventId: string; naddr: string }) => void;
  editListing?: ClassifiedListing | null;
  isEdit?: boolean;
}

interface ListingFormData {
  title: string;
  description: string;
  priceAmount: string;
  priceCurrency: string;
  priceFrequency: string;
  status: "active" | "sold" | "hidden";
  condition: ListingCondition | "";
  shippingType: ShippingType;
  shippingCost: string;
  shippingCurrency: string;
  quantity: string;
  expiration: string; // ISO date string for the date input
  location: string;
  images: string[];
  tags: string;
}

const CURRENCIES = ["sats", "USD", "BTC", "EUR", "GBP"];
const FREQUENCIES = ["", "hour", "day", "week", "month", "year"];
const CONDITIONS: { value: ListingCondition | ""; label: string }[] = [
  { value: "", label: "Not specified" },
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
  { value: "refurbished", label: "Refurbished" },
];

export default function ListingForm({
  onClose,
  onSuccess,
  editListing,
  isEdit = false,
}: ListingFormProps) {
  const { user, signEvent } = useNostr();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [formData, setFormData] = useState<ListingFormData>({
    title: "",
    description: "",
    priceAmount: "",
    priceCurrency: "sats",
    priceFrequency: "",
    status: "active",
    condition: "",
    shippingType: "pickup" as ShippingType,
    shippingCost: "",
    shippingCurrency: "sats",
    quantity: "",
    expiration: "",
    location: "",
    images: [],
    tags: "",
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (isEdit && editListing) {
      // Convert expiration unix timestamp to ISO date string for the date input
      let expirationStr = "";
      if (editListing.expiration) {
        const d = new Date(editListing.expiration * 1000);
        expirationStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
      }

      setFormData({
        title: editListing.title || "",
        description: editListing.description || "",
        priceAmount: editListing.price?.amount || "",
        priceCurrency: editListing.price?.currency || "sats",
        priceFrequency: editListing.price?.frequency || "",
        status: editListing.status === "sold" ? "sold" : editListing.status === "hidden" ? "hidden" : "active",
        condition: editListing.condition || "",
        shippingType: editListing.shipping?.type || "pickup",
        shippingCost: editListing.shipping?.cost || "",
        shippingCurrency: editListing.shipping?.currency || "sats",
        quantity: editListing.quantity?.toString() || "",
        expiration: expirationStr,
        location: editListing.location || "",
        images: editListing.images || [],
        tags: editListing.tags?.join(", ") || "",
      });
    }
  }, [isEdit, editListing]);

  const updateField = (field: keyof ListingFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addImage = () => {
    const url = newImageUrl.trim();
    if (url && !formData.images.includes(url)) {
      setFormData((prev) => ({ ...prev, images: [...prev.images, url] }));
      setNewImageUrl("");
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    if (!formData.title.trim()) errors.push("Title is required");
    if (!formData.description.trim())
      errors.push("Description is required");
    if (
      formData.priceAmount &&
      (isNaN(parseFloat(formData.priceAmount)) ||
        parseFloat(formData.priceAmount) <= 0)
    ) {
      errors.push("Price must be a positive number");
    }
    return errors;
  };

  /** Publish a kind 5 deletion event for the old listing event */
  const deleteOldEvent = async (eventId: string) => {
    try {
      const unsigned = {
        kind: 5,
        content: "Editing classified listing — replacing with updated version",
        tags: [["e", eventId]],
        created_at: Math.floor(Date.now() / 1000),
      };
      const signed = await signEvent(unsigned as any);
      await pool.publish(nostrRelays, signed as any);
    } catch (e) {
      logger.warn("Failed to publish deletion of old listing event:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      alert("Please fix the following errors:\n\n" + errors.join("\n"));
      return;
    }

    if (!user) {
      alert("Please connect your Nostr account to create a listing.");
      return;
    }

    setIsSubmitting(true);

    try {
      const tagsList = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Convert expiration date to unix timestamp
      let expirationTs: number | undefined;
      if (formData.expiration) {
        const d = new Date(formData.expiration);
        if (!isNaN(d.getTime())) {
          // Set to end of day (23:59:59 UTC)
          d.setUTCHours(23, 59, 59);
          expirationTs = Math.floor(d.getTime() / 1000);
        }
      }

      const opts = {
        dTag: isEdit && editListing ? editListing.dTag : undefined,
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim() || undefined,
        priceAmount: formData.priceAmount.trim() || undefined,
        priceCurrency: formData.priceAmount
          ? formData.priceCurrency
          : undefined,
        priceFrequency: formData.priceFrequency || undefined,
        status: formData.status,
        condition: (formData.condition || undefined) as ListingCondition | undefined,
        shippingType: (formData.shippingType || undefined) as ShippingType | undefined,
        shippingCost: formData.shippingType === "added_cost" ? formData.shippingCost.trim() || undefined : undefined,
        shippingCurrency: formData.shippingType === "added_cost" ? formData.shippingCurrency || undefined : undefined,
        quantity: formData.quantity ? parseInt(formData.quantity, 10) : undefined,
        expiration: expirationTs,
        images: formData.images.length > 0 ? formData.images : undefined,
        tags: tagsList.length > 0 ? tagsList : undefined,
      };

      const unsignedEvent = buildClassifiedEvent(opts);

      const signedEvent = await signEvent(unsignedEvent as any);
      const signed = signedEvent as Record<string, unknown>;

      const success = await publishClassified(signed);

      if (!success) {
        throw new Error("Failed to publish to any relay");
      }

      // On edit, delete the old event to clean up
      if (isEdit && editListing?.id) {
        await deleteOldEvent(editListing.id);
      }

      const dTag =
        (unsignedEvent.tags as string[][]).find((t) => t[0] === "d")?.[1] ||
        "";

      const naddr = naddrEncode({
        kind: 30402,
        pubkey: user.pubkey,
        identifier: dTag,
      });

      logger.debug("Classified listing published:", {
        eventId: signed.id,
        naddr,
      });

      onSuccess({
        eventId: (signed.id as string) || "",
        naddr,
      });
    } catch (error) {
      logger.error("Error creating classified listing:", error);
      alert(
        "Failed to create listing: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        data-testid="listing-form-modal"
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 font-archivo-black">
            {isEdit ? "Edit Listing" : "Create Classified Listing"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Basic Information
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                data-testid="listing-title"
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="e.g., Coldcard Mk4 Hardware Wallet"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  data-testid="listing-status"
                  value={formData.status}
                  onChange={(e) =>
                    updateField(
                      "status",
                      e.target.value as "active" | "sold" | "hidden",
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="sold">Sold</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <select
                  data-testid="listing-condition"
                  value={formData.condition}
                  onChange={(e) => updateField("condition", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  data-testid="listing-quantity"
                  value={formData.quantity}
                  onChange={(e) => updateField("quantity", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                  placeholder="Leave blank for unlimited"
                  min="1"
                  step="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Listing Expires
                </label>
                <input
                  type="date"
                  data-testid="listing-expiration"
                  value={formData.expiration}
                  onChange={(e) => updateField("expiration", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Price</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  data-testid="listing-price-amount"
                  value={formData.priceAmount}
                  onChange={(e) =>
                    updateField("priceAmount", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                  placeholder="50000"
                  min="0"
                  step="any"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  data-testid="listing-price-currency"
                  value={formData.priceCurrency}
                  onChange={(e) =>
                    updateField("priceCurrency", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency
                </label>
                <select
                  data-testid="listing-price-frequency"
                  value={formData.priceFrequency}
                  onChange={(e) =>
                    updateField("priceFrequency", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                >
                  <option value="">One-time</option>
                  {FREQUENCIES.filter(Boolean).map((f) => (
                    <option key={f} value={f}>
                      Per {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Shipping — local pickup only for now */}
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-md p-3">
            <span>📦</span>
            <span>All listings are <strong>Local Pickup</strong> by default. Arrange pickup with the buyer via Nostr DM.</span>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Description *
            </h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Markdown supported
            </label>
            <textarea
              data-testid="listing-description"
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
              placeholder="Describe what you're selling in detail. Markdown is supported."
              required
            />
          </div>

          {/* Location */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Location
            </h3>
            <input
              type="text"
              data-testid="listing-location"
              value={formData.location}
              onChange={(e) => updateField("location", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
              placeholder="e.g., Kansas City, MO or Ship worldwide"
            />
          </div>

          {/* Images */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Images
            </h3>
            <div className="flex gap-2">
              <input
                type="url"
                data-testid="listing-images"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
                placeholder="https://example.com/image.jpg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addImage();
                  }
                }}
              />
              <button
                type="button"
                onClick={addImage}
                className="px-4 py-2 text-sm font-medium text-bitcoin-orange border border-bitcoin-orange rounded-md hover:bg-orange-50"
              >
                Add
              </button>
            </div>
            {formData.images.length > 0 && (
              <ul className="mt-2 space-y-1">
                {formData.images.map((url, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-gray-600"
                  >
                    <span className="truncate flex-1">{url}</span>
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Tags
            </h3>
            <input
              type="text"
              data-testid="listing-tags"
              value={formData.tags}
              onChange={(e) => updateField("tags", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:border-transparent"
              placeholder="bitcoin, hardware, wallet (comma separated)"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="listing-publish"
              disabled={isSubmitting || !user}
              className="px-4 py-2 text-sm font-medium text-white bg-bitcoin-orange border border-transparent rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-bitcoin-orange focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? isEdit
                  ? "Updating..."
                  : "Publishing..."
                : isEdit
                  ? "Update Listing"
                  : "Create Listing"}
            </button>
          </div>

          {!user && (
            <div className="text-center text-sm text-red-600">
              Please connect your Nostr account to create listings.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
