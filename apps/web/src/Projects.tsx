import type { Team } from "./api/client";
import type { TaskActions } from "./Tasks";

export function Projects(_props: {
  teams: Team[];
  userId: string;
  zone: string;
  actions: TaskActions;
  onTask: (projectId: string) => void;
  refresh: () => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}) {
  return (
    <div className="p-8 text-center text-slate-500">
      <p className="text-lg font-medium">Projekty zespolowe</p>
      <p className="text-sm">Wspolpraca zespolowa zostanie wdrozone w MPT-32.</p>
    </div>
  );
}
