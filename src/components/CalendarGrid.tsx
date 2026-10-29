import { Lock, Plus } from "lucide-react";
import type { CalendarEvent, FreeSlot, PlannedSession } from "../types";
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  formatDuration,
  formatTime,
  minutesSinceMidnight,
  toDateKey,
  weekDays,
} from "../lib/time";

const HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, i) => GRID_START_HOUR + i,
);

const TOTAL_MIN = (GRID_END_HOUR - GRID_START_HOUR) * 60;
const COL_GAP_PCT = 0.6;

function topPct(d: Date): number {
  const mins = minutesSinceMidnight(d) - GRID_START_HOUR * 60;
  return (Math.max(0, mins) / TOTAL_MIN) * 100;
}

function heightPct(start: Date, end: Date): number {
  const mins = (end.getTime() - start.getTime()) / 60000;
  return (mins / TOTAL_MIN) * 100;
}

interface TimedItem {
  id: string;
  start: Date;
  end: Date;
}

interface LayoutSlot {
  id: string;
  column: number;
  columnCount: number;
}

/**
 * Assign side-by-side columns for concurrent items (standard calendar packing).
 * Items that overlap in time share a cluster and split the day width equally.
 */
function layoutOverlapping<T extends TimedItem>(items: T[]): Map<string, LayoutSlot> {
  const result = new Map<string, LayoutSlot>();
  if (!items.length) return result;

  const sorted = [...items].sort((a, b) => {
    const byStart = a.start.getTime() - b.start.getTime();
    if (byStart !== 0) return byStart;
    return b.end.getTime() - a.end.getTime();
  });

  // Build overlap clusters (connected components by time overlap)
  const clusters: T[][] = [];
  let current: T[] = [];
  let clusterEnd = 0;

  for (const item of sorted) {
    if (!current.length) {
      current = [item];
      clusterEnd = item.end.getTime();
      continue;
    }
    if (item.start.getTime() < clusterEnd) {
      current.push(item);
      clusterEnd = Math.max(clusterEnd, item.end.getTime());
    } else {
      clusters.push(current);
      current = [item];
      clusterEnd = item.end.getTime();
    }
  }
  if (current.length) clusters.push(current);

  for (const cluster of clusters) {
    // Greedy column assignment: first free column whose last event doesn't overlap
    const colLastEnd: number[] = [];
    const assignments = new Map<string, number>();

    for (const item of cluster) {
      let col = 0;
      while (
        col < colLastEnd.length &&
        item.start.getTime() < colLastEnd[col]
      ) {
        col++;
      }
      if (col === colLastEnd.length) colLastEnd.push(0);
      colLastEnd[col] = item.end.getTime();
      assignments.set(item.id, col);
    }

    const columnCount = Math.max(1, colLastEnd.length);
    for (const item of cluster) {
      result.set(item.id, {
        id: item.id,
        column: assignments.get(item.id) ?? 0,
        columnCount,
      });
    }
  }

  return result;
}

function columnStyle(layout: LayoutSlot | undefined): {
  left: string;
  width: string;
  right?: undefined;
} {
  if (!layout || layout.columnCount <= 1) {
    return { left: "0.125rem", width: "calc(100% - 0.25rem)" };
  }
  const { column, columnCount } = layout;
  const usable = 100 - COL_GAP_PCT;
  const widthPct = usable / columnCount;
  const leftPct = (column / columnCount) * 100 + COL_GAP_PCT / 2;
  return {
    left: `calc(${leftPct}% + 1px)`,
    width: `calc(${widthPct}% - 2px)`,
  };
}

function eventStyle(ev: CalendarEvent): string {
  if (ev.source === "RECOVERY_BREAK") {
    return "bg-stone-400/70 text-stone-900 border-stone-500 border-dashed dark:bg-stone-600/60 dark:text-stone-100";
  }
  if (ev.source === "USOS_ICS") {
    return "bg-slate-600/90 text-white border-slate-500";
  }
  if (ev.source === "CUSTOM_ACTIVITY") {
    return ev.isPermanent
      ? "bg-violet-700/90 text-white border-violet-500"
      : "bg-violet-500/80 text-white border-violet-400";
  }
  const hue = (ev.parentTaskId?.charCodeAt(ev.parentTaskId.length - 1) ?? 0) % 2;
  return hue === 0
    ? "bg-amber-600/90 text-white border-amber-500"
    : "bg-blue-700/90 text-white border-blue-500";
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  weekStart: Date;
  events: CalendarEvent[];
  freeSlots: FreeSlot[];
  highlightFree: boolean;
  previewSessions: PlannedSession[];
  /** Event ids that should render as completed (struck through). */
  doneEventIds: Set<string>;
  selectedEventId?: string | null;
  onScheduleHere: (slot: FreeSlot) => void;
  onEventClick: (ev: CalendarEvent) => void;
}

