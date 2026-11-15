import {
  addDays,
  dateKey,
  dayWindow,
  daysBetween,
  EventBlock,
  localInstant,
  minuteTime,
  overlaps,
  Preferences,
} from "./time";

export interface ScheduleTask {
  id: string;
  title: string;
  deadlineDate: Date;
  requiredMinutes: number;
  minSessionMinutes: number;
  maxSessionMinutes: number;
  importance: number;
  tieBreakerOrder: number;
  allocationMode: string;
  status: string;
}
export interface ScheduledBlock {
  id: string;
  taskId: string;
  title: string;
  start: string;
  end: string;
  kind: "WORK" | "RECOVERY";
}
export interface ScheduleResult {
  strategy: "earliest" | "balanced";
  sessions: ScheduledBlock[];
  moves: {
    activityId: string;
    occurrenceDate: string;
    title: string;
    from: string;
    start: string;
    end: string;
  }[];
  totals: {
    taskId: string;
    title: string;
    requested: number;
    placed: number;
    missing: number;
  }[];
}
const MINUTE = 60_000;

/** Pure scheduling: inputs include the clock, preferences and all horizon occurrences. */
export function schedule(
  tasks: ScheduleTask[],
  events: EventBlock[],
  zone: string,
  prefs: Preferences,
  strategy: "earliest" | "balanced",
  now = new Date(),
  allocation: "SEQUENTIAL" | "EVEN_SPLIT" = "SEQUENTIAL",
  order: string[] = [],
): ScheduleResult {
  const today = dateKey(now, zone);
  const active = tasks.filter((t) => t.status !== "DONE");
  const horizon = active.reduce(
    (last, t) =>
      t.deadlineDate.toISOString().slice(0, 10) > last
        ? t.deadlineDate.toISOString().slice(0, 10)
        : last,
    today,
  );
  if (daysBetween(today, horizon) > 366)
    throw new Error("Horyzont planowania nie może przekraczać roku.");
  const soft = events.filter(
    (e) =>
      e.source === "CUSTOM_ACTIVITY" &&
      !e.isPermanent &&
      e.activityId &&
      +e.start > +now,
  );
  const fixed = events.filter(
    (e) =>
      e.isPermanent ||
      e.source === "TEAM_MEETING" ||
      (e.source === "CUSTOM_ACTIVITY" && +e.start <= +now) ||
      (e.source === "SCHEDULED_TASK" &&
        e.status !== "MISSED" &&
        (e.pinned || e.status === "COMPLETED" || +e.start <= +now)),
  );
  const blockedSoft = new Set<string>();
  let final: ScheduleResult = { strategy, sessions: [], moves: [], totals: [] };
  const taskMap = new Map(active.map((t) => [t.id, t]));

  // A soft occurrence that cannot be moved is promoted to a barrier and retried.
  // The set only grows, so the retry is bounded and never loses an activity.
  for (let attempt = 0; attempt <= soft.length; attempt++) {
    const barriers: EventBlock[] = [
      ...fixed,
      ...soft.filter((e) => blockedSoft.has(e.id)),
    ];
    const sessions: ScheduledBlock[] = [];
    const dailyWork = new Map<string, number>();
    const countByTaskDay = new Map<string, number>();
    for (const e of fixed.filter(
      (e) => e.source === "SCHEDULED_TASK" && e.status !== "MISSED",
    )) {
      const day = dateKey(e.start, zone);
      dailyWork.set(
        day,
        (dailyWork.get(day) ?? 0) + (+e.end - +e.start) / MINUTE,
      );
      const key = `${e.taskId}:${day}`;
      countByTaskDay.set(key, (countByTaskDay.get(key) ?? 0) + 1);
    }
    const completed = new Map<string, number>();
    for (const e of events.filter(
      (e) => e.source === "SCHEDULED_TASK" && e.status === "COMPLETED",
    ))
      completed.set(
        e.taskId!,
        (completed.get(e.taskId!) ?? 0) + (+e.end - +e.start) / MINUTE,
      );
    const reserved = new Map<string, number>();
    for (const e of fixed.filter(
      (e) =>
        e.source === "SCHEDULED_TASK" &&
        e.status !== "COMPLETED" &&
        e.status !== "MISSED",
    ))
      reserved.set(
        e.taskId!,
        (reserved.get(e.taskId!) ?? 0) + (+e.end - +e.start) / MINUTE,
      );
    const remaining = new Map(
      active.map((t) => [
        t.id,
        Math.max(
          0,
          t.requiredMinutes -
            (completed.get(t.id) ?? 0) -
            (reserved.get(t.id) ?? 0),
        ),
      ]),
    );
    const initial = new Map(remaining);
    const sorted = [...active].sort(
      (a, b) =>
        +a.deadlineDate - +b.deadlineDate ||
        (order.indexOf(a.id) < 0 ? 999 : order.indexOf(a.id)) -
          (order.indexOf(b.id) < 0 ? 999 : order.indexOf(b.id)) ||
        b.importance - a.importance ||
        a.tieBreakerOrder - b.tieBreakerOrder ||
        a.id.localeCompare(b.id),
    );

    function collision(
      start: number,
      end: number,
      busy: EventBlock[],
      skip?: string,
    ) {
      return busy.some(
        (e) =>
          e.id !== skip &&
          overlaps(
            { start, end },
            {
              start:
                +e.start -
                (e.source === "RECOVERY_BREAK" ? 0 : prefs.buffer * MINUTE),
              end:
                +e.end +
                (e.source === "RECOVERY_BREAK" ? 0 : prefs.buffer * MINUTE),
            },
          ),
      );
    }
    function place(task: ScheduleTask) {
      const rem = remaining.get(task.id)!;
      if (rem <= 0) return false;
      const endDay = task.deadlineDate.toISOString().slice(0, 10);
      const days: string[] = [];
      for (let day = today; day <= endDay; day = addDays(day, 1))
        days.push(day);
      if (strategy === "balanced")
        days.sort(
          (a, b) =>
            (dailyWork.get(a) ?? 0) - (dailyWork.get(b) ?? 0) ||
            a.localeCompare(b),
        );
      const min = Math.min(task.minSessionMinutes, rem);
      for (const day of days) {
        const cap = prefs.dailyLimit - (dailyWork.get(day) ?? 0);
        if (cap < min) continue;
        const [ws, we] = dayWindow(day, prefs);
        const windowEnd = +localInstant(day, minuteTime(we), zone);
        let duration = Math.min(
          task.maxSessionMinutes,
          rem,
          Math.floor(cap / 30) * 30,
        );
        if (rem > duration && rem - duration < min && duration - min >= min)
          duration -= min - (rem - duration);
        for (; duration >= min; duration -= 30) {
          const from = Math.max(
            +localInstant(day, minuteTime(ws), zone),
            Math.ceil(+now / (15 * MINUTE)) * 15 * MINUTE,
          );
          for (
            let start = from;
            start + duration * MINUTE <= windowEnd;
            start += 15 * MINUTE
          ) {
            const end = start + duration * MINUTE;
            if (collision(start, end, barriers)) continue;
            const item: ScheduledBlock = {
              id: `${task.id}:${start}:work`,
              taskId: task.id,
              title: task.title,
              start: new Date(start).toISOString(),
              end: new Date(end).toISOString(),
              kind: "WORK",
            };
            sessions.push(item);
            barriers.push({
              ...item,
              start: new Date(start),
              end: new Date(end),
              source: "SCHEDULED_TASK",
              isPermanent: false,
            });
            remaining.set(task.id, rem - duration);
            dailyWork.set(day, (dailyWork.get(day) ?? 0) + duration);
            const key = `${task.id}:${day}`,
              count = (countByTaskDay.get(key) ?? 0) + 1;
            countByTaskDay.set(key, count);
            if (
              count % 2 === 0 &&
              prefs.recovery > 0 &&
              end + prefs.recovery * MINUTE <= windowEnd &&
              !collision(end, end + prefs.recovery * MINUTE, barriers, item.id)
            ) {
              const recovery: ScheduledBlock = {
                id: `${task.id}:${end}:recovery`,
                taskId: task.id,
                title: "Przerwa regeneracyjna",
                start: new Date(end).toISOString(),
                end: new Date(end + prefs.recovery * MINUTE).toISOString(),
                kind: "RECOVERY",
              };
              sessions.push(recovery);
              barriers.push({
                ...recovery,
                start: new Date(recovery.start),
                end: new Date(recovery.end),
                source: "RECOVERY_BREAK",
                isPermanent: false,
              });
            }
            return true;
          }
        }
      }
      return false;
    }
    const groups = new Map<string, ScheduleTask[]>();
    for (const t of sorted) {
      const key = t.deadlineDate.toISOString();
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    for (const group of groups.values()) {
      if (allocation === "EVEN_SPLIT" && group.length > 1) {
        let progress = true;
        while (progress) {
          progress = false;
          for (const task of group) if (place(task)) progress = true;
        }
      } else
        for (const task of group)
          while (place(task)) {
            /* bounded by the task budget */
          }
    }

    const moves: ScheduleResult["moves"] = [];
    const softBusy = [
      ...barriers,
      ...soft.filter((e) => !blockedSoft.has(e.id)),
    ];
    let retry = false;
    for (const event of soft.filter((e) => !blockedSoft.has(e.id))) {
      if (!collision(+event.start, +event.end, barriers)) continue;
      const duration = +event.end - +event.start;
      let fit: number | undefined;
      for (
        let day = dateKey(new Date(Math.max(+event.end, +now)), zone);
        day <= horizon && fit === undefined;
        day = addDays(day, 1)
      ) {
        const [ws, we] = dayWindow(day, prefs);
        const from = Math.max(
          +localInstant(day, minuteTime(ws), zone),
          +now,
          +event.end,
        );
        for (
          let start = Math.ceil(from / (15 * MINUTE)) * 15 * MINUTE;
          start + duration <= +localInstant(day, minuteTime(we), zone);
          start += 15 * MINUTE
        ) {
          if (!collision(start, start + duration, softBusy, event.id)) {
            fit = start;
            break;
          }
        }
      }
      if (fit === undefined) {
        blockedSoft.add(event.id);
        retry = true;
        break;
      }
      moves.push({
        activityId: event.activityId!,
        occurrenceDate: event.occurrenceDate!,
        title: event.title,
        from: event.start.toISOString(),
        start: new Date(fit).toISOString(),
        end: new Date(fit + duration).toISOString(),
      });
      const index = softBusy.findIndex((e) => e.id === event.id);
      softBusy[index] = {
        ...event,
        start: new Date(fit),
        end: new Date(fit + duration),
      };
    }
    final = {
      strategy,
      sessions,
      moves,
      totals: sorted.map((t) => ({
        taskId: t.id,
        title: t.title,
        requested: initial.get(t.id)!,
        placed: initial.get(t.id)! - remaining.get(t.id)!,
        missing: remaining.get(t.id)!,
      })),
    };
    if (!retry) break;
  }
  // Determinism applies to layout; IDs are transport identities, not scheduling input.
  for (const s of final.sessions)
    if (!taskMap.has(s.taskId)) throw new Error("Unknown task in schedule");
  return final;
}
