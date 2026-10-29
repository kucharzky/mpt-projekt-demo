import type { ActivitySeries, CalendarEvent } from "../types";
import {
  addDays,
  clampDateToMonth,
  mondayIndex,
  parseDateKey,
  setTimeOnDate,
  startOfWeekMonday,
  toDateKey,
  weeksBetweenMondays,
} from "./time";

function occurrenceOnDate(series: ActivitySeries, date: Date): CalendarEvent | null {
  const key = toDateKey(date);
  const ex = series.exceptions[key];
  if (ex?.cancelled) return null;

  let start: Date;
  let end: Date;

  if (ex?.start && ex?.end) {
    start = new Date(ex.start);
    end = new Date(ex.end);
  } else {
    start = setTimeOnDate(date, series.startTime);
    end = setTimeOnDate(date, series.endTime);
  }

  return {
    id: `${series.id}_${key}`,
    title: ex?.title ?? series.title,
    start,
    end,
    source: "CUSTOM_ACTIVITY",
    isPermanent: series.isPermanent,
    seriesId: series.id,
    exceptionDate: key,
  };
}

function matchesRecurrence(series: ActivitySeries, date: Date): boolean {
  const key = toDateKey(date);

  switch (series.recurrence) {
    case "ONE_TIME":
      return key === series.anchorDate;
    case "WEEKLY":
      return mondayIndex(date) === (series.weekday ?? 0);
    case "BIWEEKLY": {
      if (mondayIndex(date) !== (series.weekday ?? 0)) return false;
      const anchor = parseDateKey(series.biweeklyAnchorMonday ?? series.anchorDate);
      const week = startOfWeekMonday(date);
      const diff = weeksBetweenMondays(startOfWeekMonday(anchor), week);
      return diff >= 0 && diff % 2 === 0;
    }
    case "MONTHLY": {
      const anchor = parseDateKey(series.anchorDate);
      const day = anchor.getDate();
      const clamped = clampDateToMonth(date.getFullYear(), date.getMonth(), day);
      return toDateKey(clamped) === key;
    }
    default:
      return false;
  }
}

/** Expand activity series into concrete events overlapping [rangeStart, rangeEnd). */
export function expandSeries(
  seriesList: ActivitySeries[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const series of seriesList) {
    for (let d = new Date(rangeStart); d < rangeEnd; d = addDays(d, 1)) {
      if (!matchesRecurrence(series, d)) continue;
      const ev = occurrenceOnDate(series, d);
      if (ev) out.push(ev);
    }
  }
  return out;
}

export function applyOccurrenceMove(
  series: ActivitySeries,
  occurrenceDate: string,
  start: Date,
  end: Date,
): ActivitySeries {
  const prev = series.exceptions[occurrenceDate];
  return {
    ...series,
    exceptions: {
      ...series.exceptions,
      [occurrenceDate]: {
        ...prev,
        cancelled: undefined,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    },
  };
}

/** Occurrence-only edit: optional title and/or times. */
export function applyOccurrenceEdit(
  series: ActivitySeries,
  occurrenceDate: string,
  patch: { title?: string; start: Date; end: Date },
): ActivitySeries {
  const prev = series.exceptions[occurrenceDate];
  return {
    ...series,
    exceptions: {
      ...series.exceptions,
      [occurrenceDate]: {
        ...prev,
        cancelled: undefined,
        title: patch.title,
        start: patch.start.toISOString(),
        end: patch.end.toISOString(),
      },
    },
  };
}

export function cancelOccurrence(
  series: ActivitySeries,
  occurrenceDate: string,
): ActivitySeries {
  return {
    ...series,
    exceptions: {
      ...series.exceptions,
      [occurrenceDate]: { cancelled: true },
    },
  };
}

/**
 * Series-wide title/time change. Clears all occurrence exceptions so one-offs
 * do not linger against the new template.
 */
export function applySeriesEdit(
  series: ActivitySeries,
  patch: { title: string; startTime: string; endTime: string },
): ActivitySeries {
  return {
    ...series,
    title: patch.title,
    startTime: patch.startTime,
    endTime: patch.endTime,
    exceptions: {},
  };
}

export function applySeriesTimeChange(
  series: ActivitySeries,
  startTime: string,
  endTime: string,
  clearOccurrenceException?: string,
): ActivitySeries {
  const exceptions = { ...series.exceptions };
  if (clearOccurrenceException) {
    delete exceptions[clearOccurrenceException];
  }
  return { ...series, startTime, endTime, exceptions };
}
