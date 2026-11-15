import type { Task } from "./api/client";

export interface TaskActions {
  details: (id: string) => void;
  edit: (task: Task) => void;
  delete: (task: Task) => void;
  session: (task: Task) => void;
  status: (task: Task, status: string) => Promise<void>;
}

export function TaskCard(_props: {
  task: Task;
  actions: TaskActions;
  compact?: boolean;
  canEdit?: boolean;
  canSchedule?: boolean;
}) {
  return null;
}

export function Tasks(_props: {
  tasks: Task[];
  actions: TaskActions;
  onAdd: () => void;
  onPlan: () => void;
}) {
  return (
    <div className="p-8 text-center text-slate-500">
      <p className="text-lg font-medium">Modul zadan</p>
      <p className="text-sm">Zarzadzanie zadaniami zostanie wdrozone w MPT-24.</p>
    </div>
  );
}
