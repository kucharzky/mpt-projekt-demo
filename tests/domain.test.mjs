import test from "node:test";
import assert from "node:assert/strict";
import time from "../apps/api/dist/planner/domain/time.js";
import scheduler from "../apps/api/dist/planner/domain/scheduler.js";
import ics from "../apps/api/dist/imports/ics.js";
const {
  localInstant,
  dateKey,
  addDays,
  daysBetween,
  expandActivities,
  freeWindows,
  defaultPreferences,
  overlaps,
} = time;
const { schedule } = scheduler;
const zone = "Europe/Warsaw",
  now = new Date("2026-11-05T06:00:00Z");
const task = (id = "a", minutes = 180, deadline = "2026-11-08") => ({
  id,
  title: id,
  deadlineDate: new Date(deadline + "T00:00:00Z"),
  requiredMinutes: minutes,
  minSessionMinutes: 60,
  maxSessionMinutes: 120,
  importance: 1,
  tieBreakerOrder: 0,
  allocationMode: "SEQUENTIAL",
  status: "TODO",
});
const block = (id, start, end, extra = {}) => ({
  id,
  title: id,
  start: new Date(start),
  end: new Date(end),
  source: "USOS_ICS",
  isPermanent: true,
  ...extra,
});
const span = (day, start, end, id = "class") =>
  block(id, localInstant(day, start, zone), localInstant(day, end, zone));

