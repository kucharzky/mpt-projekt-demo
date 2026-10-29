import type { CalendarEvent } from "../types";
import { uid } from "./time";

function unfoldIcs(text: string): string {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parseIcsDate(value: string): Date | null {
  const v = value.trim();
  if (/^\d{8}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6)) - 1;
    const d = Number(v.slice(6, 8));
    return new Date(y, m, d, 0, 0, 0, 0);
  }
  const utc = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utc) {
    return new Date(
      Date.UTC(
        Number(utc[1]),
        Number(utc[2]) - 1,
        Number(utc[3]),
        Number(utc[4]),
        Number(utc[5]),
        Number(utc[6]),
      ),
    );
  }
  const local = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (local) {
    return new Date(
      Number(local[1]),
      Number(local[2]) - 1,
      Number(local[3]),
      Number(local[4]),
      Number(local[5]),
      Number(local[6]),
    );
  }
  return null;
}

/** Read property value after the first unquoted colon (handles DTSTART;TZID=...:value). */
function fieldValue(block: string, name: string): string | undefined {
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    if (line.toUpperCase().startsWith(`${name};`) || line.toUpperCase().startsWith(`${name}:`)) {
      const idx = line.indexOf(":");
      if (idx >= 0) return line.slice(idx + 1).trim();
    }
  }
  return undefined;
}

export function parseIcsToEvents(icsText: string): CalendarEvent[] {
  const text = unfoldIcs(icsText);
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  const events: CalendarEvent[] = [];

  for (const raw of blocks) {
    const block = raw.split(/END:VEVENT/i)[0] ?? raw;
    const summary = fieldValue(block, "SUMMARY") ?? "Untitled";
    const dtStartRaw = fieldValue(block, "DTSTART");
    const dtEndRaw = fieldValue(block, "DTEND");
    if (!dtStartRaw) continue;

    const startDate = parseIcsDate(dtStartRaw);
    if (!startDate) continue;

    let endDate = dtEndRaw ? parseIcsDate(dtEndRaw) : null;
    if (!endDate) {
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    }

    events.push({
      id: uid("usos"),
      title: summary.replace(/\\,/g, ",").replace(/\\n/g, " "),
      start: startDate,
      end: endDate,
      source: "USOS_ICS",
      isPermanent: true,
      location: fieldValue(block, "LOCATION")?.replace(/\\,/g, ","),
    });
  }

  return events;
}
