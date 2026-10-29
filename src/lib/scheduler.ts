import type {
  AllocationBounds,
  AllocationMode,
  CalendarEvent,
  FreeSlot,
  PlacementProposal,
  PlacementStrategy,
  PlannedRecovery,
  PlannedSession,
  Task,
} from "../types";
import { computeFreeSlots, hardLockedEvents, subtractBusy } from "./freeSlots";
import { applyOccurrenceMove } from "./recurrence";
import {
  DEFAULT_ALLOCATION_BOUNDS,
  addDays,
  formatTime,
  pad2,
  parseDateKey,
  setTimeOnDate,
  startOfDay,
  toDateKey,
  uid,
  windowForDate,
} from "./time";

const HOUR_MS = 60 * 60 * 1000;
export const TRANSITION_MS = 15 * 60 * 1000;
export const RECOVERY_MS = 60 * 60 * 1000;

export function normalizeChunks(hours: number): number[] {
  const chunks: number[] = [];
  let rem = Math.round(hours * 2) / 2;
  while (rem > 0) {
    if (rem >= 2) {
      chunks.push(2);
      rem -= 2;
    } else {
      chunks.push(rem);
      rem = 0;
    }
  }
  return chunks.length ? chunks : [1];
}

function horizonEnd(deadlineDate: string, bounds: AllocationBounds): Date {
  const day = parseDateKey(deadlineDate);
  const win = windowForDate(day, bounds);
  return setTimeOnDate(day, `${pad2(win.endHour)}:00`);
}

function horizonStart(from = new Date()): Date {
  const now = new Date(from);
  const m = now.getMinutes();
  if (m > 0 || now.getSeconds() > 0) {
    now.setMinutes(m <= 30 ? 30 : 60, 0, 0);
  }
  return now;
}

function inflateInterval(
  start: Date,
  end: Date,
  padMs: number,
): { start: Date; end: Date } {
  return {
    start: new Date(start.getTime() - padMs),
    end: new Date(end.getTime() + padMs),
  };
}

/** Pad hard-locked events by transition buffer before carving free slots. */
function padHardLocked(events: CalendarEvent[]): CalendarEvent[] {
  return events.map((e) => ({
    ...e,
    start: new Date(e.start.getTime() - TRANSITION_MS),
    end: new Date(e.end.getTime() + TRANSITION_MS),
  }));
}

export function schedulableSlots(
  allEvents: CalendarEvent[],
  deadlineDate: string,
  excludeTaskIds: string[] = [],
  treatSoftAsBusy = false,
  bounds: AllocationBounds = DEFAULT_ALLOCATION_BOUNDS,
): FreeSlot[] {
  const start = horizonStart();
  const end = horizonEnd(deadlineDate, bounds);
  if (end <= start) return [];

  const hard = hardLockedEvents(allEvents);
  let free = computeFreeSlots(
    padHardLocked(hard),
    startOfDay(start),
    addDays(parseDateKey(deadlineDate), 1),
    bounds,
  );
  free = free.filter((s) => s.end > start);
  free = free.map((s) => ({
    start: s.start < start ? new Date(start) : s.start,
    end: s.end,
  }));

  const busy: { start: Date; end: Date }[] = [];
  for (const e of allEvents) {
    if (e.source === "RECOVERY_BREAK") {
      if (e.parentTaskId && excludeTaskIds.includes(e.parentTaskId)) continue;
      // Exact interval — no extra 15m around recovery
      busy.push({ start: e.start, end: e.end });
      continue;
    }
    if (e.source === "SCHEDULED_TASK") {
      if (e.parentTaskId && excludeTaskIds.includes(e.parentTaskId)) continue;
      busy.push(inflateInterval(e.start, e.end, TRANSITION_MS));
    } else if (treatSoftAsBusy && e.source === "CUSTOM_ACTIVITY" && !e.isPermanent) {
      busy.push(inflateInterval(e.start, e.end, TRANSITION_MS));
    }
  }
  return subtractBusy(free, busy);
}

