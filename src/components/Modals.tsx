import { useEffect, useState, type ReactNode } from "react";
import { GripVertical, Lock, MapPin, X } from "lucide-react";
import type {
  ActivityRecurrence,
  ActivitySeries,
  AllocationMode,
  CalendarEvent,
  PlacementProposal,
  PlacementStrategy,
  Task,
} from "../types";
import { findHardLockOverlaps } from "../lib/scheduler";
import {
  formatDuration,
  formatTime,
  mondayIndex,
  parseDateKey,
  setTimeOnDate,
  toDateKey,
  uid,
} from "../lib/time";

export function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-teal-950/40 p-4 backdrop-blur-sm">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-teal-900/10 bg-[#f7faf6] shadow-xl dark:border-white/10 dark:bg-[#12201a] ${wide ? "max-w-xl" : "max-w-md"}`}
      >
        <div className="flex items-center justify-between border-b border-teal-900/10 px-5 py-4 dark:border-white/10">
          <h2 className="font-display text-xl text-teal-950 dark:text-teal-50">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-teal-900/50 hover:bg-teal-900/5 dark:text-teal-100/50 dark:hover:bg-white/5"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Inline sidebar panel — no viewport overlay, so the calendar stays visible. */
export function DockPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-teal-900/10 pb-3 dark:border-white/10">
        <h2 className="font-display text-lg leading-tight text-teal-950 dark:text-teal-50">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-teal-900/50 hover:bg-teal-900/5 dark:text-teal-100/50 dark:hover:bg-white/5"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-3">{children}</div>
    </div>
  );
}

const field =
  "mt-1 w-full rounded-lg border border-teal-900/15 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 dark:border-white/15 dark:bg-white/5 dark:focus:border-teal-400";
const label = "block text-xs font-semibold uppercase tracking-wide text-teal-900/55 dark:text-teal-100/55";

export function TaskFormModal({
  initialSlotStart,
  onClose,
  onSubmit,
}: {
  initialSlotStart?: Date;
  onClose: () => void;
  onSubmit: (draft: {
    title: string;
    deadlineDate: string;
    isLargeTask: boolean;
    hoursRequired: number;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [deadlineDate, setDeadlineDate] = useState(() => {
    const d = initialSlotStart ?? new Date();
    const end = new Date(d);
    end.setDate(end.getDate() + 7);
    return toDateKey(end);
  });
  const [isLarge, setIsLarge] = useState(true);
  const [hours, setHours] = useState(4);

  return (
    <ModalShell title="New Task" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSubmit({
            title: title.trim(),
            deadlineDate,
            isLargeTask: isLarge,
            hoursRequired: isLarge ? hours : 1,
          });
        }}
      >
        <label className="block">
          <span className={label}>Task Title</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block">
          <span className={label}>Deadline Date</span>
          <input
            type="date"
            className={field}
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
            required
          />
        </label>
        <fieldset className="space-y-2">
          <legend className={label}>Task Type</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={!isLarge}
              onChange={() => setIsLarge(false)}
            />
            Standard (1h block)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={isLarge} onChange={() => setIsLarge(true)} />
            Large Iterative Task
          </label>
        </fieldset>
        {isLarge && (
          <label className="block">
            <span className={label}>Hours to spend before deadline</span>
            <input
              type="number"
              min={1}
              max={40}
              step={0.5}
              className={field}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            />
          </label>
        )}
        <button
          type="submit"
          className="w-full rounded-xl bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-600"
        >
          Continue to placement
        </button>
      </form>
    </ModalShell>
  );
}

export function ActivityFormModal({
  initialSlotStart,
  onClose,
  onSubmit,
}: {
  initialSlotStart?: Date;
  onClose: () => void;
  onSubmit: (draft: {
    title: string;
    isPermanent: boolean;
    recurrence: ActivityRecurrence;
    startTime: string;
    endTime: string;
    anchorDate: string;
    weekday: number;
  }) => void;
}) {
  const base = initialSlotStart ?? new Date();
  const [title, setTitle] = useState("");
  const [isPermanent, setIsPermanent] = useState(true);
  const [recurrence, setRecurrence] = useState<ActivityRecurrence>("WEEKLY");
  const [anchorDate, setAnchorDate] = useState(toDateKey(base));
  const [weekday, setWeekday] = useState(mondayIndex(base));
  const [startTime, setStartTime] = useState(
    initialSlotStart
      ? `${String(initialSlotStart.getHours()).padStart(2, "0")}:${String(initialSlotStart.getMinutes()).padStart(2, "0")}`
      : "18:00",
  );
  const [endTime, setEndTime] = useState(
    initialSlotStart
      ? `${String(initialSlotStart.getHours() + 1).padStart(2, "0")}:${String(initialSlotStart.getMinutes()).padStart(2, "0")}`
      : "19:00",
  );

  return (
    <ModalShell title="Custom Activity" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSubmit({
            title: title.trim(),
            isPermanent,
            recurrence,
            startTime,
            endTime,
            anchorDate,
            weekday,
          });
        }}
      >
        <label className="block">
          <span className={label}>Title</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block">
          <span className={label}>Recurrence</span>
          <select
            className={field}
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as ActivityRecurrence)}
          >
            <option value="ONE_TIME">One-time event</option>
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Every two weeks</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </label>
        {(recurrence === "ONE_TIME" || recurrence === "MONTHLY") && (
          <label className="block">
            <span className={label}>{recurrence === "MONTHLY" ? "Day of month (anchor)" : "Date"}</span>
            <input
              type="date"
              className={field}
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
            />
          </label>
        )}
        {(recurrence === "WEEKLY" || recurrence === "BIWEEKLY") && (
          <label className="block">
            <span className={label}>Day of week</span>
            <select
              className={field}
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
            >
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                (n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>Start</span>
            <input
              type="time"
              className={field}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={label}>End</span>
            <input
              type="time"
              className={field}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPermanent}
            onChange={(e) => setIsPermanent(e.target.checked)}
          />
          Permanent Activity (Cannot be moved by algorithm)
        </label>
        <button
          type="submit"
          className="w-full rounded-xl bg-violet-700 py-2.5 text-sm font-semibold text-white hover:bg-violet-600"
        >
          Add activity
        </button>
      </form>
    </ModalShell>
  );
}

