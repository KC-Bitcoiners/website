import React from "react";
import EventCard from "../components/EventCard";
import StaticLayout from "../components/StaticLayout";
import { StaticEvent, getUpcomingStaticEvents, getPastStaticEvents } from "../data/staticEvents";
import { GetStaticProps, InferGetStaticPropsType } from "next";

interface CalendarStaticPageProps {
  upcomingEvents: StaticEvent[];
  pastEvents: StaticEvent[];
}

export const getStaticProps: GetStaticProps<CalendarStaticPageProps> = async () => {
  // In a real build, you'd determine these at build time
  // For now, we'll just return all events and let the client sort them
  const upcomingEvents = getUpcomingStaticEvents();
  const pastEvents = getPastStaticEvents();

  return {
    props: {
      upcomingEvents,
      pastEvents,
    },
  };
};

export default function CalendarStaticPage({
  upcomingEvents,
  pastEvents,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  // Helper functions to format data for EventCard
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString?: string): string => {
    if (!timeString) return "TBA";
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const splitDescription = (description: string): string[] => {
    if (!description) return ["No description available."];
    return description
      .split(/\n\s*\n/)
      .filter((paragraph) => paragraph.trim().length > 0)
      .map((paragraph) => paragraph.trim());
  };

  return (
    <StaticLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="relative">
          {/* Main Content */}
          <div className="flex gap-6">
            {/* Statistics Sidebar */}
            <div className="w-24 flex-shrink-0">
              <div className="sticky top-24 space-y-2">
                <div className="bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
                  <div className="text-lg font-bold text-bitcoin-orange mb-1">
                    {upcomingEvents.length + pastEvents.length}
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
            <div className="flex-1">
              {/* Header */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h1 className="text-3xl font-bold font-archivo-black text-gray-900 mb-2">
                  KC Bitcoiners Events
                </h1>
                <p className="text-gray-600">
                  Join us for Bitcoin meetups, workshops, and educational events in Kansas City.
                </p>
              </div>

              {/* Upcoming Events Section */}
              {upcomingEvents.length > 0 && (
                <section className="mb-16">
                  <h2 className="text-3xl font-bold mb-8 font-archivo-black text-gray-900">
                    Upcoming Events
                  </h2>
                  <div className="space-y-8">
                    {upcomingEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        className="bg-purple-50 border-purple-200"
                        date={formatDate(event.startDate)}
                        title={event.title}
                        startTime={formatTime(event.startTime)}
                        endTime={formatTime(event.endTime)}
                        location={event.location}
                        description={splitDescription(event.description)}
                        link={event.link}
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
                        className="bg-gray-50 border-gray-200"
                        date={formatDate(event.startDate)}
                        title={event.title}
                        startTime={formatTime(event.startTime)}
                        endTime={formatTime(event.endTime)}
                        location={event.location}
                        description={splitDescription(event.description)}
                        link={event.link}
                      />
                    ))}
                  </div>
                </section>
              )}

              {upcomingEvents.length === 0 && pastEvents.length === 0 && (
                <div className="text-center py-12">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">
                      No Events Scheduled
                    </h3>
                    <p className="text-gray-600">
                      Check back soon for upcoming Bitcoin events in Kansas City.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </StaticLayout>
  );
}