test("local recurrence preserves wall-clock time across daylight saving change", () => {
  const a = {
    id: "series",
    title: "Seminarium",
    location: "",
    recurrence: "WEEKLY",
    anchorDate: "2026-10-19",
    startTime: "09:00",
    endTime: "10:00",
    isPermanent: true,
    version: 0,
    exceptions: {},
  };
  const events = expandActivities([a], "2026-10-19", "2026-11-03", zone);
  assert.deepEqual(
    events.map((e) => e.start.toISOString()),
    [
      "2026-10-19T07:00:00.000Z",
      "2026-10-26T08:00:00.000Z",
      "2026-11-02T08:00:00.000Z",
    ],
  );
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
});
test("monthly activities clamp to month end and never appear before their anchor", () => {
  const events = expandActivities(
    [
      {
        id: "m",
        title: "m",
        recurrence: "MONTHLY",
        anchorDate: "2026-01-31",
        startTime: "09:00",
        endTime: "10:00",
        isPermanent: true,
        version: 0,
        exceptions: {},
      },
    ],
    "2026-01-01",
    "2026-04-02",
    zone,
  );
  assert.deepEqual(
    events.map((e) => e.occurrenceDate),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
});
test("occurrence overrides stay identifiable and moved occurrences enter a different query range", () => {
  const events = expandActivities(
    [
      {
        id: "s",
        title: "Trening",
        recurrence: "WEEKLY",
        anchorDate: "2026-10-05",
        startTime: "09:00",
        endTime: "10:00",
        isPermanent: false,
        version: 0,
        exceptions: {
          "2026-10-05": {
            start: "2026-11-06T12:00:00Z",
            end: "2026-11-06T13:00:00Z",
          },
          "2026-11-02": { cancelled: true },
        },
      },
    ],
    "2026-11-02",
    "2026-11-09",
    zone,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "s:2026-10-05");
});
test("adjacent intervals do not overlap and hard-only free slots ignore soft work", () => {
  assert.equal(overlaps({ start: 0, end: 60 }, { start: 60, end: 90 }), false);
  const soft = span("2026-11-05", "09:00", "10:00", "soft");
  soft.isPermanent = false;
  soft.source = "SCHEDULED_TASK";
  const slots = freeWindows(
    [span("2026-11-05", "10:00", "11:00"), soft],
    "2026-11-05",
    "2026-11-06",
    zone,
    defaultPreferences,
  );
  assert.equal(slots.length, 2);
  assert.equal(
    slots[0].end.toISOString(),
    localInstant("2026-11-05", "10:00", zone).toISOString(),
  );
});
test("both placement strategies preserve hard locks, deadlines, transition buffers and total budget", () => {
  const hard = span("2026-11-05", "08:00", "12:00");
  for (const strategy of ["earliest", "balanced"]) {
    const result = schedule(
      [task()],
      [hard],
      zone,
      defaultPreferences,
      strategy,
      now,
    );
    assert.equal(result.totals[0].placed, 180);
    assert.equal(result.totals[0].missing, 0);
    const work = result.sessions.filter((s) => s.kind === "WORK");
    for (const s of work) {
      assert.ok(new Date(s.start) >= now);
      assert.ok(dateKey(new Date(s.end), zone) <= "2026-11-08");
      assert.equal(overlaps(s, hard), false);
      if (dateKey(new Date(s.start), zone) === "2026-11-05")
        assert.ok(
          new Date(s.start) >= localInstant("2026-11-05", "12:15", zone),
        );
    }
    for (let i = 0; i < work.length; i++)
      for (let j = i + 1; j < work.length; j++)
        assert.equal(overlaps(work[i], work[j]), false);
  }
});
test("scarcity is explicit and never spills past the deadline", () => {
  const result = schedule(
    [task("scarce", 600, "2026-11-05")],
    [],
    zone,
    { ...defaultPreferences, dailyLimit: 120 },
    "earliest",
    now,
  );
  assert.equal(result.totals[0].placed, 120);
  assert.equal(result.totals[0].missing, 480);
});
test("earlier deadlines preempt movable future work while pinned sessions remain", () => {
  const future = span("2026-11-05", "08:00", "10:00", "old");
  future.source = "SCHEDULED_TASK";
  future.isPermanent = false;
  future.taskId = "late";
  future.status = "PLANNED";
  const tasks = [
    task("late", 120, "2026-11-08"),
    task("urgent", 60, "2026-11-05"),
  ];
  const result = schedule(
    tasks,
    [future],
    zone,
    defaultPreferences,
    "earliest",
    now,
  );
  assert.equal(result.sessions.find((s) => s.kind === "WORK").taskId, "urgent");
  future.pinned = true;
  const pinned = schedule(
    tasks,
    [future],
    zone,
    defaultPreferences,
    "earliest",
    now,
  );
  assert.ok(pinned.sessions.every((s) => !overlaps(s, future)));
  assert.equal(pinned.totals.find((t) => t.taskId === "late").requested, 0);
});
test("completion is explicit and an unconfirmed past session is not silently rescheduled", () => {
  const past = span("2026-11-04", "15:00", "16:00", "past");
  Object.assign(past, {
    source: "SCHEDULED_TASK",
    isPermanent: false,
    taskId: "a",
    status: "PLANNED",
  });
  let result = schedule(
    [task("a", 60)],
    [past],
    zone,
    defaultPreferences,
    "earliest",
    now,
  );
  assert.equal(result.sessions.filter((s) => s.kind === "WORK").length, 0);
  past.status = "MISSED";
  result = schedule(
    [task("a", 60)],
    [past],
    zone,
    defaultPreferences,
    "earliest",
    now,
  );
  assert.equal(result.totals[0].placed, 60);
});
test("same-deadline even split alternates all competitors and custom ordering is respected", () => {
  const tasks = [task("a", 120), task("b", 120), task("c", 120)];
  tasks.forEach((t) => (t.maxSessionMinutes = 60));
  const result = schedule(
    tasks,
    [],
    zone,
    defaultPreferences,
    "earliest",
    now,
    "EVEN_SPLIT",
    ["c", "b", "a"],
  );
  assert.deepEqual(
    result.sessions
      .filter((s) => s.kind === "WORK")
      .slice(0, 6)
      .map((s) => s.taskId),
    ["c", "b", "a", "c", "b", "a"],
  );
});
test("recovery stays on the same day and balanced scheduling never aborts because it cannot fit", () => {
  const t = task("a", 240, "2026-11-05");
  t.maxSessionMinutes = 60;
  const result = schedule([t], [], zone, defaultPreferences, "earliest", now);
  assert.ok(result.sessions.some((s) => s.kind === "RECOVERY"));
  for (const s of result.sessions.filter((s) => s.kind === "RECOVERY"))
    assert.equal(
      dateKey(new Date(s.start), zone),
      dateKey(new Date(+new Date(s.end) - 1), zone),
    );
  const short = schedule(
    [task("a", 120, "2026-11-05")],
    [],
    zone,
    { ...defaultPreferences, workStart: 480, workEnd: 630, recovery: 120 },
    "balanced",
    now,
  );
  assert.equal(short.totals[0].placed, 120);
});
test("soft moves preserve every occurrence or keep it as a barrier when no replacement fits", () => {
  const soft = span("2026-11-05", "08:00", "09:00", "soft");
  Object.assign(soft, {
    source: "CUSTOM_ACTIVITY",
    isPermanent: false,
    activityId: "series",
    occurrenceDate: "2026-11-05",
  });
  const result = schedule(
    [task("a", 60, "2026-11-05")],
    [soft],
    zone,
    defaultPreferences,
    "earliest",
    now,
  );
  assert.equal(result.moves.length, 1);
  assert.ok(
    result.sessions
      .filter((s) => s.kind === "WORK")
      .every((s) => !overlaps(s, result.moves[0])),
  );
  const tiny = schedule(
    [task("a", 60, "2026-11-05")],
    [soft],
    zone,
    { ...defaultPreferences, workStart: 480, workEnd: 540 },
    "earliest",
    now,
  );
  assert.equal(tiny.moves.length, 0);
  assert.equal(tiny.totals[0].missing, 60);
});
const calendar = (body) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//QA//PL\r\n${body}\r\nEND:VCALENDAR\r\n`;
test("ICS handles IANA timezones, folding, escaped text and recurrence exceptions", () => {
  const text = calendar(
    "BEGIN:VEVENT\r\nUID:lecture\r\nDTSTART;TZID=Europe/Warsaw:20261019T090000\r\nDTEND;TZID=Europe/Warsaw:20261019T100000\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nEXDATE;TZID=Europe/Warsaw:20261026T090000\r\nSUMMARY:Bazy\\, dane i\r\n  coś więcej\r\nEND:VEVENT",
  );
  const result = ics.parseIcs(text, zone, "2026-10-01", "2026-11-10");
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].start, "2026-10-19T07:00:00.000Z");
  assert.equal(result.events[1].start, "2026-11-02T08:00:00.000Z");
  assert.ok(result.events[0].title.includes("Bazy, dane"));
});
test("invalid ICS and inverted intervals fail without inventing fallback classes", () => {
  assert.throws(() =>
    ics.parseIcs("not a calendar", zone, "2026-11-01", "2026-12-01"),
  );
  assert.throws(() =>
    ics.parseIcs(
      calendar(
        "BEGIN:VEVENT\r\nUID:bad\r\nDTSTART:20261105T100000Z\r\nDTEND:20261105T090000Z\r\nEND:VEVENT",
      ),
      zone,
      "2026-11-01",
      "2026-12-01",
    ),
  );
});
test("ICS export round-trips unicode, escaping, stable identity and times", () => {
  const original = {
    id: "unique",
    title: "Długi tytuł Ąę, test; " + "ć".repeat(90),
    location: "Biblioteka",
    start: new Date("2026-11-05T12:00:00Z"),
    end: new Date("2026-11-05T13:00:00Z"),
  };
  const exported = ics.exportIcs([original], now),
    result = ics.parseIcs(exported, zone, "2026-11-01", "2026-12-01");
  assert.equal(result.events[0].title, original.title);
  assert.equal(result.events[0].start, original.start.toISOString());
  assert.equal(result.events[0].uid, "unique@smartuniplanner.local");
  for (const line of exported.trim().split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("missed pinned sessions release shared availability and scheduling capacity", () => {
  const missed = {
    ...span("2026-11-05", "08:00", "10:00", "missed"),
    source: "SCHEDULED_TASK",
    isPermanent: false,
    taskId: "a",
    status: "MISSED",
    pinned: true,
  };
  const prefs = {
    ...defaultPreferences,
    workStart: 480,
    workEnd: 600,
    buffer: 0,
    recovery: 0,
  };
  const windows = freeWindows(
    [missed],
    "2026-11-05",
    "2026-11-06",
    zone,
    prefs,
    false,
  );
  assert.equal(windows.length, 1);
  assert.equal(+windows[0].end - +windows[0].start, 120 * 60000);
  const result = schedule(
    [task("a", 120, "2026-11-05")],
    [missed],
    zone,
    prefs,
    "earliest",
    now,
  );
  assert.equal(result.totals[0].placed, 120);
  assert.equal(result.totals[0].missing, 0);
});

test("ongoing soft activities keep their current time during replanning", () => {
  const ongoing = {
    ...span("2026-11-05", "09:00", "11:00", "ongoing"),
    source: "CUSTOM_ACTIVITY",
    isPermanent: false,
    activityId: "soft",
    occurrenceDate: "2026-11-05",
  };
  const clock = localInstant("2026-11-05", "10:00", zone);
  const result = schedule(
    [task("a", 60, "2026-11-05")],
    [ongoing],
    zone,
    defaultPreferences,
    "earliest",
    clock,
  );
  assert.equal(result.moves.length, 0);
  assert.ok(
    new Date(result.sessions[0].start) >=
      localInstant("2026-11-05", "11:15", zone),
  );
});

test("ICS recurrence expansion has a cumulative budget across the whole upload", () => {
  const events = [1, 2]
    .map((id) =>
      [
        "BEGIN:VEVENT",
        `UID:budget-${id}`,
        "DTSTART:19850101T100000Z",
        "DTEND:19850101T110000Z",
        "RRULE:FREQ=DAILY;COUNT=20000",
        "SUMMARY:Budget test",
        "END:VEVENT",
      ].join("\r\n"),
    )
    .join("\r\n");
  const text = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR\r\n`;
  assert.throws(
    () => ics.parseIcs(text, "Europe/Warsaw", "2026-11-01", "2026-11-10"),
    /limit obliczeń/,
  );
});

test("ICS metadata limits also cover exported recurrence exceptions without a master", () => {
  const text = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:orphan-exception",
    "RECURRENCE-ID:20261105T100000Z",
    "DTSTART:20261105T110000Z",
    "DTEND:20261105T120000Z",
    `SUMMARY:${"x".repeat(501)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  assert.throws(
    () => ics.parseIcs(text, "Europe/Warsaw", "2026-11-01", "2026-11-10"),
    /zbyt długie/,
  );
});
