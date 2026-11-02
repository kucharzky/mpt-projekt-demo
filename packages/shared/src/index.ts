/** Shared domain types for SmartUniPlanner (web + api). */

export type TaskStatus = "todo" | "in_progress" | "done";

export type EventSource = "usos" | "manual" | "scheduler";

export interface TaskDto {
  id: string;
  title: string;
  status: TaskStatus;
  deadline?: string;
  priority?: number;
}

export interface CalendarEventDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  source: EventSource;
  hardLocked: boolean;
}
