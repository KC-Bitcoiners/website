import { describe, it, expect } from "vitest";
import {
  googleMapsSearchUrl,
  getDisplayLocationLines,
  generateEventId,
  sortEventsByTime,
  getUpcomingEvents,
  getPastEvents,
  getEventTypeLabel,
} from "@/utils/calendar";
import type { CalendarEvent } from "@/types/calendar";

// ---------------------------------------------------------------------------
// googleMapsSearchUrl
// ---------------------------------------------------------------------------
describe("googleMapsSearchUrl", () => {
  it("encodes the query string", () => {
    const url = googleMapsSearchUrl("123 Main St, Kansas City, MO");
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Kansas%20City%2C%20MO",
    );
  });

  it("handles a simple single-word query", () => {
    const url = googleMapsSearchUrl("Denver");
    expect(url).toBe("https://www.google.com/maps/search/?api=1&query=Denver");
  });

  it("handles an empty query", () => {
    const url = googleMapsSearchUrl("");
    expect(url).toBe("https://www.google.com/maps/search/?api=1&query=");
  });

  it("handles unicode characters", () => {
    const url = googleMapsSearchUrl("Zürich, Schweiz");
    expect(url).toContain("Z%C3%BCrich");
    expect(url).toContain("Schweiz");
  });

  it("handles special characters like # and &", () => {
    const url = googleMapsSearchUrl("Building #5 & 6");
    expect(url).toContain("Building%20%235%20%26%206");
  });
});

// ---------------------------------------------------------------------------
// getDisplayLocationLines
// ---------------------------------------------------------------------------
describe("getDisplayLocationLines", () => {
  /** Helper to build a partial CalendarEvent with location fields. */
  function makeEvent(
    location?: string,
    locations?: string[],
  ): Partial<CalendarEvent> {
    return { location, locations };
  }

  it("returns empty array when no location data", () => {
    expect(getDisplayLocationLines(makeEvent())).toEqual([]);
  });

  it("returns empty array when location is empty string and no locations", () => {
    expect(getDisplayLocationLines(makeEvent(""))).toEqual([]);
  });

  it("returns primary location only", () => {
    expect(getDisplayLocationLines(makeEvent("123 Main St"))).toEqual([
      "123 Main St",
    ]);
  });

  it("returns locations array when no primary location", () => {
    expect(
      getDisplayLocationLines(makeEvent(undefined, ["Venue A", "Venue B"])),
    ).toEqual(["Venue A", "Venue B"]);
  });

  it("deduplicates exact matches between location and locations", () => {
    expect(
      getDisplayLocationLines(
        makeEvent("123 Main St", ["123 Main St", "Kansas City"]),
      ),
    ).toEqual(["123 Main St", "Kansas City"]);
  });

  it("deduplicates when locations entry is a substring of location", () => {
    // "Main St" is a substring of "123 Main St, Kansas City"
    expect(
      getDisplayLocationLines(
        makeEvent("123 Main St, Kansas City", ["Main St", "Kansas City"]),
      ),
    ).toEqual(["123 Main St, Kansas City"]);
    // "Kansas City" is also a substring of primary
  });

  it("deduplicates duplicate entries within locations", () => {
    expect(
      getDisplayLocationLines(
        makeEvent(undefined, ["Venue A", "Venue A", "Venue B"]),
      ),
    ).toEqual(["Venue A", "Venue B"]);
  });

  it("keeps distinct location lines", () => {
    expect(
      getDisplayLocationLines(
        makeEvent("123 Main St", ["456 Oak Ave", "789 Pine Rd"]),
      ),
    ).toEqual(["123 Main St", "456 Oak Ave", "789 Pine Rd"]);
  });

  it("handles edge case: locations is empty array", () => {
    expect(getDisplayLocationLines(makeEvent("123 Main St", []))).toEqual([
      "123 Main St",
    ]);
  });

  it("handles edge case: location is empty string but locations has values", () => {
    expect(
      getDisplayLocationLines(makeEvent("", ["Venue A", "Venue B"])),
    ).toEqual(["Venue A", "Venue B"]);
  });

  it("trims whitespace from location values", () => {
    expect(
      getDisplayLocationLines(
        makeEvent("  Venue A  ", ["  Venue A  ", "Venue B"]),
      ),
    ).toEqual(["Venue A", "Venue B"]);
  });

  it("skips blank entries in locations array", () => {
    expect(
      getDisplayLocationLines(makeEvent(undefined, ["", "  ", "Venue A"])),
    ).toEqual(["Venue A"]);
  });

  it("handles location that fully contains a locations entry", () => {
    // "Kansas City" is contained in "123 Main St, Kansas City, MO"
    const result = getDisplayLocationLines(
      makeEvent("123 Main St, Kansas City, MO", ["Kansas City", "MO"]),
    );
    expect(result).toEqual(["123 Main St, Kansas City, MO"]);
  });
});

