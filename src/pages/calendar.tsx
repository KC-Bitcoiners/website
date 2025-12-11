import React, { useState, useEffect } from "react";
import Head from "next/head";
import CalendarEventCard from "../components/CalendarEventCard";
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
import {
  fetchMeetupEvents,
  getVenueAddress,
  MeetupGroup,
} from "../utils/meetup";
import { PlusIcon } from "../components/Icons";
import { GetStaticProps, InferGetStaticPropsType } from "next";

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

  // Load events from localStorage and use meetup data from props
  useEffect(() => {
    const loadAllEvents = () => {
      try {
        // Load local events
        const localEvents = loadEvents();

        // Transform meetup events from props
        let meetupEvents: CalendarEvent[] = [];

        if (meetupGroup) {
          meetupEvents = meetupGroup.events.edges.map((edge) => {
            const event = edge.node;
            const startTime = new Date(event.dateTime).getTime() / 1000;
            const endTime = event.endTime
              ? new Date(event.endTime).getTime() / 1000
              : startTime + 3600; // Default 1 hour duration

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
        }

        // Combine all events and sort
        const allEvents = sortEventsByTime([...localEvents, ...meetupEvents]);
        setEvents(allEvents);
      } catch (error) {
        console.error("Error loading events:", error);
        // Fallback to local events only
        const localEvents = loadEvents();
        setEvents(sortEventsByTime(localEvents));
      }
    };

    loadAllEvents();
  }, [meetupGroup]);

  const handleCreateEvent = async (formData: EventFormData) => {
    setIsSubmitting(true);
    try {
      const newEvent = createEventFromFormData(formData);
      const updatedEvents = sortEventsByTime([...events, newEvent]);
      setEvents(updatedEvents);
      saveEvents(updatedEvents);
      setShowCreateForm(false);
    } catch (error) {
      console.error("Failed to create event:", error);
      alert("Failed to create event. Please try again.");
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
      console.error("Failed to update event:", error);
      alert("Failed to update event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    const updatedEvents = events.filter((event) => event.id !== eventId);
    setEvents(updatedEvents);
    saveEvents(updatedEvents);
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

  if (meetupError) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-600">
              Unable to load meetup events at this time. Please try again later.
            </p>
            <p className="text-sm text-red-500 mt-2">{meetupError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Calendar - KC Bitcoin Meetup Group</title>
        <meta
          name="description"
          content="Upcoming Bitcoin meetup events in Kansas City"
        />
      </Head>

      <div className="container mx-auto px-4 py-12">
        {/* Statistics */}
        <div className="mb-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-bitcoin-orange mb-2">
                {events.length}
              </div>
              <div className="text-gray-600">Total Events</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {upcomingEvents.length}
              </div>
              <div className="text-gray-600">Upcoming</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-gray-600 mb-2">
                {pastEvents.length}
              </div>
              <div className="text-gray-600">Past Events</div>
            </div>
          </div>
        </div>

        {/* Always show view selector */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
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
        </div>

        {/* Calendar View */}
        {viewMode !== "list" && (
          <CalendarView
            events={events}
            onEventClick={setSelectedEvent}
            currentView={viewMode}
          />
        )}

        {viewMode === "list" && (
          <div className="space-y-8">
            {/* Upcoming Events Section */}
            {upcomingEvents.length > 0 && (
              <section className="mb-16">
                <div className="space-y-8">
                  {upcomingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      date={formatDate(event.start)}
                      title={event.title || "Untitled Event"}
                      startTime={formatTime(event.start)}
                      endTime={event.end ? formatTime(event.end) : "TBA"}
                      location={event.location || "Location TBD"}
                      description={splitDescription(event.description || "")}
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
                      date={formatDate(event.start)}
                      title={event.title || "Untitled Event"}
                      startTime={formatTime(event.start)}
                      endTime={event.end ? formatTime(event.end) : "TBA"}
                      location={event.location || "Location TBD"}
                      description={splitDescription(event.description || "")}
                      link={event.references?.[0]}
                    />
                  ))}
                </div>
              </section>
            )}

            {events.length === 0 && (
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

        {/* Page Description and Actions */}
        <div className="mt-12 text-center">
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-8">
            Create and manage community events. All events are stored locally
            and can be created anonymously without requiring a login.
          </p>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 bg-bitcoin-orange text-white px-6 py-3 rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Create New Event
            </button>
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
                    : undefined
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
      </div>
    </>
  );
}
