import React, { useState, useEffect } from "react";
import EventCard from "../components/EventCard";
import EventForm from "../components/EventForm";
import CalendarView from "../components/CalendarView";
import EventDetailsModal from "../components/EventDetailsModal";
import { CalendarEvent, EventFormData } from "../types/calendar";
import {
  createEventFromFormData,
  loadEvents,
  saveEvents,
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
import { WHITELISTED_NPUBS, WHITELISTED_PUBKEYS, basePath, CLIENT_TAG } from "@/config";
import { config } from "@/config";
import { useNostr } from "../contexts/NostrContext";
import { useRef, useCallback } from "react";
import { logger } from "@/utils/logger";
import { formatDate, formatTime, splitDescription } from "@/utils/formatting";

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
    logger.error("Error fetching meetup events:", error);

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
  const { user, signEvent } = useNostr();
  const [chatOpen, setChatOpen] = useState(false);
  const chatIframeRef = useRef<HTMLIFrameElement>(null);

  const CORNYCHAT_URL = "https://cornychat.com";

  // Pass nsec to CornyChat iframe when it's ready
  const handleChatMessage = useCallback(
    (event: MessageEvent) => {
      if (
        event.data?.type === "cornychat-ready" &&
        chatIframeRef.current &&
        user?.privateKey
      ) {
        chatIframeRef.current.contentWindow?.postMessage(
          { type: "cornychat-signin", nsec: user.privateKey },
          "https://cornychat.com",
        );
      }
    },
    [user?.privateKey],
  );

  useEffect(() => {
    window.addEventListener("message", handleChatMessage);
    return () => window.removeEventListener("message", handleChatMessage);
  }, [handleChatMessage]);

  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (!user || !event.rawEvent || user.pubkey !== event.pubkey) return;
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    const kind = (event.rawEvent as { kind?: number }).kind ?? 31923;
    const unsignedDelete = { kind: 5, content: "Deleted by author", tags: [[...CLIENT_TAG], ["e", event.id], ["k", String(kind)]], created_at: Math.floor(Date.now() / 1000) };
    const signedDelete = await signEvent(unsignedDelete as { kind: number; content: string; tags: string[][]; created_at: number });
    const { pool } = await import("@/lib/nostr");
    const { nostrRelays } = await import("@/config");
    try { await pool.publish(nostrRelays, signedDelete as any); } catch {}
  };

  // Load events from localStorage, meetup data, and nostr
  useEffect(() => {
    const loadInitialEvents = async () => {
      logger.debug("📅 Starting to load initial events...");

      try {
        // Load local events
        logger.debug("🗂️ Loading local events...");
        const localEvents = loadEvents();
        logger.debug(`📊 Loaded ${localEvents.length} local events`);

        // Transform meetup events from props
        logger.debug("🌐 Processing meetup events from props...");
        let meetupEvents: CalendarEvent[] = [];

        if (meetupGroup) {
          logger.debug(
            `📋 Found ${meetupGroup.events.edges.length} meetup events in group`,
          );
          meetupEvents = meetupGroup.events.edges.map((edge) => {
            const event = edge.node;
            // meetup.com dateTime is an ISO string, convert to Unix timestamp
            const startTime = Math.floor(
              new Date(event.dateTime).getTime() / 1000,
            );
            const endTime = event.endTime
              ? Math.floor(new Date(event.endTime).getTime() / 1000)
              : startTime + 3600; // Default 1 hour duration

            logger.debug(
              `🎯 Processing meetup event: ${event.title} at ${new Date(startTime * 1000).toLocaleString()}`,
            );

            return {
              id: `meetup-${event.id}`,
              kind: 31923, // Timed event
              pubkey: "meetup",
              tags: [],
              content: event.description,
              dTag: "meetup-event",
              title: event.title,
              summary: event.title,
              description: event.description,
              location: getVenueAddress(event.venues),
              locations: event.venues?.map((v: any) => v.address) || [],
              venueName: event.venues?.[0]?.name?.trim() || undefined,
              start: startTime.toString(),
              end: endTime.toString(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              image: event.venues?.[0]?.id
                ? `https://secure.meetupstatic.com/photos/event/${event.venues[0].id}/450x300.jpeg`
                : undefined,
              hashtags: [],
              references: [event.eventUrl],
              created_at: Math.floor(Date.now() / 1000),
            };
          });
          logger.debug(
            `✅ Successfully processed ${meetupEvents.length} meetup events`,
          );
        } else {
          logger.debug("⚠️ No meetup group data available");
        }

        // Load local and meetup events immediately
        logger.debug(
          `🚀 Displaying immediate events: ${localEvents.length} local + ${meetupEvents.length} meetup`,
        );
        logger.debug(
          "🔍 Meetup events before sorting:",
          meetupEvents.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            kind: e.kind,
            pubkey: e.pubkey,
          })),
        );

        const immediateEvents = sortEventsByTime([
          ...localEvents,
          ...meetupEvents,
        ]);
        logger.debug(
          "🔍 All immediate events after sorting:",
          immediateEvents.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            kind: e.kind,
            pubkey: e.pubkey,
          })),
        );

        const upcoming = getUpcomingEvents(immediateEvents);
        const past = getPastEvents(immediateEvents);
        logger.debug("🔍 Upcoming events count:", upcoming.length);
        logger.debug("🔍 Past events count:", past.length);
        logger.debug(
          "🔍 Upcoming events:",
          upcoming.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            kind: e.kind,
          })),
        );
        logger.debug(
          "🔍 Past events:",
          past.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            kind: e.kind,
          })),
        );

        setEvents(immediateEvents);
      } catch (error) {
        logger.error("Error loading initial events:", error);
        // Fallback to local events only
        const localEvents = loadEvents();
        setEvents(sortEventsByTime(localEvents));
      }
    };

    loadInitialEvents();
  }, [meetupGroup]);

  // Load nostr events separately in the background
  useEffect(() => {
    const loadNostrEvents = async () => {
      logger.debug("🕰️ Loading nostr events in background...");
      setIsLoadingNostrEvents(true);
      let nostrEvents: CalendarEvent[] = [];

      try {
        const nostrCalendarEvents = await fetchNostrCalendarEvents();
        logger.debug(`📡 Found ${nostrCalendarEvents.length} raw nostr events`);
        nostrEvents = nostrCalendarEvents.map(convertNostrEventToCalendar);
        logger.debug(
          `✅ Converted ${nostrEvents.length} nostr events to calendar format`,
        );
      } catch (error) {
        logger.warn("⚠️ Failed to load nostr events:", error);
      } finally {
        setIsLoadingNostrEvents(false);
      }

      // Add nostr events to existing events, deduplicating by ID
      setEvents((prevEvents) => {
        const existingIds = new Set(prevEvents.map((e) => e.id));
        const newEvents = nostrEvents.filter((e) => !existingIds.has(e.id));
        logger.debug(
          `➕ Adding ${newEvents.length} new nostr events to existing ${prevEvents.length} events (${nostrEvents.length - newEvents.length} duplicates skipped)`,
        );
        const allEvents = sortEventsByTime([...prevEvents, ...newEvents]);
        logger.debug(`📅 Total events after adding nostr: ${allEvents.length}`);
        return allEvents;
      });
    };

    // Load nostr events after a short delay to ensure immediate events are displayed first
    const timer = setTimeout(loadNostrEvents, 100);
    return () => clearTimeout(timer);
  }, [meetupGroup]);

  const handleCreateEvent = async (formData: EventFormData) => {
    setIsSubmitting(true);
    try {
      // Publish to nostr instead of saving locally
      logger.debug("🚀 Creating new nostr event:", formData);

      // For now, use a mock private key. In a real implementation, this would come from user authentication
      // Check if user is authenticated
      if (!user) {
        alert(
          "🔐 Please connect your Nostr wallet or log in to create events.",
        );
        return;
      }

      logger.debug(
        "🚀 Creating new nostr event with authenticated user:",
        user.pubkey,
      );

      // Use Nostr extension for signing
      const result = await publishNostrEvent(formData, undefined, user.pubkey);

      if (result.success) {
        logger.debug(
          "✅ Successfully published event to nostr:",
          result.eventId,
        );
        logger.debug("🔗 Event naddr:", result.naddr);

        // Create a calendar event to display immediately
        const newEvent = createEventFromFormData(formData);
        newEvent.id = result.eventId || `nostr-${Date.now()}`;
        newEvent.pubkey = user.pubkey; // Use actual user pubkey from Nostr extension
        newEvent.dTag = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // Match the dTag used in publishing

        logger.debug("📝 Adding new event to local state:", {
          id: newEvent.id,
          title: newEvent.title,
          start: newEvent.start,
          dTag: newEvent.dTag,
          pubkey: newEvent.pubkey,
        });

        // Add to existing events without duplicates
        setEvents((prevEvents) => {
          // Check if this event already exists (by ID or dTag+pubkey combination)
          const exists = prevEvents.some(
            (e) =>
              e.id === newEvent.id ||
              (e.dTag === newEvent.dTag && e.pubkey === newEvent.pubkey),
          );

          if (exists) {
            logger.debug(
              "⚠️ Event already exists, skipping duplicate:",
              newEvent.id,
            );
            return prevEvents;
          }

          const updatedEvents = sortEventsByTime([...prevEvents, newEvent]);
          logger.debug("📅 Updated events count:", updatedEvents.length);

          // Also save to localStorage as backup (but avoid duplicates)
          const existingEvents = loadEvents();
          const hasLocalDuplicate = existingEvents.some(
            (e) =>
              e.id === newEvent.id ||
              (e.dTag === newEvent.dTag && e.pubkey === newEvent.pubkey),
          );

          if (!hasLocalDuplicate) {
            saveEvents(updatedEvents);
          }

          return updatedEvents;
        });

        setShowCreateForm(false);
        setSuccessMessage({
          eventId: result.eventId || "",
          naddr: result.naddr || "",
        });
      } else {
        const errorMsg = result.error || "Failed to publish to nostr";
        logger.error("❌ Event publishing failed:", errorMsg);

        // Show detailed error to user
        if (errorMsg.includes("timeout") || errorMsg.includes("Timeout")) {
          alert(
            "🕐 Publishing timed out. The relays may be busy or experiencing issues. Please try again in a moment.\n\nError: " +
              errorMsg,
          );
        } else if (
          errorMsg.includes("connection") ||
          errorMsg.includes("Connection")
        ) {
          alert(
            "🔌 Connection to relays failed. Please check your internet connection and try again.\n\nError: " +
              errorMsg,
          );
        } else if (errorMsg.includes("Failed to publish to any relay")) {
          alert(
            "📡 Unable to publish to any relay. The event data may be invalid or relays may be experiencing issues. Please try again.\n\nError: " +
              errorMsg,
          );
        } else {
          alert(
            "❌ Failed to publish event to Nostr. Please try again.\n\nError: " +
              errorMsg,
          );
        }

        throw new Error(errorMsg);
      }
    } catch (error) {
      logger.error("Failed to create event:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      // Show user-friendly error message
      if (errorMsg.includes("timeout") || errorMsg.includes("Timeout")) {
        alert(
          "🕐 Publishing timed out. The relays may be busy or experiencing issues. Please try again in a moment.\n\nError: " +
            errorMsg,
        );
      } else if (
        errorMsg.includes("connection") ||
        errorMsg.includes("Connection")
      ) {
        alert(
          "🔌 Connection to relays failed. Please check your internet connection and try again.\n\nError: " +
            errorMsg,
        );
      } else {
        alert(
          "❌ Failed to publish event to Nostr. Please try again.\n\nError: " +
            errorMsg,
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEvent = async (formData: EventFormData) => {
    if (!editingEvent) return;

    setIsSubmitting(true);
    try {
      const updatedEvent = createEventFromFormData({
        ...formData,
        eventType: editingEvent.kind === 31922 ? "all-day" : "timed",
      });
      updatedEvent.id = editingEvent.id;
      updatedEvent.dTag = editingEvent.dTag;
      updatedEvent.created_at = editingEvent.created_at;

      const updatedEvents = sortEventsByTime(
        events.map((event) =>
          event.id === editingEvent.id ? updatedEvent : event,
        ),
      );
      setEvents(updatedEvents);
      saveEvents(updatedEvents);
      setEditingEvent(null);
    } catch (error) {
      logger.error("Failed to update event:", error);
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

  // Debug event rendering
  logger.debug("🎯 Event Rendering Debug:");
  logger.debug(`📊 Total events: ${events.length}`);
  logger.debug(`🟢 Upcoming events: ${upcomingEvents.length}`);
  logger.debug(`🔴 Past events: ${pastEvents.length}`);
  logger.debug(
    "📋 All events:",
    events.map((e) => ({
      id: e.id,
      title: e.title,
      pubkey: e.pubkey,
      start: e.start,
      color: getEventColor(e),
    })),
  );

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold font-archivo-black">Calendar</h1>
          <a
            href={config.site.externalLinks.meetup.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-bitcoin-orange hover:underline font-semibold"
          >
            View on Meetup.com (nostr events excluded) &rarr;
          </a>
        </div>
        {/* Mobile Stats Row */}
        <div className="flex md:hidden gap-3 mb-6">
          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
            <div className="text-lg font-bold text-bitcoin-orange">{events.length}</div>
            <div className="text-xs text-gray-600">Total</div>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
            <div className="text-lg font-bold text-green-600">{upcomingEvents.length}</div>
            <div className="text-xs text-gray-600">Upcoming</div>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
            <div className="text-lg font-bold text-gray-600">{pastEvents.length}</div>
            <div className="text-xs text-gray-600">Past</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Statistics Sidebar - Hidden on mobile */}
          <div className="hidden md:block w-24 flex-shrink-0">
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
          <div className="flex-1 min-w-0 relative">
            {/* Loading Overlay - Over calendar with transparent background */}
            {viewMode !== "list" && isLoadingNostrEvents && (
              <div className="absolute top-4 left-0 right-0 z-50 flex justify-center">
                <div className="flex flex-col items-center gap-3 px-6 py-3 bg-white bg-opacity-95 rounded-lg shadow-lg backdrop-blur-sm">
                  <img
                    src={`${basePath}/bitcoinShaka.jpg`}
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
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
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
                  className="inline-flex items-center justify-center w-11 h-11 sm:w-10 sm:h-10 bg-bitcoin-orange text-white rounded-full hover:bg-bitcoin-orange-hover transition-colors"
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
                        src={`${basePath}/bitcoinShaka.jpg`}
                        alt="Loading..."
                        className="bitcoin-shaka-spinner"
                      />
                      <p className="text-purple-600 font-medium mt-4 text-center">
                        Loading events from Nostr...
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading skeleton for initial load */}
                {events.length === 0 && isLoadingNostrEvents && (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-lg p-6">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
                        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
                        <div className="h-4 bg-gray-200 rounded w-full" />
                      </div>
                    ))}
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
                          venueName={event.venueName}
                          description={splitDescription(
                            event.description || "",
                          )}
                          link={event.references?.[0]}
                          rawEvent={event.rawEvent}
                          onDelete={user && user.pubkey === event.pubkey ? () => handleDeleteEvent(event) : undefined}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Past Events Section */}
                {pastEvents.length > 0 && (
                  <section>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 font-archivo-black">
                      Past Events
                    </h3>
                    <div className="space-y-8">
                      {pastEvents.slice(0, 5).map((event) => (
                        <EventCard
                          key={event.id}
                          className={getEventColor(event)}
                          date={formatDate(event.start)}
                          title={event.title || "Untitled Event"}
                          startTime={formatTime(event.start)}
                          endTime={event.end ? formatTime(event.end) : "TBA"}
                          location={event.location || "Location TBD"}
                          venueName={event.venueName}
                          description={splitDescription(
                            event.description || "",
                          )}
                          link={event.references?.[0]}
                          rawEvent={event.rawEvent}
                          onDelete={user && user.pubkey === event.pubkey ? () => handleDeleteEvent(event) : undefined}
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

        {/* CornyChat collapsible embed */}
        <div className="mt-8 border border-gray-200 rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-bitcoin-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span className="font-semibold text-gray-800">Live Chat</span>
              <span className="text-xs text-gray-500 hidden sm:inline">
                CornyChat audio space
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${chatOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {chatOpen && (
            <iframe
              ref={chatIframeRef}
              src={CORNYCHAT_URL}
              className="w-full border-0"
              style={{ height: "calc(100vh - 200px)", minHeight: "400px" }}
              allow="microphone; camera; autoplay"
              title="CornyChat"
            />
          )}
        </div>
      </div>
    </div>
  );
}
