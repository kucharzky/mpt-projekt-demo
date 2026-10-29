import type { CalendarEvent } from "../types";
import { addDays, setTimeOnDate, startOfWeekMonday, uid } from "../lib/time";

function block(
  day: Date,
  startH: number,
  startM: number,
  endH: number,
  endM: number,
  title: string,
  location: string,
): CalendarEvent {
  const start = setTimeOnDate(day, `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`);
  const end = setTimeOnDate(day, `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
  return {
    id: uid("usos"),
    title,
    start,
    end,
    source: "USOS_ICS",
    isPermanent: true,
    location,
  };
}

/** Realistic USOS-like lectures/labs for the week containing `anchor` (default: today). */
export function buildSampleUsosSchedule(anchor = new Date()): CalendarEvent[] {
  const mon = startOfWeekMonday(anchor);
  const tue = addDays(mon, 1);
  const wed = addDays(mon, 2);
  const thu = addDays(mon, 3);
  const fri = addDays(mon, 4);

  return [
    block(mon, 8, 0, 9, 30, "Algebra — Lecture", "A-1.12"),
    block(mon, 10, 0, 11, 30, "Discrete Math — Lecture", "B-2.04"),
    block(mon, 13, 0, 14, 30, "Programming Lab", "C-Lab 3"),
    block(tue, 9, 0, 10, 30, "Physics — Lecture", "A-0.01"),
    block(tue, 11, 0, 12, 30, "Physics — Lab", "P-Lab 1"),
    block(tue, 15, 0, 16, 30, "English B2", "D-1.08"),
    block(wed, 8, 0, 9, 30, "Algorithms — Lecture", "B-3.21"),
    block(wed, 12, 0, 14, 0, "Algorithms — Lab", "C-Lab 1"),
    block(thu, 9, 0, 10, 30, "Databases — Lecture", "A-2.15"),
    block(thu, 11, 0, 12, 30, "Databases — Lab", "C-Lab 2"),
    block(thu, 14, 0, 15, 30, "Operating Systems", "B-1.10"),
    block(fri, 8, 0, 11, 0, "Project Seminar", "A-Seminar"),
    block(fri, 12, 0, 13, 30, "Probability — Lecture", "B-0.22"),
  ];
}

export function sampleUsosIcs(anchor = new Date()): string {
  const events = buildSampleUsosSchedule(anchor);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Smart Timetable//EN"];
  for (const e of events) {
    const fmt = (d: Date) => {
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
    };
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@sample`,
      `SUMMARY:${e.title}`,
      `DTSTART:${fmt(e.start)}`,
      `DTEND:${fmt(e.end)}`,
      `LOCATION:${e.location ?? ""}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
