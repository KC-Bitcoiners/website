import { writeFileSync } from "fs";
import { join } from "path";
import { MeetupGroup, getVenueAddress } from "../lib/meetup";

// Helper function to format date for iCalendar (YYYYMMDDTHHMMSSZ format)
const formatICalDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
};

// Helper function to escape iCalendar text
const escapeICalText = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
};

// Helper function to generate UID for events
const generateUID = (eventId: string): string => {
  return `${eventId}@kansas-city-bitcoin-meetup.com`;
};

// Helper function to clean HTML from description
const cleanDescription = (description: string): string => {
  if (!description) return "";
  // Remove HTML tags and decode HTML entities
  return description
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

// Generate iCalendar content from meetup group data
export function generateICalendar(group: MeetupGroup): string {
  const events = group.events.edges.map((edge) => edge.node);

  let icalContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kansas City Bitcoiners//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICalText(group.name)}`,
    `X-WR-CALDESC:${escapeICalText(group.description || "Bitcoin meetups and events in Kansas City")}`,
    "X-WR-TIMEZONE:America/Chicago",
  ];

  events.forEach((event) => {
    const startTime = formatICalDate(event.dateTime);
    const endTime = event.endTime
      ? formatICalDate(event.endTime)
      : formatICalDate(
          new Date(
            new Date(event.dateTime).getTime() + 2 * 60 * 60 * 1000,
          ).toISOString(),
        ); // Default 2 hours if no end time
    const location = getVenueAddress(event.venues);
    const description = cleanDescription(event.description);
    const uid = generateUID(event.id);
    const createdTime = formatICalDate(event.createdTime);
    const modifiedTime = formatICalDate(new Date().toISOString());

    icalContent.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART:${startTime}`,
      `DTEND:${endTime}`,
      `DTSTAMP:${modifiedTime}`,
      `CREATED:${createdTime}`,
      `LAST-MODIFIED:${modifiedTime}`,
      `SUMMARY:${escapeICalText(event.title)}`,
      `DESCRIPTION:${escapeICalText(description)}${event.eventUrl ? "\\n\\nEvent URL: " + event.eventUrl : ""}${event.howToFindUs ? "\\n\\nHow to find us: " + escapeICalText(event.howToFindUs) : ""}`,
      `LOCATION:${escapeICalText(location)}`,
      `URL:${event.eventUrl}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  });

  icalContent.push("END:VCALENDAR");

  return icalContent.join("\r\n");
}

// Generate and save iCalendar file to public directory
export function generateICalendarFile(group: MeetupGroup): void {
  const icalContent = generateICalendar(group);

  // Write the .ics file to the public directory during build
  const publicPath = join(process.cwd(), "public", "events.ics");
  writeFileSync(publicPath, icalContent, "utf-8");

  console.log("Generated events.ics file in public directory");
}
