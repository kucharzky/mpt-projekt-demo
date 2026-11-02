/** ICS / USOS import helpers (scaffold). */

export interface ParsedVEvent {
  uid: string;
  summary: string;
  dtStart: string;
  dtEnd: string;
}

export interface ParseIcsResult {
  events: ParsedVEvent[];
  errors: string[];
}

/**
 * Placeholder parser — real VEVENT mapping lands with MPT-7.
 */
export function parseIcs(content: string): ParseIcsResult {
  if (!content.trim()) {
    return { events: [], errors: ["Empty ICS content"] };
  }

  return { events: [], errors: [] };
}
