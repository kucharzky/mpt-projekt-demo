import type { AllocationBounds, DayWindow } from "../types";

export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 22;
/** Default allocation start when bounds are not customized */
export const FREE_START_HOUR = 8;
/** Default allocation end when bounds are not customized */
export const FREE_END_HOUR = 21;
export const SLOT_MINUTES = 30;

export const DEFAULT_ALLOCATION_BOUNDS: AllocationBounds = {
  workweek: { startHour: FREE_START_HOUR, endHour: FREE_END_HOUR },
  weekend: { startHour: FREE_START_HOUR, endHour: FREE_END_HOUR },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Saturday or Sunday (local). */
export function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

export function windowForDate(d: Date, bounds: AllocationBounds): DayWindow {
  return isWeekend(d) ? bounds.weekend : bounds.workweek;
}

export function formatHourOption(h: number): string {
  return `${pad2(h)}:00`;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday of the week containing `d` (local). */
export function startOfWeekMonday(d: Date): Date {
  const day = startOfDay(d);
  const dow = day.getDay(); // 0 Sun … 6 Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(day, offset);
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function setTimeOnDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    h,
    m,
    0,
    0,
  );
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${pad2(m)}m`;
}

export function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatWeekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${weekStart.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
}

export function daysUntil(deadlineDate: string, from = new Date()): number {
  const a = startOfDay(from).getTime();
  const b = parseDateKey(deadlineDate).getTime();
  return Math.round((b - a) / DAY_MS);
}

export function priorityScore(deadlineDate: string, from = new Date()): number {
  return daysUntil(deadlineDate, from);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function clampDateToMonth(year: number, monthIndex: number, day: number): Date {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, last), 0, 0, 0, 0);
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Monday-index weekday: 0=Mon … 6=Sun */
export function mondayIndex(d: Date): number {
  const dow = d.getDay();
  return dow === 0 ? 6 : dow - 1;
}

export function weeksBetweenMondays(aMonday: Date, bMonday: Date): number {
  return Math.round((startOfDay(bMonday).getTime() - startOfDay(aMonday).getTime()) / (7 * DAY_MS));
}
