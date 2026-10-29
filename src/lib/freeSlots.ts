import type { AllocationBounds, CalendarEvent, FreeSlot } from "../types";
import {
  DEFAULT_ALLOCATION_BOUNDS,
  addDays,
  pad2,
  setTimeOnDate,
  startOfDay,
  toDateKey,
  windowForDate,
} from "./time";

/** Hard-locked barriers only (USOS + permanent custom). */
export function hardLockedEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => e.isPermanent || e.source === "USOS_ICS");
}

/**
 * Free slots within allocation bounds for each day in [rangeStart, rangeEnd),
 * carved only by hard-locked events. Minimum 30 minutes.
 * Workweek vs weekend windows come from `bounds`.
 */
export function computeFreeSlots(
  hardLocked: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  bounds: AllocationBounds = DEFAULT_ALLOCATION_BOUNDS,
): FreeSlot[] {
  const slots: FreeSlot[] = [];

  for (let day = startOfDay(rangeStart); day < rangeEnd; day = addDays(day, 1)) {
    const win = windowForDate(day, bounds);
    if (win.endHour <= win.startHour) continue;

    const dayStart = setTimeOnDate(day, `${pad2(win.startHour)}:00`);
    const dayEnd = setTimeOnDate(day, `${pad2(win.endHour)}:00`);
    const key = toDateKey(day);

    const blocking = hardLocked
      .filter((e) => toDateKey(e.start) === key || (e.start < dayEnd && e.end > dayStart))
      .map((e) => ({
        start: e.start < dayStart ? dayStart : e.start,
        end: e.end > dayEnd ? dayEnd : e.end,
      }))
      .filter((e) => e.start < e.end)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let cursor = dayStart;
    for (const b of blocking) {
      if (b.start > cursor) {
        const gapMs = b.start.getTime() - cursor.getTime();
        if (gapMs >= 30 * 60 * 1000) {
          slots.push({ start: new Date(cursor), end: new Date(b.start) });
        }
      }
      if (b.end > cursor) cursor = new Date(b.end);
    }
    if (dayEnd > cursor) {
      const gapMs = dayEnd.getTime() - cursor.getTime();
      if (gapMs >= 30 * 60 * 1000) {
        slots.push({ start: new Date(cursor), end: new Date(dayEnd) });
      }
    }
  }

  return slots;
}

/** Subtract occupied intervals (scheduled sessions / soft events treated as busy for placement). */
export function subtractBusy(
  free: FreeSlot[],
  busy: { start: Date; end: Date }[],
): FreeSlot[] {
  let slots = free.map((s) => ({ ...s }));
  const sorted = [...busy].sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const b of sorted) {
    const next: FreeSlot[] = [];
    for (const s of slots) {
      if (b.end <= s.start || b.start >= s.end) {
        next.push(s);
        continue;
      }
      if (b.start > s.start) {
        next.push({ start: s.start, end: new Date(Math.min(b.start.getTime(), s.end.getTime())) });
      }
      if (b.end < s.end) {
        next.push({ start: new Date(Math.max(b.end.getTime(), s.start.getTime())), end: s.end });
      }
    }
    slots = next.filter((s) => s.end.getTime() - s.start.getTime() >= 30 * 60 * 1000);
  }
  return slots;
}