function carveFromSlots(
  slots: FreeSlot[],
  blockStart: Date,
  blockEnd: Date,
): FreeSlot[] {
  return subtractBusy(slots, [{ start: blockStart, end: blockEnd }]);
}

interface PlacementResult {
  sessions: PlannedSession[];
  recoveries: PlannedRecovery[];
}

/**
 * Place chunks with 15m transitions. Recovery: after every 2nd same-task
 * session on the same calendar day, try a 1h recovery on that day; if it
 * doesn't fit, omit it (never spill alone onto the next day). Never abort
 * the whole plan when recovery can't fit.
 */
function placeChunksWithBuffers(
  chunks: number[],
  slots: FreeSlot[],
  task: Task,
  preferBalanced: boolean,
): PlacementResult {
  let remaining = slots.map((s) => ({ ...s }));
  const sessions: PlannedSession[] = [];
  const recoveries: PlannedRecovery[] = [];
  const sessionsPerDay = new Map<string, number>();
  let lastEnd: Date | null = null;
  let justHadRecovery = false;

  const allDays = [...new Set(remaining.map((s) => toDateKey(s.start)))].sort();

  for (let c = 0; c < chunks.length; c++) {
    const hours = chunks[c];
    const need = hours * HOUR_MS;

    // Earliest: chronological minStart from last placed block.
    // Balanced: per-day minStart inside findBalancedPlacement so earlier
    // under-filled days stay usable after later days were touched.
    const minStartMs: number = preferBalanced
      ? 0
      : lastEnd
        ? justHadRecovery
          ? lastEnd.getTime()
          : lastEnd.getTime() + TRANSITION_MS
        : 0;
    justHadRecovery = false;

    const fitted = preferBalanced
      ? findBalancedPlacement(remaining, need, allDays, sessions, recoveries)
      : findEarliestPlacement(remaining, need, minStartMs);

    if (!fitted) {
      // No room for this chunk — stop; earlier chunks already placed.
      break;
    }

    const start: Date = new Date(Math.max(fitted.start.getTime(), minStartMs));
    const end: Date = new Date(start.getTime() + need);
    if (end.getTime() > fitted.slotEnd.getTime() + 1) break;

    const dayKey = toDateKey(start);
    sessions.push({
      taskId: task.id,
      title: task.title,
      start,
      end,
      sessionIndex: sessions.length + 1,
      sessionTotal: 0,
    });
    remaining = carveFromSlots(remaining, start, end);
    lastEnd = end;

    const count = (sessionsPerDay.get(dayKey) ?? 0) + 1;
    sessionsPerDay.set(dayKey, count);

    // After 2nd, 4th, … session on this day → try same-day recovery
    if (count % 2 === 0) {
      const placed = trySameDayRecovery(remaining, end, dayKey, task.id);
      if (placed) {
        recoveries.push(placed.recovery);
        remaining = placed.remaining;
        lastEnd = placed.recovery.end;
        justHadRecovery = true;
      }
      // If no room: omit recovery; continue placing later chunks
    }
  }

  const total = sessions.length;
  return {
    sessions: sessions.map((s, i) => ({
      ...s,
      sessionIndex: i + 1,
      sessionTotal: total,
    })),
    recoveries,
  };
}

/** 1h recovery starting at sessionEnd, fully on dayKey; otherwise null. */
function trySameDayRecovery(
  slots: FreeSlot[],
  sessionEnd: Date,
  dayKey: string,
  taskId: string,
): { recovery: PlannedRecovery; remaining: FreeSlot[] } | null {
  const anchorMs = sessionEnd.getTime();
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const s of sorted) {
    if (toDateKey(s.start) !== dayKey) continue;
    const startMs = Math.max(s.start.getTime(), anchorMs);
    if (toDateKey(new Date(startMs)) !== dayKey) continue;
    const endMs = startMs + RECOVERY_MS;
    if (endMs > s.end.getTime() + 1) continue;
    // Must finish on the same calendar day
    if (toDateKey(new Date(endMs - 1)) !== dayKey) continue;

    const recovery: PlannedRecovery = {
      taskId,
      start: new Date(startMs),
      end: new Date(endMs),
    };
    return {
      recovery,
      remaining: carveFromSlots(slots, recovery.start, recovery.end),
    };
  }
  return null;
}

