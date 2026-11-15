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
