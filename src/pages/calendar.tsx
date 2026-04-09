import React, { useState, useEffect } from "react";
import EventCard from "../components/EventCard";
import EventForm from "../components/EventForm";
import CalendarView from "../components/CalendarView";
import EventDetailsModal from "../components/EventDetailsModal";
import { CalendarEvent, EventFormData } from "../types/calendar";
import {
  createEventFromFormData,
  loadEvents,
  sortEventsByTime,
  getUpcomingEvents,
  getPastEvents,
} from "../utils/calendar";
import { fetchMeetupEvents, getVenueAddress, MeetupGroup } from "../lib/meetup";
import {
  fetchNostrCalendarEvents,
  convertNostrEventToCalendar,
  publishNostrEvent,
} from "../utils/nostrEvents";
import { PlusIcon } from "../components/Icons";
import { GetStaticProps, InferGetStaticPropsType } from "next";
import { WHITELISTED_NPUBS, WHITELISTED_PUBKEYS } from "@/config";
import { useNostr } from "../contexts/NostrContext";

interface CalendarPageProps {
  meetupGroup: MeetupGroup | null;
  meetupError?: string;
}

export const getStaticProps: GetStaticProps<CalendarPageProps> = async () => {
  try {
    // Fetch meetup events data
    const group = await fetchMeetupEvents();

    return {
      props: {
        meetupGroup: group,
      },
    };
  } catch (error) {
    console.error("Error fetching meetup events:", error);

    return {
      props: {
        meetupGroup: null,
        meetupError:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
    };
  }
};

export default function CalendarPage({
  meetupGroup,
  meetupError,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "month" | "week" | "day">(
    "month",
  );
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingNostrEvents, setIsLoadingNostrEvents] = useState(false);
  const [successMessage, setSuccessMessage] = useState<{
    eventId: string;
    naddr: string;
  } | null>(null);
  const { user } = useNostr();

  // Load local + Meetup events immediately on mount
  useEffect(() => {
    const loadInitialEvents = async () => {
      try {
        const localEvents = loadEvents();
        let meetupEvents: CalendarEvent[] = [];

        if (meetupGroup) {
          meetupEvents = meetupGroup.events.edges.map((edge) => {
            const event = edge.node;
            const startTime = Math.floor(new Date(event.dateTime).getTime() / 1000);
            const endTime = event.endTime
              ? Math.floor(new Date(event.endTime).getTime() / 1000)
              : startTime + 3600;

            return {
              id: `meetup-${event.id}`,
              kind: 31923,
              pubkey: "meetup",
              tags: [],
              content: event.description,
              dTag: "meetup-event",
              title: event.title,
              description: event.description,
              location: getVenueAddress(event.venues),
              venueName: event.venues?.[0]?.name || undefined,
              start: startTime.toString(),
              end: endTime.toString(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              hashtags: [],
              references: [event.eventUrl],
              created_at: Math.floor(Date.now() / 1000),
            };
          });
        }

        setEvents(sortEventsByTime([...localEvents, ...meetupEvents]));
      } catch (error) {
        console.error("Error loading initial events:", error);
        setEvents(sortEventsByTime(loadEvents()));
      }
    };

    loadInitialEvents();
  }, [meetupGroup]);

  // Load Nostr events in the background after initial render
  useEffect(() => {
    const loadNostrEvents = async () => {
      setIsLoadingNostrEvents(true);
      try {
        const raw = await fetchNostrCalendarEvents();
        const nostrEvents = raw.map(convertNostrEventToCalendar);
        setEvents((prev) => sortEventsByTime([...prev, ...nostrEvents]));
      } catch (error) {
        console.warn("Failed to load Nostr events:", error);
      } finally {
        setIsLoadingNostrEvents(false);
      }
    };

    const timer = setTimeout(loadNostrEvents, 100);
    return () => clearTimeout(timer);
  }, [meetupGroup]);

  const handleCreateEvent = async (formData: EventFormData) => {
    if (!user) {
      alert("Please connect your Nostr extension to create events.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await publishNostrEvent(formData, undefined, user.pubkey);

      if (result.success) {
        // Optimistically add the new event to local state
        const newEvent = createEventFromFormData(formData);
        newEvent.id = result.eventId || `nostr-${Date.now()}`;
        newEvent.pubkey = user.pubkey;

        setEvents((prev) => {
          const alreadyExists = prev.some((e) => e.id === newEvent.id);
          if (alreadyExists) return prev;
          return sortEventsByTime([...prev, newEvent]);
        });

        setShowCreateForm(false);
        setSuccessMessage({ eventId: result.eventId || "", naddr: result.naddr || "" });

        // Re-fetch from relay after a short delay to pick up the canonical signed event
        setTimeout(async () => {
          try {
            const raw = await fetchNostrCalendarEvents();
            const refreshed = raw.map(convertNostrEventToCalendar);
            setEvents((prev) => sortEventsByTime([...prev, ...refreshed]));
          } catch {
            // Non-fatal — the optimistic event is already displayed
          }
        }, 2000);
      } else {
        alert(`Failed to publish event: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to create event:", error);
      alert(`Failed to publish event: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEvent = async (formData: EventFormData) => {
    if (!editingEvent) return;
    if (!user) {
      alert("Please connect your Nostr extension to edit events.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Publish a replaceable event using the same dTag so the relay updates it
      const result = await publishNostrEvent(
        { ...formData, eventType: editingEvent.kind === 31922 ? "all-day" : "timed" },
        undefined,
        user.pubkey,
        editingEvent.dTag, // same dTag = relay replaces the old event
      );

      if (result.success) {
        // Update local state to reflect the edit immediately
        const updatedEvent = createEventFromFormData({
          ...formData,
          eventType: editingEvent.kind === 31922 ? "all-day" : "timed",
        });
        updatedEvent.id = editingEvent.id;
        updatedEvent.dTag = editingEvent.dTag;
        updatedEvent.pubkey = user.pubkey;
        updatedEvent.created_at = Math.floor(Date.now() / 1000);

        setEvents((prev) =>
          sortEventsByTime(prev.map((e) => (e.id === editingEvent.id ? updatedEvent : e))),
        );
        setEditingEvent(null);
      } else {
        alert(`Failed to update event: ${result.error}`);
      }
    } catch (error) {
      console.error("Failed to update event:", error);
      alert("Failed to update event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to get color based on event creator
  const getEventColor = (event: CalendarEvent): string => {
    if (event.pubkey === "meetup") {
      return "bg-bitcoin-orange border-bitcoin-orange"; // Meetup events - bitcoin orange
    }

    // Find index based on hex format (which nostr events use)
    const hexIndex = WHITELISTED_PUBKEYS.findIndex(
      (hex: string) => hex === event.pubkey,
    );
    const npubIndex = WHITELISTED_NPUBS.findIndex(
      (npub: string) => npub === event.pubkey,
    );
    const colorIndex = Math.max(hexIndex, npubIndex);

    const colors = [
      "bg-purple-500 border-purple-600", // First whitelisted user - purple
      "bg-green-500 border-green-600", // Second user - green
      "bg-yellow-500 border-yellow-600", // Third user - yellow
      "bg-pink-500 border-pink-600", // Fourth user - pink
      "bg-indigo-500 border-indigo-600", // Fifth user - indigo
    ];

    return colorIndex >= 0
      ? colors[colorIndex % colors.length]
      : "bg-gray-50 border-gray-200"; // Default fallback
  };

  const upcomingEvents = getUpcomingEvents(events);
  const pastEvents = getPastEvents(events);


  // Helper functions to format data for EventCard
  const formatDate = (timestamp: string | undefined): string => {
    if (!timestamp) return "TBD";
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timestamp: string | undefined): string => {
    if (!timestamp) return "TBA";
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const splitDescription = (description: string): string[] => {
    if (!description) return ["No description available."];
    return description
      .split(/\n\s*\n/)
      .filter((paragraph) => paragraph.trim().length > 0)
      .map((paragraph) => paragraph.trim());
  };


  return (
    <div className="container mx-auto px-4 py-12">
      <div className="relative">
        {/* Main Content */}
        <div className="flex gap-6">
          {/* Statistics Sidebar - Fixed in left margin */}
          <div className="w-24 flex-shrink-0">
            <div className="sticky top-24 space-y-2">
              <div className="bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
                <div className="text-lg font-bold text-bitcoin-orange mb-1">
                  {events.length}
                </div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
                <div className="text-lg font-bold text-green-600 mb-1">
                  {upcomingEvents.length}
                </div>
                <div className="text-xs text-gray-600">Upcoming</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
                <div className="text-lg font-bold text-gray-600 mb-1">
                  {pastEvents.length}
                </div>
                <div className="text-xs text-gray-600">Past</div>
              </div>
            </div>
          </div>

          {/* Calendar Content */}
          <div className="flex-1 relative">
            {/* Loading Overlay - Over calendar with transparent background */}
            {viewMode !== "list" && isLoadingNostrEvents && (
              <div className="absolute top-4 left-0 right-0 z-50 flex justify-center">
                <div className="flex flex-col items-center gap-3 px-6 py-3 bg-white bg-opacity-95 rounded-lg shadow-lg backdrop-blur-sm">
                  <img
                    src="/bitcoinShaka.jpg"
                    alt="Loading..."
                    className="w-auto h-auto max-w-12 max-h-12 rounded-full animate-spin"
                  />
                  <p className="text-purple-600 font-medium">
                    Loading events from Nostr...
                  </p>
                </div>
              </div>
            )}

            {/* Always show view selector */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("month")}
                    className={`px-4 py-2 text-sm font-medium transition-colors rounded-l-lg ${
                      viewMode === "month"
                        ? "bg-bitcoin-orange text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setViewMode("week")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      viewMode === "week"
                        ? "bg-bitcoin-orange text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setViewMode("day")}
                    className={`px-4 py-2 text-sm font-medium transition-colors rounded-r-lg ${
                      viewMode === "day"
                        ? "bg-bitcoin-orange text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Day
                  </button>

                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-4 py-2 text-sm font-medium transition-colors rounded-lg border border-gray-200 bg-white ml-2 ${
                      viewMode === "list"
                        ? "bg-bitcoin-orange text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    List
                  </button>
                </div>

                {/* Orange plus button for creating events */}
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center justify-center w-10 h-10 bg-bitcoin-orange text-white rounded-full hover:bg-bitcoin-orange-hover transition-colors"
                  title="Create New Event"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Calendar View */}
            {viewMode !== "list" && (
              <CalendarView
                events={events}
                onEventClick={setSelectedEvent}
                currentView={viewMode}
                getEventColor={getEventColor}
              />
            )}

            {viewMode === "list" && (
              <div className="space-y-8">
                {isLoadingNostrEvents && (
                  <div className="bitcoin-shaka-loading-overlay mb-8">
                    <div className="bitcoin-shaka-container">
                      <img
                        src="/bitcoinShaka.jpg"
                        alt="Loading..."
                        className="bitcoin-shaka-spinner"
                      />
                      <p className="text-purple-600 font-medium mt-4 text-center">
                        Loading events from Nostr...
                      </p>
                    </div>
                  </div>
                )}

                {/* Upcoming Events Section */}
                {upcomingEvents.length > 0 && (
                  <section className="mb-16">
                    <div className="space-y-8">
                      {upcomingEvents.map((event) => (
                        <EventCard
                          key={event.id}
                          className={getEventColor(event)}
                          date={formatDate(event.start)}
                          title={event.title || "Untitled Event"}
                          startTime={formatTime(event.start)}
                          endTime={event.end ? formatTime(event.end) : "TBA"}
                          location={event.location || "Location TBD"}
                          description={splitDescription(
                            event.description || "",
                          )}
                          link={event.references?.[0]}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Past Events Section */}
                {pastEvents.length > 0 && (
                  <section>
                    <h2 className="text-3xl font-bold mb-8 font-archivo-black text-gray-700">
                      Past Events
                    </h2>
                    <div className="space-y-8 opacity-75">
                      {pastEvents.slice(0, 5).map((event) => (
                        <EventCard
                          key={event.id}
                          className={getEventColor(event)}
                          date={formatDate(event.start)}
                          title={event.title || "Untitled Event"}
                          startTime={formatTime(event.start)}
                          endTime={event.end ? formatTime(event.end) : "TBA"}
                          location={event.location || "Location TBD"}
                          description={splitDescription(
                            event.description || "",
                          )}
                          link={event.references?.[0]}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {events.length === 0 && !isLoadingNostrEvents && (
                  <div className="text-center py-12">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8">
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">
                        No Events Yet
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Start by creating your first community event.
                      </p>
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="inline-flex items-center gap-2 bg-bitcoin-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors"
                      >
                        <PlusIcon className="w-5 h-5" />
                        Create Your First Event
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Event Modal */}
        {(showCreateForm || editingEvent) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <EventForm
                initialData={
                  editingEvent
                    ? {
                        title: editingEvent.title,
                        description: editingEvent.description,
                        summary: editingEvent.summary,
                        image: editingEvent.image,
                        locations:
                          editingEvent.locations ||
                          (editingEvent.location
                            ? [editingEvent.location]
                            : []),
                        startDate:
                          editingEvent.kind === 31922
                            ? editingEvent.start || ""
                            : editingEvent.start
                              ? new Date(parseInt(editingEvent.start) * 1000)
                                  .toISOString()
                                  .split("T")[0]
                              : "",
                        endDate:
                          editingEvent.kind === 31922
                            ? editingEvent.end || ""
                            : editingEvent.end
                              ? new Date(parseInt(editingEvent.end) * 1000)
                                  .toISOString()
                                  .split("T")[0]
                              : "",
                        startTime:
                          editingEvent.kind === 31923
                            ? editingEvent.start
                              ? new Date(parseInt(editingEvent.start) * 1000)
                                  .toTimeString()
                                  .slice(0, 5)
                              : ""
                            : "",
                        endTime:
                          editingEvent.kind === 31923
                            ? editingEvent.end
                              ? new Date(parseInt(editingEvent.end) * 1000)
                                  .toTimeString()
                                  .slice(0, 5)
                              : ""
                            : "",
                        timezone:
                          editingEvent.timezone ||
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                        hashtags: editingEvent.hashtags || [],
                        references: editingEvent.references || [],
                        eventType:
                          editingEvent.kind === 31922 ? "all-day" : "timed",
                      }
                    : {
                        // Default values for new events: tomorrow from noon to 2pm
                        title: "",
                        description: "",
                        summary: "",
                        image: "",
                        locations: [],
                        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                          .toISOString()
                          .split("T")[0],
                        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                          .toISOString()
                          .split("T")[0],
                        startTime: "12:00",
                        endTime: "14:00",
                        timezone:
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                        hashtags: [],
                        references: [],
                        eventType: "timed",
                      }
                }
                onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent}
                onCancel={() => {
                  setShowCreateForm(false);
                  setEditingEvent(null);
                }}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        )}

        {/* Event Details Modal */}
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />

        {/* Success Popup */}
        {successMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
              {/* Close button in top right */}
              <button
                onClick={() => setSuccessMessage(null)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                title="Close"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <div className="text-center pr-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold font-archivo-black mb-2">
                  Event Published Successfully!
                </h3>
                <p className="text-gray-600 mb-4">
                  Your event has been published to the Nostr network.
                </p>

                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Event ID:
                  </p>
                  <p className="text-xs text-gray-600 break-all font-mono">
                    {successMessage.eventId}
                  </p>
                  <p className="text-sm font-medium text-gray-700 mb-2 mt-3">
                    View Event:
                  </p>
                  <a
                    href={`https://plektos.app/event/${successMessage.naddr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors text-sm"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Open in Plektos
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
