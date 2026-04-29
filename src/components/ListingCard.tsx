import EventActions from "@/components/EventActions";
import type { ClassifiedListing } from "@/types/classifieds";

interface ListingCardProps {
  listing: ClassifiedListing;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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
  onEdit,
  onDelete,
}: ListingCardProps) {
  const statusColor =
    listing.status === "active"
      ? "bg-green-100 text-green-800"
      : listing.status === "sold"
        ? "bg-gray-100 text-gray-600"
        : "bg-gray-50 text-gray-500";

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
                {listing.status}
              </span>
              {listing.price && (
                <span className="text-sm font-semibold text-bitcoin-orange">
                  {formatPrice(listing)}
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
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          )}
        </div>

        {/* Summary */}
        {listing.summary && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {listing.summary}
          </p>
        )}

        {/* Location */}
        {listing.location && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
            <span>📍</span>
            <span className="truncate">{listing.location}</span>
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

        {/* Footer: date */}
        <div className="pt-3 border-t border-gray-100 text-xs text-gray-400">
          {new Date(listing.createdAt * 1000).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
