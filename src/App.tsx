import { useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Upload,
} from "lucide-react";
import { CalendarGrid } from "./components/CalendarGrid";
import { OptionsMenu } from "./components/OptionsMenu";
import { TaskSidebar } from "./components/TaskSidebar";
import {
  ActivityFormModal,
  BudgetReconcilePanel,
  ConflictModal,
  DeleteConfirmPanel,
  EditActivityPanel,
  EventDetailsPanel,
  PlacementModal,
  ReschedulePromptModal,
  ScheduleHereChooser,
  SeriesScopePanel,
  TaskFormModal,
  newTaskId,
} from "./components/Modals";
import { buildSampleUsosSchedule } from "./data/sampleUsos";
import { parseIcsToEvents } from "./lib/ics";
import { computeFreeSlots, hardLockedEvents } from "./lib/freeSlots";
import {
  applyOccurrenceEdit,
  applyOccurrenceMove,
  applySeriesEdit,
  applySeriesTimeChange,
  cancelOccurrence,
  expandSeries,
} from "./lib/recurrence";
import {
  applyParentTaskDone,
  buildProposals,
  computeHoursDone,
  describeSoftMove,
  isSessionDone,
  placedHoursForTask,
  placementToEvents,
  proposeConflictLayouts,
  rebuildRecoveriesForTask,
  recoveriesToEvents,
  renumberSessionsForTask,
  sessionsToEvents,
} from "./lib/scheduler";
import {
  DEFAULT_ALLOCATION_BOUNDS,
  addDays,
  formatTime,
  formatWeekLabel,
  pad2,
  parseDateKey,
  setTimeOnDate,
  startOfWeekMonday,
  toDateKey,
  uid,
} from "./lib/time";
import type {
  ActivitySeries,
  AllocationBounds,
  AllocationMode,
  CalendarEvent,
  FreeSlot,
  PlacementProposal,
  PlacementStrategy,
  PlannedSession,
  SoftMoveToast,
  Task,
  TaskStatus,
} from "./types";

type Modal =
  | { type: "task"; slot?: Date }
  | { type: "activity"; slot?: Date }
  | {
      type: "placement";
      task: Task;
      proposals: PlacementProposal[];
      /** Fill shortfall on an existing task instead of creating one */
      fillExisting?: boolean;
    }
  | { type: "conflict"; tasks: Task[]; incoming: Task }
  | { type: "chooser"; slot: FreeSlot }
  | { type: "reschedule-prompt" }
  | null;

type DockView =
  | { type: "details" }
  | { type: "series-scope"; action: "edit" | "delete" }
  | { type: "edit-activity"; scope: "occurrence" | "series" | "one-time" }
  | { type: "edit-session" }
  | { type: "delete-confirm"; scope: "occurrence" | "series" | "one-time" }
  | { type: "budget"; taskId: string; shortfallHours: number };