export function PlacementModal({
  proposals,
  onClose,
  onConfirm,
  onPreview,
}: {
  proposals: PlacementProposal[];
  onClose: () => void;
  onConfirm: (strategy: PlacementStrategy) => void;
  onPreview?: (strategy: PlacementStrategy) => void;
}) {
  const [strategy, setStrategy] = useState<PlacementStrategy>("earliest");
  const selected = proposals.find((p) => p.strategy === strategy) ?? proposals[0];

  const select = (s: PlacementStrategy) => {
    setStrategy(s);
    onPreview?.(s);
  };

  return (
    <DockPanel title="Placement proposals" onClose={onClose}>
      <p className="mb-3 text-sm text-teal-900/70 dark:text-teal-100/70">
        Hover a strategy to preview dashed blocks on the calendar, then confirm.
      </p>
      <div className="space-y-2">
        {proposals.map((p) => (
          <button
            key={p.strategy}
            type="button"
            onClick={() => select(p.strategy)}
            onMouseEnter={() => onPreview?.(p.strategy)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
              strategy === p.strategy
                ? "border-teal-700 bg-teal-800/10 dark:border-teal-400 dark:bg-teal-400/10"
                : "border-teal-900/10 bg-white/60 dark:border-white/10 dark:bg-white/5"
            }`}
          >
            <div className="font-semibold">{p.label}</div>
            <div className="text-xs text-teal-900/60 dark:text-teal-100/60">
              {p.hoursPlaced.toFixed(1)} of {p.hoursRequested}h · {p.sessions.length} session
              {p.sessions.length === 1 ? "" : "s"}
              {p.hoursPlaced + 0.01 < p.hoursRequested
                ? ` · partial placement warning`
                : ""}
            </div>
          </button>
        ))}
      </div>
      {selected && selected.hoursPlaced + 0.01 < selected.hoursRequested && (
        <p className="mt-3 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Scheduled {selected.hoursPlaced.toFixed(1)} of {selected.hoursRequested} hours — not
          enough free time before the deadline.
        </p>
      )}
      <button
        type="button"
        onClick={() => onConfirm(strategy)}
        className="mt-4 w-full rounded-xl bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-600"
      >
        Confirm {selected?.label}
      </button>
    </DockPanel>
  );
}

export function ConflictModal({
  tasks,
  onClose,
  onHoverPreview,
  onConfirm,
}: {
  tasks: Task[];
  onClose: () => void;
  onHoverPreview: (mode: AllocationMode, order: string[]) => void;
  onConfirm: (mode: AllocationMode, order: string[]) => void;
}) {
  const [order, setOrder] = useState(() =>
    [...tasks].sort((a, b) => a.tieBreakerOrder - b.tieBreakerOrder).map((t) => t.id),
  );
  const [mode, setMode] = useState<AllocationMode>("SEQUENTIAL");

  const move = (index: number, dir: -1 | 1) => {
    const next = [...order];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setOrder(next);
  };

  return (
    <DockPanel title="Deadline Priority Conflict" onClose={onClose}>
      <p className="mb-3 text-sm text-teal-900/70 dark:text-teal-100/70">
        These tasks share deadline <strong>{tasks[0]?.deadlineDate}</strong>. Reorder priority or
        choose even split. Hover a row or Even split to preview on the calendar.
      </p>
      <ul className="space-y-2">
        {order.map((id, i) => {
          const t = tasks.find((x) => x.id === id)!;
          return (
            <li
              key={id}
              onMouseEnter={() => onHoverPreview("SEQUENTIAL", order)}
              onMouseLeave={() => onHoverPreview(mode, order)}
              className="flex items-center gap-2 rounded-xl border border-teal-900/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5"
            >
              <GripVertical className="size-4 text-teal-900/30 dark:text-teal-100/30" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{t.title}</div>
                <div className="text-[11px] text-teal-900/50 dark:text-teal-100/50">
                  #{i + 1} · {t.isLargeTask ? `${t.hoursRequired}h` : "1h"}
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <button type="button" className="text-xs" onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="text-xs" onClick={() => move(i, 1)}>
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onMouseEnter={() => onHoverPreview("EVEN_SPLIT", order)}
        onMouseLeave={() => onHoverPreview(mode, order)}
        onClick={() => setMode("EVEN_SPLIT")}
        className={`mt-3 w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
          mode === "EVEN_SPLIT"
            ? "border-teal-700 bg-teal-800/10 dark:border-teal-400"
            : "border-teal-900/10 dark:border-white/10"
        }`}
      >
        Even split (round-robin)
      </button>
      <button
        type="button"
        onClick={() => {
          setMode("SEQUENTIAL");
        }}
        className={`mt-2 w-full rounded-xl border px-4 py-2 text-left text-sm ${
          mode === "SEQUENTIAL"
            ? "border-teal-700 bg-teal-800/10 dark:border-teal-400"
            : "border-teal-900/10 dark:border-white/10"
        }`}
      >
        Use list order (sequential)
      </button>
      <button
        type="button"
        onClick={() => onConfirm(mode, order)}
        className="mt-4 w-full rounded-xl bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-600"
      >
        Lock in schedule
      </button>
    </DockPanel>
  );
}

const RECURRENCE_LABEL: Record<ActivityRecurrence, string> = {
  ONE_TIME: "One-time",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every two weeks",
  MONTHLY: "Monthly",
};

const STATUS_LABEL: Record<Task["status"], string> = {
  TODO: "To-Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

const canMutateEvent = (event: CalendarEvent) =>
  event.source === "CUSTOM_ACTIVITY" || event.source === "SCHEDULED_TASK";

export function EventDetailsPanel({
  event,
  tasks,
  seriesList,
  sessionIsDone,
  budgetNote,
  onClose,
  onToggleSessionDone,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  tasks: Task[];
  seriesList: ActivitySeries[];
  sessionIsDone?: boolean;
  budgetNote?: string | null;
  onClose: () => void;
  onToggleSessionDone?: (eventId: string, done: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const parentTask = event.parentTaskId
    ? tasks.find((t) => t.id === event.parentTaskId)
    : undefined;
  const series = event.seriesId
    ? seriesList.find((s) => s.id === event.seriesId)
    : undefined;
  const mutable = canMutateEvent(event);

  let sourceLabel = "Calendar event";
  if (event.source === "USOS_ICS") sourceLabel = "USOS class (hard-locked)";
  else if (event.source === "CUSTOM_ACTIVITY") {
    sourceLabel = event.isPermanent
      ? "Permanent custom activity"
      : "Soft custom activity";
  } else if (event.source === "SCHEDULED_TASK") {
    sourceLabel = "Scheduled task session";
  } else if (event.source === "RECOVERY_BREAK") {
    sourceLabel = "Recovery break (protected)";
  }

  return (
    <DockPanel title="Event details" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <h3 className="font-display text-xl text-teal-950 dark:text-teal-50">{event.title}</h3>
          <p className="mt-1 text-sm text-teal-900/65 dark:text-teal-100/65">{sourceLabel}</p>
        </div>

        {budgetNote && (
          <div className="rounded-lg bg-teal-800/10 px-2.5 py-2 text-sm text-teal-950 dark:bg-teal-400/10 dark:text-teal-50">
            {budgetNote}
          </div>
        )}

        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-teal-900/50 dark:text-teal-100/50">
              When
            </dt>
            <dd>
              {toDateKey(event.start)} · {formatTime(event.start)}–{formatTime(event.end)}
              <span className="ml-1 text-teal-900/50 dark:text-teal-100/50">
                ({formatDuration(event.end.getTime() - event.start.getTime())})
              </span>
            </dd>
          </div>

          {event.location && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-teal-900/50 dark:text-teal-100/50">
                Location
              </dt>
              <dd className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0 opacity-70" />
                {event.location}
              </dd>
            </div>
          )}

          {(event.isPermanent || event.source === "USOS_ICS") && (
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-600/10 px-2.5 py-2 text-slate-800 dark:text-slate-200">
              <Lock className="size-3.5" />
              Hard-locked — scheduler cannot move this
            </div>
          )}

          {event.source === "RECOVERY_BREAK" && (
            <div className="rounded-lg bg-stone-500/15 px-2.5 py-2 text-stone-800 dark:text-stone-200">
              Reserved after two consecutive study sessions — the scheduler will not place
              other tasks here.
            </div>
          )}

          {event.source === "CUSTOM_ACTIVITY" && !event.isPermanent && (
            <div className="rounded-lg bg-violet-600/10 px-2.5 py-2 text-violet-900 dark:text-violet-200">
              Soft event — may be shifted by preemption
            </div>
          )}

          {series && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-teal-900/50 dark:text-teal-100/50">
                Recurrence
              </dt>
              <dd>{RECURRENCE_LABEL[series.recurrence]}</dd>
            </div>
          )}

          {event.sessionIndex != null && event.sessionTotal != null && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-teal-900/50 dark:text-teal-100/50">
                Session
              </dt>
              <dd>
                {event.sessionIndex} of {event.sessionTotal}
                {sessionIsDone ? " · done" : ""}
              </dd>
            </div>
          )}

          {event.source === "SCHEDULED_TASK" && onToggleSessionDone && (
            <button
              type="button"
              onClick={() => onToggleSessionDone(event.id, !sessionIsDone)}
              className="w-full rounded-xl bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-600"
            >
              {sessionIsDone ? "Mark session not done" : "Mark session done"}
            </button>
          )}

          {parentTask && (
            <div className="rounded-xl border border-teal-900/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="text-xs font-semibold uppercase tracking-wide text-teal-900/50 dark:text-teal-100/50">
                Parent task
              </div>
              <div className="mt-1 font-medium">{parentTask.title}</div>
              <div className="mt-1 text-xs text-teal-900/60 dark:text-teal-100/60">
                Deadline {parentTask.deadlineDate} · {STATUS_LABEL[parentTask.status]}
                {` · ${(parentTask.hoursDone ?? 0).toFixed(1)}/${parentTask.hoursRequired}h done`}
              </div>
            </div>
          )}
        </dl>

        {mutable && (onEdit || onDelete) && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-xl border border-teal-900/15 bg-white/80 py-2.5 text-sm font-semibold text-teal-950 hover:bg-teal-900/5 dark:border-white/15 dark:bg-white/5 dark:text-teal-50"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-xl border border-rose-700/25 bg-rose-600/10 py-2.5 text-sm font-semibold text-rose-900 hover:bg-rose-600/15 dark:text-rose-200"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </DockPanel>
  );
}

export function SeriesScopePanel({
  action,
  seriesRecurrence,
  onChoose,
  onBack,
}: {
  action: "edit" | "delete";
  seriesRecurrence: ActivityRecurrence;
  onChoose: (scope: "occurrence" | "series") => void;
  onBack: () => void;
}) {
  const verb = action === "edit" ? "Edit" : "Delete";
  return (
    <DockPanel title={`${verb} scope`} onClose={onBack}>
      <p className="mb-3 text-sm text-teal-900/70 dark:text-teal-100/70">
        This activity repeats ({RECURRENCE_LABEL[seriesRecurrence]}). Apply {action} to:
      </p>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => onChoose("occurrence")}
          className="rounded-xl border border-teal-900/10 bg-white/80 px-3 py-3 text-left text-sm hover:border-teal-700 dark:border-white/10 dark:bg-white/5"
        >
          <div className="font-semibold">This occurrence only</div>
          <div className="mt-0.5 text-xs text-teal-900/55 dark:text-teal-100/55">
            {action === "edit" ? "Change just the clicked instance" : "Cancel this date only"}
          </div>
        </button>
        <button
          type="button"
          onClick={() => onChoose("series")}
          className="rounded-xl border border-teal-900/10 bg-white/80 px-3 py-3 text-left text-sm hover:border-teal-700 dark:border-white/10 dark:bg-white/5"
        >
          <div className="font-semibold">Entire series</div>
          <div className="mt-0.5 text-xs text-teal-900/55 dark:text-teal-100/55">
            {action === "edit"
              ? "Update the recurring template (clears one-off exceptions)"
              : "Remove every occurrence"}
          </div>
        </button>
      </div>
    </DockPanel>
  );
}

export function EditActivityPanel({
  initialTitle,
  initialDate,
  initialStartTime,
  initialEndTime,
  scope,
  allEvents,
  ignoreEventId,
  deadlineDate,
  minDurationMinutes = 30,
  onSave,
  onBack,
}: {
  initialTitle: string;
  initialDate: string;
  initialStartTime: string;
  initialEndTime: string;
  scope: "occurrence" | "series" | "one-time";
  allEvents: CalendarEvent[];
  ignoreEventId?: string;
  deadlineDate?: string;
  minDurationMinutes?: number;
  onSave: (draft: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [ackHard, setAckHard] = useState(false);
  const [durationError, setDurationError] = useState<string | null>(null);

  const checkDate = scope === "series" ? initialDate : date;
  const start = setTimeOnDate(parseDateKey(checkDate), startTime);
  const end = setTimeOnDate(parseDateKey(checkDate), endTime);
  const overlaps = findHardLockOverlaps(start, end, allEvents, ignoreEventId);
  const hardLockWarning =
    overlaps.length > 0
      ? `Overlaps hard-locked event(s): ${overlaps.map((o) => o.title).join(", ")}. Classes are sometimes cancelled or optional.`
      : null;
  const deadlineWarning =
    deadlineDate && toDateKey(end) > deadlineDate
      ? `This block ends after the task deadline (${deadlineDate}).`
      : null;

  const scopeLabel =
    scope === "series" ? "Entire series" : scope === "occurrence" ? "This occurrence" : "Activity";

  return (
    <DockPanel title={`Edit · ${scopeLabel}`} onClose={onBack}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          if (end.getTime() - start.getTime() < minDurationMinutes * 60 * 1000) {
            setDurationError(`Duration must be at least ${minDurationMinutes} minutes.`);
            return;
          }
          setDurationError(null);
          if (hardLockWarning && !ackHard) return;
          onSave({
            title: title.trim(),
            date: checkDate,
            startTime,
            endTime,
          });
        }}
      >
        <label className="block">
          <span className={label}>Title</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        {(scope === "one-time") && (
          <label className="block">
            <span className={label}>Date</span>
            <input
              type="date"
              className={field}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setAckHard(false);
              }}
              required
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>Start</span>
            <input
              type="time"
              className={field}
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setAckHard(false);
              }}
              required
            />
          </label>
          <label className="block">
            <span className={label}>End</span>
            <input
              type="time"
              className={field}
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setAckHard(false);
              }}
              required
            />
          </label>
        </div>

        {durationError && (
          <div className="rounded-lg bg-rose-600/10 px-2.5 py-2 text-sm text-rose-900 dark:text-rose-200">
            {durationError}
          </div>
        )}
        {deadlineWarning && (
          <div className="rounded-lg bg-amber-500/15 px-2.5 py-2 text-sm text-amber-950 dark:text-amber-100">
            {deadlineWarning}
          </div>
        )}
        {hardLockWarning && (
          <div className="space-y-2 rounded-lg bg-amber-500/15 px-2.5 py-2 text-sm text-amber-950 dark:text-amber-100">
            <p>{hardLockWarning}</p>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={ackHard}
                onChange={(e) => setAckHard(e.target.checked)}
              />
              Save anyway
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={Boolean(hardLockWarning) && !ackHard}
          className="w-full rounded-xl bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-600"
        >
          Save
        </button>
      </form>
    </DockPanel>
  );
}

export function DeleteConfirmPanel({
  title,
  description,
  onConfirm,
  onBack,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <DockPanel title={title} onClose={onBack}>
      <p className="mb-4 text-sm text-teal-900/70 dark:text-teal-100/70">{description}</p>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-rose-800 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-teal-900/10 py-2.5 text-sm font-medium dark:border-white/10"
        >
          Cancel
        </button>
      </div>
    </DockPanel>
  );
}

export function BudgetReconcilePanel({
  taskTitle,
  hoursPlaced,
  hoursRequired,
  shortfallHours,
  onPropose,
  onReduce,
  onBack,
}: {
  taskTitle: string;
  hoursPlaced: number;
  hoursRequired: number;
  shortfallHours: number;
  onPropose: () => void;
  onReduce: () => void;
  onBack: () => void;
}) {
  return (
    <DockPanel title="Task budget" onClose={onBack}>
      <p className="mb-3 text-sm text-teal-900/70 dark:text-teal-100/70">
        “{taskTitle}” has {hoursPlaced.toFixed(1)}h placed of {hoursRequired.toFixed(1)}h required
        ({shortfallHours.toFixed(1)}h short).
      </p>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onPropose}
          className="rounded-xl bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-600"
        >
          Propose new session(s)
        </button>
        <button
          type="button"
          onClick={onReduce}
          className="rounded-xl border border-teal-900/15 bg-white/80 py-2.5 text-sm font-semibold dark:border-white/15 dark:bg-white/5"
        >
          Discard shortfall · reduce hours required
        </button>
      </div>
    </DockPanel>
  );
}

export function ReschedulePromptModal({
  onConfirm,
  onDismiss,
}: {
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <ModalShell title="Free time opened" onClose={onDismiss}>
      <p className="mb-4 text-sm text-teal-900/70 dark:text-teal-100/70">
        Unused future sessions were cleared. Reschedule other active tasks into the new gaps?
      </p>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Reschedule
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-xl border border-teal-900/15 py-2.5 text-sm font-semibold dark:border-white/15"
        >
          Not now
        </button>
      </div>
    </ModalShell>
  );
}

export function ScheduleHereChooser({
  onClose,
  onPickTask,
  onPickActivity,
}: {
  onClose: () => void;
  onPickTask: () => void;
  onPickActivity: () => void;
}) {
  return (
    <ModalShell title="Schedule Here" onClose={onClose}>
      <div className="grid gap-2">
        <button
          type="button"
          onClick={onPickTask}
          className="rounded-xl bg-teal-800 py-3 text-sm font-semibold text-white"
        >
          Add task into this slot
        </button>
        <button
          type="button"
          onClick={onPickActivity}
          className="rounded-xl border border-teal-900/15 bg-white py-3 text-sm font-semibold dark:border-white/15 dark:bg-white/5"
        >
          Add custom activity here
        </button>
      </div>
    </ModalShell>
  );
}

export function newTaskId() {
  return uid("task");
}
