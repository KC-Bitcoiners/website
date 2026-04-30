import { useState, useCallback } from "react";
import type { ClassifiedListing, ListingCondition, ListingShipping } from "@/types/classifieds";
import EventActions from "@/components/EventActions";
import ReactMarkdown from "react-markdown";

/** Format price for display */
function formatPrice(listing: ClassifiedListing): string {
  if (!listing.price) return "";
  const { amount, currency, frequency } = listing.price;
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;

  if (currency.toLowerCase() === "sats") {
    const formatted = Math.round(num).toLocaleString();
    return `${formatted} sats${frequency ? `/${frequency}` : ""}`;
  }

  const symbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };
  const sym = symbols[currency] || `${currency} `;
  return `${sym}${num.toLocaleString()}${frequency ? `/${frequency}` : ""}`;
}

/** Format shipping type for display */
function formatShipping(shipping: ListingShipping): string {
  const labels: Record<string, string> = {
    na: "Digital/Service (no shipping)",
    free: "Free Shipping",
    pickup: "Local Pickup",
    free_pickup: "Free Shipping or Local Pickup",
    added_cost: `Shipping: ${shipping.cost || "—"} ${shipping.currency || ""}`.trim(),
  };
  return labels[shipping.type] || shipping.type;
}

/** Format condition for display */
function formatCondition(condition: ListingCondition): string {
  const labels: Record<ListingCondition, string> = {
    new: "New",
    used: "Used",
    refurbished: "Refurbished",
  };
  return labels[condition] || condition;
}

/** Check if a listing has expired */
function isExpired(listing: ClassifiedListing): boolean {
  if (!listing.expiration) return false;
  return listing.expiration < Math.floor(Date.now() / 1000);
}

interface ListingDetailModalProps {
  listing: ClassifiedListing;
  onClose: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onAddToCart?: () => void;
  onBuyNow?: () => void;
  sellerProfile?: { name?: string; picture?: string };
}

export default function ListingDetailModal({
  listing,
  onClose,
  onDelete,
  onEdit,
  onAddToCart,
  onBuyNow,
  sellerProfile,
}: ListingDetailModalProps) {
  const [currentImage, setCurrentImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const hasImages = listing.images.length > 0;
  const expired = isExpired(listing);

  // Status styling
  const statusColor = listing.status === "sold"
    ? "bg-gray-100 text-gray-600"
    : listing.status === "hidden"
      ? "bg-red-100 text-red-700"
      : expired
        ? "bg-yellow-100 text-yellow-800"
        : "bg-green-100 text-green-800";
  const statusLabel = listing.status === "sold"
    ? "Sold"
    : listing.status === "hidden"
      ? "Hidden"
      : expired
        ? "Expired"
        : listing.status;

  const conditionColor: Record<ListingCondition, string> = {
    new: "bg-blue-100 text-blue-700",
    used: "bg-amber-100 text-amber-700",
    refurbished: "bg-purple-100 text-purple-700",
  };

  const nextImage = useCallback(() => {
    setCurrentImage((i) => (i + 1) % listing.images.length);
  }, [listing.images.length]);

  const prevImage = useCallback(() => {
    setCurrentImage((i) => (i - 1 + listing.images.length) % listing.images.length);
  }, [listing.images.length]);

  return (
    <>
      {/* Detail Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-start p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 font-archivo-black">
                {listing.title}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${statusColor}`}
                >
                  {statusLabel}
                </span>
                {listing.condition && (
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${conditionColor[listing.condition] || "bg-gray-100 text-gray-600"}`}
                  >
                    {formatCondition(listing.condition)}
                  </span>
                )}
                {listing.price && (
                  <span className="text-lg font-semibold text-bitcoin-orange">
                    {formatPrice(listing)}
                  </span>
                )}
                {listing.quantity && listing.quantity > 1 && (
                  <span className="text-xs text-gray-500">
                    {listing.quantity} available
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {listing.rawEvent && (
                <EventActions
                  event={listing.rawEvent}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Image carousel */}
          {hasImages && (
            <div className="relative bg-gray-100">
              <img
                src={listing.images[currentImage]}
                alt={`${listing.title} - image ${currentImage + 1}`}
                className="w-full max-h-96 object-contain cursor-pointer"
                onClick={() => setLightboxOpen(true)}
              />
              {listing.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/60 text-lg"
                  >
                    ‹
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/60 text-lg"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {listing.images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImage(i)}
                        className={`w-2.5 h-2.5 rounded-full transition-colors ${
                          i === currentImage ? "bg-white" : "bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {listing.location && (
                <div className="flex items-center gap-2 text-gray-500">
                  <span>📍</span>
                  <span>{listing.location}</span>
                </div>
              )}
              {listing.shipping && (
                <div className="flex items-center gap-2 text-gray-500">
                  <span>📦</span>
                  <span>{formatShipping(listing.shipping)}</span>
                </div>
              )}
              {listing.quantity && listing.quantity > 0 && (
                <div className="flex items-center gap-2 text-gray-500">
                  <span>🔢</span>
                  <span>{listing.quantity} available</span>
                </div>
              )}
              {listing.expiration && (
                <div className="flex items-center gap-2 text-gray-500">
                  <span>⏰</span>
                  <span className={expired ? "text-yellow-600 font-medium" : ""}>
                    {expired ? "Expired " : "Expires "}
                    {new Date(listing.expiration * 1000).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Tags */}
            {listing.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {listing.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block px-3 py-1 text-sm font-medium bg-gray-100 text-gray-600 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description (markdown) */}
            {listing.description && (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{listing.description}</ReactMarkdown>
              </div>
            )}

            {/* Buy Now / Add to Cart for active listings with price */}
            {listing.status === "active" && !expired && listing.price && (
              <div className="flex gap-3 pt-2">
                {onBuyNow && (
                  <button
                    data-testid="buy-now-btn"
                    onClick={onBuyNow}
                    className="flex-1 py-3 bg-bitcoin-orange text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Buy Now — {formatPrice(listing)}
                  </button>
                )}
                {onAddToCart && (
                  <button
                    data-testid="add-to-cart-btn"
                    onClick={onAddToCart}
                    className="flex-1 py-3 border-2 border-bitcoin-orange text-bitcoin-orange font-semibold rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    Add to Cart
                  </button>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
              <div className="flex items-center gap-2">
                {sellerProfile?.picture ? (
                  <img
                    src={sellerProfile.picture}
                    alt={sellerProfile.name || "Seller"}
                    className="w-6 h-6 rounded-full"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-400" style={{ fontSize: 10 }}>
                    ?
                  </div>
                )}
                <span>
                  {sellerProfile?.name || listing.pubkey.substring(0, 12) + "..."}
                </span>
              </div>
              <span>
                Published{" "}
                {new Date(listing.publishedAt || listing.createdAt * 1000).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen lightbox */}
      {lightboxOpen && hasImages && (
        <div
          className="fixed inset-0 bg-black z-[60] flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={listing.images[currentImage]}
            alt={`${listing.title} - image ${currentImage + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {listing.images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center text-2xl hover:bg-white/30"
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center text-2xl hover:bg-white/30"
              >
                ›
              </button>
            </>
          )}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
          >
            ✕
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
            {currentImage + 1} / {listing.images.length}
          </div>
        </div>
      )}
    </>
  );
}
