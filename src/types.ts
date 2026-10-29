export type EventSource =
  | "USOS_ICS"
  | "CUSTOM_ACTIVITY"
  | "SCHEDULED_TASK"
  | "RECOVERY_BREAK";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export type ActivityRecurrence = "ONE_TIME" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type AllocationMode = "SEQUENTIAL" | "EVEN_SPLIT";

export type PlacementStrategy = "earliest" | "balanced";

/** Inclusive start hour, exclusive end as wall-clock (e.g. 8–21 → 08:00–21:00). */
export interface DayWindow {
  startHour: number;
  endHour: number;
}

/** When free slots / auto-scheduler may place hours. */
export interface AllocationBounds {
  workweek: DayWindow;
  weekend: DayWindow;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  source: EventSource;
  isPermanent: boolean;
  location?: string;
  parentTaskId?: string;
  sessionIndex?: number;
  sessionTotal?: number;
  /**
   * Session completion override.
   * `true` / `false` = manual; `undefined` = automatic (done when end ≤ now).
   */
  sessionDone?: boolean;
  /** Links occurrence to a custom activity series template */
  seriesId?: string;
  /** Exception override for a single occurrence (ISO date YYYY-MM-DD) */
  exceptionDate?: string;
}

export interface ActivitySeries {
  id: string;
  title: string;
  isPermanent: boolean;
  recurrence: ActivityRecurrence;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
  /** For ONE_TIME / MONTHLY anchor */
  anchorDate: string;
  /** 0=Mon … 6=Sun for WEEKLY/BIWEEKLY */
  weekday?: number;
  /** Monday of creation week (YYYY-MM-DD) for BIWEEKLY anchoring */
  biweeklyAnchorMonday?: string;
  /** Per-date exceptions: cancelled, and/or overridden title/times */
  exceptions: Record<
    string,
    {
      cancelled?: boolean;
      title?: string;
      start?: string;
      end?: string;
    } | undefined
  >;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  isLargeTask: boolean;
  hoursRequired: number;
  deadlineDate: string;
  tieBreakerOrder: number;
  allocationMode: AllocationMode;
  hoursPlaced: number;
  /** Hours from sessions marked done (manual or auto by time). */
  hoursDone: number;
}

export interface FreeSlot {
  start: Date;
  end: Date;
}

export interface PlannedSession {
  taskId: string;
  title: string;
  start: Date;
  end: Date;
  sessionIndex: number;
  sessionTotal: number;
  isPreview?: boolean;
}

export interface PlannedRecovery {
  taskId: string;
  start: Date;
  end: Date;
}

export interface SoftMoveToast {
  id: string;
  seriesId: string;
  occurrenceDate: string;
  title: string;
  fromStart: Date;
  toStart: Date;
  toEnd: Date;
  previousException?: ActivitySeries["exceptions"][string];
}

export interface PlacementProposal {
  strategy: PlacementStrategy;
  label: string;
  sessions: PlannedSession[];
  recoveries: PlannedRecovery[];
  hoursPlaced: number;
  hoursRequested: number;
}
