import { CheckCircle2, Circle, Clock3, Plus } from "lucide-react";
import type { Task, TaskStatus } from "../types";

const STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To-Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

interface Props {
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAddTask: () => void;
  onAddActivity: () => void;
}

export function TaskSidebar({ tasks, onStatusChange, onAddTask, onAddActivity }: Props) {
  return (
    <aside className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAddTask}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-800 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="size-4" /> Task
        </button>
        <button
          type="button"
          onClick={onAddActivity}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-teal-900/15 bg-white/80 px-3 py-2.5 text-sm font-semibold text-teal-950 transition hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-teal-50 dark:hover:bg-white/10"
        >
          <Plus className="size-4" /> Activity
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {STATUS_ORDER.map((status) => {
          const list = tasks.filter((t) => t.status === status);
          return (
            <section key={status}>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-900/55 dark:text-teal-100/55">
                {status === "TODO" && <Circle className="size-3.5" />}
                {status === "IN_PROGRESS" && <Clock3 className="size-3.5" />}
                {status === "DONE" && <CheckCircle2 className="size-3.5" />}
                {STATUS_LABEL[status]}
                <span className="ml-auto tabular-nums">{list.length}</span>
              </h3>
              <ul className="space-y-2">
                {list.map((task) => {
                  const required = Math.max(task.hoursRequired || 1, 0.01);
                  const doneHrs = task.hoursDone ?? 0;
                  const pct = Math.min(100, Math.round((doneHrs / required) * 100));
                  return (
                    <li
                      key={task.id}
                      className="rounded-xl border border-teal-900/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="font-medium leading-snug">{task.title}</div>
                      <div className="mt-1 text-[11px] text-teal-900/60 dark:text-teal-100/60">
                        Deadline {task.deadlineDate}
                        {` · ${doneHrs.toFixed(1)}/${task.hoursRequired}h done`}
                        {task.hoursPlaced > 0
                          ? ` · ${task.hoursPlaced.toFixed(1)}h scheduled`
                          : ""}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-teal-900/10 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-teal-700 transition-all dark:bg-teal-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {STATUS_ORDER.filter((s) => s !== status).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => onStatusChange(task.id, s)}
                            className="rounded-md bg-teal-900/5 px-2 py-0.5 text-[10px] font-medium text-teal-900/70 hover:bg-teal-900/10 dark:bg-white/5 dark:text-teal-100/70 dark:hover:bg-white/10"
                          >
                            → {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
                {!list.length && (
                  <li className="text-xs text-teal-900/40 dark:text-teal-100/40">None</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