function findEarliestPlacement(
  slots: FreeSlot[],
  needMs: number,
  minStartMs: number,
): { start: Date; slotEnd: Date } | null {
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const s of sorted) {
    const startMs = Math.max(s.start.getTime(), minStartMs);
    if (s.end.getTime() - startMs + 1 < needMs) continue;
    return { start: new Date(startMs), slotEnd: s.end };
  }
  return null;
}

/**
 * Latest end on a calendar day for this plan. After a recovery block, next
 * work may start immediately; after a session, require TRANSITION_MS.
 */
function dayMinStartMs(
  dayKey: string,
  existingSessions: PlannedSession[],
  existingRecoveries: PlannedRecovery[],
): number {
  let latest = 0;
  let latestWasRecovery = false;
  for (const s of existingSessions) {
    if (toDateKey(s.start) !== dayKey) continue;
    const end = s.end.getTime();
    if (end >= latest) {
      latest = end;
      latestWasRecovery = false;
    }
  }
  for (const r of existingRecoveries) {
    if (toDateKey(r.start) !== dayKey) continue;
    const end = r.end.getTime();
    if (end >= latest) {
      latest = end;
      latestWasRecovery = true;
    }
  }
  if (latest === 0) return 0;
  return latestWasRecovery ? latest : latest + TRANSITION_MS;
}

/** Prefer days with fewer hours already placed for this task; then earliest fallback. */
function findBalancedPlacement(
  slots: FreeSlot[],
  needMs: number,
  allDays: string[],
  existingSessions: PlannedSession[],
  existingRecoveries: PlannedRecovery[],
): { start: Date; slotEnd: Date } | null {
  const hoursByDay = new Map<string, number>();
  for (const d of allDays) hoursByDay.set(d, 0);
  for (const s of existingSessions) {
    const k = toDateKey(s.start);
    hoursByDay.set(
      k,
      (hoursByDay.get(k) ?? 0) + (s.end.getTime() - s.start.getTime()) / HOUR_MS,
    );
  }

  const daysByFill = [...allDays].sort((a, b) => {
    const ha = hoursByDay.get(a) ?? 0;
    const hb = hoursByDay.get(b) ?? 0;
    if (ha !== hb) return ha - hb;
    return a.localeCompare(b);
  });

  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const day of daysByFill) {
    const dayMin = dayMinStartMs(day, existingSessions, existingRecoveries);
    for (const s of sorted) {
      if (toDateKey(s.start) !== day) continue;
      const startMs = Math.max(s.start.getTime(), dayMin);
      if (s.end.getTime() - startMs + 1 < needMs) continue;
      return { start: new Date(startMs), slotEnd: s.end };
    }
  }

  // Fallback: earliest slot that fits using that day's local minStart
  for (const s of sorted) {
    const day = toDateKey(s.start);
    const dayMin = dayMinStartMs(day, existingSessions, existingRecoveries);
    const startMs = Math.max(s.start.getTime(), dayMin);
    if (s.end.getTime() - startMs + 1 < needMs) continue;
    return { start: new Date(startMs), slotEnd: s.end };
  }
  return null;
}

function placeChunksEarliest(
  chunks: number[],
  slots: FreeSlot[],
  task: Task,
): PlacementResult {
  return placeChunksWithBuffers(chunks, slots, task, false);
}

function placeChunksBalanced(
  chunks: number[],
  slots: FreeSlot[],
  task: Task,
): PlacementResult {
  return placeChunksWithBuffers(chunks, slots, task, true);
}

