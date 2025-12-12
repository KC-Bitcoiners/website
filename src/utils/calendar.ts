import { CalendarEvent, EventFormData } from "@/types/calendar";

// Local storage key for events
const EVENTS_STORAGE_KEY = "calendar-events";

// Generate a random ID for anonymous events
export function generateEventId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Generate a random pubkey for anonymous events
export function generateAnonymousPubkey(): string {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

// Save events to localStorage (only local events, not meetup events)
export function saveEvents(events: CalendarEvent[]): void {
  try {
    // Filter out meetup events - only save user-created local events
    const localEvents = events.filter(
      (event) => event.pubkey !== "meetup" && !event.id.startsWith("meetup-"),
    );
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(localEvents));
  } catch (error) {
    console.error("Failed to save events:", error);
  }
}

// Load events from localStorage
export function loadEvents(): CalendarEvent[] {
  try {
    const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to load events:", error);
    return [];
  }
}

// Create a CalendarEvent from form data
export function createEventFromFormData(
  formData: EventFormData,
): CalendarEvent {
  const now = Math.floor(Date.now() / 1000);
  const eventId = generateEventId();
  const pubkey = generateAnonymousPubkey();

  let start: string;
  let end: string;
  let kind: number;

  if (formData.eventType === "all-day") {
    kind = 31922; // Date-based event
    start = formData.startDate;
    end = formData.endDate || formData.startDate;
  } else {
    kind = 31923; // Time-based event
    const startDateTime = new Date(
      `${formData.startDate}T${formData.startTime}`,
    );
    const endDateTime =
      formData.endDate && formData.endTime
        ? new Date(`${formData.endDate}T${formData.endTime}`)
        : new Date(startDateTime.getTime() + 60 * 60 * 1000);

    start = Math.floor(startDateTime.getTime() / 1000).toString();
    end = Math.floor(endDateTime.getTime() / 1000).toString();
  }

  // Build tags array
  const tags: string[][] = [];

  // Add d-tag
  tags.push(["d", eventId]);

  // Add locations
  if (formData.locations.length > 0) {
    formData.locations.forEach((location) => {
      tags.push(["location", location]);
    });
  }

  // Add hashtags
  if (formData.hashtags.length > 0) {
    formData.hashtags.forEach((tag) => {
      tags.push(["t", tag]);
    });
  }

  // Add references
  if (formData.references.length > 0) {
    formData.references.forEach((ref) => {
      tags.push(["r", ref]);
    });
  }

  // Add timezone for timed events
  if (formData.eventType === "timed" && formData.timezone) {
    tags.push(["timezone", formData.timezone]);
  }

  return {
    id: eventId,
    kind,
    pubkey,
    created_at: now,
    tags,
    content: formData.description,

    // Parsed data
    dTag: eventId,
    title: formData.title,
    summary: formData.summary || undefined,
    image: formData.image || undefined,
    start,
    end,
    location: formData.locations[0] || undefined,
    locations: formData.locations.length > 0 ? formData.locations : undefined,
    description: formData.description,
    timezone: formData.eventType === "timed" ? formData.timezone : undefined,
    hashtags: formData.hashtags.length > 0 ? formData.hashtags : undefined,
    references:
      formData.references.length > 0 ? formData.references : undefined,

    // UI properties
    source: "local",
  };
}

// Format event time for display
export function formatEventTime(event: CalendarEvent): string {
  if (event.kind === 31922) {
    // Date-based event
    if (!event.start) return "No date";
    const start = new Date(event.start);
    const end = event.end ? new Date(event.end) : start;

    if (event.start === event.end || !event.end) {
      return start.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } else {
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
  } else if (event.kind === 31923) {
    // Time-based event
    if (!event.start) return "No time";
    const start = new Date(parseInt(event.start) * 1000);
    const startFormatted = start.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (event.end) {
      const end = new Date(parseInt(event.end) * 1000);
      // If same day, only show end time
      if (start.toDateString() === end.toDateString()) {
        return `${startFormatted} - ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
      } else {
        // Different days, show full end date/time
        return `${startFormatted} - ${end.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })}`;
      }
    }

    return startFormatted;
  }

  return "No time specified";
}

// Get event type label
export function getEventTypeLabel(event: CalendarEvent): string {
  switch (event.kind) {
    case 31922:
      return "All-day Event";
    case 31923:
      return "Timed Event";
    default:
      return "Calendar Event";
  }
}

// Sort events by start time
export function sortEventsByTime(events: CalendarEvent[]): CalendarEvent[] {
  return events.sort((a, b) => {
    const getStartTime = (event: CalendarEvent): number => {
      if (event.kind === 31923) {
        return parseInt(event.start || "0");
      } else {
        return new Date(event.start || "0").getTime();
      }
    };

    return getStartTime(a) - getStartTime(b);
  });
}

// Filter upcoming events
export function getUpcomingEvents(events: CalendarEvent[]): CalendarEvent[] {
  const now = Date.now();
  return events.filter(event => {
    let startTimeMs: number;
    
    if (event.kind === 31922) {
      // All-day event - start is a date string
      startTimeMs = new Date(event.start || '0').getTime();
    } else {
      // Timed event - start is a timestamp string
      startTimeMs = parseInt(event.start || '0') * 1000;
    }
    
    return startTimeMs > now;
  });
}

// Filter past events
export function getPastEvents(events: CalendarEvent[]): CalendarEvent[] {
  const now = Date.now();
  return events.filter(event => {
    let startTimeMs: number;
    
    if (event.kind === 31922) {
      // All-day event - start is a date string
      startTimeMs = new Date(event.start || '0').getTime();
    } else {
      // Timed event - start is a timestamp string
      startTimeMs = parseInt(event.start || '0') * 1000;
    }
    
    return startTimeMs <= now;
  });
}
