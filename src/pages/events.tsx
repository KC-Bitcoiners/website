import { GetStaticProps, InferGetStaticPropsType } from "next";
import EventCard from "../components/EventCard";
import { generateICalendarFile } from "../utils/icalendar";
import { fetchMeetupEvents, getVenueAddress, MeetupGroup } from "../lib/meetup";
import { getMeetupUrl, eventsConfig } from "../config";
import { formatDate, formatTime, splitDescription } from "../utils/formatting";

interface EventsPageProps {
  group: MeetupGroup | null;
  error?: string;
}

export const getStaticProps: GetStaticProps<EventsPageProps> = async () => {
  try {
    // Fetch meetup events data
    const group = await fetchMeetupEvents();

    // Generate iCalendar file in public directory
    generateICalendarFile(group);

    return {
      props: {
        group,
      },
    };
  } catch (error) {
    console.error("Error fetching events:", error);

    return {
      props: {
        group: null,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
    };
  }
};

export default function EventsPage({
  group,
  error,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8 font-archivo-black">Events</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-600">
              Unable to load events at this time. Please try again later.
            </p>
            <p className="text-sm text-red-500 mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8 font-archivo-black">Events</h1>
          <p className="text-gray-600">No group data available.</p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const events = group.events.edges.map((edge) => edge.node);
  const upcomingEvents = events.filter(
    (event) => new Date(event.dateTime) > now,
  );
  const pastEvents = events.filter((event) => new Date(event.dateTime) <= now);

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Page Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-6 font-archivo-black">
          {eventsConfig.header.title}
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          {eventsConfig.header.description}
        </p>
      </div>

      {/* Upcoming Events Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-8 font-archivo-black bitcoin-orange">
          {eventsConfig.sections.upcoming.title}
        </h2>

        {upcomingEvents.length > 0 ? (
          <div className="space-y-8">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event.id}
                date={formatDate(event.dateTime)}
                title={event.title}
                startTime={formatTime(event.dateTime)}
                endTime={event.endTime ? formatTime(event.endTime) : "TBA"}
                location={getVenueAddress(event.venues)}
                venueName={event.venues?.[0]?.name?.trim()}
                description={splitDescription(event.description)}
                link={event.eventUrl}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600 text-lg mb-4">
              {eventsConfig.sections.upcoming.noEventsMessage}
            </p>
            <p className="text-gray-500">
              {eventsConfig.sections.upcoming.followUsMessage}{" "}
              <a
                href={getMeetupUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="bitcoin-orange hover:underline font-semibold"
              >
                Meetup.com
              </a>
            </p>
          </div>
        )}
      </section>

      {/* Past Events Section */}
      {pastEvents.length > 0 && (
        <section>
          <h2 className="text-3xl font-bold mb-8 font-archivo-black text-gray-700">
            {eventsConfig.sections.past.title}
          </h2>
          <div className="space-y-8 opacity-75">
            {pastEvents.slice(0, 5).map((event) => (
              <EventCard
                key={event.id}
                date={formatDate(event.dateTime)}
                title={event.title}
                startTime={formatTime(event.dateTime)}
                endTime={event.endTime ? formatTime(event.endTime) : "TBA"}
                location={getVenueAddress(event.venues)}
                venueName={event.venues?.[0]?.name?.trim()}
                description={splitDescription(event.description)}
                link={event.eventUrl}
              />
            ))}
          </div>

          {pastEvents.length > 5 && (
            <div className="text-center mt-8">
              <p className="text-gray-500">
                {eventsConfig.sections.past.showingRecentMessage}{" "}
                <a
                  href={`${getMeetupUrl()}events/past/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bitcoin-orange hover:underline font-semibold"
                >
                  {eventsConfig.sections.past.viewAllText}
                </a>
              </p>
            </div>
          )}
        </section>
      )}

      {/* Call to Action */}
      <section className="mt-16 bg-gradient-to-r from-gray-50 to-orange-50 border border-gray-200 rounded-lg p-8 text-center">
        <h3 className="text-2xl font-bold mb-4 font-archivo-black">
          {eventsConfig.callToAction.title}
        </h3>
        <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
          {eventsConfig.callToAction.description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={getMeetupUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-bitcoin-orange text-white px-8 py-3 rounded-lg font-semibold hover:bg-bitcoin-orange-hover transition-colors"
          >
            {eventsConfig.callToAction.buttonText}
          </a>
          {/* Only show in dev mode for testing */}
          {process.env.NODE_ENV === "development" && (
            <a
              href={eventsConfig.calendar.webcalUrl}
              download={eventsConfig.calendar.downloadFilename}
              className="inline-block bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
            >
              {eventsConfig.calendar.buttonText}
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