export function buildProposals(
  task: Task,
  allEvents: CalendarEvent[],
  excludeTaskIds: string[] = [],
  bounds: AllocationBounds = DEFAULT_ALLOCATION_BOUNDS,
): PlacementProposal[] {
  const hours = task.isLargeTask ? task.hoursRequired : 1;
  const chunks = normalizeChunks(hours);
  const slots = schedulableSlots(allEvents, task.deadlineDate, excludeTaskIds, true, bounds);

  const earliest = placeChunksEarliest(chunks, slots, task);
  const balanced = placeChunksBalanced(chunks, slots, task);

  const mk = (
    strategy: PlacementStrategy,
    label: string,
    result: PlacementResult,
  ): PlacementProposal => ({
    strategy,
    label,
    sessions: result.sessions,
    recoveries: result.recoveries,
    hoursPlaced: result.sessions.reduce(
      (a, s) => a + (s.end.getTime() - s.start.getTime()) / HOUR_MS,
      0,
    ),
    hoursRequested: hours,
  });

  return [
    mk("earliest", "Earliest Available Slots", earliest),
    mk("balanced", "Balanced Daily Spread", balanced),
  ];
}

export function sessionsToEvents(sessions: PlannedSession[]): CalendarEvent[] {
  return sessions.map((s) => ({
    id: uid("sess"),
    title: s.title,
    start: s.start,
    end: s.end,
    source: "SCHEDULED_TASK" as const,
    isPermanent: false,
    parentTaskId: s.taskId,
    sessionIndex: s.sessionIndex,
    sessionTotal: s.sessionTotal,
  }));
}

export function recoveriesToEvents(recoveries: PlannedRecovery[]): CalendarEvent[] {
  return recoveries.map((r) => ({
    id: uid("rec"),
    title: "Recovery break",
    start: r.start,
    end: r.end,
    source: "RECOVERY_BREAK" as const,
    isPermanent: false,
    parentTaskId: r.taskId,
  }));
}

export function placementToEvents(proposal: PlacementProposal): CalendarEvent[] {
  return [
    ...sessionsToEvents(proposal.sessions),
    ...recoveriesToEvents(proposal.recoveries),
  ];
}

export function isSessionDone(ev: CalendarEvent, now = new Date()): boolean {
  if (ev.source !== "SCHEDULED_TASK") return false;
  if (ev.sessionDone === true) return true;
  if (ev.sessionDone === false) return false;
  return ev.end.getTime() <= now.getTime();
}

export function computeHoursDone(
  taskId: string,
  events: CalendarEvent[],
  now = new Date(),
): number {
  return events
    .filter((e) => e.source === "SCHEDULED_TASK" && e.parentTaskId === taskId)
    .filter((e) => isSessionDone(e, now))
    .reduce((a, e) => a + (e.end.getTime() - e.start.getTime()) / HOUR_MS, 0);
}

/** When parent marked Done: keep past sessions, drop future sessions + all recoveries for task. */
export function applyParentTaskDone(
  taskId: string,
  events: CalendarEvent[],
  now = new Date(),
): CalendarEvent[] {
  return events.filter((e) => {
    if (e.parentTaskId !== taskId) return true;
    if (e.source === "RECOVERY_BREAK") {
      // Drop all recoveries for this task (past and future)
      return false;
    }
    if (e.source === "SCHEDULED_TASK") {
      if (e.end.getTime() <= now.getTime()) {
        return true; // keep past — struck through via done styling
      }
      return false; // clear unused future
    }
    return true;
  }).map((e) => {
    if (
      e.parentTaskId === taskId &&
      e.source === "SCHEDULED_TASK" &&
      e.end.getTime() <= now.getTime()
    ) {
      return { ...e, sessionDone: true };
    }
    return e;
  });
}

