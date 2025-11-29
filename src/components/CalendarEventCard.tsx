import React from "react";
import { ClockIcon, MarkerIcon } from "./Icons";
import { CalendarEvent } from "@/types/calendar";
import { formatEventTime, getEventTypeLabel } from "@/utils/calendar";

interface CalendarEventCardProps {
  event: CalendarEvent;
  onDelete?: (eventId: string) => void;
  onEdit?: () => void;
}

export default function CalendarEventCard({ event, onDelete, onEdit }: CalendarEventCardProps) {
  const handleDelete = () => {
    if (onDelete && window.confirm('Are you sure you want to delete this event?')) {
      onDelete(event.id);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 sm:p-6 lg:p-8 w-full overflow-hidden relative">
      {/* Action buttons */}
      <div className="absolute top-4 right-4 flex gap-2">
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-blue-600 transition-colors"
            aria-label="Edit event"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 0 0 2.828l8.586 8.586z" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-600 transition-colors"
            aria-label="Delete event"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Mobile-first layout */}
      <div className="space-y-4 sm:space-y-6 pr-8">
        {/* Header section with event type and title */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6">
          <div className="order-2 sm:order-1 flex-1">
            <div className="mb-2">
              <span className="inline-block px-2 py-1 text-xs font-medium bg-bitcoin-orange/10 text-bitcoin-orange rounded-full mb-2">
                {getEventTypeLabel(event)}
              </span>
            </div>
            <h4 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-2 font-archivo-black leading-tight">
              {event.title || 'Untitled Event'}
            </h4>
            {event.summary && (
              <p className="text-sm text-gray-600 mb-2">{event.summary}</p>
            )}
          </div>
        </div>

        {/* Time section */}
        <div className="flex items-start gap-2 text-gray-600">
          <ClockIcon className="size-6 text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold text-gray-900 block">
              {formatEventTime(event)}
            </span>
            {event.timezone && (
              <span className="text-xs text-gray-500">
                Timezone: {event.timezone}
              </span>
            )}
          </div>
        </div>

        {/* Location section */}
        {event.location && (
          <div className="flex items-start gap-2 text-gray-600">
            <MarkerIcon className="size-6 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-gray-900 block">Location</span>
              <span className="text-sm sm:text-base block">{event.location}</span>
              {event.locations && event.locations.length > 1 && (
                <span className="text-xs text-gray-500">
                  +{event.locations.length - 1} more location{event.locations.length > 2 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Description section */}
        {event.description && (
          <div className="text-gray-700">
            <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        )}

        {/* Tags section */}
        {event.hashtags && event.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {event.hashtags.map((tag, index) => (
              <span
                key={index}
                className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Event Image */}
        {event.image && (
          <div className="mt-4">
            <img
              src={event.image}
              alt={event.title || 'Event image'}
              className="w-full h-48 object-cover rounded-lg"
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* References/Links */}
        {event.references && event.references.length > 0 && (
          <div className="space-y-2">
            <span className="font-semibold text-gray-900 text-sm">Links:</span>
            {event.references.map((ref, index) => (
              <a
                key={index}
                href={ref}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-bitcoin-orange hover:underline truncate"
              >
                {ref}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
