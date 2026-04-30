import EventActions from "@/components/EventActions";
import type { ClassifiedListing, ListingCondition, ListingShipping } from "@/types/classifieds";

/** Format shipping type for display */
function formatShipping(shipping: ListingShipping): string {
  const labels: Record<string, string> = {
    na: "Digital/Service",
    free: "Free Shipping",
    pickup: "Local Pickup",
    free_pickup: "Free + Pickup",
    added_cost: `Shipping: ${shipping.cost || ""} ${shipping.currency || ""}`.trim(),
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

interface ListingCardProps {
  listing: ClassifiedListing;
  onClick: () => void;
  zapTotal?: number;
  onDelete?: () => void;
  onEdit?: () => void;
  onAddToCart?: () => void;
  onBuyNow?: () => void;
  pubkey?: string | null;
  sellerProfile?: { name?: string; picture?: string };
}

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

  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  const sym = symbols[currency] || `${currency} `;
  return `${sym}${num.toLocaleString()}${frequency ? `/${frequency}` : ""}`;
}

export default function ListingCard({
  listing,
  onClick,
  zapTotal = 0,
  onDelete,
  onEdit,
  onAddToCart,
  onBuyNow,
  pubkey,
  sellerProfile,
}: ListingCardProps) {
  const statusColor =
    listing.status === "sold"
      ? "bg-gray-100 text-gray-600"
      : listing.status === "hidden"
        ? "bg-red-100 text-red-700"
        : isExpired(listing)
          ? "bg-yellow-100 text-yellow-800"
          : "bg-green-100 text-green-800";

  const statusLabel =
    listing.status === "sold"
      ? "Sold"
      : listing.status === "hidden"
        ? "Hidden"
        : isExpired(listing)
          ? "Expired"
          : listing.status;

  const conditionColor: Record<ListingCondition, string> = {
    new: "bg-blue-100 text-blue-700",
    used: "bg-amber-100 text-amber-700",
    refurbished: "bg-purple-100 text-purple-700",
  };

  return (
    <div
      data-testid={`listing-card-${listing.id}`}
      className="bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
      onClick={onClick}
    >
      {/* Image banner */}
      {listing.images.length > 0 && (
        <div className="relative h-48 bg-gray-100 overflow-hidden">
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
          {listing.images.length > 1 && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              {listing.images.slice(0, 5).map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === 0 ? "bg-white" : "bg-white/50"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        {/* Header: title + status + actions */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate">
              {listing.title}
            </h3>
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
                <span className="text-sm font-semibold text-bitcoin-orange">
                  {formatPrice(listing)}
                </span>
              )}
              {listing.quantity && listing.quantity > 1 && (
                <span className="text-xs text-gray-500">
                  Qty: {listing.quantity}
                </span>
              )}
            </div>
          </div>

          {/* EventActions: stop click propagation so menu doesn't trigger card click */}
          {listing.rawEvent && (
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <EventActions
                event={listing.rawEvent}
                onDelete={onDelete}
                onEdit={onEdit}
                pubkey={pubkey}
              />
            </div>
          )}
        </div>

        {/* Location */}
        {listing.location && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
            <span>📍</span>
            <span className="truncate">{listing.location}</span>
          </div>
        )}

        {/* Shipping */}
        {listing.shipping && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
            <span>📦</span>
            <span>{formatShipping(listing.shipping)}</span>
          </div>
        )}

        {/* Tags */}
        {listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {listing.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded"
              >
                {tag}
              </span>
            ))}
            {listing.tags.length > 4 && (
              <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-50 text-gray-400 rounded">
                +{listing.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Spacer to push footer down */}
        <div className="flex-1" />

        {/* Action buttons for active, non-expired listings with price */}
        {listing.status === "active" && !isExpired(listing) && listing.price && (
          <div
            className="flex gap-2 mb-3"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {onBuyNow && (
              <button
                data-testid="buy-now-btn"
                onClick={onBuyNow}
                className="flex-1 py-2 bg-bitcoin-orange text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Buy Now
              </button>
            )}
            {onAddToCart && (
              <button
                data-testid="add-to-cart-btn"
                onClick={onAddToCart}
                className="flex-1 py-2 border border-bitcoin-orange text-bitcoin-orange text-xs font-semibold rounded-lg hover:bg-orange-50 transition-colors"
              >
                Add to Cart
              </button>
            )}
          </div>
        )}

        {/* Footer: seller + date + zaps */}
        <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
          <div className="flex items-center gap-1.5 min-w-0">
            {sellerProfile?.picture ? (
              <img
                src={sellerProfile.picture}
                alt={sellerProfile.name || "Seller"}
                className="w-5 h-5 rounded-full flex-shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0" style={{ fontSize: 9 }}>
                ?
              </div>
            )}
            <span className="truncate">
              {sellerProfile?.name || listing.pubkey.substring(0, 10) + "..."}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span>{new Date(listing.createdAt * 1000).toLocaleDateString()}</span>
            {zapTotal > 0 && (
              <span className="text-yellow-500 font-medium">⚡ {zapTotal.toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
