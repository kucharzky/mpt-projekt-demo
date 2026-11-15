import { systemMessage } from "./i18n/system";
import {
  Input,
  DateField,
  SelectField,
  Textarea,
  Button,
} from "./components/controls";
import { t as tr, locale } from "./i18n";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Upload,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Check,
  FileText,
  Link as LinkIcon,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import {
  api,
  send,
  ApiError,
  type Activity,
  type CalendarEvent,
  type ImportPreview,
  type PlannerState,
  type Proposal,
  type Task,
  type TaskDetails,
  type Team,
} from "./api/client";
import {
  addDays,
  Badge,
  clock,
  dateKey,
  Dialog,
  displayDate,
  duration,
  Empty,
  Field,
  Form,
  importanceNames,
  recurrenceNames,
  statusNames,
  timeValue,
  minutesValue,
} from "./ui";

type Common = {
  close: () => void;
  done: (message: string, next?: string) => Promise<void>;
};
export function TaskForm({
  task,
  teams,
  userId,
  projectId,
  close,
  done,
}: {
  task?: Task;
  teams: Team[];
  userId: string;
  projectId?: string;
} & Common) {
  const [project, setProject] = useState(task?.projectId ?? projectId ?? "");
  const team = teams.find((t) => t.projects.some((p) => p.id === project)),
    manager = team?.members.find((m) => m.userId === userId)?.role !== "MEMBER";
  return (
    <Dialog
      title={task ? tr("Edytuj zadanie") : tr("Nowe zadanie")}
      subtitle={tr(
        "Określ cel i czas pracy. Planer pomoże znaleźć na niego miejsce.",
      )}
      onClose={close}
    >
      <Form
        cancel={close}
        label={task ? tr("Zapisz zmiany") : tr("Dodaj zadanie")}
        onSubmit={async (f) => {
          const result = await send<Task>(
            task ? `/tasks/${task.id}` : "/tasks",
            {
              title: f.get("title"),
              description: f.get("description"),
              deadlineDate: f.get("deadlineDate"),
              requiredMinutes: Number(f.get("hours")) * 60,
              minSessionMinutes: Number(f.get("min")),
              maxSessionMinutes: Number(f.get("max")),
              importance: Number(f.get("importance")),
              recurrence: f.get("recurrence"),
              ...(project
                ? {
                    projectId: project,
                    assigneeId: String(
                      f.get("assigneeId") || task?.userId || userId,
                    ),
                  }
                : {}),
              ...(task ? { version: task.version } : {}),
            },
            task ? "PATCH" : "POST",
          );
          await done(
            tr("Zapisano zadanie „{{value0}}”.", { value0: result.title }),
            f.has("plan") ? "schedule" : undefined,
          );
        }}
      >
        <Field label={tr("Nazwa zadania")}>
          <Input
            name="title"
            required
            maxLength={180}
            defaultValue={task?.title}
            placeholder={tr("np. Przygotować projekt z baz danych")}
          />
        </Field>
        <div className="form-row">
          <Field label={tr("Termin wykonania")}>
            <DateField
              name="deadlineDate"
              required
              defaultValue={task?.deadlineDate ?? addDays(dateKey(), 7)}
            />
          </Field>
          <Field label={tr("Łączny czas pracy (godz.)")}>
            <Input
              name="hours"
              type="number"
              required
              min="0.5"
              step="0.5"
              max="1000"
              defaultValue={(task?.requiredMinutes ?? 60) / 60}
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label={tr("Minimalna sesja")}>
            <SelectField
              name="min"
              defaultValue={task?.minSessionMinutes ?? 60}
            >
              {[30, 60, 90, 120].map((n) => (
                <option key={n} value={n}>
                  {duration(n)}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label={tr("Maksymalna sesja")}>
            <SelectField
              name="max"
              defaultValue={task?.maxSessionMinutes ?? 120}
            >
              {[30, 60, 90, 120, 180, 240].map((n) => (
                <option key={n} value={n}>
                  {duration(n)}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>
        <div className="form-row">
          <Field
            label={tr("Ważność")}
            hint={tr("Planer najpierw uwzględnia termin, a potem ważność.")}
          >
            <SelectField name="importance" defaultValue={task?.importance ?? 1}>
              {importanceNames().map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label={tr("Powtarzanie po ukończeniu")}>
            <SelectField
              name="recurrence"
              defaultValue={task?.recurrence ?? "NONE"}
            >
              {["NONE", "WEEKLY", "BIWEEKLY", "MONTHLY"].map((v) => (
                <option key={v} value={v}>
                  {recurrenceNames[v]}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>
        <Field label={tr("Projekt")}>
          <SelectField
            value={project}
            onValueChange={(value) => setProject(value)}
            disabled={!!task?.projectId}
          >
            <option value="">{tr("Zadanie osobiste")}</option>
            {teams.flatMap((t) =>
              t.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {t.name} / {p.title}
                </option>
              )),
            )}
          </SelectField>
        </Field>
        {project && (
          <Field label={tr("Osoba odpowiedzialna")}>
            <SelectField
              name="assigneeId"
              defaultValue={task?.userId ?? userId}
              disabled={!manager}
            >
              {team?.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </SelectField>
          </Field>
        )}
        <Field label={tr("Notatki")}>
          <Textarea
            name="description"
            rows={3}
            maxLength={10000}
            defaultValue={task?.description}
            placeholder={tr(
              "Co chcesz zrobić? Linki i materiały dodasz w szczegółach.",
            )}
          />
        </Field>
        {(!project || task?.userId === userId) && (
          <label className="check-row">
            <Input name="plan" type="checkbox" defaultChecked={!task} />
            <span>{tr("Pokaż propozycje planu po zapisaniu")}</span>
          </label>
        )}
      </Form>
    </Dialog>
  );
}

export function ActivityForm({
  event,
  initialDate,
  initialTime,
  zone,
  close,
  done,
}: {
  event?: CalendarEvent;
  initialDate?: string;
  initialTime?: string;
  zone: string;
} & Common) {
  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity", event?.activityId],
    queryFn: () => api<Activity>(`/activities/${event!.activityId}`),
    enabled: !!event?.activityId,
  });
  const [scope, setScope] = useState<"choose" | "occurrence" | "series">(
      event ? "choose" : "series",
    ),
    [overlap, setOverlap] = useState(false);
  if (event && isLoading)
    return (
      <Dialog title={tr("Wczytywanie aktywności")} onClose={close}>
        <p>{tr("Chwila…")}</p>
      </Dialog>
    );
  if (event && activity?.recurrence !== "ONE_TIME" && scope === "choose")
    return (
      <Dialog
        title={tr("Co chcesz zmienić?")}
        subtitle={event.title}
        onClose={close}
      >
        <div className="choice-list">
          <Button className="choice" onClick={() => setScope("occurrence")}>
            <CalendarDays />
            <span>
              <strong>{tr("Tylko to wystąpienie")}</strong>
              <small>{displayDate(event.occurrenceDate!)}</small>
            </span>
          </Button>
          <Button className="choice" onClick={() => setScope("series")}>
            <CalendarDays />
            <span>
              <strong>{tr("Całą serię")}</strong>
              <small>
                {tr("Zmieni wzorzec i wyczyści wyjątki wystąpień.")}
              </small>
            </span>
          </Button>
        </div>
      </Dialog>
    );
  const occurrence =
    event && activity?.recurrence !== "ONE_TIME" && scope === "occurrence";
  const date = occurrence
    ? dateKey(new Date(event.start), zone)
    : (activity?.anchorDate ?? initialDate ?? dateKey(new Date(), zone));
  const start = occurrence
      ? clock(event.start, zone)
      : (activity?.startTime ?? initialTime ?? "09:00"),
    end = occurrence
      ? clock(event.end, zone)
      : (activity?.endTime ?? timeValue((minutesValue(start) + 60) % 1440));
  return (
    <Dialog
      title={event ? tr("Edytuj aktywność") : tr("Nowa aktywność")}
      subtitle={
        occurrence
          ? tr("Zmieniasz tylko jedno wystąpienie.")
          : tr(
              "Zajęcia, trening, praca — znajdź miejsce na swoje zobowiązania.",
            )
      }
      onClose={close}
    >
      <Form
        cancel={close}
        label={tr("Zapisz aktywność")}
        onError={(e) => {
          if (e instanceof ApiError && e.code === "CALENDAR_OVERLAP")
            setOverlap(true);
        }}
        onSubmit={async (f) => {
          const common = {
            title: String(f.get("title")),
            startTime: String(f.get("startTime")),
            endTime: String(f.get("endTime")),
            allowConflict: f.has("allowConflict"),
          };
          if (occurrence)
            await send(
              `/activities/${activity!.id}/occurrences/${event.occurrenceDate}`,
              { ...common, date: f.get("date"), version: activity!.version },
              "PATCH",
            );
          else
            await send(
              activity ? `/activities/${activity.id}` : "/activities",
              {
                ...common,
                anchorDate: f.get("date"),
                recurrence: f.get("recurrence"),
                isPermanent: f.has("permanent"),
                location: f.get("location") ?? "",
                ...(f.get("untilDate")
                  ? { untilDate: f.get("untilDate") }
                  : {}),
                ...(activity ? { version: activity.version } : {}),
              },
              activity ? "PATCH" : "POST",
            );
          await done(tr("Aktywność została zapisana."));
        }}
      >
        <Field label={tr("Nazwa")}>
          <Input
            name="title"
            required
            maxLength={180}
            defaultValue={occurrence ? event.title : activity?.title}
            placeholder={tr("np. Trening, praca, nauka języka")}
          />
        </Field>
        <Field
          label={
            occurrence
              ? tr("Data wystąpienia")
              : tr("Data pierwszego wystąpienia")
          }
        >
          <DateField name="date" required defaultValue={date} />
        </Field>
        <div className="form-row">
          <Field label={tr("Początek")}>
            <Input
              name="startTime"
              type="time"
              required
              step={900}
              defaultValue={start}
            />
          </Field>
          <Field label={tr("Koniec")}>
            <Input
              name="endTime"
              type="time"
              required
              step={900}
              defaultValue={end}
            />
          </Field>
        </div>
        <small className="muted">
          {tr(
            "Godzina końca wcześniejsza niż początek oznacza następny dzień. Strefa:",
          )}{" "}
          {occurrence ? zone : (activity?.timezone ?? zone)}.
        </small>
        {!occurrence && (
          <>
            <div className="form-row">
              <Field label={tr("Powtarzanie")}>
                <SelectField
                  name="recurrence"
                  defaultValue={activity?.recurrence ?? "ONE_TIME"}
                >
                  {["ONE_TIME", "WEEKLY", "BIWEEKLY", "MONTHLY"].map((v) => (
                    <option key={v} value={v}>
                      {recurrenceNames[v]}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field label={tr("Powtarzaj do (opcjonalnie)")}>
                <DateField
                  name="untilDate"

                  defaultValue={activity?.untilDate ?? ""}
                />
              </Field>
            </div>
            <Field label={tr("Miejsce")}>
              <Input
                name="location"
                maxLength={300}
                defaultValue={activity?.location}
                placeholder={tr("np. Biblioteka, sala D-17")}
              />
            </Field>
            <label className="check-row">
              <Input
                name="permanent"
                type="checkbox"
                defaultChecked={activity?.isPermanent ?? true}
              />
              <span>
                <strong>{tr("Stała aktywność")}</strong>
                <small>
                  {tr(
                    "Planer nigdy jej nie przesunie. Wyłącz dla elastycznej aktywności.",
                  )}{" "}
                </small>
              </span>
            </label>
          </>
        )}
        {overlap && (
          <label className="check-row warning">
            <Input type="checkbox" name="allowConflict" />
            <span>{tr("Rozumiem kolizję i chcę zapisać ten termin.")}</span>
          </label>
        )}
      </Form>
    </Dialog>
  );
}

export function SessionForm({
  task,
  event,
  zone,
  close,
  done,
}: { task: Task; event?: CalendarEvent; zone: string } & Common) {
  const [overlap, setOverlap] = useState(false);
  return (
    <Dialog
      title={event ? tr("Edytuj sesję") : tr("Zaplanuj sesję ręcznie")}
      subtitle={task.title}
      onClose={close}
    >
      <Form
        cancel={close}
        label={tr("Zapisz sesję")}
        onError={(e) => {
          if (e instanceof ApiError && e.code === "CALENDAR_OVERLAP")
            setOverlap(true);
        }}
        onSubmit={async (f) => {
          await send(
            event ? `/task-sessions/${event.id}` : `/tasks/${task.id}/sessions`,
            {
              title: task.title,
              date: f.get("date"),
              startTime: f.get("startTime"),
              endTime: f.get("endTime"),
              pinned: f.has("pinned"),
              status: f.get("status"),
              version: event?.version ?? 0,
              allowConflict: f.has("allowConflict"),
            },
            event ? "PATCH" : "POST",
          );
          await done(tr("Sesja została zapisana."));
        }}
      >
        <Field label={tr("Data")}>
          <DateField
            name="date"

            required
            defaultValue={
              event
                ? dateKey(new Date(event.start), zone)
                : dateKey(new Date(), zone)
            }
          />
        </Field>
        <div className="form-row">
          <Field label={tr("Od")}>
            <Input
              name="startTime"
              type="time"
              required
              step={900}
              defaultValue={event ? clock(event.start, zone) : "14:00"}
            />
          </Field>
          <Field label={tr("Do")}>
            <Input
              name="endTime"
              type="time"
              required
              step={900}
              defaultValue={event ? clock(event.end, zone) : "15:00"}
            />
          </Field>
        </div>
        <Field label={tr("Realizacja")}>
          <SelectField name="status" defaultValue={event?.status ?? "PLANNED"}>
            <option value="PLANNED">
              {tr("Zaplanowana — jeszcze nie potwierdzam wykonania")}{" "}
            </option>
            <option value="COMPLETED">{tr("Wykonana")}</option>
            <option value="MISSED">
              {tr("Pominięta — czas do przeplanowania")}
            </option>
          </SelectField>
        </Field>
        <label className="check-row">
          <Input
            name="pinned"
            type="checkbox"
            defaultChecked={event?.pinned ?? true}
          />
          <span>
            <strong>{tr("Zablokuj ten termin")}</strong>
            <small>{tr("Planer pozostawi sesję na miejscu.")}</small>
          </span>
        </label>
        <p className="muted">
          {tr("Termin zadania:")} {displayDate(task.deadlineDate)}
          {tr(
            ". Zmiana długości sesji może zmienić rozliczenie czasu zadania.",
          )}{" "}
        </p>
        {overlap && (
          <label className="check-row warning">
            <Input name="allowConflict" type="checkbox" />
            <span>{tr("Świadomie akceptuję nakładanie się wydarzeń.")}</span>
          </label>
        )}
      </Form>
    </Dialog>
  );
}

export function ScheduleForm({
  state,
  onPreview,
  onConfirm,
  close,
  done,
}: {
  state: PlannerState;
  onPreview: (proposal: Proposal | null) => void;
  onConfirm: (id: string) => void;
} & Common) {
  const [mode, setMode] = useState("SEQUENTIAL"),
    [order, setOrder] = useState<string[]>(
      state.tasks.filter((t) => t.status !== "DONE").map((t) => t.id),
    ),
    [choice, setChoice] = useState(0);
  const {
    data: proposals,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["proposals", mode, order],
    queryFn: () =>
      send<Proposal[]>("/scheduler/proposals", { allocationMode: mode, order }),
    staleTime: 0,
    retry: false,
  });
  const [overrides, setOverrides] = useState<Record<string, Proposal>>({});
  const [editId, setEditId] = useState("");
  const original = proposals?.[choice],
    selected = original ? (overrides[original.id] ?? original) : undefined;
  const editSession =
    selected?.sessions.find((s) => s.id === editId) ??
    selected?.sessions.find((s) => s.kind === "WORK");
  useEffect(() => {
    onPreview(selected ?? null);
    return () => onPreview(null);
  }, [selected, onPreview]);
  const tied = state.tasks.filter(
    (t) =>
      t.status !== "DONE" &&
      state.tasks.some(
        (o) =>
          o.id !== t.id &&
          o.status !== "DONE" &&
          o.deadlineDate === t.deadlineDate,
      ),
  );
  const move = (id: string, direction: number) =>
    setOrder((old) => {
      const copy = [...old],
        i = copy.indexOf(id),
        j = i + direction;
      if (j < 0 || j >= copy.length) return old;
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  return (
    <Dialog
      title={tr("Zaplanuj czas na to, co ważne")}
      subtitle={tr(
        "Porównaj propozycje. Zmiany trafią do kalendarza dopiero po Twojej akceptacji.",
      )}
      onClose={close}
      wide
    >
      {!!tied.length && (
        <section className="section-block">
          <h3>{tr("Wspólne terminy zadań")}</h3>
          <p className="muted">
            {tr(
              "Ustal kolejność zadań z tym samym terminem lub rozdziel sesje naprzemiennie.",
            )}{" "}
          </p>
          <div className="segmented">
            <Button
              className={mode === "SEQUENTIAL" ? "active" : ""}
              onClick={() => setMode("SEQUENTIAL")}
            >
              {tr("Według kolejności")}{" "}
            </Button>
            <Button
              className={mode === "EVEN_SPLIT" ? "active" : ""}
              onClick={() => setMode("EVEN_SPLIT")}
            >
              {tr("Naprzemiennie")}{" "}
            </Button>
          </div>
          <div className="priority-list">
            {order
              .map((id) => state.tasks.find((t) => t.id === id)!)
              .filter((t) => t && tied.some((x) => x.id === t.id))
              .map((t) => (
                <div key={t.id}>
                  <span>
                    {t.title}
                    <small>{displayDate(t.deadlineDate)}</small>
                  </span>
                  <Button
                    className="icon-button"
                    aria-label={tr("Wyżej: {{value0}}", { value0: t.title })}
                    onClick={() => move(t.id, -1)}
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    className="icon-button"
                    aria-label={tr("Niżej: {{value0}}", { value0: t.title })}
                    onClick={() => move(t.id, 1)}
                  >
                    <ArrowDown size={15} />
                  </Button>
                </div>
              ))}
          </div>
        </section>
      )}
      {isLoading ? (
        <div className="loading">{tr("Szukam dobrego rozkładu sesji…")}</div>
      ) : error ? (
        <div role="alert" className="inline-error">
          {error.message}
          <Button className="text-button" onClick={() => void refetch()}>
            {tr("Spróbuj ponownie")}{" "}
          </Button>
        </div>
      ) : (
        selected && (
          <>
            <div className="proposal-choices">
              {proposals?.map((p, i) => (
                <Button
                  className={`proposal-choice ${choice === i ? "selected" : ""}`}
                  key={p.id}
                  onClick={() => setChoice(i)}
                >
                  <span>
                    {i === 0 ? (
                      <CalendarDays size={20} />
                    ) : (
                      <Sparkles size={20} />
                    )}
                  </span>
                  <strong>
                    {i === 0
                      ? tr("Najbliższe wolne terminy")
                      : tr("Równomiernie w ciągu dni")}
                  </strong>
                  <small>
                    {i === 0
                      ? tr("Szybciej zrobione, spokojniejsza głowa.")
                      : tr("Więcej równowagi między dniami.")}
                  </small>
                  <b>
                    {duration(p.totals.reduce((s, t) => s + t.placed, 0))}{" "}
                    {tr("zaplanowano")}{" "}
                  </b>
                </Button>
              ))}
            </div>
            <div className="plan-totals">
              {selected.totals.map((t) => (
                <div key={t.taskId}>
                  <span>{t.title}</span>
                  <strong>
                    {duration(t.placed)} / {duration(t.requested)}
                  </strong>
                  {t.missing > 0 && (
                    <Badge tone="warning">
                      {tr("Brakuje")} {duration(t.missing)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            {selected.totals.some((t) => t.missing > 0) && (
              <p role="status" className="notice warning">
                {tr(
                  "Przed terminem nie ma miejsca na całą pracę. Możesz zaakceptować częściowy plan, zwolnić czas lub zmienić czas potrzebny na zadania.",
                )}{" "}
              </p>
            )}
            {selected.moves.length > 0 && (
              <section className="section-block">
                <h3>{tr("Przesunięcia elastycznych aktywności")}</h3>
                {selected.moves.map((m, i) => (
                  <p key={i}>
                    {m.title}:{" "}
                    {displayDate(
                      dateKey(new Date(m.from), state.user.timezone),
                    )}{" "}
                    {clock(m.from, state.user.timezone)} →{" "}
                    {displayDate(
                      dateKey(new Date(m.start), state.user.timezone),
                    )}{" "}
                    {clock(m.start, state.user.timezone)}
                  </p>
                ))}
              </section>
            )}
            <details className="section-block">
              <summary>
                {tr("Wszystkie sesje i przerwy (")}
                {selected.sessions.length})
              </summary>
              <div className="session-list">
                {selected.sessions.map((s) => (
                  <div key={s.id}>
                    <span>{s.title}</span>
                    <small>
                      {displayDate(
                        dateKey(new Date(s.start), state.user.timezone),
                      )}{" "}
                      · {clock(s.start, state.user.timezone)}–
                      {clock(s.end, state.user.timezone)}
                    </small>
                  </div>
                ))}
              </div>
            </details>
            <details className="section-block">
              <summary>{tr("Zmień termin sesji w tej propozycji")}</summary>
              {editSession && (
                <Form
                  key={editSession.id + editSession.start}
                  cancel={close}
                  label={tr("Zmień termin w podglądzie")}
                  onSubmit={async (f) => {
                    const edited = await send<Proposal>(
                      `/scheduler/proposals/${selected.id}/sessions/${editSession.id}`,
                      {
                        date: f.get("date"),
                        startTime: f.get("startTime"),
                        endTime: f.get("endTime"),
                      },
                      "PATCH",
                    );
                    setOverrides((old) => ({ ...old, [selected.id]: edited }));
                  }}
                >
                  <Field label={tr("Sesja")}>
                    <SelectField
                      value={editSession.id}
                      onValueChange={(value) => setEditId(value)}
                    >
                      {selected.sessions
                        .filter((s) => s.kind === "WORK")
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title} ·{" "}
                            {displayDate(
                              dateKey(new Date(s.start), state.user.timezone),
                            )}{" "}
                            {clock(s.start, state.user.timezone)}
                          </option>
                        ))}
                    </SelectField>
                  </Field>
                  <Field label={tr("Nowa data")}>
                    <DateField
                      name="date"

                      required
                      defaultValue={dateKey(
                        new Date(editSession.start),
                        state.user.timezone,
                      )}
                    />
                  </Field>
                  <div className="form-row">
                    <Field label={tr("Początek")}>
                      <Input
                        name="startTime"
                        type="time"
                        required
                        defaultValue={clock(
                          editSession.start,
                          state.user.timezone,
                        )}
                      />
                    </Field>
                    <Field label={tr("Koniec")}>
                      <Input
                        name="endTime"
                        type="time"
                        required
                        defaultValue={clock(
                          editSession.end,
                          state.user.timezone,
                        )}
                      />
                    </Field>
                  </div>
                  <p className="muted">
                    {tr(
                      "Zachowaj długość sesji. Sprawdzimy kolizje, termin, godziny pracy i dzienny limit.",
                    )}{" "}
                  </p>
                </Form>
              )}
            </details>
            <Form
              cancel={close}
              label={tr("Zaakceptuj ten plan")}
              disabled={!selected.sessions.length && !selected.moves.length}
              onSubmit={async () => {
                await send(`/scheduler/proposals/${selected.id}/confirm`);
                onConfirm(selected.id);
                await done(
                  tr(
                    "Plan zapisany. Możesz cofnąć tę zmianę, dopóki nie wprowadzisz kolejnych zmian.",
                  ),
                );
              }}
            >
              <p className="muted">
                {tr(
                  "Zachowujemy wykonane i zablokowane sesje. Pozostałe przyszłe sesje mogą otrzymać nowe terminy.",
                )}{" "}
              </p>
            </Form>
          </>
        )
      )}
    </Dialog>
  );
}

function sampleIcs() {
  const from = dateKey();
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SmartUniPlanner Sample//PL\r\n${[0, 1, 2].map((n) => `BEGIN:VEVENT\r\nUID:smartuni-sample-${n}\r\nDTSTART;TZID=Europe/Warsaw:${addDays(from, n).replaceAll("-", "")}T100000\r\nDTEND;TZID=Europe/Warsaw:${addDays(from, n).replaceAll("-", "")}T113000\r\nSUMMARY:${[tr("Bazy danych"), tr("Analiza matematyczna"), tr("Inżynieria oprogramowania")][n]}\r\nLOCATION:Sala ${n + 101}\r\nEND:VEVENT\r\n`).join("")}END:VCALENDAR\r\n`;
}
export function ImportForm({ close, done, zone }: { zone: string } & Common) {
  const [file, setFile] = useState<{ name: string; content: string } | null>(
      null,
    ),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [fileError, setFileError] = useState("");
  async function read(file?: File) {
    if (!file) return;
    setFileError("");
    if (file.size > 2_000_000) {
      setFileError(tr("Plik może mieć maksymalnie 2 MB."));
      return;
    }
    try {
      setFile({ name: file.name, content: await file.text() });
    } catch {
      setFileError(tr("Nie udało się odczytać pliku."));
    }
  }
  return (
    <Dialog
      title={tr("Twój plan z USOS")}
      subtitle={tr(
        "Wczytaj eksport .ics. Zajęcia staną się stałymi wydarzeniami w Twoim kalendarzu.",
      )}
      onClose={close}
    >
      {preview ? (
        <Form
          cancel={() => setPreview(null)}
          label={tr("Zatwierdź import")}
          onSubmit={async () => {
            await send(`/imports/${preview.id}/commit`);
            await done(
              tr(
                "Plan zajęć został zaimportowany. Istniejące sesje pozostają na miejscu — sprawdź ewentualne kolizje.",
              ),
            );
          }}
        >
          <div className="import-summary">
            <div>
              <strong>{preview.added}</strong>
              <span>{tr("nowych")}</span>
            </div>
            <div>
              <strong>{preview.updated}</strong>
              <span>{tr("zmienionych")}</span>
            </div>
            <div>
              <strong>{preview.unchanged}</strong>
              <span>{tr("bez zmian")}</span>
            </div>
            <div>
              <strong>{preview.removed}</strong>
              <span>{tr("do usunięcia")}</span>
            </div>
          </div>
          {preview.warnings.map((w, i) => (
            <p className="notice warning" key={i}>
              {systemMessage(w)}
            </p>
          ))}
          <div className="session-list">
            {preview.events.slice(0, 8).map((e, i) => (
              <div key={i}>
                <span>{e.title}</span>
                <small>{displayDate(dateKey(new Date(e.start), zone))}</small>
              </div>
            ))}
          </div>
          {preview.events.length > 8 && (
            <p className="muted">
              {tr("Pozostałe wydarzenia: {{count}}", {
                count: preview.events.length - 8,
              })}{" "}
            </p>
          )}
        </Form>
      ) : (
        <Form
          cancel={close}
          label={tr("Sprawdź plik")}
          disabled={!file}
          onSubmit={async (f) => {
            setPreview(
              await send<ImportPreview>("/imports/usos/preview", {
                ...file,
                from: f.get("from"),
                to: f.get("to"),
                replace: f.has("replace"),
              }),
            );
          }}
        >
          <label
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void read(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={28} />
            <strong>
              {file ? file.name : tr("Wybierz lub przeciągnij plik .ics")}
            </strong>
            <span>{tr("Do 2 MB · eksport kalendarza z USOS AGH")}</span>
            <Input
              type="file"
              accept=".ics,text/calendar"
              aria-label={tr("Plik ICS")}
              onChange={(e) => void read(e.target.files?.[0])}
            />
          </label>
          {fileError && (
            <p className="inline-error" role="alert">
              {systemMessage(fileError)}
            </p>
          )}
          <Button
            className="text-button"
            type="button"
            onClick={() =>
              setFile({ name: "przykladowy-plan.ics", content: sampleIcs() })
            }
          >
            {tr("Wypróbuj przykładowy plan zajęć")}{" "}
          </Button>
          <div className="form-row">
            <Field label={tr("Importuj od")}>
              <DateField
                name="from"

                required
                defaultValue={dateKey(new Date(), zone).slice(0, 8) + "01"}
              />
            </Field>
            <Field label={tr("Do (bez tego dnia)")}>
              <DateField
                name="to"

                required
                defaultValue={addDays(dateKey(new Date(), zone), 180)}
              />
            </Field>
          </div>
          <label className="check-row">
            <Input type="checkbox" name="replace" />
            <span>
              <strong>{tr("Zastąp zajęcia w tym zakresie")}</strong>
              <small>
                {tr(
                  "Usunie stare zajęcia USOS nieobecne w pliku. Własne aktywności i sesje zostają.",
                )}{" "}
              </small>
            </span>
          </label>
        </Form>
      )}
    </Dialog>
  );
}

export function SettingsForm({
  state,
  close,
  done,
}: { state: PlannerState } & Common) {
  return (
    <Dialog
      title={tr("Twój rytm pracy")}
      subtitle={tr(
        "Planer uwzględni te ustawienia przy tworzeniu nowych propozycji.",
      )}
      onClose={close}
    >
      <Form
        cancel={close}
        label={tr("Zapisz ustawienia")}
        onSubmit={async (f) => {
          const payload = Object.fromEntries(
            ["workStart", "workEnd", "weekendStart", "weekendEnd"].map(
              (key) => [key, minutesValue(String(f.get(key)))],
            ),
          );
          await send(
            "/me/preferences",
            {
              ...payload,
              timezone: f.get("timezone"),
              dailyLimit: Number(f.get("dailyLimit")) * 60,
              buffer: Number(f.get("buffer")),
              recovery: Number(f.get("recovery")),
              revision: state.revision,
            },
            "PATCH",
          );
          await done(
            tr(
              "Ustawienia zapisane. Dotychczasowy plan nie został automatycznie zmieniony.",
            ),
          );
        }}
      >
        <Field label={tr("Strefa czasowa")}>
          <SelectField name="timezone" defaultValue={state.user.timezone}>
            {[
              "Europe/Warsaw",
              "Europe/London",
              "UTC",
              "America/New_York",
              "Asia/Tokyo",
            ].map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </SelectField>
        </Field>
        <fieldset>
          <legend>{tr("Poniedziałek – piątek")}</legend>
          <div className="form-row">
            <Field label={tr("Od")}>
              <Input
                name="workStart"
                type="time"
                required
                defaultValue={timeValue(state.preferences.workStart)}
              />
            </Field>
            <Field label={tr("Do")}>
              <Input
                name="workEnd"
                type="time"
                required
                defaultValue={timeValue(state.preferences.workEnd)}
              />
            </Field>
          </div>
        </fieldset>
        <fieldset>
          <legend>{tr("Weekend")}</legend>
          <div className="form-row">
            <Field label={tr("Od")}>
              <Input
                name="weekendStart"
                type="time"
                required
                defaultValue={timeValue(state.preferences.weekendStart)}
              />
            </Field>
            <Field label={tr("Do")}>
              <Input
                name="weekendEnd"
                type="time"
                required
                defaultValue={timeValue(state.preferences.weekendEnd)}
              />
            </Field>
          </div>
          <small>
            {tr("Równe godziny oznaczają brak planowania w weekend.")}
          </small>
        </fieldset>
        <Field label={tr("Maksymalnie godzin zadań dziennie")}>
          <Input
            name="dailyLimit"
            type="number"
            min="0.5"
            max="12"
            step="0.5"
            required
            defaultValue={state.preferences.dailyLimit / 60}
          />
        </Field>
        <div className="form-row">
          <Field label={tr("Odstęp między zajęciami (min)")}>
            <Input
              name="buffer"
              type="number"
              min="0"
              max="60"
              required
              defaultValue={state.preferences.buffer}
            />
          </Field>
          <Field label={tr("Przerwa po dwóch sesjach (min)")}>
            <Input
              name="recovery"
              type="number"
              min="0"
              max="120"
              required
              defaultValue={state.preferences.recovery}
            />
          </Field>
        </div>
      </Form>
    </Dialog>
  );
}

export function TaskDetail({
  id,
  userId,
  onEdit,
  onSession,
  canEdit,
  close,
  done,
}: {
  id: string;
  userId: string;
  onEdit: (task: Task) => void;
  onSession: (task: Task) => void;
  canEdit: (task: Task) => boolean;
} & Common) {
  const {
    data: task,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["task", id],
    queryFn: () => api<TaskDetails>(`/tasks/${id}`),
  });
  const [tab, setTab] = useState("notes"),
    [mutationError, setMutationError] = useState("");
  return (
    <Dialog title={task?.title ?? tr("Szczegóły zadania")} onClose={close}>
      {isLoading ? (
        <p>{tr("Wczytywanie…")}</p>
      ) : error ? (
        <p role="alert">{error.message}</p>
      ) : (
        task && (
          <>
            <div className="detail-meta">
              <Badge tone={task.status === "DONE" ? "success" : "neutral"}>
                {statusNames[task.status]}
              </Badge>
              <span>
                {tr("Do")} {displayDate(task.deadlineDate)}
              </span>
              <span>
                {importanceNames()[task.importance]} {tr("priorytet")}
              </span>
            </div>
            <div className="progress-large">
              <div
                style={{
                  width: `${task.status === "DONE" ? 100 : Math.min(100, (task.completedMinutes / task.requiredMinutes) * 100)}%`,
                }}
              />
            </div>
            <p>
              {duration(task.completedMinutes)} {tr("wykonano ·")}{" "}
              {duration(task.plannedMinutes)} {tr("zaplanowano · cel")}{" "}
              {duration(task.requiredMinutes)}
            </p>
            <div className="button-row">
              {canEdit(task) && (
                <Button
                  className="button secondary"
                  onClick={() => onEdit(task)}
                >
                  {tr("Edytuj zadanie")}{" "}
                </Button>
              )}
              {task.userId === userId && task.status !== "DONE" && (
                <Button
                  className="button secondary"
                  onClick={() => onSession(task)}
                >
                  <CalendarDays size={16} /> {tr("Dodaj sesję")}{" "}
                </Button>
              )}
            </div>
            <div className="segmented tabs">
              <Button
                className={tab === "notes" ? "active" : ""}
                onClick={() => setTab("notes")}
              >
                <FileText size={15} /> {tr("Notatki")}{" "}
              </Button>
              <Button
                className={tab === "materials" ? "active" : ""}
                onClick={() => setTab("materials")}
              >
                <LinkIcon size={15} /> {tr("Materiały")}{" "}
              </Button>
              <Button
                className={tab === "comments" ? "active" : ""}
                onClick={() => setTab("comments")}
              >
                <MessageCircle size={15} /> {tr("Komentarze (")}
                {task.comments.length})
              </Button>
            </div>
            {tab === "notes" &&
              (task.description ? (
                <p className="notes-text">{task.description}</p>
              ) : (
                <Empty title={tr("Miejsce na notatki")}>
                  {tr("Dodaj opis podczas edycji zadania.")}{" "}
                </Empty>
              ))}
            {tab === "materials" && (
              <>
                <div className="resource-list">
                  {task.resources.map((r) => (
                    <div key={r.id}>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        <ExternalLink size={15} />
                        {r.title}
                      </a>
                    </div>
                  ))}
                </div>
                {canEdit(task) && (
                  <Form
                    label={tr("Dodaj materiał")}
                    cancel={close}
                    onSubmit={async (f) => {
                      await send(`/tasks/${id}/resources`, {
                        title: f.get("title"),
                        url: f.get("url"),
                      });
                      await refetch();
                    }}
                  >
                    <Field label={tr("Tytuł materiału")}>
                      <Input name="title" required maxLength={180} />
                    </Field>
                    <Field label={tr("Link")}>
                      <Input
                        name="url"
                        required
                        type="url"
                        placeholder={tr("https://…")}
                      />
                    </Field>
                  </Form>
                )}
              </>
            )}
            {tab === "comments" && (
              <>
                <div className="comments">
                  {task.comments.map((c) => (
                    <article key={c.id}>
                      <strong>{c.author}</strong>
                      <small>
                        {new Date(c.createdAt).toLocaleString(locale())}
                      </small>
                      <p>{c.body}</p>
                    </article>
                  ))}
                </div>
                <Form
                  label={tr("Dodaj komentarz")}
                  cancel={close}
                  onSubmit={async (f) => {
                    await send(`/tasks/${id}/comments`, {
                      body: f.get("body"),
                    });
                    await refetch();
                  }}
                >
                  <Field label={tr("Komentarz")}>
                    <Textarea name="body" required maxLength={4000} rows={3} />
                  </Field>
                </Form>
              </>
            )}
            {mutationError && (
              <p role="alert" className="inline-error">
                {mutationError}
              </p>
            )}
            {canEdit(task) && (
              <Button
                className="button primary full-width"
                onClick={() =>
                  void send(`/tasks/${id}/status`, {
                    status: task.status === "DONE" ? "TODO" : "DONE",
                    version: task.version,
                  })
                    .then(() =>
                      done(
                        task.status === "DONE"
                          ? tr("Zadanie przywrócone.")
                          : tr("Zadanie ukończone."),
                      ),
                    )
                    .catch((error) =>
                      setMutationError(
                        error instanceof Error
                          ? error.message
                          : tr("Nie udało się zmienić statusu."),
                      ),
                    )
                }
              >
                <Check size={16} />
                {task.status === "DONE"
                  ? tr("Przywróć do zrobienia")
                  : tr("Oznacz jako ukończone")}
              </Button>
            )}
          </>
        )
      )}
    </Dialog>
  );
}

export function EventDetails({
  event,
  zone,
  onEdit,
  onDelete,
  onTask,
  close,
}: {
  event: CalendarEvent;
  zone: string;
  onEdit: () => void;
  onDelete: () => void;
  onTask: (id: string) => void;
  close: () => void;
}) {
  return (
    <Dialog
      title={
        event.source === "RECOVERY_BREAK"
          ? tr("Przerwa regeneracyjna")
          : event.title
      }
      onClose={close}
    >
      <div className="event-detail-time">
        <CalendarDays size={22} />
        <div>
          <strong>
            {displayDate(dateKey(new Date(event.start), zone), {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </strong>
          <p>
            {clock(event.start, zone)} – {clock(event.end, zone)} ·{" "}
            {duration((+new Date(event.end) - +new Date(event.start)) / 60000)}
          </p>
        </div>
      </div>
      {event.location && <p>{event.location}</p>}
      <p className="notice">
        {event.source === "USOS_ICS"
          ? tr(
              "Zajęcia z USOS. Planer nigdy ich nie przesunie. Aktualizuj je przez ponowny import.",
            )
          : event.source === "RECOVERY_BREAK"
            ? tr(
                "Przerwa wyliczona przez planer. Zmieni się przy ponownym planowaniu.",
              )
            : event.source === "TEAM_MEETING"
              ? tr(
                  "Potwierdzone spotkanie zespołu. Zarządzaj nim w zakładce zespołu.",
                )
              : event.pinned
                ? tr(
                    "Ta sesja jest zablokowana i pozostanie na miejscu podczas planowania.",
                  )
                : event.isPermanent
                  ? tr("Stała aktywność. Planer nie może jej przesunąć.")
                  : tr(
                      "Elastyczny termin, który może zostać uwzględniony w nowej propozycji.",
                    )}
      </p>
      {event.status && (
        <Badge
          tone={
            event.status === "COMPLETED"
              ? "success"
              : event.status === "MISSED"
                ? "warning"
                : "neutral"
          }
        >
          {event.status === "COMPLETED"
            ? tr("Sesja wykonana")
            : event.status === "MISSED"
              ? tr("Sesja pominięta")
              : tr("Wykonanie niepotwierdzone")}
        </Badge>
      )}
      <div className="button-row">
        {(event.source === "CUSTOM_ACTIVITY" ||
          event.source === "SCHEDULED_TASK") && (
          <>
            <Button className="button primary" onClick={onEdit}>
              {tr("Edytuj")}{" "}
            </Button>
            <Button className="button danger" onClick={onDelete}>
              {tr("Usuń")}{" "}
            </Button>
          </>
        )}
        {event.taskId && (
          <Button
            className="button secondary"
            onClick={() => onTask(event.taskId!)}
          >
            {tr("Szczegóły zadania")}{" "}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
