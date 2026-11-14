import { Button, SelectField, Input } from "./components/controls";
import { t as tr, locale } from "./i18n";
import {
  Check,
  Circle,
  Pencil,
  Trash2,
  CalendarPlus,
  ArrowDownUp,
  Search,
} from "lucide-react";
import { useState } from "react";
import type { Task } from "./api/client";
import {
  Badge,
  dateKey,
  displayDate,
  duration,
  Empty,
  IconButton,
  importanceNames,
  statusNames,
} from "./ui";

export interface TaskActions {
  details: (id: string) => void;
  edit: (task: Task) => void;
  delete: (task: Task) => void;
  session: (task: Task) => void;
  status: (task: Task, status: string) => Promise<void>;
}
export function TaskCard({
  task,
  actions,
  compact = false,
  canEdit = true,
  canSchedule = canEdit,
}: {
  task: Task;
  actions: TaskActions;
  compact?: boolean;
  canEdit?: boolean;
  canSchedule?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function changeStatus(value: string) {
    if (busy) return;
    setBusy(true);
    try {
      await actions.status(task, value);
    } finally {
      setBusy(false);
    }
  }
  const overdue = task.deadlineDate < dateKey() && task.status !== "DONE";
  return (
    <article
      className={`task-card ${task.status === "DONE" ? "task-complete" : ""}`}
    >
      <div className="task-card-main">
        <Button
          className={`task-check ${task.status === "DONE" ? "checked" : ""}`}
          aria-label={
            task.status === "DONE"
              ? tr("Przywróć: {{value0}}", { value0: task.title })
              : tr("Ukończ: {{value0}}", { value0: task.title })
          }
          disabled={!canEdit || busy}
          onClick={() =>
            void changeStatus(task.status === "DONE" ? "TODO" : "DONE")
          }
        >
          {task.status === "DONE" ? <Check size={15} /> : <Circle size={17} />}
        </Button>
        <Button
          className="task-title-button"
          onClick={() => actions.details(task.id)}
        >
          <strong>{task.title}</strong>
          <span className={overdue ? "overdue" : ""}>
            {overdue ? tr("Po terminie · ") : ""}
            {displayDate(task.deadlineDate)}
            {!compact && ` · ${task.assigneeName}`}
          </span>
        </Button>
        <Badge tone={task.importance === 2 ? "warning" : "neutral"}>
          {importanceNames()[task.importance]}
        </Badge>
      </div>
      <div className="task-progress">
        <span
          style={{
            width: `${task.status === "DONE" ? 100 : Math.min(100, (task.completedMinutes / task.requiredMinutes) * 100)}%`,
          }}
        />
      </div>
      <div className="task-time">
        <span>
          {duration(task.completedMinutes)} / {duration(task.requiredMinutes)}
        </span>
        {task.missingMinutes > 0 && task.status !== "DONE" && (
          <span className="unscheduled">
            {duration(task.missingMinutes)} {tr("do zaplanowania")}{" "}
          </span>
        )}
      </div>
      {!compact && (
        <div className="task-card-footer">
          <SelectField
            aria-label={tr("Status: {{value0}}", { value0: task.title })}
            value={task.status}
            disabled={!canEdit || busy}
            onValueChange={(value) => void changeStatus(value)}
          >
            {Object.entries(statusNames).map(([v, label]) => (
              <option value={v} key={v}>
                {label}
              </option>
            ))}
          </SelectField>
          {canEdit && (
            <div>
              <IconButton
                label={tr("Zaplanuj sesję: {{value0}}", { value0: task.title })}
                disabled={task.status === "DONE" || !canSchedule}
                onClick={() => actions.session(task)}
              >
                <CalendarPlus size={16} />
              </IconButton>
              <IconButton
                label={tr("Edytuj: {{value0}}", { value0: task.title })}
                onClick={() => actions.edit(task)}
              >
                <Pencil size={16} />
              </IconButton>
              <IconButton
                label={tr("Usuń: {{value0}}", { value0: task.title })}
                onClick={() => actions.delete(task)}
              >
                <Trash2 size={16} />
              </IconButton>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
export function Tasks({
  tasks,
  actions,
  onAdd,
  onPlan,
}: {
  tasks: Task[];
  actions: TaskActions;
  onAdd: () => void;
  onPlan: () => void;
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("ALL"),
    [sort, setSort] = useState("deadline"),
    [board, setBoard] = useState(false);
  const list = tasks
    .filter(
      (t) =>
        (status === "ALL" || t.status === status) &&
        t.title
          .toLocaleLowerCase(locale())
          .includes(search.toLocaleLowerCase(locale())),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, locale())
        : sort === "importance"
          ? b.importance - a.importance ||
            a.deadlineDate.localeCompare(b.deadlineDate)
          : a.deadlineDate.localeCompare(b.deadlineDate) ||
            b.importance - a.importance,
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{tr("Twoja praca, dobry rytm")}</span>
          <h1>{tr("Zadania")}</h1>
          <p>
            {tr("Zbierz to, co masz do zrobienia. Czas znajdziemy wspólnie.")}
          </p>
        </div>
        <div className="button-row">
          <Button className="button secondary" onClick={onPlan}>
            {tr("Zaplanuj pracę")}{" "}
          </Button>
          <Button className="button primary" onClick={onAdd}>
            {tr("Dodaj zadanie")}{" "}
          </Button>
        </div>
      </div>
      <div className="filter-bar">
        <label className="search">
          <Search size={17} />
          <Input
            aria-label={tr("Szukaj zadania")}
            placeholder={tr("Szukaj zadania…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <SelectField
          aria-label={tr("Filtruj według statusu")}
          value={status}
          onValueChange={(value) => setStatus(value)}
        >
          <option value="ALL">{tr("Wszystkie statusy")}</option>
          {Object.entries(statusNames).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </SelectField>
        <label className="sort">
          <ArrowDownUp size={16} />
          <SelectField
            aria-label={tr("Sortowanie zadań")}
            value={sort}
            onValueChange={(value) => setSort(value)}
          >
            <option value="deadline">{tr("Według terminu")}</option>
            <option value="importance">{tr("Według ważności")}</option>
            <option value="title">{tr("Alfabetycznie")}</option>
          </SelectField>
        </label>
        <div className="segmented">
          <Button
            className={!board ? "active" : ""}
            onClick={() => setBoard(false)}
          >
            {tr("Lista")}{" "}
          </Button>
          <Button
            className={board ? "active" : ""}
            onClick={() => setBoard(true)}
          >
            {tr("Kanban")}{" "}
          </Button>
        </div>
      </div>
      {!list.length ? (
        <Empty
          title={
            tasks.length
              ? tr("Brak pasujących zadań")
              : tr("Zrób miejsce na swoje cele")
          }
        >
          {tasks.length
            ? tr("Zmień wyszukiwanie lub filtr.")
            : tr(
                "Zacznij od jednego zadania i określ, ile czasu potrzebujesz.",
              )}
        </Empty>
      ) : board ? (
        <div className="kanban">
          {Object.entries(statusNames).map(([value, label]) => (
            <section key={value}>
              <h3>
                {label}
                <Badge>{list.filter((t) => t.status === value).length}</Badge>
              </h3>
              <div className="task-stack">
                {list
                  .filter((t) => t.status === value)
                  .map((t) => (
                    <TaskCard key={t.id} task={t} actions={actions} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="task-list">
          {list.map((t) => (
            <TaskCard key={t.id} task={t} actions={actions} />
          ))}
        </div>
      )}
    </>
  );
}
