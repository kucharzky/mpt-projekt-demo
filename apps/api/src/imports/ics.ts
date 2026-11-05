import ICAL from "ical.js";
import type { ImportedItem } from "../planner/domain/import";
import { localInstant } from "../planner/domain/time";

function instant(value: ICAL.Time, fallbackZone: string, tzid?: string): Date {
  if (value.zone.tzid !== "floating" && value.zone.tzid !== "local") {
    if (value.zone.tzid === "UTC" || value.zone.component)
      return value.toJSDate();
  }
  const date = `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
  const time = `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}:${String(value.second).padStart(2, "0")}`;
  return localInstant(
    date,
    time,
    tzid ?? (value.zone.tzid !== "floating" ? value.zone.tzid : fallbackZone),
  );
}
export class IcsValidationError extends Error {}

export function parseIcs(
  text: string,
  zone: string,
  from: string,
  to: string,
): { events: ImportedItem[]; warnings: string[] } {
  ICAL.TimezoneService.reset();
  try {
    return parseCalendar(text, zone, from, to);
  } catch (error) {
    if (error instanceof IcsValidationError) throw error;
    throw new IcsValidationError("Nieprawidłowy plik ICS.");
  } finally {
    ICAL.TimezoneService.reset();
  }
}
function parseCalendar(
  text: string,
  zone: string,
  from: string,
  to: string,
): { events: ImportedItem[]; warnings: string[] } {
  if (Buffer.byteLength(text, "utf8") > 2_000_000)
    throw new IcsValidationError("Plik jest za duży (maksymalnie 2 MB).");
  if (!text.includes("BEGIN:VCALENDAR") || !text.includes("END:VCALENDAR"))
    throw new IcsValidationError("To nie jest kompletny plik kalendarza ICS.");
  const root = new ICAL.Component(ICAL.parse(text));
  if (root.name !== "vcalendar")
    throw new IcsValidationError("Brak sekcji VCALENDAR.");
  const events: ImportedItem[] = [],
    warnings: string[] = [];
  const components = root.getAllSubcomponents("vevent");
  if (!components.length)
    throw new IcsValidationError("Plik nie zawiera wydarzeń VEVENT.");
  if (components.length > 5000)
    throw new IcsValidationError("Plik ma zbyt wiele wydarzeń.");
  for (const tz of root.getAllSubcomponents("vtimezone"))
    ICAL.TimezoneService.register(new ICAL.Timezone(tz));
  const startRange = +localInstant(from, "00:00", zone),
    endRange = +localInstant(to, "00:00", zone);
  let expansionSteps = 0;
  const parsed = components.map((c) => new ICAL.Event(c));
  for (const event of parsed) {
    if (!event.uid || !event.component.hasProperty("dtstart"))
      throw new IcsValidationError("Każde wydarzenie wymaga UID i DTSTART.");
    if (
      event.uid.length > 1024 ||
      (event.summary?.length ?? 0) > 500 ||
      (event.location?.length ?? 0) > 1000 ||
      (event.description?.length ?? 0) > 20000 ||
      !Number.isInteger(Number(event.sequence) || 0) ||
      Number(event.sequence) < 0 ||
      Number(event.sequence) > 2147483647
    )
      throw new IcsValidationError(
        "Wydarzenie zawiera zbyt długie lub nieprawidłowe dane.",
      );
  }
  for (const event of parsed.filter((e) => !e.isRecurrenceException())) {
    for (const exception of parsed.filter(
      (e) => e.isRecurrenceException() && e.uid === event.uid,
    ))
      event.relateException(exception);
    const tzid = event.component
      .getFirstProperty("dtstart")
      ?.getParameter("tzid") as string | undefined;
    const append = (
      start: ICAL.Time,
      end: ICAL.Time,
      key: string,
      title = event.summary,
    ) => {
      const startDate = instant(start, zone, tzid),
        endDate = instant(end, zone, tzid);
      if (
        !Number.isFinite(+startDate) ||
        !Number.isFinite(+endDate) ||
        +endDate <= +startDate
      )
        throw new IcsValidationError(
          `Nieprawidłowy czas wydarzenia „${title}”.`,
        );
      if (+startDate >= endRange || +endDate <= startRange) return;
      events.push({
        uid: event.uid,
        occurrenceKey: key,
        title: title || "Zajęcia USOS",
        description: event.description || "",
        location: event.location || "",
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        sequence: Number(event.sequence) || 0,
      });
      if (events.length > 10_000)
        throw new IcsValidationError(
          "Za dużo wystąpień. Zawęź zakres importu.",
        );
    };
    if (event.isRecurring()) {
      const iterator = event.iterator();
      let occurrence: ICAL.Time | null;
      while ((occurrence = iterator.next())) {
        if (++expansionSteps > 25_000)
          throw new IcsValidationError(
            "Reguła cykliczna przekracza limit obliczeń. Zawęź zakres lub wyeksportuj konkretne wystąpienia.",
          );
        if (+instant(occurrence, zone, tzid) >= endRange) break;
        const details = event.getOccurrenceDetails(occurrence);
        if (
          details.item.component.getFirstPropertyValue("status") === "CANCELLED"
        )
          continue;
        append(
          details.startDate,
          details.endDate,
          occurrence.toString(),
          details.item.summary,
        );
      }
    } else {
      if (event.component.getFirstPropertyValue("status") === "CANCELLED") {
        warnings.push(`Pominięto anulowane wydarzenie: ${event.summary}`);
        continue;
      }
      append(event.startDate, event.endDate, "single");
    }
  }
  // Exported exceptions without a master component are discrete, stable instances.
  for (const event of parsed.filter(
    (e) =>
      e.isRecurrenceException() &&
      !parsed.some((m) => !m.isRecurrenceException() && m.uid === e.uid),
  )) {
    const start = instant(event.startDate, zone),
      end = instant(event.endDate, zone);
    if (+end <= +start)
      throw new IcsValidationError("Nieprawidłowy zakres wystąpienia.");
    if (+start < endRange && +end > startRange)
      events.push({
        uid: event.uid,
        occurrenceKey: event.recurrenceId.toString(),
        title: event.summary,
        description: event.description || "",
        location: event.location || "",
        start: start.toISOString(),
        end: end.toISOString(),
        sequence: Number(event.sequence) || 0,
      });
  }
  if (events.length > 10000)
    throw new IcsValidationError("Za dużo wystąpień. Zawęź zakres importu.");
  const unique = new Map<string, ImportedItem>();
  for (const e of events) {
    const key = `${e.uid}\0${e.occurrenceKey}`,
      previous = unique.get(key);
    if (
      previous &&
      previous.sequence === e.sequence &&
      JSON.stringify(previous) !== JSON.stringify(e)
    )
      throw new IcsValidationError(
        "Plik zawiera sprzeczne wersje tego samego wydarzenia.",
      );
    if (!previous || previous.sequence <= e.sequence) unique.set(key, e);
  }
  if (!unique.size) warnings.push("Brak zajęć w wybranym zakresie dat.");
  return { events: [...unique.values()], warnings };
}

const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
function fold(line: string) {
  const lines: string[] = [];
  let chunk = "";
  for (const char of line) {
    if (Buffer.byteLength(chunk + char) > 75) {
      lines.push(chunk);
      chunk = " ";
    }
    chunk += char;
  }
  lines.push(chunk);
  return lines.join("\r\n");
}
export function exportIcs(
  events: {
    id: string;
    title: string;
    start: Date;
    end: Date;
    location?: string;
  }[],
  now = new Date(),
) {
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SmartUniPlanner//PL",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of events)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@smartuniplanner.local`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${escape(e.title)}`,
      `LOCATION:${escape(e.location || "")}`,
      "END:VEVENT",
    );
  return [...lines, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}