function placeEvenSplit(
  group: Task[],
  contextEvents: CalendarEvent[],
  bounds: AllocationBounds = DEFAULT_ALLOCATION_BOUNDS,
): Map<string, PlacementResult> {
  const deadline = group[0].deadlineDate;
  let remaining = schedulableSlots(
    contextEvents,
    deadline,
    group.map((t) => t.id),
    true,
    bounds,
  );
  const queues = new Map(
    group.map((t) => [t.id, normalizeChunks(t.isLargeTask ? t.hoursRequired : 1)]),
  );
  const results = new Map<string, PlacementResult>(
    group.map((t) => [t.id, { sessions: [], recoveries: [] }]),
  );
  const sessionsPerDay = new Map<string, Map<string, number>>(
    group.map((t) => [t.id, new Map()]),
  );
  const lastEnd = new Map<string, Date | null>(group.map((t) => [t.id, null]));
  const afterRec = new Map(group.map((t) => [t.id, false]));

  let progress = true;
  while (progress) {
    progress = false;
    for (const t of group) {
      const q = queues.get(t.id)!;
      if (!q.length) continue;

      const le = lastEnd.get(t.id) ?? null;
      const hours = q[0];
      const need = hours * HOUR_MS;
      const minStart = le
        ? afterRec.get(t.id)
          ? le.getTime()
          : le.getTime() + TRANSITION_MS
        : 0;
      afterRec.set(t.id, false);

      const fitted = findEarliestPlacement(remaining, need, minStart);
      if (!fitted) continue;
      const start = new Date(Math.max(fitted.start.getTime(), minStart));
      const end = new Date(start.getTime() + need);
      if (end.getTime() > fitted.slotEnd.getTime() + 1) continue;

      const list = results.get(t.id)!.sessions;
      list.push({
        taskId: t.id,
        title: t.title,
        start,
        end,
        sessionIndex: list.length + 1,
        sessionTotal: 0,
      });
      q.shift();
      remaining = carveFromSlots(remaining, start, end);
      lastEnd.set(t.id, end);

      const dayKey = toDateKey(start);
      const dayMap = sessionsPerDay.get(t.id)!;
      const count = (dayMap.get(dayKey) ?? 0) + 1;
      dayMap.set(dayKey, count);

      if (count % 2 === 0) {
        const placed = trySameDayRecovery(remaining, end, dayKey, t.id);
        if (placed) {
          results.get(t.id)!.recoveries.push(placed.recovery);
          remaining = placed.remaining;
          lastEnd.set(t.id, placed.recovery.end);
          afterRec.set(t.id, true);
        }
      }
      progress = true;
    }
  }

  for (const [id, result] of results) {
    const total = result.sessions.length;
    results.set(id, {
      sessions: result.sessions.map((s, i) => ({
        ...s,
        sessionIndex: i + 1,
        sessionTotal: total,
      })),
      recoveries: result.recoveries,
    });
  }
  return results;
}

export function proposeConflictLayouts(
  tasks: Task[],
  mode: AllocationMode,
  order: string[],
  allEvents: CalendarEvent[],
  bounds: AllocationBounds = DEFAULT_ALLOCATION_BOUNDS,
): { sessions: PlannedSession[]; recoveries: PlannedRecovery[] } {
  const ordered = order
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t)
    .map((t, i) => ({
      ...t,
      tieBreakerOrder: i,
      allocationMode: mode,
    }));

  const usos = allEvents.filter((e) => e.source === "USOS_ICS" || e.isPermanent);
  const soft = allEvents.filter((e) => e.source === "CUSTOM_ACTIVITY" && !e.isPermanent);
  const otherScheduled = allEvents.filter(
    (e) =>
      (e.source === "SCHEDULED_TASK" || e.source === "RECOVERY_BREAK") &&
      e.parentTaskId &&
      !ordered.some((t) => t.id === e.parentTaskId),
  );

  if (mode === "EVEN_SPLIT") {
    const map = placeEvenSplit(ordered, [...usos, ...soft, ...otherScheduled], bounds);
    const sessions: PlannedSession[] = [];
    const recoveries: PlannedRecovery[] = [];
    for (const t of ordered) {
      const r = map.get(t.id);
      if (!r) continue;
      sessions.push(...r.sessions);
      recoveries.push(...r.recoveries);
    }
    return { sessions, recoveries };
  }

  const sessions: PlannedSession[] = [];
  const recoveries: PlannedRecovery[] = [];
  const placed: CalendarEvent[] = [];
  for (const t of ordered) {
    const prop = buildProposals(
      t,
      [...usos, ...soft, ...otherScheduled, ...placed],
      [],
      bounds,
    )[0];
    sessions.push(...prop.sessions);
    recoveries.push(...prop.recoveries);
    placed.push(...placementToEvents(prop));
  }
  return { sessions, recoveries };
}