export function CalendarGrid({
  weekStart,
  events,
  freeSlots,
  highlightFree,
  previewSessions,
  doneEventIds,
  selectedEventId,
  onScheduleHere,
  onEventClick,
}: Props) {
  const days = weekDays(weekStart);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-teal-900/10 bg-white/70 shadow-sm backdrop-blur dark:border-white/10 dark:bg-emerald-950/40">
      <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-teal-900/10 dark:border-white/10">
        <div />
        {days.map((d, i) => {
          const isToday = toDateKey(d) === toDateKey(new Date());
          return (
            <div
              key={toDateKey(d)}
              className={`px-2 py-3 text-center ${isToday ? "bg-teal-700/10 dark:bg-teal-400/10" : ""}`}
            >
              <div className="text-xs font-medium uppercase tracking-wide text-teal-900/50 dark:text-teal-100/50">
                {DAY_NAMES[i]}
              </div>
              <div
                className={`font-display text-lg ${isToday ? "text-teal-800 dark:text-teal-200" : ""}`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="grid grid-cols-[3.5rem_repeat(7,1fr)]"
          style={{ minHeight: `${(GRID_END_HOUR - GRID_START_HOUR) * 48}px` }}
        >
          <div className="relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-teal-900/40 dark:text-teal-100/40"
                style={{
                  top: `${((h - GRID_START_HOUR) / (GRID_END_HOUR - GRID_START_HOUR)) * 100}%`,
                }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const key = toDateKey(day);
            const dayEnd = new Date(day.getTime() + 86400000);
            const dayEvents = events.filter(
              (e) => toDateKey(e.start) === key || (e.start < dayEnd && e.end > day),
            );
            const dayFree = freeSlots.filter((s) => toDateKey(s.start) === key);
            const dayPreview = previewSessions.filter((s) => toDateKey(s.start) === key);
            const eventLayout = layoutOverlapping(dayEvents);
            const previewLayout = layoutOverlapping(
              dayPreview.map((s, i) => ({
                id: `preview-${i}-${s.start.toISOString()}`,
                start: s.start,
                end: s.end,
              })),
            );

            return (
              <div
                key={key}
                className="relative border-l border-teal-900/8 dark:border-white/8"
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-teal-900/6 dark:border-white/6"
                    style={{
                      top: `${((h - GRID_START_HOUR) / (GRID_END_HOUR - GRID_START_HOUR)) * 100}%`,
                      height: `${100 / (GRID_END_HOUR - GRID_START_HOUR)}%`,
                    }}
                  />
                ))}

                {highlightFree &&
                  dayFree.map((slot) => (
                    <button
                      key={`${slot.start.toISOString()}-${slot.end.toISOString()}`}
                      type="button"
                      onClick={() => onScheduleHere(slot)}
                      className="animate-free group absolute inset-x-0.5 z-10 overflow-hidden rounded-md border border-dashed border-emerald-400/80 bg-emerald-400/20 px-1 text-left backdrop-blur-[1px] transition hover:bg-emerald-400/30"
                      style={{
                        top: `${topPct(slot.start)}%`,
                        height: `${heightPct(slot.start, slot.end)}%`,
                      }}
                    >
                      <div className="text-[10px] font-semibold text-emerald-900 dark:text-emerald-100">
                        Free Slot: {formatDuration(slot.end.getTime() - slot.start.getTime())}
                      </div>
                      <div className="mt-0.5 flex items-center gap-0.5 text-[9px] text-emerald-800/80 opacity-0 transition group-hover:opacity-100 dark:text-emerald-100/80">
                        <Plus className="size-3" /> Schedule Here
                      </div>
                    </button>
                  ))}

                {dayEvents.map((ev) => {
                  const struck = doneEventIds.has(ev.id);
                  const selected = selectedEventId === ev.id;
                  const layout = eventLayout.get(ev.id);
                  const pos = columnStyle(layout);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      className={`absolute z-20 cursor-pointer overflow-hidden rounded-md border px-1 py-0.5 text-left shadow-sm transition hover:z-40 hover:brightness-110 focus-visible:z-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-300 ${eventStyle(ev)} ${struck ? "opacity-50 line-through" : ""} ${selected ? "z-40 ring-2 ring-sky-300 ring-offset-1 ring-offset-transparent" : ""}`}
                      style={{
                        top: `${topPct(ev.start)}%`,
                        height: `${Math.max(heightPct(ev.start, ev.end), 2)}%`,
                        left: pos.left,
                        width: pos.width,
                      }}
                      title={`${ev.title} · ${formatTime(ev.start)}–${formatTime(ev.end)}${ev.location ? ` · ${ev.location}` : ""}${layout && layout.columnCount > 1 ? ` · overlaps ${layout.columnCount} events` : ""}`}
                    >
                      <div className="flex items-start gap-0.5 text-[10px] font-semibold leading-tight">
                        {(ev.isPermanent || ev.source === "USOS_ICS") && (
                          <Lock className="mt-0.5 size-2.5 shrink-0 opacity-90" />
                        )}
                        <span className="truncate">{ev.title}</span>
                      </div>
                      <div className="truncate text-[9px] opacity-90">
                        {formatTime(ev.start)}–{formatTime(ev.end)}
                        {ev.sessionIndex != null && ev.sessionTotal != null
                          ? ` · ${ev.sessionIndex}/${ev.sessionTotal}`
                          : ""}
                      </div>
                      {ev.parentTaskId && (
                        <div className="truncate text-[8px] opacity-80">deadline task</div>
                      )}
                    </button>
                  );
                })}

                {dayPreview.map((s, i) => {
                  const id = `preview-${i}-${s.start.toISOString()}`;
                  const pos = columnStyle(previewLayout.get(id));
                  return (
                    <div
                      key={id}
                      className="animate-preview pointer-events-none absolute z-30 rounded-md border-2 border-dashed border-sky-300 bg-sky-400/25 px-1"
                      style={{
                        top: `${topPct(s.start)}%`,
                        height: `${heightPct(s.start, s.end)}%`,
                        left: pos.left,
                        width: pos.width,
                      }}
                    >
                      <div className="truncate text-[10px] font-semibold text-sky-950 dark:text-sky-50">
                        {s.title} · preview
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
