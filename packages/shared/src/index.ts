/** Shared domain types for SmartUniPlanner (web + api). */

export type TaskStatus = "todo" | "in_progress" | "done";
export type EventSource = "usos" | "manual" | "scheduler";
export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export interface TaskDto {
  id: string;
  title: string;
  status: TaskStatus;
  deadline?: string;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  minSessionMinutes?: number;
  maxSessionMinutes?: number;
}

export interface CalendarEventDto {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  source: EventSource;
  hardLocked: boolean;
}

export interface TaskFilterOptions {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  sortBy?: "deadline" | "priority" | "title";
  sortOrder?: "asc" | "desc";
}

export interface KanbanColumnDto {
  id: TaskStatus;
  title: string;
  taskIds: string[];
}
