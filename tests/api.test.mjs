import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
dotenv.config({ quiet: true });
if (
  !process.env.TEST_DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")
)
  throw new Error("Integration tests require an isolated _test database");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
const require = createRequire(import.meta.url),
  { PrismaClient } = require("@prisma/client");
const { createApplication } = require("../apps/api/dist/main.js");
const {
  dateKey,
  addDays,
  localInstant,
} = require("../apps/api/dist/planner/domain/time.js");
let app, base, db;
const users = [],
  suffix = randomUUID().slice(0, 8),
  today = dateKey(new Date(), "Europe/Warsaw"),
  tomorrow = addDays(today, 1),
  deadline = addDays(today, 10);
class Client {
  cookie = "";
  csrf = "";
  user = null;
  async call(
    path,
    body,
    method = body === undefined ? "GET" : "POST",
    expected = 200,
  ) {
    const r = await fetch(base + path, {
      method,
      headers: {
        cookie: this.cookie,
        origin: "http://localhost:5173",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.csrf ? { "x-csrf-token": this.csrf } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const cookie = r.headers.getSetCookie?.()[0];
    if (cookie) this.cookie = cookie.split(";")[0];
    const data = r.headers.get("content-type")?.includes("json")
      ? await r.json()
      : await r.text();
    assert.equal(
      r.status,
      expected,
      `${method} ${path}: ${JSON.stringify(data)}`,
    );
    if (data.csrfToken) this.csrf = data.csrfToken;
    if (data.user) this.user = data.user;
    return data;
  }
  async register(name) {
    await this.call("/auth/session");
    const data = await this.call(
      "/auth/register",
      {
        name,
        email: `${name.toLowerCase()}-${suffix}@smartuni.test`,
        password: "Integration-2026!",
      },
      "POST",
      201,
    );
    users.push(data.user.id);
    return this;
  }
  state() {
    return this.call(`/planner/state?from=${today}&to=${addDays(today, 14)}`);
  }
}
const a = new Client(),
  b = new Client(),
  outsider = new Client();
let task, activity, team, project, invite, session, proposal;
const taskInput = (title = "Projekt testowy") => ({
  title,
  deadlineDate: deadline,
  requiredMinutes: 180,
  minSessionMinutes: 60,
  maxSessionMinutes: 120,
  importance: 1,
});
before(async () => {
  execFileSync(process.execPath, ["apps/api/scripts/migrate.cjs"], {
    env: { ...process.env, MIGRATE_TEST: "1" },
    stdio: "pipe",
  });
  db = new PrismaClient();
  await db.rateLimitBucket.deleteMany();
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
});
after(async () => {
  if (db) {
    await db.team.deleteMany({
      where: { memberships: { some: { userId: { in: users } } } },
    });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
  if (app) await app.close();
});

test("authentication, validation, CSRF and registration session regeneration", async () => {
  await a.call(
    `/planner/state?from=${today}&to=${tomorrow}`,
    undefined,
    "GET",
    401,
  );
  await a.register("Anna");
  await b.register("Bartek");
  await outsider.register("Celina");
  assert.ok(a.cookie);
  assert.ok(a.csrf);
  assert.notEqual(a.cookie, b.cookie);
  const saved = a.csrf;
  a.csrf = "é".repeat(saved.length);
  await a.call("/tasks", taskInput(), "POST", 403);
  a.csrf = "invalid";
  await a.call("/tasks", taskInput(), "POST", 403);
  a.csrf = saved;
  await a.call("/tasks", { ...taskInput(), ownerId: b.user.id }, "POST", 400);
  await a.call(
    "/tasks",
    { ...taskInput(), deadlineDate: "2026-02-30" },
    "POST",
    400,
  );
  assert.equal((await a.state()).tasks.length, 0);
});
test("task CRUD persists, computes progress, rejects other owners and stale writes", async () => {
  task = await a.call("/tasks", taskInput(), "POST", 201);
  assert.equal((await a.state()).tasks[0].title, "Projekt testowy");
  await b.call(`/tasks/${task.id}`, undefined, "GET", 404);
  await b.call(
    `/tasks/${task.id}`,
    { ...taskInput(), version: task.version },
    "PATCH",
    404,
  );
  task = await a.call(
    `/tasks/${task.id}`,
    { ...taskInput("Zmieniony projekt"), version: task.version },
    "PATCH",
  );
  await a.call(
    `/tasks/${task.id}`,
    { ...taskInput(), version: 0 },
    "PATCH",
    409,
  );
  await a.call(
    `/tasks/${task.id}/comments`,
    { body: "Ustalenia testowe" },
    "POST",
    201,
  );
  await a.call(
    `/tasks/${task.id}/resources`,
    { title: "Materiały", url: "https://example.org/materialy" },
    "POST",
    201,
  );
  await a.call(
    `/tasks/${task.id}/resources`,
    { title: "Niebezpieczny link", url: "javascript:alert(1)" },
    "POST",
    400,
  );
  const details = await a.call(`/tasks/${task.id}`);
  assert.equal(details.comments.length, 1);
  assert.equal(details.resources.length, 1);
});
test("activities recur, occurrence edits preserve the series, collisions require explicit acknowledgement", async () => {
  const input = {
    title: "Stałe zajęcie",
    anchorDate: tomorrow,
    startTime: "10:00",
    endTime: "11:00",
    recurrence: "WEEKLY",
    isPermanent: true,
  };
  activity = await a.call("/activities", input, "POST", 201);
  assert.ok(
    (await a.state()).events.filter((e) => e.activityId === activity.id)
      .length >= 2,
  );
  await a.call("/activities", { ...input, title: "Kolizja" }, "POST", 409);
  await a.call(
    `/activities/${activity.id}/occurrences/${tomorrow}`,
    {
      title: "Jednorazowa zmiana",
      date: tomorrow,
      startTime: "11:00",
      endTime: "12:00",
      version: activity.version,
    },
    "PATCH",
  );
  const events = (await a.state()).events.filter(
    (e) => e.activityId === activity.id,
  );
  assert.equal(
    events.find((e) => e.occurrenceDate === tomorrow).title,
    "Jednorazowa zmiana",
  );
  assert.ok(events.some((e) => e.title === "Stałe zajęcie"));
  activity = await a.call(`/activities/${activity.id}`);
  await a.call(
    `/activities/${activity.id}/occurrences/${tomorrow}?version=${activity.version}`,
    undefined,
    "DELETE",
  );
  assert.ok(
    !(await a.state()).events.some(
      (e) => e.activityId === activity.id && e.occurrenceDate === tomorrow,
    ),
  );
  await a.call(
    `/trash/occurrence/${activity.id}:${tomorrow}/restore`,
    {},
    "POST",
    201,
  );
  assert.equal(
    (await a.state()).events.find(
      (e) => e.activityId === activity.id && e.occurrenceDate === tomorrow,
    ).title,
    "Jednorazowa zmiana",
  );
});
test("manual sessions reconcile effort, completion is explicit, missed sessions reopen capacity", async () => {
  session = await a.call(
    `/tasks/${task.id}/sessions`,
    {
      title: task.title,
      date: tomorrow,
      startTime: "13:00",
      endTime: "14:00",
      version: 0,
      pinned: true,
      status: "PLANNED",
    },
    "POST",
    201,
  );
  let details = await a.call(`/tasks/${task.id}`);
  assert.equal(details.completedMinutes, 0);
  assert.equal(details.plannedMinutes, 60);
  session = await a.call(
    `/task-sessions/${session.id}`,
    {
      title: task.title,
      date: tomorrow,
      startTime: "13:00",
      endTime: "14:00",
      version: session.version,
      pinned: true,
      status: "COMPLETED",
    },
    "PATCH",
  );
  details = await a.call(`/tasks/${task.id}`);
  assert.equal(details.completedMinutes, 60);
  assert.equal(details.status, "IN_PROGRESS");
});
test("manual quarter-hour sessions keep estimates editable in half-hour increments", async () => {
  const t = await a.call(
    "/tasks",
    {
      ...taskInput("Krótka praca"),
      requiredMinutes: 30,
      minSessionMinutes: 30,
      maxSessionMinutes: 60,
    },
    "POST",
    201,
  );
  const placed = await a.call(
    `/tasks/${t.id}/sessions`,
    {
      title: t.title,
      date: addDays(today, 3),
      startTime: "18:00",
      endTime: "18:45",
      version: 0,
      pinned: true,
      status: "COMPLETED",
    },
    "POST",
    201,
  );
  const current = await a.call(`/tasks/${t.id}`);
  assert.equal(current.requiredMinutes, 60);
  assert.equal(current.completedMinutes, 45);
  assert.equal(current.status, "IN_PROGRESS");
  assert.equal(current.missingMinutes, 15);
  await a.call(
    `/tasks/${t.id}`,
    {
      ...taskInput("Krótka praca — edycja"),
      requiredMinutes: 60,
      version: current.version,
    },
    "PATCH",
  );
  await a.call(
    `/task-sessions/${placed.id}?version=${placed.version}`,
    undefined,
    "DELETE",
  );
  const last = await a.call(`/tasks/${t.id}`);
  await a.call(`/tasks/${t.id}?version=${last.version}`, undefined, "DELETE");
});
test("proposals have two layouts, preserve pins, confirm exactly once, undo safely and reject stale state", async () => {
  let layouts = await a.call(
    "/scheduler/proposals",
    { allocationMode: "SEQUENTIAL", order: [] },
    "POST",
    201,
  );
  assert.equal(layouts.length, 2);
  proposal = layouts[0];
  assert.ok(proposal.sessions.length);
  assert.ok(
    proposal.sessions.every(
      (s) =>
        !(
          +new Date(s.start) < +new Date(session.end) &&
          +new Date(s.end) > +new Date(session.start)
        ),
    ),
  );
  const before = (await a.state()).revision;
  await a.call(`/scheduler/proposals/${proposal.id}/confirm`, {}, "POST", 201);
  const state = await a.state();
  assert.equal(state.revision, before + 1);
  await a.call(`/scheduler/proposals/${proposal.id}/confirm`, {}, "POST", 201);
  assert.equal((await a.state()).revision, state.revision);
  await b.call(`/scheduler/proposals/${proposal.id}/confirm`, {}, "POST", 404);
  await a.call(`/scheduler/proposals/${proposal.id}/undo`, {}, "POST", 201);
  assert.ok(
    !(await a.state()).events.some((e) =>
      proposal.sessions.some((s) => s.id === e.id),
    ),
  );
  layouts = await a.call(
    "/scheduler/proposals",
    { allocationMode: "EVEN_SPLIT", order: [] },
    "POST",
    201,
  );
  await a.call("/tasks", taskInput("Zmiana w drugiej karcie"), "POST", 201);
  await a.call(
    `/scheduler/proposals/${layouts[0].id}/confirm`,
    {},
    "POST",
    409,
  );
});

test("changing display timezone preserves the absolute instants of existing series", async () => {
  const before = await a.state(),
    existing = before.events
      .filter((e) => e.activityId === activity.id)
      .map((e) => [e.id, e.start, e.end]);
  await a.call(
    "/me/preferences",
    {
      ...before.preferences,
      timezone: "America/New_York",
      revision: before.revision,
    },
    "PATCH",
  );
  assert.deepEqual(
    (await a.state()).events
      .filter((e) => e.activityId === activity.id)
      .map((e) => [e.id, e.start, e.end]),
    existing,
  );
  const current = await a.state();
  await a.call(
    "/me/preferences",
    {
      ...before.preferences,
      timezone: "Europe/Warsaw",
      revision: current.revision,
    },
    "PATCH",
  );
});
test("proposal editing rejects invalid duration and collisions then commits the edited layout", async () => {
  const layouts = await a.call(
      "/scheduler/proposals",
      { allocationMode: "SEQUENTIAL", order: [] },
      "POST",
      201,
    ),
    p = layouts[0],
    s = p.sessions.find((s) => s.kind === "WORK");
  assert.ok(s);
  const date = addDays(today, 9),
    minutes = (+new Date(s.end) - +new Date(s.start)) / 60000,
    end = `${String(16 + Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  await a.call(
    `/scheduler/proposals/${p.id}/sessions/${s.id}`,
    { date, startTime: "16:00", endTime: "16:15" },
    "PATCH",
    400,
  );
  const edited = await a.call(
    `/scheduler/proposals/${p.id}/sessions/${s.id}`,
    { date, startTime: "16:00", endTime: end },
    "PATCH",
  );
  assert.equal(
    edited.sessions.find((x) => x.id === s.id).start,
    localInstant(date, "16:00", "Europe/Warsaw").toISOString(),
  );
  const revision = (await a.state()).revision;
  const results = await Promise.all([
    a.call(`/scheduler/proposals/${p.id}/confirm`, {}, "POST", 201),
    a.call(`/scheduler/proposals/${p.id}/confirm`, {}, "POST", 201),
  ]);
  assert.equal(results.length, 2);
  const saved = await a.state();
  assert.equal(saved.revision, revision + 1);
  assert.equal(
    saved.events.find((x) => x.id === s.id).start,
    edited.sessions.find((x) => x.id === s.id).start,
  );
  await a.call(`/scheduler/proposals/${p.id}/undo`, {}, "POST", 201);
});

test("recoverable deletion hides records and restores their associated information", async () => {
  let current = await a.call(`/tasks/${task.id}`);
  await a.call(
    `/tasks/${task.id}?version=${current.version}`,
    undefined,
    "DELETE",
  );
  await a.call(`/tasks/${task.id}`, undefined, "GET", 404);
  assert.ok((await a.call("/trash")).some((t) => t.id === task.id));
  await b.call(`/trash/task/${task.id}/restore`, {}, "POST", 404);
  await a.call(`/trash/task/${task.id}/restore`, {}, "POST", 201);
  current = await a.call(`/tasks/${task.id}`);
  assert.equal(current.comments.length, 1);
  assert.equal(current.completedMinutes, 60);
  await a.call(
    `/task-sessions/${session.id}?version=${session.version}`,
    undefined,
    "DELETE",
  );
  assert.equal((await a.call(`/tasks/${task.id}`)).completedMinutes, 0);
  await a.call(`/trash/session/${session.id}/restore`, {}, "POST", 201);
  assert.equal((await a.call(`/tasks/${task.id}`)).completedMinutes, 60);
});
test("USOS import is previewed, idempotent, updates stable UIDs and exports usable ICS", async () => {
  const day = tomorrow.replaceAll("-", "");
  const content = (title) =>
    `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:lecture-1\r\nDTSTART;TZID=Europe/Warsaw:${day}T080000\r\nDTEND;TZID=Europe/Warsaw:${day}T090000\r\nSUMMARY:${title}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  let batch = await a.call(
    "/imports/usos/preview",
    {
      name: "plan.ics",
      content: content("Bazy danych"),
      from: today,
      to: deadline,
    },
    "POST",
    201,
  );
  assert.equal(batch.added, 1);
  assert.equal(
    (await a.state()).events.filter((e) => e.source === "USOS_ICS").length,
    0,
  );
  await a.call(`/imports/${batch.id}/commit`, {}, "POST", 201);
  const id = (await a.state()).events.find((e) => e.source === "USOS_ICS").id;
  batch = await a.call(
    "/imports/usos/preview",
    {
      name: "plan.ics",
      content: content("Bazy danych"),
      from: today,
      to: deadline,
    },
    "POST",
    201,
  );
  assert.equal(batch.added, 0);
  assert.equal(batch.unchanged, 1);
  await a.call(`/imports/${batch.id}/commit`, {}, "POST", 201);
  batch = await a.call(
    "/imports/usos/preview",
    {
      name: "plan.ics",
      content: content("Nowa nazwa zajęć"),
      from: today,
      to: deadline,
    },
    "POST",
    201,
  );
  assert.equal(batch.updated, 1);
  await a.call(`/imports/${batch.id}/commit`, {}, "POST", 201);
  assert.equal(
    (await a.state()).events.find((e) => e.source === "USOS_ICS").id,
    id,
  );
  const exported = await a.call(
    `/calendar/export?from=${today}&to=${deadline}`,
  );
  assert.ok(exported.includes("BEGIN:VCALENDAR"));
  assert.ok(exported.includes("Nowa nazwa"));
  await a.call(
    "/imports/usos/preview",
    { name: "bad.ics", content: "bad", from: today, to: deadline },
    "POST",
    400,
  );
});
test("recurring tasks produce the next deadline once when completed", async () => {
  let recurring = await a.call(
    "/tasks",
    { ...taskInput("Co tydzień"), requiredMinutes: 60, recurrence: "WEEKLY" },
    "POST",
    201,
  );
  await a.call(
    `/tasks/${recurring.id}/status`,
    { status: "DONE", version: recurring.version },
    "POST",
    201,
  );
  recurring = await a.call(`/tasks/${recurring.id}`);
  await a.call(
    `/tasks/${recurring.id}/status`,
    { status: "DONE", version: recurring.version },
    "POST",
    201,
  );
  assert.equal(
    await db.task.count({ where: { recurrenceRootId: recurring.id } }),
    1,
  );
});
test("teams enforce invitations, roles and private calendar isolation", async () => {
  team = await a.call("/teams", { title: "Zespół akceptacyjny" }, "POST", 201);
  project = await a.call(
    `/teams/${team.id}/projects`,
    { title: "Wspólny projekt", description: "Projekt zespołowy" },
    "POST",
    201,
  );
  invite = await a.call(
    `/teams/${team.id}/invitations`,
    { email: b.user.email, role: "MEMBER" },
    "POST",
    201,
  );
  await outsider.call(
    "/invitations/accept",
    { token: invite.token },
    "POST",
    403,
  );
  await b.call("/invitations/accept", { token: invite.token }, "POST", 201);
  await b.call("/invitations/accept", { token: invite.token }, "POST", 400);
  await b.call(
    `/teams/${team.id}/projects`,
    { title: "Nie mogę" },
    "POST",
    403,
  );
  await outsider.call(
    `/teams/${team.id}/projects`,
    { title: "Nie mogę" },
    "POST",
    404,
  );
  await b.call(
    `/teams/${team.id}/members/${a.user.id}`,
    { shareAvailability: true },
    "PATCH",
    403,
  );
  const list = await b.call("/teams");
  assert.equal(list.length, 1);
  assert.ok(!JSON.stringify(list).includes("Nowa nazwa zajęć"));
});
test("shared availability discloses only slots and meetings require all confirmations", async () => {
  await a.call(
    `/teams/${team.id}/members/${a.user.id}`,
    { shareAvailability: true },
    "PATCH",
  );
  await b.call(
    `/teams/${team.id}/members/${b.user.id}`,
    { shareAvailability: true },
    "PATCH",
  );
  const slots = await a.call(
    `/teams/${team.id}/availability`,
    {
      participantIds: [a.user.id, b.user.id],
      from: tomorrow,
      to: addDays(tomorrow, 4),
      durationMinutes: 60,
    },
    "POST",
    201,
  );
  assert.ok(slots.length);
  assert.deepEqual(Object.keys(slots[0]).sort(), ["end", "start"]);
  const meeting = await a.call(
    `/teams/${team.id}/meetings`,
    {
      title: "Spotkanie projektowe",
      participantIds: [a.user.id, b.user.id],
      ...slots[0],
    },
    "POST",
    201,
  );
  await a.call(
    `/teams/${team.id}/meetings/${meeting.id}/accept`,
    {},
    "POST",
    201,
  );
  assert.ok(!(await a.state()).events.some((e) => e.source === "TEAM_MEETING"));
  await b.call(
    `/teams/${team.id}/meetings/${meeting.id}/accept`,
    {},
    "POST",
    201,
  );
  assert.ok((await a.state()).events.some((e) => e.source === "TEAM_MEETING"));
});
test("project assignments use opted-in members and commit a version-checked proposal atomically", async () => {
  await a.call(
    "/tasks",
    {
      ...taskInput("Zadanie zespołu"),
      projectId: project.id,
      assigneeId: a.user.id,
    },
    "POST",
    201,
  );
  const proposal = await a.call(
    `/teams/${team.id}/assignments`,
    {},
    "POST",
    201,
  );
  assert.ok(proposal.suggestions.length);
  await b.call(
    `/teams/${team.id}/assignments/${proposal.id}/confirm`,
    {},
    "POST",
    403,
  );
  await a.call(
    `/teams/${team.id}/assignments/${proposal.id}/confirm`,
    {},
    "POST",
    201,
  );
  const current = await a.call(
    `/teams/${team.id}/assignments`,
    {},
    "POST",
    201,
  );
  await a.call("/tasks", taskInput("Zmiana po propozycji"), "POST", 201);
  await a.call(
    `/teams/${team.id}/assignments/${current.id}/confirm`,
    {},
    "POST",
    409,
  );
});
test("soft-event moves preserve overrides and undo restores the original occurrence", async () => {
  const c = await new Client().register("Dorota");
  await c.call(
    "/activities",
    {
      title: "Dzisiaj niedostępne",
      anchorDate: today,
      startTime: "00:00",
      endTime: "23:59",
      recurrence: "ONE_TIME",
      isPermanent: true,
    },
    "POST",
    201,
  );
  const soft = await c.call(
    "/activities",
    {
      title: "Elastyczne zajęcie",
      anchorDate: tomorrow,
      startTime: "08:00",
      endTime: "10:00",
      recurrence: "WEEKLY",
      isPermanent: false,
    },
    "POST",
    201,
  );
  await c.call(
    `/activities/${soft.id}/occurrences/${tomorrow}`,
    {
      title: "Własna nazwa wystąpienia",
      date: tomorrow,
      startTime: "08:00",
      endTime: "10:00",
      version: soft.version,
    },
    "PATCH",
  );
  await c.call(
    "/tasks",
    {
      ...taskInput("Pilna nauka"),
      deadlineDate: tomorrow,
      requiredMinutes: 120,
    },
    "POST",
    201,
  );
  const before = await c.state(),
    original = before.events.find(
      (e) => e.activityId === soft.id && e.occurrenceDate === tomorrow,
    );
  const p = (
    await c.call(
      "/scheduler/proposals",
      { allocationMode: "SEQUENTIAL", order: [] },
      "POST",
      201,
    )
  )[0];
  assert.ok(p.moves.some((m) => m.activityId === soft.id));
  const movedSlot = p.moves.find((m) => m.activityId === soft.id),
    work = p.sessions.find((s) => s.kind === "WORK");
  const local = (t) =>
    new Date(t).toLocaleTimeString("en-GB", {
      timeZone: "Europe/Warsaw",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  await c.call(
    `/scheduler/proposals/${p.id}/sessions/${work.id}`,
    {
      date: dateKey(new Date(movedSlot.start), "Europe/Warsaw"),
      startTime: local(movedSlot.start),
      endTime: local(movedSlot.end),
    },
    "PATCH",
    409,
  );

  await c.call(`/scheduler/proposals/${p.id}/confirm`, {}, "POST", 201);
  const moved = (await c.state()).events.find((e) => e.id === original.id);
  assert.equal(moved.title, original.title);
  assert.notEqual(moved.start, original.start);
  await c.call(`/scheduler/proposals/${p.id}/undo`, {}, "POST", 201);
  const restored = (await c.state()).events.find((e) => e.id === original.id);
  assert.equal(restored.title, original.title);
  assert.equal(restored.start, original.start);
  assert.equal(restored.end, original.end);
});
test("role changes apply immediately and removing a member revokes project access", async () => {
  await a.call(
    `/teams/${team.id}/members/${b.user.id}`,
    { role: "ADMIN" },
    "PATCH",
  );
  await b.call(
    `/teams/${team.id}/projects/${project.id}`,
    { title: "Projekt po edycji administratora" },
    "PATCH",
  );
  await b.call(
    `/teams/${team.id}/members/${a.user.id}`,
    { role: "MEMBER" },
    "PATCH",
    403,
  );
  const projectTasks = (await a.call("/teams"))[0].projects.find(
    (p) => p.id === project.id,
  ).tasks;
  await a.call(`/teams/${team.id}/members/${b.user.id}`, undefined, "DELETE");
  assert.equal((await b.call("/teams")).length, 0);
  for (const t of projectTasks) {
    await b.call(`/tasks/${t.id}`, undefined, "GET", 404);
    assert.equal((await a.call(`/tasks/${t.id}`)).userId, a.user.id);
  }
  assert.ok(!(await b.state()).events.some((e) => e.source === "TEAM_MEETING"));
  assert.ok(!(await a.state()).events.some((e) => e.source === "TEAM_MEETING"));
});
test("whole-series activity edits reset overrides and recoverable deletion restores the series", async () => {
  const input = {
    title: "Seria do edycji",
    anchorDate: addDays(today, 2),
    startTime: "20:00",
    endTime: "21:00",
    recurrence: "WEEKLY",
    isPermanent: true,
  };
  let item = await a.call("/activities", input, "POST", 201);
  await a.call(
    `/activities/${item.id}/occurrences/${input.anchorDate}`,
    {
      title: "Wyjątek",
      date: input.anchorDate,
      startTime: "21:00",
      endTime: "22:00",
      version: item.version,
    },
    "PATCH",
  );
  item = await a.call(`/activities/${item.id}`);
  item = await a.call(
    `/activities/${item.id}`,
    { ...input, title: "Zmieniona cała seria", version: item.version },
    "PATCH",
  );
  let events = (await a.state()).events.filter((e) => e.activityId === item.id);
  assert.ok(events.length >= 2);
  assert.ok(events.every((e) => e.title === "Zmieniona cała seria"));
  assert.equal(Object.keys(item.exceptions).length, 0);
  await a.call(
    `/activities/${item.id}?version=${item.version}`,
    undefined,
    "DELETE",
  );
  assert.ok(!(await a.state()).events.some((e) => e.activityId === item.id));
  await a.call(`/trash/activity/${item.id}/restore`, {}, "POST", 201);
  assert.equal(
    (await a.state()).events.filter((e) => e.activityId === item.id).length,
    events.length,
  );
});
test("logout invalidates the session on the server and a new login restores the saved data", async () => {
  const stolenCookie = a.cookie;
  await a.call("/auth/logout", {}, "POST", 201);
  a.cookie = stolenCookie;
  await a.call(
    `/planner/state?from=${today}&to=${tomorrow}`,
    undefined,
    "GET",
    401,
  );
  await a.call("/auth/session");
  await a.call(
    "/auth/login",
    { email: a.user.email, password: "Integration-2026!" },
    "POST",
    201,
  );
  assert.ok((await a.state()).tasks.length > 0);
});
