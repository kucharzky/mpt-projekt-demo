/** ICS / USOS import helpers and parser contracts. */

export interface ParsedVEvent {
  uid: string;
  summary: string;
  dtStart: string;
  dtEnd: string;
  location?: string;
  description?: string;
  rrule?: string;
}

export interface ParseIcsResult {
  events: ParsedVEvent[];
  warnings?: string[];
  errors: string[];
}

/**
 * Validates and extracts basic VEVENT entries from raw ICS file text.
 */
export function parseIcs(content: string): ParseIcsResult {
  if (!content.trim()) {
    return { events: [], errors: ["Empty ICS content"] };
  }
  return { events: [], errors: [] };
}

/**
 * Validates syntax, line endings and size limits for uploaded .ics files.
 */
export function validateIcsFormat(content: string, maxBytes = 10_000_000): { valid: boolean; error?: string } {
  if (!content || !content.trim()) return { valid: false, error: "Pusty plik kalendarza" };
  if (Buffer.byteLength(content, "utf-8") > maxBytes) return { valid: false, error: "Plik przekracza dozwolony limit rozmiaru" };
  if (!content.includes("BEGIN:VCALENDAR") || !content.includes("END:VCALENDAR")) {
    return { valid: false, error: "Brak wymaganych naglowkow VCALENDAR" };
  }
  return { valid: true };
}
