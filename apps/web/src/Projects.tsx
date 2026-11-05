import {
  Button,
  SelectField,
  Input,
  Textarea,
  DateField,
} from "./components/controls";
import { t as tr } from "./i18n";
import { useState } from "react";
import {
  UserPlus,
  Plus,
  Check,
  CalendarDays,
  Sparkles,
  Copy,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  send,
  remove,
  type Assignments,
  type Slot,
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
  statusNames,
} from "./ui";
import { TaskCard, type TaskActions } from "./Tasks";

type Modal = {
  kind:
    | "team"
    | "join"
    | "invite"
    | "project"
    | "meeting"
    | "assign"
    | "remove-member"
    | "cancel-meeting"
    | "edit-project";
  id?: string;
} | null;
export function Projects({
  teams,
  userId,
  zone,
  actions,
  onTask,
  refresh,
  notify,
}: {
  teams: Team[];
  userId: string;
  zone: string;
  actions: TaskActions;
  onTask: (projectId: string) => void;
  refresh: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
}) {
  const [teamId, setTeamId] = useState(""),
    [projectId, setProjectId] = useState(""),
    [tab, setTab] = useState("projects"),
    [modal, setModal] = useState<Modal>(null),
    [invite, setInvite] = useState(""),
    [slots, setSlots] = useState<Slot[]>([]),
    [slot, setSlot] = useState<Slot | null>(null),
    [participants, setParticipants] = useState<string[]>([]),
    [assignments, setAssignments] = useState<Assignments | null>(null);
  const team = teams.find((t) => t.id === teamId) ?? teams[0],
    project =
      team?.projects.find((p) => p.id === projectId) ?? team?.projects[0],
    self = team?.members.find((m) => m.userId === userId),
    manager = self?.role !== "MEMBER";
  const close = () => {
    setModal(null);
    setInvite("");
    setSlots([]);
    setSlot(null);
    setAssignments(null);
  };
  async function saved(message: string) {
    await refresh();
    notify(message);
    close();
  }
  async function action(job: () => Promise<unknown>, message: string) {
    try {
      await job();
      await refresh();
      notify(message);
    } catch (e) {
      notify(
        e instanceof Error ? e.message : tr("Nie udało się zapisać zmiany."),
        true,
      );
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{tr("Razem jest łatwiej")}</span>
          <h1>{tr("Zespoły i projekty")}</h1>
          <p>{tr("Wspólny cel. Przejrzyste zadania. Czas na współpracę.")}</p>
        </div>
        <div className="button-row">
          <Button
            className="button secondary"
            onClick={() => setModal({ kind: "join" })}
          >
            {tr("Dołącz z kodem")}{" "}
          </Button>
          <Button
            className="button primary"
            onClick={() => setModal({ kind: "team" })}
          >
            <Plus size={17} /> {tr("Nowy zespół")}{" "}
          </Button>
        </div>
      </div>
      {!team ? (
        <Empty
          title={tr("Zacznijcie pracować razem")}
          action={
            <Button
              className="button primary"
              onClick={() => setModal({ kind: "team" })}
            >
              {tr("Utwórz zespół")}{" "}
            </Button>
          }
        >
          {tr(
            "Stwórz zespół projektowy lub dołącz przy użyciu kodu zaproszenia.",
          )}{" "}
        </Empty>
      ) : (
        <>
          <div className="team-toolbar">
            <label>
              <span className="sr-only">{tr("Wybierz zespół")}</span>
              <SelectField
                value={team.id}
                onValueChange={(value) => {
                  setTeamId(value);
                  setProjectId("");
                }}
              >
                {teams.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </SelectField>
            </label>
            <Badge>
              {self?.role === "OWNER"
                ? tr("Właściciel")
                : self?.role === "ADMIN"
                  ? tr("Administrator")
                  : tr("Członek")}
            </Badge>
            <div className="segmented">
              <Button
                className={tab === "projects" ? "active" : ""}
                onClick={() => setTab("projects")}
              >
                {tr("Projekty")}{" "}
              </Button>
              <Button
                className={tab === "people" ? "active" : ""}
                onClick={() => setTab("people")}
              >
                {tr("Osoby")}{" "}
              </Button>
              <Button
                className={tab === "meetings" ? "active" : ""}
                onClick={() => setTab("meetings")}
              >
                {tr("Spotkania")}{" "}
              </Button>
            </div>
          </div>
          {tab === "projects" && (
            <>
              <div className="section-heading">
                <div className="button-row">
                  {team.projects.map((p) => (
                    <Button
                      key={p.id}
                      className={`project-tab ${project?.id === p.id ? "selected" : ""}`}
                      onClick={() => setProjectId(p.id)}
                    >
                      {p.title}
                    </Button>
                  ))}
                </div>
                {manager && (
                  <Button
                    className="button secondary"
                    onClick={() => setModal({ kind: "project" })}
                  >
                    <Plus size={15} /> {tr("Nowy projekt")}{" "}
                  </Button>
                )}
              </div>
              {!project ? (
                <Empty title={tr("Pierwszy wspólny projekt")}>
                  {tr(
                    "Administrator zespołu może utworzyć projekt i dodać zadania.",
                  )}{" "}
                </Empty>
              ) : (
                <>
                  <div className="section-heading">
                    <div>
                      <h2>{project.title}</h2>
                      <p className="muted">
                        {project.description ||
                          tr("Zadania Waszego projektu — w jednym miejscu.")}
                      </p>
                    </div>
                    <div className="button-row">
                      {manager && (
                        <Button
                          className="icon-button"
                          aria-label={tr("Edytuj projekt")}
                          onClick={() => setModal({ kind: "edit-project" })}
                        >
                          <Pencil size={17} />
                        </Button>
                      )}
                      {manager && (
                        <Button
                          className="button secondary"
                          onClick={() => setModal({ kind: "assign" })}
                        >
                          <Sparkles size={16} /> {tr("Zaproponuj podział")}{" "}
                        </Button>
                      )}
                      <Button
                        className="button primary"
                        onClick={() => onTask(project.id)}
                      >
                        {tr("Dodaj zadanie")}{" "}
                      </Button>
                    </div>
                  </div>
                  <div className="kanban">
                    {Object.entries(statusNames).map(([value, label]) => (
                      <section key={value}>
                        <h3>
                          {label}
                          <Badge>
                            {
                              project.tasks.filter((t) => t.status === value)
                                .length
                            }
                          </Badge>
                        </h3>
                        <div className="task-stack">
                          {project.tasks
                            .filter((t) => t.status === value)
                            .map((t) => (
                              <TaskCard
                                key={t.id}
                                task={t}
                                actions={actions}
                                canEdit={manager || t.userId === userId}
                                canSchedule={t.userId === userId}
                              />
                            ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {tab === "people" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>{tr("Osoby w zespole")}</h2>
                  <p className="muted">
                    {tr(
                      "Udostępnienie dostępności pokazuje wolne terminy, bez tytułów prywatnych wydarzeń.",
                    )}{" "}
                  </p>
                </div>
                {manager && (
                  <Button
                    className="button primary"
                    onClick={() => setModal({ kind: "invite" })}
                  >
                    <UserPlus size={16} /> {tr("Zaproś osobę")}{" "}
                  </Button>
                )}
              </div>
              <div className="member-list">
                {team.members.map((m) => (
                  <article key={m.userId}>
                    <div className="avatar">{m.user.name.slice(0, 1)}</div>
                    <div className="member-name">
                      <strong>
                        {m.user.name}
                        {m.userId === userId ? tr(" (Ty)") : ""}
                      </strong>
                      <small>{m.user.email}</small>
                    </div>
                    {self?.role === "OWNER" && m.role !== "OWNER" ? (
                      <SelectField
                        aria-label={tr("Rola: {{value0}}", {
                          value0: m.user.name,
                        })}
                        value={m.role}
                        onValueChange={(value) =>
                          void action(
                            () =>
                              send(
                                `/teams/${team.id}/members/${m.userId}`,
                                { role: value },
                                "PATCH",
                              ),
                            tr("Rola została zmieniona."),
                          )
                        }
                      >
                        <option value="MEMBER">{tr("Członek")}</option>
                        <option value="ADMIN">{tr("Administrator")}</option>
                      </SelectField>
                    ) : (
                      <Badge>
                        {m.role === "OWNER"
                          ? tr("Właściciel")
                          : m.role === "ADMIN"
                            ? tr("Administrator")
                            : tr("Członek")}
                      </Badge>
                    )}
                    {m.userId === userId ? (
                      <label className="check-row">
                        <Input
                          type="checkbox"
                          checked={m.shareAvailability}
                          onChange={(e) =>
                            void action(
                              () =>
                                send(
                                  `/teams/${team.id}/members/${userId}`,
                                  { shareAvailability: e.target.checked },
                                  "PATCH",
                                ),
                              tr("Ustawienie dostępności zapisane."),
                            )
                          }
                        />
                        <span>{tr("Udostępniam dostępność")}</span>
                      </label>
                    ) : (
                      <span className="muted">
                        {m.shareAvailability
                          ? tr("Dostępność udostępniona")
                          : tr("Dostępność prywatna")}
                      </span>
                    )}
                    {manager && m.role !== "OWNER" && (
                      <Button
                        className="icon-button"
                        aria-label={tr("Usuń z zespołu: {{value0}}", {
                          value0: m.user.name,
                        })}
                        onClick={() =>
                          setModal({ kind: "remove-member", id: m.userId })
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
          {tab === "meetings" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>{tr("Spotkania")}</h2>
                  <p className="muted">
                    {tr(
                      "Proponuj wspólny termin. Spotkanie trafi do kalendarzy po zgodzie wszystkich uczestników.",
                    )}{" "}
                  </p>
                </div>
                <Button
                  className="button primary"
                  onClick={() => {
                    setParticipants(
                      team.members
                        .filter((m) => m.shareAvailability)
                        .map((m) => m.userId),
                    );
                    setModal({ kind: "meeting" });
                  }}
                >
                  <CalendarDays size={16} /> {tr("Znajdź termin")}{" "}
                </Button>
              </div>
              {!team.meetings.length ? (
                <Empty title={tr("Znajdźcie wspólną chwilę")}>
                  {tr(
                    "Każdy uczestnik najpierw udostępnia dostępność w zakładce Osoby.",
                  )}{" "}
                </Empty>
              ) : (
                <div className="meeting-list">
                  {team.meetings.map((m) => (
                    <article key={m.id}>
                      <div>
                        <Badge
                          tone={
                            m.status === "CONFIRMED" ? "success" : "warning"
                          }
                        >
                          {m.status === "CONFIRMED"
                            ? tr("Potwierdzone")
                            : tr("Czeka na akceptację")}
                        </Badge>
                        <h3>{m.title}</h3>
                        <p>
                          {displayDate(dateKey(new Date(m.start), zone))} ·{" "}
                          {clock(m.start, zone)}–{clock(m.end, zone)}
                        </p>
                        <small>
                          {m.acceptedIds.length}/{m.participantIds.length}{" "}
                          {tr("potwierdzeń")}{" "}
                        </small>
                      </div>
                      <div className="button-row">
                        {m.status === "PENDING" &&
                          m.participantIds.includes(userId) &&
                          !m.acceptedIds.includes(userId) && (
                            <Button
                              className="button primary"
                              onClick={() =>
                                void action(
                                  () =>
                                    send(
                                      `/teams/${team.id}/meetings/${m.id}/accept`,
                                    ),
                                  tr("Akceptacja spotkania zapisana."),
                                )
                              }
                            >
                              <Check size={16} /> {tr("Akceptuję")}{" "}
                            </Button>
                          )}
                        {(manager || m.creatorId === userId) && (
                          <Button
                            className="button secondary"
                            onClick={() =>
                              setModal({ kind: "cancel-meeting", id: m.id })
                            }
                          >
                            {tr("Anuluj spotkanie")}{" "}
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
      {modal?.kind === "team" && (
        <Dialog title={tr("Nowy zespół")} onClose={close}>
          <Form
            cancel={close}
            label={tr("Utwórz zespół")}
            onSubmit={async (f) => {
              const t = await send<Team>("/teams", { title: f.get("title") });
              setTeamId(t.id);
              await saved(tr("Zespół został utworzony."));
            }}
          >
            <Field label={tr("Nazwa zespołu")}>
              <Input
                name="title"
                required
                maxLength={180}
                placeholder={tr("np. Projekt semestralny")}
              />
            </Field>
          </Form>
        </Dialog>
      )}
      {modal?.kind === "join" && (
        <Dialog
          title={tr("Dołącz do zespołu")}
          subtitle={tr(
            "Użyj kodu otrzymanego od administratora. Zaproszenie jest przypisane do Twojego e-maila.",
          )}
          onClose={close}
        >
          <Form
            cancel={close}
            label={tr("Dołącz do zespołu")}
            onSubmit={async (f) => {
              await send("/invitations/accept", {
                token: String(f.get("token")).trim(),
              });
              await saved(tr("Dołączono do zespołu."));
            }}
          >
            <Field label={tr("Kod zaproszenia")}>
              <Input name="token" required minLength={32} maxLength={128} />
            </Field>
          </Form>
        </Dialog>
      )}
      {modal?.kind === "invite" && team && (
        <Dialog
          title={tr("Zaproś osobę")}
          subtitle={tr(
            "Przekaż wygenerowany kod osobiście. Aplikacja nie wysyła e-maili.",
          )}
          onClose={close}
        >
          {invite ? (
            <div className="form-stack">
              <p>
                {tr(
                  "Kod jest ważny przez 7 dni i może zostać użyty raz, przez wskazany adres e-mail.",
                )}{" "}
              </p>
              <Field label={tr("Kod zaproszenia")}>
                <Input readOnly value={invite} />
              </Field>
              <Button
                className="button primary"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(invite)
                    .then(() => notify(tr("Kod skopiowany.")))
                    .catch(() => notify(tr("Skopiuj kod ręcznie z pola.")))
                }
              >
                <Copy size={16} /> {tr("Skopiuj kod")}{" "}
              </Button>
            </div>
          ) : (
            <Form
              cancel={close}
              label={tr("Utwórz zaproszenie")}
              onSubmit={async (f) => {
                const result = await send<{ token: string }>(
                  `/teams/${team.id}/invitations`,
                  { email: f.get("email"), role: f.get("role") },
                );
                setInvite(result.token);
              }}
            >
              <Field label={tr("Adres e-mail")}>
                <Input name="email" required type="email" />
              </Field>
              <Field label={tr("Rola")}>
                <SelectField name="role">
                  <option value="MEMBER">{tr("Członek")}</option>
                  <option value="ADMIN">{tr("Administrator")}</option>
                </SelectField>
              </Field>
            </Form>
          )}
        </Dialog>
      )}
      {modal?.kind === "project" && team && (
        <Dialog title={tr("Nowy projekt")} onClose={close}>
          <Form
            cancel={close}
            label={tr("Utwórz projekt")}
            onSubmit={async (f) => {
              const p = await send<{ id: string }>(
                `/teams/${team.id}/projects`,
                { title: f.get("title"), description: f.get("description") },
              );
              setProjectId(p.id);
              await saved(tr("Projekt utworzony."));
            }}
          >
            <Field label={tr("Nazwa projektu")}>
              <Input name="title" required maxLength={180} />
            </Field>
            <Field label={tr("Opis")}>
              <Textarea name="description" rows={3} maxLength={2000} />
            </Field>
          </Form>
        </Dialog>
      )}
      {modal?.kind === "edit-project" && team && project && (
        <Dialog title={tr("Edytuj projekt")} onClose={close}>
          <Form
            cancel={close}
            onSubmit={async (f) => {
              await send(
                `/teams/${team.id}/projects/${project.id}`,
                { title: f.get("title"), description: f.get("description") },
                "PATCH",
              );
              await saved(tr("Projekt zapisany."));
            }}
          >
            <Field label={tr("Nazwa projektu")}>
              <Input
                name="title"
                required
                maxLength={180}
                defaultValue={project.title}
              />
            </Field>
            <Field label={tr("Opis")}>
              <Textarea
                name="description"
                rows={3}
                maxLength={2000}
                defaultValue={project.description}
              />
            </Field>
          </Form>
        </Dialog>
      )}
      {modal?.kind === "meeting" && team && (
        <Dialog title={tr("Wspólny wolny termin")} onClose={close}>
          <Form
            cancel={close}
            label={
              slot ? tr("Wyślij propozycję uczestnikom") : tr("Szukaj terminów")
            }
            disabled={slot ? false : !participants.length}
            onSubmit={async (f) => {
              if (slot) {
                await send(`/teams/${team.id}/meetings`, {
                  title: f.get("title"),
                  participantIds: participants,
                  start: slot.start,
                  end: slot.end,
                });
                await saved(
                  tr("Propozycja spotkania czeka na zgodę uczestników."),
                );
                setTab("meetings");
              } else {
                const result = await send<Slot[]>(
                  `/teams/${team.id}/availability`,
                  {
                    participantIds: participants,
                    from: f.get("from"),
                    to: f.get("to"),
                    durationMinutes: Number(f.get("duration")),
                  },
                );
                setSlots(result);
                if (!result.length)
                  notify(
                    tr("Nie ma wspólnego terminu. Spróbuj innego zakresu."),
                  );
              }
            }}
          >
            {slot ? (
              <>
                <p className="notice">
                  {displayDate(dateKey(new Date(slot.start), zone))} ·{" "}
                  {clock(slot.start, zone)}–{clock(slot.end, zone)}
                </p>
                <Field label={tr("Temat spotkania")}>
                  <Input name="title" required maxLength={180} />
                </Field>
                <Button
                  className="text-button"
                  type="button"
                  onClick={() => setSlot(null)}
                >
                  {tr("Wybierz inny termin")}{" "}
                </Button>
              </>
            ) : (
              <>
                <fieldset>
                  <legend>{tr("Uczestnicy")}</legend>
                  {team.members.map((m) => (
                    <label className="check-row" key={m.userId}>
                      <Input
                        type="checkbox"
                        disabled={!m.shareAvailability}
                        checked={participants.includes(m.userId)}
                        onChange={(e) => {
                          setParticipants((old) =>
                            e.target.checked
                              ? [...old, m.userId]
                              : old.filter((id) => id !== m.userId),
                          );
                          setSlots([]);
                        }}
                      />
                      <span>
                        {m.user.name}
                        {!m.shareAvailability
                          ? tr(" — dostępność prywatna")
                          : ""}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="form-row">
                  <Field label={tr("Od")}>
                    <DateField
                      name="from"
                      required
                      defaultValue={dateKey(new Date(), zone)}
                    />
                  </Field>
                  <Field label={tr("Do (bez tego dnia)")}>
                    <DateField
                      name="to"
                      required
                      defaultValue={addDays(dateKey(new Date(), zone), 7)}
                    />
                  </Field>
                </div>
                <Field label={tr("Czas spotkania")}>
                  <SelectField name="duration">
                    <option value="30">{tr("30 min")}</option>
                    <option value="60">{tr("1 godz.")}</option>
                    <option value="90">{tr("1 godz. 30 min")}</option>
                  </SelectField>
                </Field>
                {slots.length > 0 && (
                  <div className="slots-list">
                    {slots.map((s) => (
                      <Button
                        className="choice"
                        type="button"
                        key={s.start}
                        onClick={() => setSlot(s)}
                      >
                        <CalendarDays size={17} />
                        {displayDate(dateKey(new Date(s.start), zone))} ·{" "}
                        {clock(s.start, zone)}–{clock(s.end, zone)}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Form>
        </Dialog>
      )}
      {modal?.kind === "assign" && team && (
        <Dialog
          title={tr("Propozycja podziału pracy")}
          subtitle={tr(
            "Heurystyka porównuje dostępność i pozostały czas pracy. Nie zmienia prywatnych zajęć.",
          )}
          onClose={close}
        >
          <Form
            cancel={close}
            label={
              assignments
                ? tr("Zaakceptuj przydziały")
                : tr("Oblicz propozycję")
            }
            onSubmit={async () => {
              if (assignments) {
                await send(
                  `/teams/${team.id}/assignments/${assignments.id}/confirm`,
                );
                await saved(
                  tr(
                    "Przydziały zapisane. Każda osoba może teraz zaplanować własne sesje.",
                  ),
                );
              } else
                setAssignments(
                  await send<Assignments>(`/teams/${team.id}/assignments`),
                );
            }}
          >
            {assignments ? (
              <div className="assignment-list">
                {assignments.suggestions.map((s) => (
                  <article key={s.taskId}>
                    <strong>{s.title}</strong>
                    <p>→ {s.userName}</p>
                    <small>
                      {duration(s.requiredMinutes)} {tr("pracy · około")}{" "}
                      {duration(s.availableMinutes)}{" "}
                      {tr("dostępności przed terminem")}{" "}
                    </small>
                    {s.overloaded && (
                      <Badge tone="warning">{tr("Ryzyko przeciążenia")}</Badge>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p>
                {tr(
                  "Uwzględniamy osoby, które udostępniły dostępność. Propozycja obejmuje aktywne zadania wszystkich projektów zespołu.",
                )}{" "}
              </p>
            )}
          </Form>
        </Dialog>
      )}
      {modal?.kind === "remove-member" && team && (
        <Dialog title={tr("Usunąć osobę z zespołu?")} onClose={close}>
          <Form
            cancel={close}
            label={tr("Usuń z zespołu")}
            onSubmit={async () => {
              await remove(`/teams/${team.id}/members/${modal.id}`);
              await saved(tr("Osoba została usunięta z zespołu."));
            }}
          >
            <p>
              {tr(
                "Odbierze to dostęp do projektu. Zadania tej osoby przejmie właściciel zespołu, a przyszłe sesje projektowe i spotkania z tą osobą zostaną odwołane.",
              )}{" "}
            </p>
          </Form>
        </Dialog>
      )}
      {modal?.kind === "cancel-meeting" && team && (
        <Dialog title={tr("Anulować spotkanie?")} onClose={close}>
          <Form
            cancel={close}
            label={tr("Anuluj spotkanie")}
            onSubmit={async () => {
              await remove(`/teams/${team.id}/meetings/${modal.id}`);
              await saved(tr("Spotkanie anulowane."));
            }}
          >
            <p>
              {tr("Potwierdzone spotkanie zniknie z kalendarzy uczestników.")}
            </p>
          </Form>
        </Dialog>
      )}
    </>
  );
}
