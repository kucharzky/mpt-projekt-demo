import { systemMessage } from "./i18n/system";
import { useTranslation } from "react-i18next";
import i18n from "./i18n";
import { Input, Button, DateField, SelectField } from "./components/controls";
import { t as tr, locale } from "./i18n";
import { useCallback, useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCheck,
  Users,
  Settings2,
  LogOut,
  Sun,
  Moon,
  Bell,
  Plus,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  X,
  RotateCcw,
  Leaf,
  Clock3,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from "lucide-react";
import {
  api,
  send,
  remove,
  type AuthSession,
  type CalendarEvent,
  type Notice,
  type PlannerState,
  type Proposal,
  type Task,
  type Team,
} from "./api/client";
import {
  ActivityForm,
  EventDetails,
  ImportForm,
  ScheduleForm,
  SessionForm,
  SettingsForm,
  TaskDetail,
  TaskForm,
} from "./Forms";
import { Calendar } from "./Calendar";
import { TaskCard, Tasks, type TaskActions } from "./Tasks";
import { Projects } from "./Projects";
import {
  addDays,
  Badge,
  dateKey,
  Dialog,
  displayDate,
  duration,
  Empty,
  Field,
  Form,
  IconButton,
  monday,
} from "./ui";

type TrashItem = { id: string; title: string; kind: string; deletedAt: string };
type Modal =
  | { kind: "task"; task?: Task; projectId?: string }
  | { kind: "activity"; event?: CalendarEvent; date?: string; time?: string }
  | { kind: "session"; task: Task; event?: CalendarEvent }
  | { kind: "details"; event: CalendarEvent }
  | { kind: "task-details"; id: string }
  | { kind: "schedule" | "import" | "settings" }
  | { kind: "delete-task"; task: Task }
  | { kind: "delete-event"; event: CalendarEvent }
  | null;

function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <CalendarDays size={21} />
      </span>
      <span>
        SmartUni<span>Planner</span>
      </span>
    </span>
  );
}
function Auth({
  onLogin,
  registrationRequiresCode,
}: {
  onLogin: (data: AuthSession) => void;
  registrationRequiresCode: boolean;
}) {
  const [register, setRegister] = useState(false);
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">
            {tr("Mniej chaosu. Więcej przestrzeni.")}
          </span>
          <h1>
            {tr("Twój czas.")} <br />
            {tr("Twój dobry plan.")}{" "}
          </h1>
          <p>
            {tr(
              "Zajęcia, projekty i to, co lubisz robić. Połącz je w tydzień, w którym jest miejsce na wszystko, co ważne.",
            )}{" "}
          </p>
          <div className="auth-promises">
            <span>
              <CalendarDays />
              {tr("Plan zajęć z USOS")}{" "}
            </span>
            <span>
              <Sparkles />
              {tr("Sesje dopasowane do Twojego dnia")}{" "}
            </span>
            <span>
              <Users />
              {tr("Projekty bez organizacyjnego chaosu")}{" "}
            </span>
          </div>
        </div>
        <p className="auth-footnote">
          <ShieldCheck size={16} />{" "}
          {tr(
            "Twój kalendarz jest prywatny. Ty decydujesz, co udostępniasz.",
          )}{" "}
        </p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form">
          <LanguageSwitcher />
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <span className="eyebrow">{tr("Dobrze Cię widzieć")}</span>
          <h2>
            {register ? tr("Zacznij od własnego konta") : tr("Witaj ponownie")}
          </h2>
          <p className="muted">
            {register
              ? tr("Zbuduj swój plan, krok po kroku.")
              : tr("Zaloguj się i wróć do swojego rytmu.")}
          </p>
          <Form
            key={String(register)}
            cancel={() => setRegister(!register)}
            label={register ? tr("Utwórz konto") : tr("Zaloguj się")}
            onSubmit={async (f) => {
              onLogin(
                await send<AuthSession>(
                  register ? "/auth/register" : "/auth/login",
                  {
                    email: f.get("email"),
                    password: f.get("password"),
                    ...(register
                      ? {
                          name: f.get("name"),
                          ...(registrationRequiresCode
                            ? { registrationCode: f.get("registrationCode") }
                            : {}),
                        }
                      : {}),
                  },
                ),
              );
            }}
          >
            {register && (
              <Field label={tr("Jak masz na imię?")}>
                <Input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="given-name"
                  placeholder={tr("Twoje imię")}
                />
              </Field>
            )}
            {register && registrationRequiresCode && (
              <Field
                label={tr("Kod rejestracji")}
                hint={tr("Kod dostępu otrzymasz od administratora aplikacji.")}
              >
                <Input
                  name="registrationCode"
                  type="password"
                  required
                  maxLength={128}
                  autoComplete="off"
                />
              </Field>
            )}
            <Field label={tr("Adres e-mail")}>
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={tr("ty@uczelnia.pl")}
              />
            </Field>
            <Field
              label={tr("Hasło")}
              hint={register ? tr("Co najmniej 10 znaków.") : ""}
            >
              <Input
                name="password"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </Field>
          </Form>
          <div className="auth-switch">
            {register ? tr("Masz już konto?") : tr("Pierwszy raz tutaj?")}{" "}
            <Button
              className="text-button"
              onClick={() => setRegister(!register)}
            >
              {register ? tr("Zaloguj się") : tr("Utwórz konto")}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
function Workspace() {
  useTranslation();
  const [collapsed, setCollapsed] = useState(
    () =>
      (localStorage.getItem("smartuni-sidebar") ??
        (matchMedia("(max-width:980px)").matches
          ? "collapsed"
          : "expanded")) === "collapsed",
  );
  useEffect(() => {
    localStorage.setItem(
      "smartuni-sidebar",
      collapsed ? "collapsed" : "expanded",
    );
  }, [collapsed]);
  const cache = useQueryClient(),
    [route, setRoute] = useState(location.hash.slice(1) || "calendar"),
    [selectedDate, setSelectedDate] = useState(dateKey()),
    [view, setView] = useState(() =>
      matchMedia("(max-width:760px)").matches ? "agenda" : "week",
    ),
    [highlight, setHighlight] = useState(false),
    [modal, setModal] = useState<Modal>(null),
    [preview, setPreview] = useState<Proposal | null>(null),
    [lastPlan, setLastPlan] = useState(""),
    [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
      null,
    ),
    [theme, setTheme] = useState(
      () => localStorage.getItem("smartuni-theme") ?? "system",
    ),
    [aside, setAside] = useState(true),
    [deleteScope, setDeleteScope] = useState("occurrence");
  const {
    data: auth,
    isLoading: authLoading,
    error: authError,
    refetch: retryAuth,
  } = useQuery({
    queryKey: ["auth"],
    queryFn: () => api<AuthSession>("/auth/session"),
    staleTime: Infinity,
  });
  const user = auth?.user;
  const from = view === "day" ? selectedDate : monday(selectedDate),
    to = addDays(from, view === "day" ? 1 : 7);
  const stateQuery = useQuery({
    queryKey: ["planner", user?.id, from, to],
    queryFn: () => api<PlannerState>(`/planner/state?from=${from}&to=${to}`),
    enabled: !!user,
    refetchInterval: 30000,
  });
  const teamQuery = useQuery({
    queryKey: ["teams", user?.id],
    queryFn: () => api<Team[]>("/teams"),
    enabled: !!user,
  });
  const notificationQuery = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api<Notice[]>("/notifications"),
    enabled: !!user,
    refetchInterval: 60000,
  });
  const trashQuery = useQuery({
    queryKey: ["trash", user?.id],
    queryFn: () => api<TrashItem[]>("/trash"),
    enabled: !!user && route === "trash",
  });
  const state = stateQuery.data,
    teams = teamQuery.data ?? [];
  const [dark, setDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(1) || "calendar");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      setDark(resolved === "dark");
    };
    apply();
    media.addEventListener("change", apply);
    localStorage.setItem("smartuni-theme", theme);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const expired = () =>
      void api<AuthSession>("/auth/session").then((data) => {
        cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
        cache.setQueryData(["auth"], data);
      });
    window.addEventListener("smartuni:unauthorized", expired);
    return () => window.removeEventListener("smartuni:unauthorized", expired);
  }, [cache]);
  const notify = useCallback(
    (text: string, error = false) => setNotice({ text, error }),
    [],
  );
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  const refresh = useCallback(async () => {
    await Promise.all(
      ["planner", "teams", "notifications", "task", "activity", "trash"].map(
        (key) => cache.invalidateQueries({ queryKey: [key] }),
      ),
    );
  }, [cache]);
  async function done(message: string, next?: string) {
    await refresh();
    setModal(next === "schedule" ? { kind: "schedule" } : null);
    setPreview(null);
    notify(message);
  }
  async function action(job: () => Promise<unknown>, message: string) {
    try {
      await job();
      await refresh();
      notify(message);
    } catch (e) {
      notify(
        e instanceof Error ? e.message : tr("Nie udało się wykonać działania."),
        true,
      );
    }
  }
  const signOut = () =>
    void action(async () => {
      await send("/auth/logout");
      cache.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
      cache.setQueryData(["auth"], await api("/auth/session"));
    }, tr("Wylogowano."));
  const close = () => {
    setModal(null);
    setPreview(null);
    setDeleteScope("occurrence");
  };
  const actions: TaskActions = {
    details: (id) => setModal({ kind: "task-details", id }),
    edit: (task) => setModal({ kind: "task", task }),
    session: (task) => setModal({ kind: "session", task }),
    delete: (task) => setModal({ kind: "delete-task", task }),
    status: async (task, status) => {
      await action(
        () =>
          send(`/tasks/${task.id}/status`, { status, version: task.version }),
        status === "DONE"
          ? tr("Zadanie ukończone.")
          : tr("Status zadania zapisany."),
      );
    },
  };
  if (authLoading)
    return (
      <main className="boot">
        <Brand />
        <p>{tr("Przygotowuję Twój planer…")}</p>
      </main>
    );
  if (authError)
    return (
      <main className="boot">
        <Brand />
        <p role="alert">
          {tr(
            "Nie można połączyć się z aplikacją. Sprawdź, czy API i baza danych są uruchomione.",
          )}{" "}
        </p>
        <Button className="button primary" onClick={() => void retryAuth()}>
          {tr("Spróbuj ponownie")}{" "}
        </Button>
      </main>
    );
  if (!user)
    return (
      <Auth
        registrationRequiresCode={auth?.registrationRequiresCode ?? false}
        onLogin={(data) => {
          setNotice(null);
          setModal(null);
          setPreview(null);
          setLastPlan("");
          cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
          cache.setQueryData(["auth"], data);
        }}
      />
    );
  const zone = state?.user.timezone ?? user.timezone;
  let events = state?.events ?? [];
  if (preview) {
    events = events
      .filter(
        (e) =>
          !(
            e.source === "RECOVERY_BREAK" ||
            (e.source === "SCHEDULED_TASK" &&
              !e.pinned &&
              e.status === "PLANNED" &&
              new Date(e.start) > new Date())
          ),
      )
      .map((e) => {
        const m = preview.moves.find(
          (m) =>
            e.activityId === m.activityId &&
            e.occurrenceDate === m.occurrenceDate,
        );
        return m ? { ...e, start: m.start, end: m.end } : e;
      });
    events = [
      ...events,
      ...preview.sessions.map((s) => ({
        id: s.id,
        taskId: s.taskId,
        title: s.title,
        start: s.start,
        end: s.end,
        source: "PREVIEW",
        isPermanent: false,
      })),
    ];
  }
  const activeTasks = (state?.tasks ?? []).filter((t) => t.status !== "DONE"),
    unread = notificationQuery.data?.filter((n) => !n.seen).length ?? 0;
  const hours = (source: string) =>
    duration(
      (state?.events ?? [])
        .filter((e) => e.source === source && e.status !== "MISSED")
        .reduce(
          (sum, e) => sum + (+new Date(e.end) - +new Date(e.start)) / 60000,
          0,
        ),
    );
  function editEvent(e: CalendarEvent) {
    if (e.source === "CUSTOM_ACTIVITY")
      setModal({ kind: "activity", event: e });
    else {
      const task = state?.tasks.find((t) => t.id === e.taskId);
      if (task) setModal({ kind: "session", task, event: e });
      else
        notify(
          tr("Ta sesja należy do historii innego przydziału zadania."),
          true,
        );
    }
  }
  return (
    <div
      className={`app-shell ${collapsed ? "nav-collapsed" : "nav-expanded"}`}
    >
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        {tr("Przejdź do treści")}{" "}
      </a>
      <aside className="navigation" id="main-navigation">
        <Button
          className="sidebar-toggle icon-button"
          aria-controls="main-navigation"
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? tr("Rozwiń panel boczny") : tr("Zwiń panel boczny")
          }
          title={
            collapsed ? tr("Rozwiń panel boczny") : tr("Zwiń panel boczny")
          }
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen size={19} />
          ) : (
            <PanelLeftClose size={19} />
          )}
        </Button>
        <a
          href="#calendar"
          className="brand-link"
          aria-label={tr("SmartUniPlanner — kalendarz")}
        >
          <Brand />
        </a>
        <div className="nav-caption">{tr("TWÓJ PLAN")}</div>
        <nav aria-label={tr("Główna nawigacja")}>
          {[
            { id: "calendar", label: tr("Kalendarz"), icon: CalendarDays },
            { id: "tasks", label: tr("Zadania"), icon: CheckCheck },
            { id: "projects", label: tr("Zespoły"), icon: Users },
            { id: "notifications", label: tr("Powiadomienia"), icon: Bell },
          ].map((item) => (
            <a
              href={`#${item.id}`}
              aria-label={item.label}
              title={item.label}
              aria-current={route === item.id ? "page" : undefined}
              key={item.id}
              className={route === item.id ? "nav-item active" : "nav-item"}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.id === "tasks" && activeTasks.length > 0 && (
                <b>{activeTasks.length}</b>
              )}
              {item.id === "notifications" && unread > 0 && <b>{unread}</b>}
            </a>
          ))}
        </nav>
        <div className="nav-note">
          <Leaf size={20} />
          <strong>{tr("Dobry plan zostawia oddech.")}</strong>
          <p>{tr("Zadbaj o czas na naukę i czas dla siebie.")}</p>
        </div>
        <div className="nav-bottom">
          <a className="nav-item" href="#trash" aria-label={tr("Kosz")}>
            <Trash2 size={19} />
            <span>{tr("Kosz")}</span>
          </a>
          <Button
            className="nav-item"
            aria-label={tr("Ustawienia planowania")}
            onClick={() => setModal({ kind: "settings" })}
          >
            <Settings2 size={19} />
            <span>{tr("Ustawienia planowania")}</span>
          </Button>
          <Button
            className="nav-item"
            aria-label={dark ? tr("Jasny motyw") : tr("Ciemny motyw")}
            onClick={() => setTheme(dark ? "light" : "dark")}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
            <span>{dark ? tr("Jasny motyw") : tr("Ciemny motyw")}</span>
          </Button>
          <div className="user-panel">
            <span className="avatar">{user.name.charAt(0)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{tr("Twój prywatny planer")}</small>
            </span>
            <IconButton label={tr("Wyloguj się")} onClick={signOut}>
              <LogOut size={17} />
            </IconButton>
          </div>
        </div>
      </aside>
      <main className="workspace" id="main" tabIndex={-1}>
        <header className="topbar">
          <LanguageSwitcher />
          <div className="mobile-actions">
            <IconButton
              label={tr("Kosz")}
              onClick={() => {
                location.hash = "trash";
              }}
            >
              <Trash2 size={19} />
            </IconButton>
            <IconButton
              label={tr("Ustawienia planowania")}
              onClick={() => setModal({ kind: "settings" })}
            >
              <Settings2 size={19} />
            </IconButton>
            <IconButton
              label={dark ? tr("Jasny motyw") : tr("Ciemny motyw")}
              onClick={() => setTheme(dark ? "light" : "dark")}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </IconButton>
            <IconButton label={tr("Wyloguj się")} onClick={signOut}>
              <LogOut size={19} />
            </IconButton>
          </div>
          <span>
            {displayDate(dateKey(new Date(), zone), {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <div>
            <span className="privacy-status">
              <ShieldCheck size={14} /> {tr("Prywatna przestrzeń")}{" "}
            </span>
            <IconButton
              label={tr("Powiadomienia")}
              onClick={() => {
                location.hash = "notifications";
              }}
            >
              <Bell size={18} />
            </IconButton>
          </div>
        </header>
        <div className="workspace-content">
          {stateQuery.error && (
            <div className="notice error" role="alert">
              {systemMessage(stateQuery.error.message)}
              <Button
                className="text-button"
                onClick={() => void stateQuery.refetch()}
              >
                {tr("Odśwież")}{" "}
              </Button>
            </div>
          )}
          {!state ? (
            <div className="loading">{tr("Wczytuję kalendarz i zadania…")}</div>
          ) : route === "tasks" ? (
            <Tasks
              tasks={state.tasks}
              actions={actions}
              onAdd={() => setModal({ kind: "task" })}
              onPlan={() => setModal({ kind: "schedule" })}
            />
          ) : route === "projects" ? (
            <Projects
              teams={teams}
              userId={user.id}
              zone={zone}
              actions={actions}
              onTask={(projectId) => setModal({ kind: "task", projectId })}
              refresh={refresh}
              notify={notify}
            />
          ) : route === "trash" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">{tr("Możesz zmienić zdanie")}</span>
                  <h1>{tr("Kosz")}</h1>
                  <p>
                    {tr(
                      "Przywróć usunięte zadania, sesje lub aktywności. Sprawdź potem ewentualne kolizje.",
                    )}{" "}
                  </p>
                </div>
              </div>
              {!trashQuery.data?.length ? (
                <Empty title={tr("Kosz jest pusty")}>
                  {tr(
                    "Usuwane elementy możesz później odzyskać w tym miejscu.",
                  )}{" "}
                </Empty>
              ) : (
                <div className="notification-list">
                  {trashQuery.data.map((item) => (
                    <article key={item.kind + item.id}>
                      <Trash2 size={20} />
                      <div style={{ flex: 1 }}>
                        <strong>{item.title}</strong>
                        <p>
                          {
                            {
                              task: tr("Zadanie"),
                              activity: tr("Aktywność"),
                              session: tr("Sesja pracy"),
                              occurrence: tr("Wystąpienie serii"),
                            }[item.kind]
                          }
                        </p>
                      </div>
                      <Button
                        className="button secondary"
                        onClick={() =>
                          void action(
                            () =>
                              send(
                                `/trash/${item.kind}/${encodeURIComponent(item.id)}/restore`,
                              ),
                            tr("Element przywrócony. Sprawdź kalendarz."),
                          )
                        }
                      >
                        {tr("Przywróć")}{" "}
                      </Button>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : route === "notifications" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {tr("Nic ważnego Ci nie umknie")}
                  </span>
                  <h1>{tr("Powiadomienia")}</h1>
                  <p>{tr("Terminy, sesje i wiadomości z Twoich zespołów.")}</p>
                </div>
                <Button
                  className="button secondary"
                  onClick={() =>
                    void action(
                      () => send("/notifications/read"),
                      tr("Powiadomienia oznaczone jako przeczytane."),
                    )
                  }
                >
                  <CheckCheck size={17} /> {tr("Oznacz przeczytane")}{" "}
                </Button>
              </div>
              {!notificationQuery.data?.length ? (
                <Empty title={tr("Wszystko pod kontrolą")}>
                  {tr(
                    "Gdy zbliży się termin zadania lub sesja, zobaczysz informację tutaj.",
                  )}{" "}
                </Empty>
              ) : (
                <div className="notification-list">
                  {notificationQuery.data.map((n) => (
                    <article key={n.id} className={n.seen ? "" : "unread"}>
                      <Bell size={20} />
                      <div>
                        <strong>{tr(n.title)}</strong>
                        <p>{n.body}</p>
                        <small>
                          {new Date(n.createdAt).toLocaleString(locale())}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {tr("Przestrzeń na to, co ważne")}
                  </span>
                  <h1>{tr("Twój kalendarz")}</h1>
                  <p>{tr("Spójrz na tydzień. Zaplanuj dobry dzień.")}</p>
                </div>
                <div className="button-row">
                  <Button
                    className="button secondary"
                    onClick={() => setModal({ kind: "import" })}
                  >
                    <Upload size={16} /> {tr("Importuj USOS")}{" "}
                  </Button>
                  <Button
                    className="button primary"
                    onClick={() => setModal({ kind: "task" })}
                  >
                    <Plus size={17} /> {tr("Nowe zadanie")}{" "}
                  </Button>
                </div>
              </div>
              <div className="week-summary">
                <span>
                  <span className="dot dot-class" />
                  {tr("Zajęcia")} <strong>{hours("USOS_ICS")}</strong>
                </span>
                <span>
                  <span className="dot dot-task" />
                  {tr("Praca nad zadaniami")}{" "}
                  <strong>{hours("SCHEDULED_TASK")}</strong>
                </span>
                <span>
                  <Clock3 size={15} />{" "}
                  {tr("Liczba aktywnych zadań: {{count}}", {
                    count: activeTasks.length,
                  })}{" "}
                </span>
                <Button
                  className="text-button"
                  onClick={() => setModal({ kind: "activity" })}
                >
                  <Plus size={15} /> {tr("Dodaj aktywność")}{" "}
                </Button>
              </div>
              {state.conflicts.length > 0 && (
                <p className="notice warning">
                  <AlertTriangle size={17} />{" "}
                  {tr(
                    "Część wydarzeń nakłada się na siebie. Sprawdź bloki z czerwoną obwódką lub wygeneruj nową propozycję.",
                  )}{" "}
                </p>
              )}
              {lastPlan && (
                <p className="notice success">
                  <CheckCheck size={17} /> {tr("Ostatni plan jest zapisany.")}{" "}
                  <Button
                    className="text-button"
                    onClick={() =>
                      void action(async () => {
                        await send(`/scheduler/proposals/${lastPlan}/undo`);
                        setLastPlan("");
                      }, tr("Przywrócono poprzedni układ sesji."))
                    }
                  >
                    <RotateCcw size={15} /> {tr("Cofnij plan")}{" "}
                  </Button>
                  <IconButton
                    label={tr("Ukryj informację o planie")}
                    onClick={() => setLastPlan("")}
                  >
                    <X size={15} />
                  </IconButton>
                </p>
              )}
              <div className="calendar-toolbar">
                <div className="date-navigation">
                  <Button
                    className="button secondary today-button"
                    onClick={() => setSelectedDate(dateKey(new Date(), zone))}
                  >
                    {tr("Dzisiaj")}{" "}
                  </Button>
                  <IconButton
                    label={tr("Poprzedni okres")}
                    onClick={() =>
                      setSelectedDate(
                        addDays(selectedDate, view === "day" ? -1 : -7),
                      )
                    }
                  >
                    <ChevronLeft size={19} />
                  </IconButton>
                  <IconButton
                    label={tr("Następny okres")}
                    onClick={() =>
                      setSelectedDate(
                        addDays(selectedDate, view === "day" ? 1 : 7),
                      )
                    }
                  >
                    <ChevronRight size={19} />
                  </IconButton>
                  <h2>
                    {view === "day"
                      ? displayDate(from)
                      : `${displayDate(from, { day: "numeric" })}–${displayDate(addDays(to, -1), { day: "numeric", month: "long", year: "numeric" })}`}
                  </h2>
                </div>
                <div className="calendar-view-controls">
                  <label className="sr-only" htmlFor="calendar-date">
                    {tr("Przejdź do daty")}{" "}
                  </label>
                  <DateField
                    id="calendar-date"
                    aria-label={tr("Przejdź do daty")}

                    value={selectedDate}
                    onValueChange={(value) => {
                      if (value) setSelectedDate(value);
                    }}
                  />
                  <div
                    className="segmented"
                    aria-label={tr("Widok kalendarza")}
                  >
                    {[
                      ["day", tr("Dzień")],
                      ["week", tr("Tydzień")],
                      ["agenda", tr("Agenda")],
                    ].map(([key, label]) => (
                      <Button
                        aria-pressed={view === key}
                        className={view === key ? "active" : ""}
                        key={key}
                        onClick={() => setView(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <IconButton
                    label={
                      aside ? tr("Ukryj panel zadań") : tr("Pokaż panel zadań")
                    }
                    onClick={() => setAside(!aside)}
                  >
                    <PanelLeftClose size={18} />
                  </IconButton>
                </div>
              </div>
              <div className={`planner-layout ${aside ? "" : "without-aside"}`}>
                <section className="calendar-section">
                  <div className="calendar-options">
                    <label className="check-row">
                      <Input
                        type="checkbox"
                        checked={highlight}
                        onChange={(e) => setHighlight(e.target.checked)}
                      />
                      <span>{tr("Pokaż czas bez stałych zajęć")}</span>
                    </label>
                    <a
                      className="text-button"
                      href={`/api/calendar/export?from=${from}&to=${to}`}
                    >
                      <Download size={15} /> {tr("Eksport .ics")}{" "}
                    </a>
                  </div>
                  <Calendar
                    from={from}
                    view={view}
                    zone={zone}
                    events={events}
                    free={state.freeSlots}
                    highlight={highlight}
                    conflicts={state.conflicts}
                    onEvent={(event) =>
                      event.source !== "PREVIEW" &&
                      setModal({ kind: "details", event })
                    }
                    onSlot={(date, time) =>
                      setModal({ kind: "activity", date, time })
                    }
                  />
                  <div className="calendar-legend">
                    <span>
                      <i className="dot dot-class" />
                      {tr("Zajęcia USOS")}{" "}
                    </span>
                    <span>
                      <i className="dot dot-activity" />
                      {tr("Aktywności")}{" "}
                    </span>
                    <span>
                      <i className="dot dot-task" />
                      {tr("Sesje pracy")}{" "}
                    </span>
                    <span>
                      <i className="dot dot-break" />
                      {tr("Przerwy")}{" "}
                    </span>
                    <span>
                      <i className="dot dot-meeting" />
                      {tr("Spotkania")}{" "}
                    </span>
                  </div>
                </section>
                {aside && (
                  <aside className="task-panel">
                    <div className="section-heading">
                      <h2>{tr("Do zrobienia")}</h2>
                      <Badge>{activeTasks.length}</Badge>
                    </div>
                    <p className="muted">{tr("Małe kroki, duży postęp.")}</p>
                    <Button
                      className="button plan-button"
                      onClick={() => setModal({ kind: "schedule" })}
                    >
                      <Sparkles size={18} /> {tr("Zaproponuj plan")}{" "}
                      <ArrowRight size={17} />
                    </Button>
                    <div className="task-stack">
                      {activeTasks.slice(0, 6).map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          actions={actions}
                          compact
                        />
                      ))}
                      {!activeTasks.length && (
                        <Empty title={tr("Spokojna głowa")}>
                          {tr(
                            "Dodaj zadanie, a pomożemy Ci znaleźć na nie czas.",
                          )}{" "}
                        </Empty>
                      )}
                    </div>
                    <a href="#tasks" className="all-tasks">
                      {tr("Wszystkie zadania")} <ArrowRight size={15} />
                    </a>
                  </aside>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      {notice && (
        <div
          className={`toast ${notice.error ? "toast-error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          <span>{systemMessage(notice.text)}</span>
          <IconButton
            label={tr("Zamknij komunikat")}
            onClick={() => setNotice(null)}
          >
            <X size={17} />
          </IconButton>
        </div>
      )}
      {modal?.kind === "task" && (
        <TaskForm
          task={modal.task}
          projectId={modal.projectId}
          teams={teams}
          userId={user.id}
          close={close}
          done={done}
        />
      )}
      {modal?.kind === "activity" && (
        <ActivityForm
          event={modal.event}
          initialDate={modal.date}
          initialTime={modal.time}
          zone={zone}
          close={close}
          done={done}
        />
      )}
      {modal?.kind === "session" && (
        <SessionForm
          task={modal.task}
          event={modal.event}
          zone={zone}
          close={close}
          done={done}
        />
      )}
      {modal?.kind === "task-details" && (
        <TaskDetail
          id={modal.id}
          userId={user.id}
          canEdit={(t) =>
            t.userId === user.id ||
            teams.some(
              (team) =>
                team.projects.some((p) => p.id === t.projectId) &&
                team.members.some(
                  (m) => m.userId === user.id && m.role !== "MEMBER",
                ),
            )
          }
          onEdit={(task) => setModal({ kind: "task", task })}
          onSession={(task) => setModal({ kind: "session", task })}
          close={close}
          done={done}
        />
      )}
      {modal?.kind === "details" && (
        <EventDetails
          event={modal.event}
          zone={zone}
          onEdit={() => editEvent(modal.event)}
          onDelete={() =>
            setModal({ kind: "delete-event", event: modal.event })
          }
          onTask={(id) => setModal({ kind: "task-details", id })}
          close={close}
        />
      )}
      {modal?.kind === "import" && (
        <ImportForm zone={zone} close={close} done={done} />
      )}
      {modal?.kind === "settings" && state && (
        <SettingsForm state={state} close={close} done={done} />
      )}
      {modal?.kind === "schedule" && state && (
        <ScheduleForm
          state={state}
          onPreview={setPreview}
          onConfirm={setLastPlan}
          close={close}
          done={done}
        />
      )}
      {modal?.kind === "delete-task" && (
        <Dialog title={tr("Usunąć zadanie?")} onClose={close}>
          <Form
            label={tr("Usuń zadanie")}
            cancel={close}
            onSubmit={async () => {
              await remove(
                `/tasks/${modal.task.id}?version=${modal.task.version}`,
              );
              await done(
                tr("Zadanie przeniesione do kosza. Możesz je przywrócić."),
              );
            }}
          >
            <p>
              {tr("Przeniesiesz „")}
              {modal.task.title}
              {tr(
                "” do kosza. Możesz później przywrócić zadanie wraz z sesjami, materiałami i komentarzami.",
              )}{" "}
            </p>
          </Form>
        </Dialog>
      )}
      {modal?.kind === "delete-event" && (
        <Dialog title={tr("Usuń wydarzenie")} onClose={close}>
          <Form
            label={tr("Potwierdź usunięcie")}
            cancel={close}
            onSubmit={async () => {
              const e = modal.event;
              if (e.activityId)
                await remove(
                  deleteScope === "series"
                    ? `/activities/${e.activityId}?version=${e.version}`
                    : `/activities/${e.activityId}/occurrences/${e.occurrenceDate}?version=${e.version}`,
                );
              else await remove(`/task-sessions/${e.id}?version=${e.version}`);
              await done(
                tr(
                  "Wydarzenie przeniesione do kosza. Możesz je przywrócić; czas zadania pozostaje do zaplanowania.",
                ),
              );
            }}
          >
            <p>{modal.event.title}</p>
            {modal.event.activityId ? (
              <Field label={tr("Zakres usunięcia")}>
                <SelectField
                  value={deleteScope}
                  onValueChange={(value) => setDeleteScope(value)}
                >
                  <option value="occurrence">
                    {tr("Tylko to wystąpienie")}
                  </option>
                  <option value="series">
                    {tr("Cała aktywność lub seria")}
                  </option>
                </SelectField>
              </Field>
            ) : (
              <p>
                {tr(
                  "Usunięcie sesji nie usuwa zadania. Możesz zaplanować jego czas ponownie.",
                )}{" "}
              </p>
            )}
          </Form>
        </Dialog>
      )}
    </div>
  );
}
function LanguageSwitcher() {
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={tr("Język aplikacji")}
    >
      {(["pl", "en"] as const).map((language) => (
        <Button
          type="button"
          key={language}
          aria-pressed={i18n.language === language}
          aria-label={language === "pl" ? "Polski" : "English"}
          lang={language}
          onClick={() => void i18n.changeLanguage(language)}
        >
          {language.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            networkMode: "always",
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <Workspace />
    </QueryClientProvider>
  );
}