// ---------------------------------------------------------------------------
// generateEventId
// ---------------------------------------------------------------------------
describe("generateEventId", () => {
  it("returns a non-empty string", () => {
    const id = generateEventId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("returns unique ids on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEventId()));
    expect(ids.size).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getEventTypeLabel
// ---------------------------------------------------------------------------
describe("getEventTypeLabel", () => {
  it("returns All-day Event for kind 31922", () => {
    expect(getEventTypeLabel({ kind: 31922 } as CalendarEvent)).toBe(
      "All-day Event",
    );
  });

  it("returns Timed Event for kind 31923", () => {
    expect(getEventTypeLabel({ kind: 31923 } as CalendarEvent)).toBe(
      "Timed Event",
    );
  });

  it("returns Calendar Event for unknown kind", () => {
    expect(getEventTypeLabel({ kind: 1 } as CalendarEvent)).toBe(
      "Calendar Event",
    );
  });
});

// ---------------------------------------------------------------------------
// sortEventsByTime
// ---------------------------------------------------------------------------
describe("sortEventsByTime", () => {
  it("sorts timed events (kind 31923) by start timestamp ascending", () => {
    const events = [
      { kind: 31923, start: "1700002000" } as CalendarEvent,
      { kind: 31923, start: "1700001000" } as CalendarEvent,
      { kind: 31923, start: "1700001500" } as CalendarEvent,
    ];
    const sorted = sortEventsByTime([...events]);
    expect(sorted[0].start).toBe("1700001000");
    expect(sorted[1].start).toBe("1700001500");
    expect(sorted[2].start).toBe("1700002000");
  });

  it("sorts date-based events (kind 31922) by date string ascending", () => {
    const events = [
      { kind: 31922, start: "2025-03-15" } as CalendarEvent,
      { kind: 31922, start: "2025-01-01" } as CalendarEvent,
      { kind: 31922, start: "2025-02-28" } as CalendarEvent,
    ];
    const sorted = sortEventsByTime([...events]);
    expect(sorted[0].start).toBe("2025-01-01");
    expect(sorted[1].start).toBe("2025-02-28");
    expect(sorted[2].start).toBe("2025-03-15");
  });
});

// ---------------------------------------------------------------------------
// getUpcomingEvents / getPastEvents
// ---------------------------------------------------------------------------
describe("getUpcomingEvents & getPastEvents", () => {
  const now = Date.now();
  const pastTs = Math.floor((now - 86400000) / 1000).toString();
  const futureTs = Math.floor((now + 86400000) / 1000).toString();

  const pastEvent = {
    kind: 31923,
    start: pastTs,
  } as CalendarEvent;

  const futureEvent = {
    kind: 31923,
    start: futureTs,
  } as CalendarEvent;

  it("getUpcomingEvents returns only future events", () => {
    const result = getUpcomingEvents([pastEvent, futureEvent]);
    expect(result).toHaveLength(1);
    expect(result[0].start).toBe(futureTs);
  });

  it("getPastEvents returns only past events", () => {
    const result = getPastEvents([pastEvent, futureEvent]);
    expect(result).toHaveLength(1);
    expect(result[0].start).toBe(pastTs);
  });

  it("works with date-based events (kind 31922)", () => {
    const pastDate = new Date(now - 86400000 * 7).toISOString().split("T")[0];
    const futureDate = new Date(now + 86400000 * 7).toISOString().split("T")[0];

    const pastDateEvent = {
      kind: 31922,
      start: pastDate,
    } as CalendarEvent;

    const futureDateEvent = {
      kind: 31922,
      start: futureDate,
    } as CalendarEvent;

    expect(getUpcomingEvents([pastDateEvent, futureDateEvent])).toHaveLength(1);
    expect(getPastEvents([pastDateEvent, futureDateEvent])).toHaveLength(1);
  });
});