function hhmm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [highlightFree, setHighlightFree] = useState(true);
  const [allocationBounds, setAllocationBounds] = useState<AllocationBounds>(
    () => structuredClone(DEFAULT_ALLOCATION_BOUNDS),
  );
  const [usosEvents, setUsosEvents] = useState<CalendarEvent[]>(() =>
    buildSampleUsosSchedule(),
  );
  const [seriesList, setSeriesList] = useState<ActivitySeries[]>([]);
  const [taskSessions, setTaskSessions] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [dockView, setDockView] = useState<DockView>({ type: "details" });
  const [budgetNote, setBudgetNote] = useState<string | null>(null);
  const [previewSessions, setPreviewSessions] = useState<PlannedSession[]>([]);
  const [toasts, setToasts] = useState<SoftMoveToast[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dockMode =
    modal?.type === "placement" || modal?.type === "conflict"
      ? modal.type
      : dockView.type === "budget" || selectedEvent
        ? "event"
        : null;

  function selectEvent(ev: CalendarEvent | null) {
    setSelectedEvent(ev);
    setDockView({ type: "details" });
    if (!ev) setBudgetNote(null);
  }

  const expandRangeStart = addDays(weekStart, -14);
  const expandRangeEnd = addDays(weekStart, 21);

  const customEvents = useMemo(
    () => expandSeries(seriesList, expandRangeStart, expandRangeEnd),
    [seriesList, weekStart],
  );

  const allEvents = useMemo(
    () => [...usosEvents, ...customEvents, ...taskSessions],
    [usosEvents, customEvents, taskSessions],
  );

  const weekEnd = addDays(weekStart, 7);
  const freeSlots = useMemo(() => {
    const hard = hardLockedEvents(allEvents);
    return computeFreeSlots(hard, weekStart, weekEnd, allocationBounds);
  }, [allEvents, weekStart, allocationBounds]);

  const doneEventIds = useMemo(() => {
    const now = new Date();
    return new Set(
      taskSessions.filter((e) => isSessionDone(e, now)).map((e) => e.id),
    );
  }, [taskSessions]);

  function refreshTaskHours(nextTasks: Task[], events: CalendarEvent[]): Task[] {
    const now = new Date();
    return nextTasks.map((t) => ({
      ...t,
      hoursDone: computeHoursDone(t.id, events, now),
      hoursPlaced: events
        .filter((e) => e.source === "SCHEDULED_TASK" && e.parentTaskId === t.id)
        .reduce((a, e) => a + (e.end.getTime() - e.start.getTime()) / 3600000, 0),
    }));
  }

  function proposalToPreview(prop: PlacementProposal | undefined): PlannedSession[] {
    if (!prop) return [];
    return [
      ...prop.sessions,
      ...prop.recoveries.map((r) => ({
        taskId: r.taskId,
        title: "Recovery break",
        start: r.start,
        end: r.end,
        sessionIndex: 0,
        sessionTotal: 0,
        isPreview: true,
      })),
    ];
  }

  const visibleEvents = useMemo(
    () =>
      allEvents.filter(
        (e) => e.end > weekStart && e.start < weekEnd,
      ),
    [allEvents, weekStart],
  );

  async function onIcsFile(file: File) {
    const text = await file.text();
    const parsed = parseIcsToEvents(text);
    setUsosEvents(parsed);
    setBanner(`Imported ${parsed.length} USOS events from ${file.name}.`);
  }

  function rebuildSessionsForTasks(nextTasks: Task[], preferStrategy: PlacementStrategy = "earliest") {
    const active = nextTasks.filter((t) => t.status !== "DONE");
    const byDeadline = new Map<string, Task[]>();
    for (const t of active) {
      if (!byDeadline.has(t.deadlineDate)) byDeadline.set(t.deadlineDate, []);
      byDeadline.get(t.deadlineDate)!.push(t);
    }

    // Keep past sessions belonging to DONE tasks
    const now = new Date();
    const keptDoneSessions = taskSessions.filter((e) => {
      if (e.source !== "SCHEDULED_TASK" || !e.parentTaskId) return false;
      const t = nextTasks.find((x) => x.id === e.parentTaskId);
      return t?.status === "DONE" && e.end.getTime() <= now.getTime();
    });

    const base = [...usosEvents, ...expandSeries(seriesList, expandRangeStart, expandRangeEnd)];
    let scheduled: CalendarEvent[] = [...keptDoneSessions];
    const updated = nextTasks.map((t) => ({ ...t }));
    const deadlines = [...byDeadline.keys()].sort();

    for (const deadline of deadlines) {
      const group = [...byDeadline.get(deadline)!].sort(
        (a, b) => a.tieBreakerOrder - b.tieBreakerOrder,
      );
      const allEven = group.length > 1 && group.every((t) => t.allocationMode === "EVEN_SPLIT");

      if (allEven) {
        const layout = proposeConflictLayouts(
          group,
          "EVEN_SPLIT",
          group.map((t) => t.id),
          [...base, ...scheduled],
          allocationBounds,
        );
        scheduled.push(
          ...sessionsToEvents(layout.sessions),
          ...recoveriesToEvents(layout.recoveries),
        );
      } else {
        for (const t of group) {
          const context = [...base, ...scheduled];
          const proposals = buildProposals(t, context, [], allocationBounds);
          const prop =
            proposals.find((p) => p.strategy === preferStrategy) ?? proposals[0];
          scheduled.push(...placementToEvents(prop));
        }
      }
    }

    const withHours = refreshTaskHours(updated, scheduled);
    setTaskSessions(scheduled);
    setTasks(withHours);
    return withHours;
  }

  function beginTaskDraft(draft: {
    title: string;
    deadlineDate: string;
    isLargeTask: boolean;
    hoursRequired: number;
  }) {
    selectEvent(null);
    const same = tasks.filter(
      (t) => t.status !== "DONE" && t.deadlineDate === draft.deadlineDate,
    );
    const incoming: Task = {
      id: newTaskId(),
      title: draft.title,
      status: "TODO",
      isLargeTask: draft.isLargeTask,
      hoursRequired: draft.hoursRequired,
      deadlineDate: draft.deadlineDate,
      tieBreakerOrder: same.length,
      allocationMode: "SEQUENTIAL",
      hoursPlaced: 0,
      hoursDone: 0,
    };

    if (same.length > 0) {
      setModal({ type: "conflict", tasks: [...same, incoming], incoming });
      setPreviewSessions([]);
      return;
    }

    const context = [...usosEvents, ...customEvents, ...taskSessions];
    const proposals = buildProposals(incoming, context, [], allocationBounds);
    setModal({ type: "placement", task: incoming, proposals });
    setPreviewSessions(proposalToPreview(proposals[0]));
  }

  function displaceSoftOverlaps(sessions: PlannedSession[]) {
    const soft = customEvents.filter((e) => !e.isPermanent);
    const moves: SoftMoveToast[] = [];
    let nextSeries = seriesList;

    for (const session of sessions) {
      for (const ev of soft) {
        if (!(session.start < ev.end && ev.start < session.end)) continue;
        if (!ev.seriesId || !ev.exceptionDate) continue;
        const duration = ev.end.getTime() - ev.start.getTime();
        const barriers = hardLockedEvents([
          ...usosEvents,
          ...customEvents.filter((e) => e.isPermanent),
          ...taskSessions,
          ...sessionsToEvents(sessions),
        ]);
        const free = computeFreeSlots(
          barriers,
          weekStart,
          addDays(weekStart, 28),
          allocationBounds,
        ).filter((s) => s.start >= session.end && s.end.getTime() - s.start.getTime() >= duration);
        const fit = free[0];
        if (!fit) continue;
        const toStart = new Date(fit.start);
        const toEnd = new Date(toStart.getTime() + duration);
        nextSeries = nextSeries.map((s) =>
          s.id === ev.seriesId
            ? applyOccurrenceMove(s, ev.exceptionDate!, toStart, toEnd)
            : s,
        );
        moves.push({
          id: uid("toast"),
          seriesId: ev.seriesId,
          occurrenceDate: ev.exceptionDate,
          title: ev.title,
          fromStart: ev.start,
          toStart,
          toEnd,
        });
      }
    }

    if (moves.length) {
      setSeriesList(nextSeries);
      setToasts((t) => [...t, ...moves]);
    }
  }

  function confirmPlacement(
    task: Task,
    strategy: PlacementStrategy,
    proposals: PlacementProposal[],
    fillExisting = false,
  ) {
    const prop = proposals.find((p) => p.strategy === strategy) ?? proposals[0];
    const events = placementToEvents(prop);

    if (fillExisting) {
      let nextSessions = [...taskSessions, ...events];
      nextSessions = rebuildRecoveriesForTask(task.id, nextSessions, allocationBounds);
      nextSessions = renumberSessionsForTask(nextSessions, task.id);
      const nextTasks = refreshTaskHours(tasks, nextSessions);
      setTaskSessions(nextSessions);
      setTasks(nextTasks);
      displaceSoftOverlaps(prop.sessions);
      if (prop.hoursPlaced + 0.01 < prop.hoursRequested) {
        setBanner(
          `Added ${prop.hoursPlaced.toFixed(1)} of ${prop.hoursRequested} missing hours for “${task.title}”.`,
        );
        const stillShort =
          (nextTasks.find((t) => t.id === task.id)?.hoursRequired ?? 0) -
          placedHoursForTask(task.id, nextSessions);
        if (stillShort > 0.01) {
          setDockView({ type: "budget", taskId: task.id, shortfallHours: stillShort });
        } else {
          setDockView({ type: "details" });
        }
      } else {
        setDockView({ type: "details" });
        setBudgetNote(null);
      }
      setModal(null);
      setPreviewSessions([]);
      return;
    }

    const nextSessions = [...taskSessions, ...events];
    const nextTasks = refreshTaskHours(
      [...tasks, { ...task, hoursPlaced: prop.hoursPlaced, hoursDone: 0 }],
      nextSessions,
    );
    setTasks(nextTasks);
    setTaskSessions(nextSessions);
    displaceSoftOverlaps(prop.sessions);
    if (prop.hoursPlaced + 0.01 < prop.hoursRequested) {
      setBanner(
        `Scheduled ${prop.hoursPlaced.toFixed(1)} of ${prop.hoursRequested} hours for “${task.title}”.`,
      );
    }
    setModal(null);
    setPreviewSessions([]);
  }

  function confirmConflict(mode: AllocationMode, order: string[], incoming: Task, group: Task[]) {
    const withIncoming = group.some((t) => t.id === incoming.id)
      ? group
      : [...group, incoming];
    const mergedTasks = [
      ...tasks.filter((t) => !withIncoming.some((g) => g.id === t.id)),
      ...order.map((id, i) => {
        const t = withIncoming.find((x) => x.id === id)!;
        return { ...t, tieBreakerOrder: i, allocationMode: mode, hoursDone: t.hoursDone ?? 0 };
      }),
    ];

    const layout = proposeConflictLayouts(
      withIncoming.map((t) => ({
        ...t,
        tieBreakerOrder: order.indexOf(t.id),
        allocationMode: mode,
      })),
      mode,
      order,
      [
        ...usosEvents,
        ...customEvents,
        ...taskSessions.filter((e) => !withIncoming.some((t) => t.id === e.parentTaskId)),
      ],
      allocationBounds,
    );

    const newEvents = [
      ...sessionsToEvents(layout.sessions),
      ...recoveriesToEvents(layout.recoveries),
    ];
    const otherSessions = taskSessions.filter(
      (e) => !withIncoming.some((t) => t.id === e.parentTaskId),
    );
    const nextSessions = [...otherSessions, ...newEvents];
    setTasks(refreshTaskHours(mergedTasks, nextSessions));
    setTaskSessions(nextSessions);
    setModal(null);
    setPreviewSessions([]);
  }

  function handleStatusChange(id: string, status: TaskStatus) {
    if (status === "DONE") {
      const nextEvents = applyParentTaskDone(id, taskSessions);
      const nextTasks = refreshTaskHours(
        tasks.map((t) => (t.id === id ? { ...t, status: "DONE" } : t)),
        nextEvents,
      );
      setTaskSessions(nextEvents);
      setTasks(nextTasks);
      setSelectedEvent(null);
      const freed = taskSessions.length > nextEvents.length;
      if (freed && nextTasks.some((t) => t.status !== "DONE" && t.id !== id)) {
        setModal({ type: "reschedule-prompt" });
      }
      return;
    }
    const next = tasks.map((t) => (t.id === id ? { ...t, status } : t));
    rebuildSessionsForTasks(next);
  }

  function handleToggleSessionDone(eventId: string, done: boolean) {
    const nextSessions = taskSessions.map((e) =>
      e.id === eventId ? { ...e, sessionDone: done } : e,
    );
    setTaskSessions(nextSessions);
    setTasks(refreshTaskHours(tasks, nextSessions));
    setSelectedEvent((sel) =>
      sel?.id === eventId ? { ...sel, sessionDone: done } : sel,
    );
  }

  function syncSelectedFromSessions(events: CalendarEvent[], preferId?: string) {
    setSelectedEvent((sel) => {
      const id = preferId ?? sel?.id;
      if (!id) return sel;
      return events.find((e) => e.id === id) ?? null;
    });
  }

  /** After session add/edit/delete: recoveries, renumber, hours, budget dock. */
  function finalizeSessionMutation(taskId: string, nextSessionsIn: CalendarEvent[]) {
    let nextSessions = rebuildRecoveriesForTask(taskId, nextSessionsIn, allocationBounds);
    nextSessions = renumberSessionsForTask(nextSessions, taskId);
    let nextTasks = refreshTaskHours(tasks, nextSessions);
    const task = nextTasks.find((t) => t.id === taskId);
    const placed = placedHoursForTask(taskId, nextSessions);

    if (task) {
      if (placed > task.hoursRequired + 0.01) {
        const bumped = Math.round(placed * 2) / 2;
        nextTasks = nextTasks.map((t) =>
          t.id === taskId ? { ...t, hoursRequired: bumped } : t,
        );
        nextTasks = refreshTaskHours(nextTasks, nextSessions);
        setBudgetNote(
          `Hours required updated to ${bumped.toFixed(1)}h to match placed sessions.`,
        );
        setDockView({ type: "details" });
      } else if (placed + 0.01 < task.hoursRequired) {
        setBudgetNote(null);
        setDockView({
          type: "budget",
          taskId,
          shortfallHours: task.hoursRequired - placed,
        });
      } else {
        setBudgetNote(null);
        setDockView({ type: "details" });
      }
    }

    setTaskSessions(nextSessions);
    setTasks(nextTasks);
    syncSelectedFromSessions(nextSessions);
  }

  function beginEditSelected() {
    if (!selectedEvent) return;
    if (selectedEvent.source === "SCHEDULED_TASK") {
      setDockView({ type: "edit-session" });
      return;
    }
    if (selectedEvent.source !== "CUSTOM_ACTIVITY" || !selectedEvent.seriesId) return;
    const series = seriesList.find((s) => s.id === selectedEvent.seriesId);
    if (!series) return;
    if (series.recurrence === "ONE_TIME") {
      setDockView({ type: "edit-activity", scope: "one-time" });
    } else {
      setDockView({ type: "series-scope", action: "edit" });
    }
  }

  function beginDeleteSelected() {
    if (!selectedEvent) return;
    if (selectedEvent.source === "SCHEDULED_TASK") {
      setDockView({ type: "delete-confirm", scope: "one-time" });
      return;
    }
    if (selectedEvent.source !== "CUSTOM_ACTIVITY" || !selectedEvent.seriesId) return;
    const series = seriesList.find((s) => s.id === selectedEvent.seriesId);
    if (!series) return;
    if (series.recurrence === "ONE_TIME") {
      setDockView({ type: "delete-confirm", scope: "one-time" });
    } else {
      setDockView({ type: "series-scope", action: "delete" });
    }
  }

  function saveActivityEdit(draft: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  }) {
    if (!selectedEvent?.seriesId || dockView.type !== "edit-activity") return;
    const seriesId = selectedEvent.seriesId;
    const scope = dockView.scope;
    const start = setTimeOnDate(parseDateKey(draft.date), draft.startTime);
    const end = setTimeOnDate(parseDateKey(draft.date), draft.endTime);
    if (end <= start) {
      setBanner("End time must be after start time.");
      return;
    }

    setSeriesList((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s;
        if (scope === "series") {
          return applySeriesEdit(s, {
            title: draft.title,
            startTime: draft.startTime,
            endTime: draft.endTime,
          });
        }
        if (scope === "one-time") {
          return {
            ...applySeriesEdit(s, {
              title: draft.title,
              startTime: draft.startTime,
              endTime: draft.endTime,
            }),
            anchorDate: draft.date,
            exceptions: {},
          };
        }
        const occDate = selectedEvent.exceptionDate ?? toDateKey(selectedEvent.start);
        return applyOccurrenceEdit(s, occDate, {
          title: draft.title,
          start,
          end,
        });
      }),
    );
    setBudgetNote(null);
    setDockView({ type: "details" });
    const nextId =
      scope === "one-time" || scope === "occurrence"
        ? `${seriesId}_${draft.date}`
        : `${seriesId}_${selectedEvent.exceptionDate ?? toDateKey(selectedEvent.start)}`;
    setSelectedEvent({
      ...selectedEvent,
      id: nextId,
      title: draft.title,
      start,
      end,
      exceptionDate: draft.date,
    });
  }

  function saveSessionEdit(draft: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  }) {
    if (!selectedEvent || selectedEvent.source !== "SCHEDULED_TASK") return;
    const taskId = selectedEvent.parentTaskId;
    if (!taskId) return;
    const start = setTimeOnDate(parseDateKey(draft.date), draft.startTime);
    const end = setTimeOnDate(parseDateKey(draft.date), draft.endTime);
    if (end <= start) {
      setBanner("End time must be after start time.");
      return;
    }
    const nextSessions = taskSessions.map((e) =>
      e.id === selectedEvent.id ? { ...e, title: draft.title, start, end } : e,
    );
    finalizeSessionMutation(taskId, nextSessions);
  }

  function confirmDeleteSelected() {
    if (!selectedEvent || dockView.type !== "delete-confirm") return;

    if (selectedEvent.source === "SCHEDULED_TASK") {
      const taskId = selectedEvent.parentTaskId;
      if (!taskId) return;
      const nextSessions = taskSessions.filter((e) => e.id !== selectedEvent.id);
      setSelectedEvent(null);
      finalizeSessionMutation(taskId, nextSessions);
      return;
    }

    if (!selectedEvent.seriesId) return;
    const seriesId = selectedEvent.seriesId;
    const scope = dockView.scope;

    if (scope === "series" || scope === "one-time") {
      setSeriesList((prev) => prev.filter((s) => s.id !== seriesId));
    } else {
      const occDate = selectedEvent.exceptionDate ?? toDateKey(selectedEvent.start);
      setSeriesList((prev) =>
        prev.map((s) => (s.id === seriesId ? cancelOccurrence(s, occDate) : s)),
      );
    }
    selectEvent(null);
  }

  function reduceTaskBudget(taskId: string) {
    const placed = placedHoursForTask(taskId, taskSessions);
    const bumped = Math.round(placed * 2) / 2;
    let nextSessions = renumberSessionsForTask(taskSessions, taskId);
    nextSessions = rebuildRecoveriesForTask(taskId, nextSessions, allocationBounds);
    nextSessions = renumberSessionsForTask(nextSessions, taskId);
    let nextTasks = tasks.map((t) => {
      if (t.id !== taskId) return t;
      if (bumped <= 0) {
        return { ...t, hoursRequired: 0, status: "DONE" as TaskStatus };
      }
      return { ...t, hoursRequired: bumped };
    });
    if (bumped <= 0) {
      nextSessions = applyParentTaskDone(taskId, nextSessions);
    }
    nextTasks = refreshTaskHours(nextTasks, nextSessions);
    setTaskSessions(nextSessions);
    setTasks(nextTasks);
    setBudgetNote(
      bumped <= 0
        ? "Hours required set to 0 — task marked Done."
        : `Hours required reduced to ${bumped.toFixed(1)}h.`,
    );
    setDockView({ type: "details" });
    syncSelectedFromSessions(nextSessions);
  }

  function proposeFillBudget(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const placed = placedHoursForTask(taskId, taskSessions);
    const shortfall = Math.round((task.hoursRequired - placed) * 2) / 2;
    if (shortfall <= 0) {
      setDockView({ type: "details" });
      return;
    }
    const fillTask: Task = {
      ...task,
      hoursRequired: shortfall,
      hoursPlaced: 0,
      hoursDone: 0,
    };
    const context = [...usosEvents, ...customEvents, ...taskSessions];
    const proposals = buildProposals(fillTask, context, [], allocationBounds);
    selectEvent(null);
    setModal({ type: "placement", task: fillTask, proposals, fillExisting: true });
    setPreviewSessions(proposalToPreview(proposals[0]));
  }

  function addActivity(draft: {
    title: string;
    isPermanent: boolean;
    recurrence: import("./types").ActivityRecurrence;
    startTime: string;
    endTime: string;
    anchorDate: string;
    weekday: number;
  }) {
    const id = uid("series");
    const series: ActivitySeries = {
      id,
      title: draft.title,
      isPermanent: draft.isPermanent,
      recurrence: draft.recurrence,
      startTime: draft.startTime,
      endTime: draft.endTime,
      anchorDate: draft.anchorDate,
      weekday: draft.weekday,
      biweeklyAnchorMonday: toDateKey(startOfWeekMonday(parseDateKey(draft.anchorDate))),
      exceptions: {},
    };
    setSeriesList((s) => [...s, series]);
    setModal(null);
  }

  function undoToast(toast: SoftMoveToast) {
    setSeriesList((prev) =>
      prev.map((s) => {
        if (s.id !== toast.seriesId) return s;
        const exceptions = { ...s.exceptions };
        delete exceptions[toast.occurrenceDate];
        return { ...s, exceptions };
      }),
    );
    setToasts((t) => t.filter((x) => x.id !== toast.id));
  }

  function applyToastToSeries(toast: SoftMoveToast) {
    const startTime = `${pad2(toast.toStart.getHours())}:${pad2(toast.toStart.getMinutes())}`;
    const endTime = `${pad2(toast.toEnd.getHours())}:${pad2(toast.toEnd.getMinutes())}`;
    setSeriesList((prev) =>
      prev.map((s) =>
        s.id === toast.seriesId
          ? applySeriesTimeChange(s, startTime, endTime, toast.occurrenceDate)
          : s,
      ),
    );
    setToasts((t) => t.filter((x) => x.id !== toast.id));
  }

  return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="relative z-50 shrink-0 border-b border-teal-900/10 bg-white/55 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-emerald-950/50">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl leading-tight tracking-tight text-teal-950 dark:text-teal-50">
                Student Smart Timetable
              </p>
              <p className="text-xs text-teal-900/55 dark:text-teal-100/55">
                Auto-Scheduler · USOS import · deadline-driven placement
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                className="rounded-lg border border-teal-900/10 bg-white/80 p-2 dark:border-white/10 dark:bg-white/5"
                aria-label="Previous week"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="flex items-center gap-1.5 rounded-lg bg-teal-900/5 px-3 py-1.5 text-sm dark:bg-white/5">
                <CalendarDays className="size-4 text-teal-800 dark:text-teal-200" />
                {formatWeekLabel(weekStart)}
              </div>
              <button
                type="button"
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                className="rounded-lg border border-teal-900/10 bg-white/80 p-2 dark:border-white/10 dark:bg-white/5"
                aria-label="Next week"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-900/5 dark:text-teal-200"
              >
                Today
              </button>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-teal-900/10 bg-white/80 px-3 py-1.5 text-sm dark:border-white/10 dark:bg-white/5">
              <span className="font-medium">Highlight Free Slots</span>
              <input
                type="checkbox"
                className="size-4 accent-teal-700"
                checked={highlightFree}
                onChange={(e) => setHighlightFree(e.target.checked)}
              />
            </label>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-800 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 dark:bg-teal-600"
            >
              <Upload className="size-4" /> Import .ics
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onIcsFile(f);
                e.target.value = "";
              }}
            />
            <OptionsMenu bounds={allocationBounds} onChange={setAllocationBounds} />
            <button
              type="button"
              onClick={() => {
                setDark((d) => !d);
                document.documentElement.classList.toggle("dark");
              }}
              className="rounded-lg border border-teal-900/10 bg-white/80 p-2 dark:border-white/10 dark:bg-white/5"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
          {banner && (
            <div className="mx-auto mt-2 max-w-[1600px] rounded-lg bg-teal-800/10 px-3 py-2 text-sm text-teal-950 dark:bg-teal-400/10 dark:text-teal-50">
              {banner}
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => setBanner(null)}
              >
                dismiss
              </button>
            </div>
          )}
        </header>

        <main className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <CalendarGrid
            weekStart={weekStart}
            events={visibleEvents}
            freeSlots={freeSlots}
            highlightFree={highlightFree}
            previewSessions={previewSessions}
            doneEventIds={doneEventIds}
            selectedEventId={selectedEvent?.id}
            onScheduleHere={(slot) => {
              selectEvent(null);
              setModal({ type: "chooser", slot });
            }}
            onEventClick={(ev) => {
              if (modal?.type === "placement" || modal?.type === "conflict") return;
              selectEvent(ev);
            }}
          />
          <div className="min-h-0 rounded-2xl border border-teal-900/10 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-emerald-950/40">
            {dockMode === "placement" && modal?.type === "placement" && (
              <PlacementModal
                proposals={modal.proposals}
                onClose={() => {
                  setModal(null);
                  setPreviewSessions([]);
                }}
                onPreview={(strategy) => {
                  const prop =
                    modal.proposals.find((p) => p.strategy === strategy) ??
                    modal.proposals[0];
                  setPreviewSessions(proposalToPreview(prop));
                }}
                onConfirm={(strategy) => {
                  confirmPlacement(
                    modal.task,
                    strategy,
                    modal.proposals,
                    modal.fillExisting,
                  );
                }}
              />
            )}
            {dockMode === "conflict" && modal?.type === "conflict" && (
              <ConflictModal
                tasks={modal.tasks}
                onClose={() => {
                  setModal(null);
                  setPreviewSessions([]);
                }}
                onHoverPreview={(mode, order) => {
                  const layout = proposeConflictLayouts(
                    modal.tasks,
                    mode,
                    order,
                    [
                      ...usosEvents,
                      ...customEvents,
                      ...taskSessions.filter(
                        (e) => !modal.tasks.some((t) => t.id === e.parentTaskId),
                      ),
                    ],
                    allocationBounds,
                  );
                  setPreviewSessions([
                    ...layout.sessions,
                    ...layout.recoveries.map((r) => ({
                      taskId: r.taskId,
                      title: "Recovery break",
                      start: r.start,
                      end: r.end,
                      sessionIndex: 0,
                      sessionTotal: 0,
                      isPreview: true,
                    })),
                  ]);
                }}
                onConfirm={(mode, order) =>
                  confirmConflict(mode, order, modal.incoming, modal.tasks)
                }
              />
            )}
            {dockMode === "event" && selectedEvent && dockView.type === "details" && (
              <EventDetailsPanel
                event={selectedEvent}
                tasks={tasks}
                seriesList={seriesList}
                sessionIsDone={
                  selectedEvent.source === "SCHEDULED_TASK"
                    ? isSessionDone(selectedEvent)
                    : undefined
                }
                budgetNote={budgetNote}
                onClose={() => selectEvent(null)}
                onToggleSessionDone={handleToggleSessionDone}
                onEdit={beginEditSelected}
                onDelete={beginDeleteSelected}
              />
            )}
            {dockMode === "event" &&
              selectedEvent &&
              dockView.type === "series-scope" &&
              (() => {
                const series = seriesList.find((s) => s.id === selectedEvent.seriesId);
                if (!series) return null;
                return (
                  <SeriesScopePanel
                    action={dockView.action}
                    seriesRecurrence={series.recurrence}
                    onBack={() => setDockView({ type: "details" })}
                    onChoose={(scope) => {
                      if (dockView.action === "edit") {
                        setDockView({ type: "edit-activity", scope });
                      } else if (scope === "occurrence") {
                        const occDate =
                          selectedEvent.exceptionDate ?? toDateKey(selectedEvent.start);
                        setSeriesList((prev) =>
                          prev.map((s) =>
                            s.id === series.id ? cancelOccurrence(s, occDate) : s,
                          ),
                        );
                        selectEvent(null);
                      } else {
                        setDockView({ type: "delete-confirm", scope: "series" });
                      }
                    }}
                  />
                );
              })()}
            {dockMode === "event" &&
              selectedEvent &&
              dockView.type === "edit-activity" && (
                <EditActivityPanel
                  key={`${selectedEvent.id}-${dockView.scope}`}
                  initialTitle={selectedEvent.title}
                  initialDate={toDateKey(selectedEvent.start)}
                  initialStartTime={hhmm(selectedEvent.start)}
                  initialEndTime={hhmm(selectedEvent.end)}
                  scope={dockView.scope}
                  allEvents={allEvents}
                  ignoreEventId={selectedEvent.id}
                  onSave={saveActivityEdit}
                  onBack={() => setDockView({ type: "details" })}
                />
              )}
            {dockMode === "event" &&
              selectedEvent &&
              dockView.type === "edit-session" && (
                <EditActivityPanel
                  key={selectedEvent.id}
                  initialTitle={selectedEvent.title}
                  initialDate={toDateKey(selectedEvent.start)}
                  initialStartTime={hhmm(selectedEvent.start)}
                  initialEndTime={hhmm(selectedEvent.end)}
                  scope="one-time"
                  allEvents={allEvents}
                  ignoreEventId={selectedEvent.id}
                  deadlineDate={
                    tasks.find((t) => t.id === selectedEvent.parentTaskId)?.deadlineDate
                  }
                  onSave={saveSessionEdit}
                  onBack={() => setDockView({ type: "details" })}
                />
              )}
            {dockMode === "event" &&
              selectedEvent &&
              dockView.type === "delete-confirm" && (
                <DeleteConfirmPanel
                  title={
                    dockView.scope === "series"
                      ? "Delete entire series?"
                      : selectedEvent.source === "SCHEDULED_TASK"
                        ? "Delete session?"
                        : "Delete activity?"
                  }
                  description={
                    dockView.scope === "series"
                      ? `Remove all occurrences of “${selectedEvent.title}”.`
                      : selectedEvent.source === "SCHEDULED_TASK"
                        ? `Remove this session from the calendar. You can propose fill-in hours or reduce the task budget afterward if needed.`
                        : `Remove “${selectedEvent.title}” from the calendar.`
                  }
                  onConfirm={confirmDeleteSelected}
                  onBack={() => setDockView({ type: "details" })}
                />
              )}
            {dockMode === "event" && dockView.type === "budget" && (() => {
              const task = tasks.find((t) => t.id === dockView.taskId);
              if (!task) return null;
              const placed = placedHoursForTask(task.id, taskSessions);
              return (
                <BudgetReconcilePanel
                  taskTitle={task.title}
                  hoursPlaced={placed}
                  hoursRequired={task.hoursRequired}
                  shortfallHours={dockView.shortfallHours}
                  onPropose={() => proposeFillBudget(task.id)}
                  onReduce={() => reduceTaskBudget(task.id)}
                  onBack={() => {
                    setDockView({ type: "details" });
                    if (!selectedEvent) {
                      const sess = taskSessions.find(
                        (e) =>
                          e.source === "SCHEDULED_TASK" && e.parentTaskId === task.id,
                      );
                      if (sess) selectEvent(sess);
                    }
                  }}
                />
              );
            })()}
            {!dockMode && (
              <TaskSidebar
                tasks={tasks}
                onStatusChange={handleStatusChange}
                onAddTask={() => {
                  selectEvent(null);
                  setModal({ type: "task" });
                }}
                onAddActivity={() => {
                  selectEvent(null);
                  setModal({ type: "activity" });
                }}
              />
            )}
          </div>
        </main>

        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto rounded-xl border border-teal-900/10 bg-[#f7faf6] p-3 shadow-lg dark:border-white/10 dark:bg-[#12201a]"
            >
              <p className="text-sm font-medium">
                {describeSoftMove(toast.title, toast.toStart)}
              </p>
              <p className="text-xs text-teal-900/55 dark:text-teal-100/55">
                Was {formatTime(toast.fromStart)} · occurrence only
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md bg-teal-900/10 px-2 py-1 text-xs font-semibold"
                  onClick={() => undoToast(toast)}
                >
                  Undo
                </button>
                <button
                  type="button"
                  className="rounded-md bg-violet-700/15 px-2 py-1 text-xs font-semibold text-violet-900 dark:text-violet-200"
                  onClick={() => applyToastToSeries(toast)}
                >
                  Apply to entire series
                </button>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs"
                  onClick={() => setToasts((t) => t.filter((x) => x.id !== toast.id))}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>

        {modal?.type === "task" && (
          <TaskFormModal
            initialSlotStart={modal.slot}
            onClose={() => setModal(null)}
            onSubmit={beginTaskDraft}
          />
        )}
        {modal?.type === "activity" && (
          <ActivityFormModal
            initialSlotStart={modal.slot}
            onClose={() => setModal(null)}
            onSubmit={addActivity}
          />
        )}
        {modal?.type === "chooser" && (
          <ScheduleHereChooser
            onClose={() => setModal(null)}
            onPickTask={() => setModal({ type: "task", slot: modal.slot.start })}
            onPickActivity={() => setModal({ type: "activity", slot: modal.slot.start })}
          />
        )}
        {modal?.type === "reschedule-prompt" && (
          <ReschedulePromptModal
            onDismiss={() => setModal(null)}
            onConfirm={() => {
              setModal(null);
              rebuildSessionsForTasks(tasks);
              setBanner("Other active tasks were rescheduled into the freed gaps.");
            }}
          />
        )}
      </div>
  );
}
