import React, { useState, useEffect, useMemo } from "react";
import EventCard from "../components/EventCard";
import EventForm from "../components/EventForm";
import CalendarView from "../components/CalendarView";
import EventDetailsModal from "../components/EventDetailsModal";
import ErrorBoundary from "../components/ErrorBoundary";
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
import {
  WHITELISTED_NPUBS,
  WHITELISTED_PUBKEYS,
  basePath,
  CLIENT_TAG,
} from "@/config";
import { config } from "@/config";
import { useNostr } from "../contexts/NostrContext";
import { useRef, useCallback } from "react";
import { logger } from "@/utils/logger";
import { formatDate, formatTime, splitDescription } from "@/utils/formatting";
import { fetchZapTotal } from "@/utils/zaps";

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
  // Default to list view on mobile, month on desktop (deferred to avoid hydration mismatch)
  const [viewMode, setViewMode] = useState<"list" | "month" | "week" | "day">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
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

  const [zapTotals, setZapTotals] = useState<Record<string, number>>({});
  const [pastExpanded, setPastExpanded] = useState(false);
  const [pastPage, setPastPage] = useState(1);

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
    const unsignedDelete = {
      kind: 5,
      content: "Deleted by author",
      tags: [[...CLIENT_TAG], ["e", event.id], ["k", String(kind)]],
      created_at: Math.floor(Date.now() / 1000),
    };
    const signedDelete = await signEvent(
      unsignedDelete as {
        kind: number;
        content: string;
        tags: string[][];
        created_at: number;
      },
    );
    const { pool } = await import("@/lib/nostr");
    const { nostrRelays } = await import("@/config");
    try {
      await pool.publish(nostrRelays, signedDelete as any);
    } catch {}
  };

  // Load all events: local + meetup + nostr in parallel
  useEffect(() => {
    let cancelled = false;

    const loadAllEvents = async () => {
      if (cancelled) return;

      try {
        // Load all three sources concurrently
        const [localEvents, meetupEvents, nostrCalendarEvents] = await Promise.all([
          Promise.resolve(loadEvents()),
          // Transform meetup events from props
          (async () => {
            if (!meetupGroup) return [];
            return meetupGroup.events.edges.map((edge) => {
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
          })(),
          // Fetch nostr events
          (async () => {
            if (!cancelled) setIsLoadingNostrEvents(true);
            try {
              return await fetchNostrCalendarEvents();
            } catch (error) {
              logger.warn("⚠️ Failed to load nostr events:", error);
              return [];
            } finally {
              if (!cancelled) setIsLoadingNostrEvents(false);
            }
          })(),
        ]);

        if (cancelled) return;

        // Convert nostr events and fetch zaps inline
        const nostrEvents = nostrCalendarEvents.map(convertNostrEventToCalendar);
        nostrEvents.forEach((e) => {
          const rawId = e.id.replace("nostr-", "");
          const pubkey = (e.rawEvent as any)?.pubkey as string | undefined;
          fetchZapTotal(rawId, pubkey).then((t) => {
            if (!cancelled && t > 0) setZapTotals((prev) => ({ ...prev, [rawId]: t }));
          });
        });

        // Merge and deduplicate
        const allEvents = sortEventsByTime([...localEvents, ...meetupEvents, ...nostrEvents]);
        if (!cancelled) setEvents(allEvents);
      } catch (error) {
        logger.error("Error loading events:", error);
        if (!cancelled) {
          const localEvents = loadEvents();
          setEvents(sortEventsByTime(localEvents));
        }
      }
    };

    loadAllEvents();
    return () => { cancelled = true; };
  }, [meetupGroup]);

  // Switch to list view on mobile after hydration
  useEffect(() => {
    if (window.innerWidth < 768) setViewMode("list");
  }, []);

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

  // Function to get color based on event creator (for calendar grid — full bg + border)
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

  // Left-border accent for list view cards (white bg, colored left border)
  const getListAccent = (event: CalendarEvent): string => {
    if (event.pubkey === "meetup") return "border-l-4 border-l-bitcoin-orange";
    const hexIndex = WHITELISTED_PUBKEYS.findIndex((hex: string) => hex === event.pubkey);
    const npubIndex = WHITELISTED_NPUBS.findIndex((npub: string) => npub === event.pubkey);
    const colorIndex = Math.max(hexIndex, npubIndex);
    const accents = [
      "border-l-4 border-l-purple-500",
      "border-l-4 border-l-green-500",
      "border-l-4 border-l-yellow-500",
      "border-l-4 border-l-pink-500",
      "border-l-4 border-l-indigo-500",
    ];
    return colorIndex >= 0 ? accents[colorIndex % accents.length] : "border-l-4 border-l-gray-300";
  };

  const upcomingEvents = getUpcomingEvents(events);
  const pastEvents = getPastEvents(events);

  // Filter past events to 12 months, sort newest first
  const recentPastEvents = useMemo(() => {
    const twelveMonthsAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    return pastEvents
      .filter((e) => {
        const ts = e.kind === 31922
          ? new Date(e.start || "0").getTime()
          : parseInt(e.start || "0") * 1000;
        return ts >= twelveMonthsAgo;
      })
      .sort((a, b) => {
        const getTs = (e: CalendarEvent) =>
          e.kind === 31922
            ? new Date(e.start || "0").getTime()
            : parseInt(e.start || "0") * 1000;
        return getTs(b) - getTs(a);
      });
  }, [pastEvents]);

  const hasUpcoming = upcomingEvents.length > 0;
  const PAST_PAGE_SIZE = 10;
  const visiblePastEvents = hasUpcoming && !pastExpanded
    ? []
    : recentPastEvents.slice(0, pastPage * PAST_PAGE_SIZE);
  const hasMorePast = recentPastEvents.length > pastPage * PAST_PAGE_SIZE;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="relative">
        {/* Mobile Stats Row */}
        <div className="flex md:hidden gap-3 mb-6">
          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
            <div className="text-lg font-bold text-bitcoin-orange">
              {events.length}
            </div>
            <div className="text-xs text-gray-600">Total</div>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
            <div className="text-lg font-bold text-green-600">
              {upcomingEvents.length}
            </div>
            <div className="text-xs text-gray-600">Upcoming</div>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
            <div className="text-lg font-bold text-gray-600">
              {pastEvents.length}
            </div>
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
              <div className="absolute top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-3 px-6 py-3 bg-white bg-opacity-95 rounded-lg shadow-lg backdrop-blur-sm pointer-events-auto">
                  <img
                    src={`${basePath}/bitcoinShaka.jpg`}
                    alt="Loading..."
                    width={48}
                    height={48}
                    className="w-auto h-auto max-w-12 max-h-12 rounded-full animate-spin"
                  />
                  <p className="text-purple-600 font-medium">
                    Loading events from Nostr...
                  </p>
                </div>
              </div>
            )}

            {/* Always show view selector */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setViewMode("month")}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors rounded-l-lg ${
                    viewMode === "month"
                      ? "bg-bitcoin-orange text-white"
                      : "text-gray-600 hover:text-gray-900 bg-gray-50"
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === "week"
                      ? "bg-bitcoin-orange text-white"
                      : "text-gray-600 hover:text-gray-900 bg-gray-50"
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode("day")}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors rounded-r-lg ${
                    viewMode === "day"
                      ? "bg-bitcoin-orange text-white"
                      : "text-gray-600 hover:text-gray-900 bg-gray-50"
                  }`}
                >
                  Day
                </button>

                <button
                  onClick={() => setViewMode("list")}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors rounded-lg border border-gray-200 bg-white ml-1 ${
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
                data-testid="create-event-btn"
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center justify-center w-7 h-7 bg-bitcoin-orange text-white rounded-full hover:bg-bitcoin-orange-hover transition-colors flex-shrink-0"
                title="Create New Event"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Calendar View */}
            {viewMode !== "list" && (
              <ErrorBoundary>
                <CalendarView
                  events={events}
                  onEventClick={setSelectedEvent}
                  currentView={viewMode}
                  getEventColor={getEventColor}
                  signEvent={signEvent}
                  pubkey={user?.pubkey}
                  zapTotals={zapTotals}
                />
              </ErrorBoundary>
            )}

            {viewMode === "list" && (
              <div className="space-y-8">
                {isLoadingNostrEvents && (
                  <div className="bitcoin-shaka-loading-overlay mb-8">
                    <div className="bitcoin-shaka-container">
                      <img
                        src={`${basePath}/bitcoinShaka.jpg`}
                        width={80}
                        height={80}
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
                      <div
                        key={i}
                        className="animate-pulse bg-white border border-gray-200 rounded-lg p-6"
                      >
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
                        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
                        <div className="h-4 bg-gray-200 rounded w-full" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Upcoming Events */}
                {upcomingEvents.length > 0 && (
                  <section>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 font-archivo-black">
                      Upcoming Events ({upcomingEvents.length})
                    </h3>
                    <div className="space-y-8">
                      {upcomingEvents.map((event) => (
                        <EventCard
                          key={event.id}
                          className={`bg-white border border-gray-200 ${getListAccent(event)}`}
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
                          signEvent={signEvent}
                          pubkey={user?.pubkey}
                          onDelete={
                            user && user.pubkey === event.pubkey
                              ? () => handleDeleteEvent(event)
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Past Events — collapsed when upcoming exist, expanded otherwise */}
                {recentPastEvents.length > 0 && (
                  <section>
                    {hasUpcoming ? (
                      <button
                        onClick={() => { setPastExpanded(!pastExpanded); setPastPage(1); }}
                        className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <span className="font-semibold font-archivo-black">
                          Past Events ({recentPastEvents.length})
                        </span>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${pastExpanded ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    ) : (
                      <h3 className="text-xl font-bold text-gray-900 mb-4 font-archivo-black">
                        Past Events ({recentPastEvents.length})
                      </h3>
                    )}
                    {(pastExpanded || !hasUpcoming) && (
                      <div className="space-y-8 mt-4">
                        {visiblePastEvents.map((event) => (
                          <EventCard
                            key={event.id}
                            className={`bg-white border border-gray-200 ${getListAccent(event)}`}
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
                            signEvent={signEvent}
                            pubkey={user?.pubkey}
                            onDelete={
                              user && user.pubkey === event.pubkey
                                ? () => handleDeleteEvent(event)
                                : undefined
                            }
                          />
                        ))}
                        {hasMorePast && (
                          <div className="text-center py-4">
                            <button
                              onClick={() => setPastPage((p) => p + 1)}
                              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                            >
                              Load more ({recentPastEvents.length - visiblePastEvents.length} remaining)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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
          signEvent={signEvent}
          pubkey={user?.pubkey}
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
              <svg
                className="w-5 h-5 text-bitcoin-orange"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {chatOpen && (
            <ErrorBoundary fallback={<p className="text-gray-500 text-sm p-4 text-center">Chat failed to load.</p>}>
              <iframe
                ref={chatIframeRef}
                sandbox="allow-scripts allow-same-origin"
                loading="lazy"
                src={CORNYCHAT_URL}
                className="w-full border-0"
                style={{ height: "calc(100vh - 200px)", minHeight: "400px" }}
                allow="microphone; camera; autoplay"
                title="CornyChat"
            />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
