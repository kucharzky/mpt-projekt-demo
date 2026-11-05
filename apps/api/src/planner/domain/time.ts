import { Temporal } from "@js-temporal/polyfill";

export function dateKey(date: Date | number, zone = "Europe/Warsaw") {
  return Temporal.Instant.fromEpochMilliseconds(+date)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
}
export function addDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function localInstant(date: string, time: string, zone: string) {
  return new Date(
    Temporal.PlainDate.from(date)
      .toPlainDateTime(Temporal.PlainTime.from(time))
      .toZonedDateTime(zone, { disambiguation: "compatible" })
      .epochMilliseconds,
  );
}
export function daysBetween(a: string, b: string) {
  return Temporal.PlainDate.from(a).until(Temporal.PlainDate.from(b)).days;
}
export function weekday(date: string) {
  return Temporal.PlainDate.from(date).dayOfWeek;
}
export function minuteTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function overlaps(
  a: { start: Date | string | number; end: Date | string | number },
  b: { start: Date | string | number; end: Date | string | number },
) {
  return (
    +new Date(a.start) < +new Date(b.end) &&
    +new Date(b.start) < +new Date(a.end)
  );
}
export function nextDeadline(date: string, frequency: string) {
  return Temporal.PlainDate.from(date)
    .add(
      frequency === "MONTHLY"
        ? { months: 1 }
        : { days: frequency === "BIWEEKLY" ? 14 : 7 },
    )
    .toString();
}

export interface Preferences {
  workStart: number;
  workEnd: number;
  weekendStart: number;
  weekendEnd: number;
  dailyLimit: number;
  buffer: number;
  recovery: number;
}
export const defaultPreferences: Preferences = {
  workStart: 480,
  workEnd: 1260,
  weekendStart: 540,
  weekendEnd: 1080,
  dailyLimit: 360,
  buffer: 15,
  recovery: 60,
};
export function dayWindow(date: string, prefs: Preferences) {
  return weekday(date) > 5
    ? [prefs.weekendStart, prefs.weekendEnd]
    : [prefs.workStart, prefs.workEnd];
}

export interface EventBlock {
  id: string;
  title: string;
  start: Date;
  end: Date;
  source: string;
  isPermanent: boolean;
  taskId?: string;
  activityId?: string;
  occurrenceDate?: string;
  location?: string;
  status?: string;
  pinned?: boolean;
  version?: number;
}
export interface ActivityInput {
  id: string;
  title: string;
  location?: string;
  isPermanent: boolean;
  recurrence: string;
  anchorDate: string;
  untilDate?: string | null;
  startTime: string;
  endTime: string;
  version: number;
  timezone?: string;
  exceptions: unknown;
}
type Exception = {
  cancelled?: boolean;
  title?: string;
  start?: string;
  end?: string;
};
export function expandActivities(
  activities: ActivityInput[],
  from: string,
  to: string,
  zone: string,
): EventBlock[] {
  if (daysBetween(from, to) < 0 || daysBetween(from, to) > 370)
    throw new Error("Invalid calendar range");
  const events: EventBlock[] = [];
  const rangeStart = localInstant(from, "00:00", zone),
    rangeEnd = localInstant(to, "00:00", zone);
  for (const a of activities) {
    const exceptions = a.exceptions as Record<string, Exception>;
    const seriesZone = a.timezone ?? zone;
    for (let day = addDays(from, -1); day <= to; day = addDays(day, 1)) {
      if (day < a.anchorDate || (a.untilDate && day > a.untilDate)) continue;
      const anchor = Temporal.PlainDate.from(a.anchorDate),
        current = Temporal.PlainDate.from(day);
      const match =
        a.recurrence === "ONE_TIME"
          ? day === a.anchorDate
          : a.recurrence === "MONTHLY"
            ? current.day === Math.min(anchor.day, current.daysInMonth)
            : current.dayOfWeek === anchor.dayOfWeek &&
              (a.recurrence !== "BIWEEKLY" ||
                daysBetween(a.anchorDate, day) % 14 === 0);
      if (!match) continue;
      const ex = exceptions[day];
      if (ex?.cancelled) continue;
      const start = ex?.start
        ? new Date(ex.start)
        : localInstant(day, a.startTime, seriesZone);
      const end = ex?.end
        ? new Date(ex.end)
        : localInstant(
            a.endTime <= a.startTime ? addDays(day, 1) : day,
            a.endTime,
            seriesZone,
          );
      if (!overlaps({ start, end }, { start: rangeStart, end: rangeEnd }))
        continue;
      events.push({
        id: `${a.id}:${day}`,
        activityId: a.id,
        occurrenceDate: day,
        title: ex?.title ?? a.title,
        start,
        end,
        source: "CUSTOM_ACTIVITY",
        isPermanent: a.isPermanent,
        location: a.location,
        version: a.version,
      });
    }
    // An occurrence moved into this range can originate outside the requested window.
    for (const [day, ex] of Object.entries(exceptions)) {
      if (
        !ex?.start ||
        !ex.end ||
        ex.cancelled ||
        events.some((e) => e.id === `${a.id}:${day}`)
      )
        continue;
      const start = new Date(ex.start),
        end = new Date(ex.end);
      if (overlaps({ start, end }, { start: rangeStart, end: rangeEnd }))
        events.push({
          id: `${a.id}:${day}`,
          activityId: a.id,
          occurrenceDate: day,
          title: ex.title ?? a.title,
          start,
          end,
          source: "CUSTOM_ACTIVITY",
          isPermanent: a.isPermanent,
          location: a.location,
          version: a.version,
        });
    }
  }
  return events;
}

export function freeWindows(
  events: EventBlock[],
  from: string,
  to: string,
  zone: string,
  prefs: Preferences,
  hardOnly = true,
) {
  const slots: { start: Date; end: Date }[] = [];
  for (let day = from; day < to; day = addDays(day, 1)) {
    const [startMinute, endMinute] = dayWindow(day, prefs);
    if (endMinute <= startMinute) continue;
    const start = localInstant(day, minuteTime(startMinute), zone),
      end = localInstant(day, minuteTime(endMinute), zone);
    const busy = events
      .filter(
        (e) =>
          e.status !== "MISSED" &&
          (!hardOnly || e.isPermanent) &&
          overlaps(e, { start, end }),
      )
      .sort((a, b) => +a.start - +b.start);
    let cursor = +start;
    for (const item of busy) {
      if (+item.start - cursor >= 30 * 60000)
        slots.push({
          start: new Date(cursor),
          end: new Date(Math.min(+end, +item.start)),
        });
      cursor = Math.max(cursor, +item.end);
    }
    if (+end - cursor >= 30 * 60000)
      slots.push({ start: new Date(cursor), end });
  }
  return slots;
}

export const validDate = (value: string) => {
  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
};