export function placedHoursForTask(taskId: string, events: CalendarEvent[]): number {
  return events
    .filter((e) => e.source === "SCHEDULED_TASK" && e.parentTaskId === taskId)
    .reduce((a, e) => a + (e.end.getTime() - e.start.getTime()) / HOUR_MS, 0);
}

/** Contiguous 1…N sessionIndex/sessionTotal for a task's sessions (by start). */
export function renumberSessionsForTask(
  events: CalendarEvent[],
  taskId: string,
): CalendarEvent[] {
  const sessions = events
    .filter((e) => e.source === "SCHEDULED_TASK" && e.parentTaskId === taskId)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const total = sessions.length;
  const byId = new Map(
    sessions.map((s, i) => [s.id, { sessionIndex: i + 1, sessionTotal: total }]),
  );
  return events.map((e) => {
    const meta = byId.get(e.id);
    return meta ? { ...e, ...meta } : e;
  });
}

/**
 * Drop recoveries for task and re-insert same-day 1h recoveries after every
 * 2nd session that day, using free capacity over the sessions' date range.
 */
export function rebuildRecoveriesForTask(
  taskId: string,
  allEvents: CalendarEvent[],
  bounds: AllocationBounds = DEFAULT_ALLOCATION_BOUNDS,
): CalendarEvent[] {
  const without = allEvents.filter(
    (e) => !(e.source === "RECOVERY_BREAK" && e.parentTaskId === taskId),
  );
  const sessions = without
    .filter((e) => e.source === "SCHEDULED_TASK" && e.parentTaskId === taskId)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (!sessions.length) return without;

  const rangeStart = startOfDay(sessions[0].start);
  const rangeEnd = addDays(startOfDay(sessions[sessions.length - 1].end), 1);

  let remaining = computeFreeSlots(
    hardLockedEvents(without),
    rangeStart,
    rangeEnd,
    bounds,
  );
  const busy: { start: Date; end: Date }[] = [];
  for (const e of without) {
    if (e.source === "RECOVERY_BREAK") {
      busy.push({ start: e.start, end: e.end });
    } else if (e.source === "SCHEDULED_TASK") {
      busy.push(inflateInterval(e.start, e.end, TRANSITION_MS));
    } else if (e.source === "CUSTOM_ACTIVITY" && !e.isPermanent) {
      busy.push(inflateInterval(e.start, e.end, TRANSITION_MS));
    }
  }
  remaining = subtractBusy(remaining, busy);

  const recoveries: PlannedRecovery[] = [];
  const byDay = new Map<string, CalendarEvent[]>();
  for (const s of sessions) {
    const k = toDateKey(s.start);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(s);
  }

  for (const [dayKey, daySessions] of byDay) {
    daySessions.sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 0; i < daySessions.length; i++) {
      if ((i + 1) % 2 !== 0) continue;
      const placed = trySameDayRecovery(
        remaining,
        daySessions[i].end,
        dayKey,
        taskId,
      );
      if (placed) {
        recoveries.push(placed.recovery);
        remaining = placed.remaining;
      }
    }
  }

  return [...without, ...recoveriesToEvents(recoveries)];
}

/** Hard-locked events that overlap [start, end), optionally ignoring one id. */
export function findHardLockOverlaps(
  start: Date,
  end: Date,
  events: CalendarEvent[],
  ignoreEventId?: string,
): CalendarEvent[] {
  return hardLockedEvents(events).filter((e) => {
    if (ignoreEventId && e.id === ignoreEventId) return false;
    return start < e.end && e.start < end;
  });
}

export function describeSoftMove(title: string, toStart: Date): string {
  return `${title} moved to ${toDateKey(toStart)} ${formatTime(toStart)}`;
}

export { applyOccurrenceMove };

/** @deprecated kept for any old imports */
export function sessionsAndRecoveriesToEvents(
  sessions: PlannedSession[],
  recoveries: PlannedRecovery[],
): CalendarEvent[] {
  return [...sessionsToEvents(sessions), ...recoveriesToEvents(recoveries)];
}
