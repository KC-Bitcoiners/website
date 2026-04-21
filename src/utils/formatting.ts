/** Parse a date string into a Date object. Handles ISO strings and Unix timestamps (seconds). */
function parseDateInput(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  // If it's a numeric string, treat as Unix timestamp in seconds
  if (/^\d+$/.test(dateString)) {
    return new Date(parseInt(dateString) * 1000);
  }
  return new Date(dateString);
}

/** Format a date string as a short date (e.g. "Mon, Jan 1"). Accepts ISO or Unix timestamp strings. */
export function formatDate(dateString: string | undefined): string {
  const date = parseDateInput(dateString);
  if (!date || isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Format a date string as a short time (e.g. "2:30 PM"). Accepts ISO or Unix timestamp strings. */
export function formatTime(dateString: string | undefined): string {
  const date = parseDateInput(dateString);
  if (!date || isNaN(date.getTime())) return "TBA";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Split a description string into paragraphs, filtering empty lines */
export function splitDescription(description: string): string[] {
  if (!description) return ["No description available."];
  return description
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim().length > 0)
    .map((paragraph) => paragraph.trim());
}
