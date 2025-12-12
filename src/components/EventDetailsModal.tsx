import React from 'react';
import { CalendarEvent } from '../types/calendar';
import { XIcon } from './Icons';
import { encodeNaddr } from '../utils/nostrEvents';

interface EventDetailsModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

export default function EventDetailsModal({
  event,
  onClose,
}: EventDetailsModalProps) {
  if (!event) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timestamp: string) => {
    return new Date(parseInt(timestamp) * 1000).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatEventDate = (event: CalendarEvent) => {
    if (event.kind === 31922) {
      // All-day event
      if (event.start && event.end) {
        return `${formatDate(event.start)} - ${formatDate(event.end)}`;
      } else if (event.start) {
        return formatDate(event.start);
      }
    } else {
      // Timed event
      if (event.start) {
        const startDate = new Date(parseInt(event.start) * 1000);
        const dateStr = startDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const startTime = formatTime(event.start);
        const endTime = event.end ? ` - ${formatTime(event.end)}` : "";
        return `${dateStr} at ${startTime}${endTime}`;
      }
    }
    return "Date TBD";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Event Details</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Title */}
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            {event.title}
          </h3>

          {/* Date and Time */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-gray-700">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="font-medium">{formatEventDate(event)}</span>
            </div>
          </div>

          {/* Summary */}
          {event.summary && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
              <p className="text-gray-600">{event.summary}</p>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
              <div className="text-gray-600 whitespace-pre-wrap">
                {event.description}
              </div>
            </div>
          )}

          {/* Image */}
          {event.image && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">Image</h4>
              <img
                src={event.image}
                alt={event.title}
                className="max-w-full h-auto rounded-lg border border-gray-200"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}

          {/* Locations */}
          {(event.location ||
            (event.locations && event.locations.length > 0)) && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">
                Location
                {event.locations && event.locations.length > 1 ? "s" : ""}
              </h4>
              <div className="space-y-2">
                {event.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>{event.location}</span>
                  </div>
                )}
                {event.locations &&
                  event.locations.map((location, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-gray-600"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span>{location}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {event.hashtags && event.hashtags.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {event.hashtags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-block px-3 py-1 bg-bitcoin-orange/10 text-bitcoin-orange rounded-full text-sm"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Meetup Link */}
          {event.id &&
            event.id.startsWith("meetup-") &&
            event.references &&
            event.references.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Meetup Event
                </h4>
                <div className="text-gray-600">
                  <a
                    href={event.references[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-bitcoin-orange text-white px-4 py-2 rounded-lg hover:bg-bitcoin-orange-hover transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19.244 2.664H21a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1h-1.756l-2.563-2.563a3 3 0 0 0-4.242 0L11 19.756V20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7.756l2.563-2.563a3 3 0 0 1 4.242 0L19.244 2.664zM15 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
                    </svg>
                    View on Meetup.com
                  </a>
                </div>
              </div>
            )}

          {/* Nostr/Plektos Link */}
          {event.id && event.id.startsWith('nostr-') && event.dTag && (() => {
            const naddr = encodeNaddr(event.kind, event.pubkey, event.dTag);
            console.log('🔗 Generated naddr for nostr event:', {
              eventId: event.id,
              kind: event.kind,
              pubkey: event.pubkey,
              dTag: event.dTag,
              naddr: naddr,
              plektosUrl: `https://plektos.app/event/${naddr}`
            });
            return naddr;
          })() && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">Nostr Event</h4>
              <div className="text-gray-600">
                <a 
                  href={`https://plektos.app/event/${encodeNaddr(event.kind, event.pubkey, event.dTag)}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  View on Plektos
                </a>
              </div>
            </div>
          )}

          {/* References */}
          {event.references && event.references.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">References</h4>
              <div className="space-y-1">
                {event.references.map((ref, index) => (
                  <div key={index} className="text-gray-600">
                    <a
                      href={ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-bitcoin-orange hover:underline"
                    >
                      {ref}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event Type */}
          <div className="text-sm text-gray-500">
            Event Type: {event.kind === 31922 ? "All-Day Event" : "Timed Event"}
          </div>
        </div>
      </div>
    </div>
  );
}
