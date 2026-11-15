import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Task } from "@prisma/client";
import { DatabaseService, Transaction } from "../database/database.service";
import {
  ActivityInputDto,
  OccurrenceDto,
  PreferencesInputDto,
  ProposalInputDto,
  ProposalSessionDto,
  SessionDto,
  TaskInputDto,
} from "../http.dto";
import {
  addDays,
  dateKey,
  daysBetween,
  dayWindow,
  defaultPreferences,
  EventBlock,
  expandActivities,
  freeWindows,
  localInstant,
  minuteTime,
  nextDeadline,
  overlaps,
  Preferences,
  validDate,
} from "./domain/time";
import { schedule, ScheduleResult } from "./domain/scheduler";
import type { ImportedItem } from "./domain/import";
import { publicUser } from "../auth/session";
import { randomUUID } from "node:crypto";

export const json = (data: unknown) =>
  JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
export function assertDate(date: string) {
  if (!validDate(date)) throw new BadRequestException("Nieprawidłowa data.");
}
export function assertRange(from: string, to: string, max = 370) {
  assertDate(from);
  assertDate(to);
  if (daysBetween(from, to) < 1 || daysBetween(from, to) > max)
    throw new BadRequestException(`Wybierz zakres od 1 do ${max} dni.`);
}
export function checkVersion(actual: number, expected: number | undefined) {
  if (expected === undefined || actual !== expected)
    throw new ConflictException(
      "Dane zmieniły się w innej karcie. Odśwież widok i spróbuj ponownie.",
    );
}
export const taskInclude = {
  user: { select: { name: true } },
  sessions: { where: { deletedAt: null } },
} as const;
export function taskView(
  task: Task & {
    user?: { name: string };
    sessions?: { kind: string; status: string; start: Date; end: Date }[];
  },
) {
  const sessions = task.sessions ?? [],
    minutes = (s: { start: Date; end: Date }) => (+s.end - +s.start) / 60000;
  const completedMinutes = sessions
    .filter((s) => s.kind === "WORK" && s.status === "COMPLETED")
    .reduce((sum, s) => sum + minutes(s), 0);
  const plannedMinutes = sessions
    .filter((s) => s.kind === "WORK" && s.status === "PLANNED")
    .reduce((sum, s) => sum + minutes(s), 0);
  return {
    ...task,
    deadlineDate: task.deadlineDate.toISOString().slice(0, 10),
    assigneeName: task.user?.name ?? "",
    sessions: undefined,
    user: undefined,
    completedMinutes,
    plannedMinutes,
    missingMinutes: Math.max(
      0,
      task.requiredMinutes - completedMinutes - plannedMinutes,
    ),
  };
}

@Injectable()
export class PlannerService {
  constructor(readonly db: DatabaseService) {}
  prefs(value: unknown): Preferences {
    return { ...defaultPreferences, ...(value as Partial<Preferences>) };
  }
  async events(
    tx: Transaction,
    userId: string,
    from: string,
    to: string,
    history = false,
  ): Promise<EventBlock[]> {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const lower = localInstant(from, "00:00", user.timezone),
      upper = localInstant(to, "00:00", user.timezone);
    const [activities, imported, sessions, meetings] = await Promise.all([
      tx.activity.findMany({ where: { userId, deletedAt: null } }),
      tx.importedEvent.findMany({
        where: { userId, start: { lt: upper }, end: { gt: lower } },
      }),
      tx.taskSession.findMany({
        where: {
          userId,
          deletedAt: null,
          task: { deletedAt: null },
          ...(history ? {} : { start: { lt: upper }, end: { gt: lower } }),
        },
        include: { task: { select: { title: true } } },
      }),
      tx.meeting.findMany({
        where: {
          participantIds: { has: userId },
          status: "CONFIRMED",
          start: { lt: upper },
          end: { gt: lower },
        },
      }),
    ]);
    return [
      ...expandActivities(activities, from, to, user.timezone),
      ...imported.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        source: e.source,
        isPermanent: true,
        location: e.location,
      })),
      ...sessions.map((s) => ({
        id: s.id,
        title: s.kind === "RECOVERY" ? "Przerwa regeneracyjna" : s.task.title,
        start: s.start,
        end: s.end,
        source: s.kind === "RECOVERY" ? "RECOVERY_BREAK" : "SCHEDULED_TASK",
        isPermanent: false,
        taskId: s.taskId,
        status: s.status,
        pinned: s.pinned,
        version: s.version,
      })),
      ...meetings.map((m) => ({
        id: m.id,
        title: m.title,
        start: m.start,
        end: m.end,
        source: "TEAM_MEETING",
        isPermanent: true,
      })),
    ];
  }
  async snapshot(userId: string, from: string, to: string) {
    assertRange(from, to, 62);
    return this.db.$transaction(
      async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } }),
          state = await tx.plannerState.findUniqueOrThrow({
            where: { userId },
          });
        const tasks = await tx.task.findMany({
          where: { userId, deletedAt: null },
          include: taskInclude,
          orderBy: [{ deadlineDate: "asc" }, { importance: "desc" }],
        });
        const events = await this.events(tx, userId, from, to),
          preferences = this.prefs(user.preferences),
          conflicts = new Set<string>();
        for (let a = 0; a < events.length; a++)
          for (let b = a + 1; b < events.length; b++)
            if (
              events[a].source !== "RECOVERY_BREAK" &&
              events[b].source !== "RECOVERY_BREAK" &&
              events[a].status !== "MISSED" &&
              events[b].status !== "MISSED" &&
              overlaps(events[a], events[b])
            ) {
              conflicts.add(events[a].id);
              conflicts.add(events[b].id);
            }
        return {
          user: publicUser(user),
          revision: state.revision,
          preferences,
          tasks: tasks.map(taskView),
          events,
          freeSlots: freeWindows(events, from, to, user.timezone, preferences),
          conflicts: [...conflicts],
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async taskAccess(tx: Transaction, userId: string, id: string, write = false) {
    const task = await tx.task.findUnique({
      where: { id },
      include: {
        ...taskInclude,
        project: true,
        comments: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
        resources: true,
      },
    });
    if (!task || task.deletedAt)
      throw new NotFoundException("Nie znaleziono zadania.");
    if (task.project) {
      const member = await tx.membership.findUnique({
        where: { teamId_userId: { teamId: task.project.teamId, userId } },
      });
      if (
        member &&
        (!write || member.role !== "MEMBER" || task.userId === userId)
      )
        return task;
    } else if (task.userId === userId) return task;
    throw new NotFoundException("Nie znaleziono zadania.");
  }
  async taskDetails(userId: string, id: string) {
    const t = await this.taskAccess(this.db, userId, id);
    return {
      ...taskView(t),
      comments: t.comments.map((c) => ({
        id: c.id,
        body: c.body,
        author: c.user.name,
        createdAt: c.createdAt,
      })),
      resources: t.resources,
    };
  }
  private validateTask(input: TaskInputDto) {
    assertDate(input.deadlineDate);
    if (input.requiredMinutes % 30 !== 0)
      throw new BadRequestException("Czas pracy podaj w krokach po 30 minut.");
    const min = Math.min(input.minSessionMinutes ?? 60, input.requiredMinutes),
      max = input.maxSessionMinutes ?? 120;
    if (min % 30 || max % 30 || min > max)
      throw new BadRequestException(
        "Nieprawidłowa długość sesji. Minimum nie może przekraczać maksimum.",
      );
    return { min, max };
  }
  async saveTask(userId: string, input: TaskInputDto, id?: string) {
    const { min, max } = this.validateTask(input);
    const existing = id
      ? await this.taskAccess(this.db, userId, id, true)
      : null;
    const targetUser = input.assigneeId ?? existing?.userId ?? userId;
    return this.db.mutate(
      [userId, targetUser, ...(existing ? [existing.userId] : [])],
      async (tx) => {
        const old = id ? await this.taskAccess(tx, userId, id, true) : null;
        if (old) checkVersion(old.version, input.version);
        const projectId = old?.projectId ?? input.projectId;
        if (projectId) {
          const project = await tx.project.findUnique({
            where: { id: projectId },
          });
          const member = project
            ? await tx.membership.findUnique({
                where: { teamId_userId: { teamId: project.teamId, userId } },
              })
            : null;
          if (!project || !member)
            throw new ForbiddenException("Brak dostępu do projektu.");
          if (targetUser !== userId && member.role === "MEMBER")
            throw new ForbiddenException(
              "Tylko administrator może przypisywać zadania innym osobom.",
            );
          if (
            !(await tx.membership.findUnique({
              where: {
                teamId_userId: { teamId: project.teamId, userId: targetUser },
              },
            }))
          )
            throw new BadRequestException(
              "Wybrana osoba nie należy do zespołu.",
            );
        } else if (targetUser !== userId)
          throw new ForbiddenException(
            "Nie możesz przypisać prywatnego zadania innej osobie.",
          );
        const data = {
          userId: targetUser,
          title: input.title.trim(),
          description: input.description ?? "",
          deadlineDate: new Date(input.deadlineDate + "T00:00:00Z"),
          requiredMinutes: input.requiredMinutes,
          minSessionMinutes: min,
          maxSessionMinutes: max,
          importance: input.importance ?? 1,
          recurrence:
            input.recurrence === "NONE" ? null : (input.recurrence ?? null),
          projectId: projectId ?? null,
        };
        if (!data.title) throw new BadRequestException("Podaj tytuł zadania.");
        const task = old
          ? await tx.task.update({
              where: { id: old.id },
              data: { ...data, version: { increment: 1 } },
            })
          : await tx.task.create({ data });
        if (old && old.userId !== targetUser)
          await tx.taskSession.deleteMany({
            where: {
              taskId: task.id,
              start: { gt: new Date() },
              status: "PLANNED",
            },
          });
        if (input.status && input.status !== task.status)
          await this.setTaskStatus(tx, task, input.status);
        return taskView(
          await tx.task.findUniqueOrThrow({
            where: { id: task.id },
            include: taskInclude,
          }),
        );
      },
    );
  }
  async changeStatus(
    userId: string,
    id: string,
    status: string,
    version: number,
  ) {
    const task = await this.taskAccess(this.db, userId, id, true);
    return this.db.mutate([task.userId], async (tx) => {
      const current = await this.taskAccess(tx, userId, id, true);
      checkVersion(current.version, version);
      await this.setTaskStatus(tx, current, status);
      return { ok: true };
    });
  }
  private async setTaskStatus(tx: Transaction, task: Task, status: string) {
    await tx.task.update({
      where: { id: task.id },
      data: { status, version: { increment: 1 } },
    });
    if (status === "DONE") {
      await tx.taskSession.deleteMany({
        where: {
          taskId: task.id,
          start: { gt: new Date() },
          status: "PLANNED",
        },
      });
      if (task.status !== "DONE" && task.recurrence) {
        const deadline = nextDeadline(
            task.deadlineDate.toISOString().slice(0, 10),
            task.recurrence,
          ),
          root = task.recurrenceRootId ?? task.id;
        const exists = await tx.task.findUnique({
          where: {
            recurrenceRootId_deadlineDate: {
              recurrenceRootId: root,
              deadlineDate: new Date(deadline + "T00:00:00Z"),
            },
          },
        });
        if (!exists)
          await tx.task.create({
            data: {
              userId: task.userId,
              title: task.title,
              description: task.description,
              requiredMinutes: task.requiredMinutes,
              minSessionMinutes: task.minSessionMinutes,
              maxSessionMinutes: task.maxSessionMinutes,
              importance: task.importance,
              deadlineDate: new Date(deadline + "T00:00:00Z"),
              recurrence: task.recurrence,
              recurrenceRootId: root,
              projectId: task.projectId,
            },
          });
      }
    }
  }
  async deleteTask(userId: string, id: string, version: number) {
    const task = await this.taskAccess(this.db, userId, id, true);
    return this.db.mutate([task.userId], async (tx) => {
      const t = await this.taskAccess(tx, userId, id, true);
      checkVersion(t.version, version);
      await tx.task.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      return { ok: true };
    });
  }
  async settings(userId: string, input: PreferencesInputDto) {
    try {
      new Intl.DateTimeFormat("pl", { timeZone: input.timezone });
    } catch {
      throw new BadRequestException("Nieprawidłowa strefa czasowa.");
    }
    if (
      input.workStart >= input.workEnd ||
      input.weekendStart > input.weekendEnd
    )
      throw new BadRequestException(
        "Godzina końca musi być późniejsza niż początek. Równe godziny weekendu wyłączają planowanie.",
      );
    const { timezone, revision, ...preferences } = input;
    return this.db.mutate([userId], async (tx) => {
      checkVersion(
        (await tx.plannerState.findUniqueOrThrow({ where: { userId } }))
          .revision,
        revision,
      );
      await tx.user.update({
        where: { id: userId },
        data: { timezone, preferences: json(preferences) },
      });
      return { ok: true };
    });
  }
  async activity(userId: string, input: ActivityInputDto, id?: string) {
    assertDate(input.anchorDate);
    if (input.untilDate) {
      assertDate(input.untilDate);
      if (input.untilDate < input.anchorDate)
        throw new BadRequestException(
          "Koniec serii nie może poprzedzać początku.",
        );
    }
    if (input.startTime === input.endTime)
      throw new BadRequestException("Aktywność musi mieć dodatnią długość.");
    return this.db.mutate([userId], async (tx) => {
      const old = id
        ? await tx.activity.findFirst({
            where: { id, userId, deletedAt: null },
          })
        : null;
      if (id && !old) throw new NotFoundException();
      if (old) checkVersion(old.version, input.version);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const { allowConflict, version, ...rest } = input;
      void version;
      const candidate = {
        ...rest,
        timezone: old?.timezone ?? user.timezone,
        id: id ?? "candidate",
        location: input.location ?? "",
        untilDate: input.untilDate ?? null,
        exceptions: {},
        version: 0,
      };
      const from = dateKey(new Date(), user.timezone),
        to = addDays(from, 180);
      const candidates = expandActivities(
        [candidate],
        input.recurrence === "ONE_TIME" ? input.anchorDate : from,
        input.recurrence === "ONE_TIME" ? addDays(input.anchorDate, 2) : to,
        user.timezone,
      );
      const others = (
        await this.events(
          tx,
          userId,
          input.recurrence === "ONE_TIME" ? input.anchorDate : from,
          input.recurrence === "ONE_TIME" ? addDays(input.anchorDate, 2) : to,
        )
      ).filter((e) => e.activityId !== id && e.isPermanent);
      if (
        !allowConflict &&
        candidates.some((e) => others.some((other) => overlaps(e, other)))
      )
        throw new ConflictException({
          message:
            "Aktywność nakłada się na stałe wydarzenie. Możesz świadomie zapisać tę kolizję.",
          code: "CALENDAR_OVERLAP",
        });
      const data = {
        ...rest,
        timezone: old?.timezone ?? user.timezone,
        title: input.title.trim(),
        location: input.location ?? "",
        untilDate: input.untilDate ?? null,
        exceptions: {},
      };
      return old
        ? tx.activity.update({
            where: { id },
            data: { ...data, version: { increment: 1 } },
          })
        : tx.activity.create({ data: { ...data, userId } });
    });
  }
  async activityDetails(userId: string, id: string) {
    const result = await this.db.activity.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!result) throw new NotFoundException();
    return result;
  }
  async occurrence(
    userId: string,
    id: string,
    occurrenceDate: string,
    input: OccurrenceDto | undefined,
    version: number,
  ) {
    assertDate(occurrenceDate);
    if (input) assertDate(input.date);
    return this.db.mutate([userId], async (tx) => {
      const activity = await tx.activity.findFirst({
        where: { id, userId, deletedAt: null },
      });
      if (!activity) throw new NotFoundException();
      checkVersion(activity.version, version);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (
        !expandActivities(
          [{ ...activity, exceptions: {} }],
          occurrenceDate,
          addDays(occurrenceDate, 1),
          user.timezone,
        ).length
      )
        throw new BadRequestException("To nie jest wystąpienie tej serii.");
      const exceptions = activity.exceptions as Record<string, unknown>;
      let patch: unknown = {
        ...((exceptions[occurrenceDate] as Record<string, unknown>) ?? {}),
        cancelled: true,
      };
      if (input) {
        const start = localInstant(input.date, input.startTime, user.timezone),
          end = localInstant(
            input.endTime <= input.startTime
              ? addDays(input.date, 1)
              : input.date,
            input.endTime,
            user.timezone,
          );
        if (+end <= +start || +end - +start > 24 * 3600000)
          throw new BadRequestException("Nieprawidłowy czas wydarzenia.");
        const others = (
          await this.events(tx, userId, input.date, addDays(input.date, 2))
        ).filter((e) => e.isPermanent && e.id !== `${id}:${occurrenceDate}`);
        if (
          !input.allowConflict &&
          others.some((e) => overlaps(e, { start, end }))
        )
          throw new ConflictException({
            message: "Wystąpienie koliduje ze stałym wydarzeniem.",
            code: "CALENDAR_OVERLAP",
          });
        patch = {
          title: input.title.trim(),
          start: start.toISOString(),
          end: end.toISOString(),
        };
      }
      return tx.activity.update({
        where: { id },
        data: {
          exceptions: json({ ...exceptions, [occurrenceDate]: patch }),
          version: { increment: 1 },
        },
      });
    });
  }
  async deleteActivity(userId: string, id: string, version: number) {
    return this.db.mutate([userId], async (tx) => {
      const a = await tx.activity.findFirst({
        where: { id, userId, deletedAt: null },
      });
      if (!a) throw new NotFoundException();
      checkVersion(a.version, version);
      await tx.activity.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      return { ok: true };
    });
  }
  async session(
    userId: string,
    taskId: string,
    input: SessionDto,
    id?: string,
  ) {
    assertDate(input.date);
    return this.db.mutate([userId], async (tx) => {
      const task = await this.taskAccess(tx, userId, taskId, true);
      if (task.userId !== userId)
        throw new ForbiddenException(
          "Sesje planuje osoba przypisana do zadania.",
        );
      const old = id
        ? await tx.taskSession.findFirst({
            where: { id, userId, taskId, deletedAt: null },
          })
        : null;
      if (id && !old) throw new NotFoundException();
      if (old) {
        if (old.kind !== "WORK")
          throw new BadRequestException("Przerwy są wyliczane przez planer.");
        checkVersion(old.version, input.version);
      }
      if (task.status === "DONE")
        throw new BadRequestException(
          "Najpierw przywróć zadanie do realizacji.",
        );
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } }),
        start = localInstant(input.date, input.startTime, user.timezone),
        end = localInstant(
          input.endTime <= input.startTime
            ? addDays(input.date, 1)
            : input.date,
          input.endTime,
          user.timezone,
        );
      const duration = (+end - +start) / 60000;
      if (duration <= 0 || duration > 240 || duration % 15 !== 0)
        throw new BadRequestException(
          "Sesja powinna trwać od 15 minut do 4 godzin, w krokach 15 minut.",
        );
      const others = (
        await this.events(tx, userId, input.date, addDays(input.date, 2))
      ).filter(
        (e) =>
          e.id !== id && e.source !== "RECOVERY_BREAK" && e.status !== "MISSED",
      );
      if (
        !input.allowConflict &&
        others.some((e) => overlaps(e, { start, end }))
      )
        throw new ConflictException({
          message:
            "Sesja nakłada się na inne wydarzenie. Zmień czas albo świadomie zaakceptuj kolizję.",
          code: "CALENDAR_OVERLAP",
        });
      const data = {
        start,
        end,
        status: input.status ?? old?.status ?? "PLANNED",
        pinned: input.pinned ?? true,
      };
      const saved = old
        ? await tx.taskSession.update({
            where: { id },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.taskSession.create({ data: { ...data, taskId, userId } });
      // Rebuild recoveries in the next proposal; manual edits never leave stale breaks.
      await tx.taskSession.deleteMany({
        where: { taskId, kind: "RECOVERY", start: { gt: new Date() } },
      });
      const all = await tx.taskSession.findMany({
        where: { taskId, kind: "WORK", deletedAt: null },
      });
      const total = all
        .filter((s) => s.status !== "MISSED")
        .reduce((sum, s) => sum + (+s.end - +s.start) / 60000, 0);
      const effectiveRequired = Math.max(
        task.requiredMinutes,
        Math.ceil(total / 30) * 30,
      );
      if (effectiveRequired > task.requiredMinutes)
        await tx.task.update({
          where: { id: taskId },
          data: {
            requiredMinutes: effectiveRequired,
            version: { increment: 1 },
          },
        });
      const done = all
        .filter((s) => s.status === "COMPLETED")
        .reduce((sum, s) => sum + (+s.end - +s.start) / 60000, 0);
      if (done >= effectiveRequired) await this.setTaskStatus(tx, task, "DONE");
      else if (done > 0 && task.status === "TODO")
        await tx.task.update({
          where: { id: taskId },
          data: { status: "IN_PROGRESS", version: { increment: 1 } },
        });
      return saved;
    });
  }
  async deleteSession(userId: string, id: string, version: number) {
    return this.db.mutate([userId], async (tx) => {
      const s = await tx.taskSession.findFirst({
        where: { id, userId, kind: "WORK", deletedAt: null },
      });
      if (!s) throw new NotFoundException();
      checkVersion(s.version, version);
      await tx.taskSession.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      await tx.taskSession.deleteMany({
        where: {
          taskId: s.taskId,
          kind: "RECOVERY",
          start: { gt: new Date() },
        },
      });
      return { ok: true };
    });
  }
  async proposals(userId: string, input: ProposalInputDto) {
    return this.db.$transaction(
      async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } }),
          state = await tx.plannerState.findUniqueOrThrow({
            where: { userId },
          }),
          now = new Date();
        const tasks = await tx.task.findMany({
          where: { userId, deletedAt: null, status: { not: "DONE" } },
          orderBy: { deadlineDate: "asc" },
        });
        if (tasks.length > 200)
          throw new BadRequestException(
            "Planer obsługuje maksymalnie 200 aktywnych zadań.",
          );
        if (
          input.order?.some((id) => !tasks.some((t) => t.id === id)) ||
          new Set(input.order).size !== input.order?.length
        ) {
          if (input.order)
            throw new BadRequestException("Nieprawidłowa kolejność zadań.");
        }
        const from = dateKey(now, user.timezone),
          last = tasks.reduce(
            (d, t) =>
              t.deadlineDate.toISOString().slice(0, 10) > d
                ? t.deadlineDate.toISOString().slice(0, 10)
                : d,
            from,
          );
        assertRange(from, addDays(last, 1), 367);
        const events = await this.events(
            tx,
            userId,
            from,
            addDays(last, 1),
            true,
          ),
          preferences = this.prefs(user.preferences),
          result = [];
        for (const strategy of ["earliest", "balanced"] as const) {
          const layout = schedule(
            tasks,
            events,
            user.timezone,
            preferences,
            strategy,
            now,
            input.allocationMode,
            input.order,
          );
          for (const block of layout.sessions) block.id = randomUUID();
          const proposal = await tx.proposal.create({
            data: {
              userId,
              baseRevision: state.revision,
              payload: json(layout),
              expiresAt: new Date(+now + 10 * 60000),
            },
          });
          result.push({ id: proposal.id, revision: state.revision, ...layout });
        }
        return result;
      },
      { isolationLevel: "RepeatableRead", timeout: 20000 },
    );
  }
  async confirmProposal(userId: string, id: string, undo = false) {
    return this.db.mutate([userId], async (tx) => {
      const proposal = await tx.proposal.findFirst({ where: { id, userId } });
      if (!proposal) throw new NotFoundException();
      const state = await tx.plannerState.findUniqueOrThrow({
        where: { userId },
      });
      if (!undo && proposal.status === "CONFIRMED")
        return { ok: true, alreadyConfirmed: true };
      if (undo) {
        if (
          proposal.status !== "CONFIRMED" ||
          proposal.confirmedRevision !== state.revision
        )
          throw new ConflictException(
            "Po zapisaniu planu wprowadzono inne zmiany. Cofnięcie nie jest już bezpieczne.",
          );
        const previous = proposal.previous as unknown as {
          sessions: {
            id: string;
            taskId: string;
            kind: string;
            start: string;
            end: string;
            status: string;
            pinned: boolean;
            version: number;
          }[];
          activities: {
            id: string;
            exceptions: Prisma.InputJsonValue;
            version: number;
          }[];
        };
        const payload = proposal.payload as unknown as ScheduleResult;
        await tx.taskSession.deleteMany({
          where: { userId, id: { in: payload.sessions.map((s) => s.id) } },
        });
        for (const s of previous.sessions)
          await tx.taskSession.create({
            data: {
              ...s,
              version: s.version + 1,
              userId,
              start: new Date(s.start),
              end: new Date(s.end),
            },
          });
        for (const a of previous.activities)
          await tx.activity.update({
            where: { id: a.id },
            data: { exceptions: a.exceptions, version: { increment: 1 } },
          });
        await tx.proposal.update({ where: { id }, data: { status: "UNDONE" } });
        return { ok: true };
      }
      if (proposal.status !== "PENDING" || proposal.expiresAt < new Date())
        throw new ConflictException("Propozycja wygasła. Wygeneruj nową.");
      checkVersion(state.revision, proposal.baseRevision);
      const payload = proposal.payload as unknown as ScheduleResult,
        now = new Date();
      if (payload.sessions.some((s) => new Date(s.start) < now))
        throw new ConflictException(
          "Czas rozpoczęcia sesji już minął. Wygeneruj nową propozycję.",
        );
      const replaceable = await tx.taskSession.findMany({
        where: {
          userId,
          deletedAt: null,
          task: { deletedAt: null },
          start: { gt: now },
          status: "PLANNED",
          pinned: false,
        },
      });
      const activities = await tx.activity.findMany({
        where: {
          id: { in: payload.moves.map((m) => m.activityId) },
          userId,
          deletedAt: null,
        },
      });
      const previousActivities = activities.map(
        ({ id, exceptions, version }) => ({
          id,
          exceptions: json(exceptions),
          version,
        }),
      );
      await tx.taskSession.deleteMany({
        where: { id: { in: replaceable.map((s) => s.id) } },
      });
      if (payload.sessions.length)
        await tx.taskSession.createMany({
          data: payload.sessions.map((s) => ({
            id: s.id,
            userId,
            taskId: s.taskId,
            kind: s.kind,
            start: new Date(s.start),
            end: new Date(s.end),
          })),
        });
      for (const a of activities) {
        const exceptions = a.exceptions as Record<string, unknown>;
        for (const m of payload.moves.filter((m) => m.activityId === a.id))
          exceptions[m.occurrenceDate] = {
            ...((exceptions[m.occurrenceDate] as Record<string, unknown>) ??
              {}),
            start: m.start,
            end: m.end,
          };
        await tx.activity.update({
          where: { id: a.id },
          data: { exceptions: json(exceptions), version: { increment: 1 } },
        });
      }
      await tx.proposal.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          confirmedRevision: state.revision + 1,
          previous: json({
            sessions: replaceable.map(
              ({ id, taskId, kind, start, end, status, pinned, version }) => ({
                id,
                taskId,
                kind,
                start,
                end,
                status,
                pinned,
                version,
              }),
            ),
            activities: previousActivities,
          }),
        },
      });
      return {
        ok: true,
        missingMinutes: payload.totals.reduce((s, t) => s + t.missing, 0),
      };
    });
  }
  async editProposal(
    userId: string,
    id: string,
    sessionId: string,
    input: ProposalSessionDto,
  ) {
    assertDate(input.date);
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "userId" FROM "PlannerState" WHERE "userId" = ${userId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "Proposal" WHERE "id" = ${id} FOR UPDATE`;
        const p = await tx.proposal.findFirst({
          where: { id, userId, status: "PENDING" },
        });
        if (!p || p.expiresAt < new Date())
          throw new ConflictException("Propozycja wygasła.");
        checkVersion(
          (await tx.plannerState.findUniqueOrThrow({ where: { userId } }))
            .revision,
          p.baseRevision,
        );
        const payload = p.payload as unknown as ScheduleResult,
          selected = payload.sessions.find(
            (s) => s.id === sessionId && s.kind === "WORK",
          );
        if (!selected)
          throw new NotFoundException("Nie znaleziono sesji w propozycji.");
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } }),
          task = await tx.task.findFirstOrThrow({
            where: { id: selected.taskId, userId, deletedAt: null },
          }),
          prefs = this.prefs(user.preferences);
        const start = localInstant(input.date, input.startTime, user.timezone),
          end = localInstant(input.date, input.endTime, user.timezone),
          duration = +new Date(selected.end) - +new Date(selected.start),
          now = new Date();
        if (
          +end - +start !== duration ||
          start < now ||
          input.date > task.deadlineDate.toISOString().slice(0, 10)
        )
          throw new BadRequestException(
            "Zachowaj długość sesji i wybierz przyszły termin przed deadline’em.",
          );
        const [ws, we] = dayWindow(input.date, prefs);
        if (
          start < localInstant(input.date, minuteTime(ws), user.timezone) ||
          end > localInstant(input.date, minuteTime(we), user.timezone)
        )
          throw new BadRequestException(
            "Sesja musi mieścić się w Twoich godzinach pracy.",
          );
        const lastDay = [
          ...payload.sessions.map((s) =>
            dateKey(new Date(s.end), user.timezone),
          ),
          ...payload.moves.map((m) => dateKey(new Date(m.end), user.timezone)),
          input.date,
        ]
          .sort()
          .at(-1)!;
        const raw = await this.events(
          tx,
          userId,
          dateKey(now, user.timezone),
          addDays(lastDay, 1),
          true,
        );
        const fixed = raw
          .filter(
            (e) =>
              e.source !== "RECOVERY_BREAK" &&
              e.status !== "MISSED" &&
              (e.source !== "SCHEDULED_TASK" ||
                e.pinned ||
                e.status === "COMPLETED" ||
                e.start <= now),
          )
          .map((e) => {
            const m = payload.moves.find(
              (m) =>
                m.activityId === e.activityId &&
                m.occurrenceDate === e.occurrenceDate,
            );
            return m
              ? { ...e, start: new Date(m.start), end: new Date(m.end) }
              : e;
          });
        for (const move of payload.moves) {
          if (
            !fixed.some(
              (e) =>
                e.activityId === move.activityId &&
                e.occurrenceDate === move.occurrenceDate,
            )
          )
            fixed.push({
              id: `${move.activityId}:${move.occurrenceDate}`,
              activityId: move.activityId,
              occurrenceDate: move.occurrenceDate,
              title: move.title,
              start: new Date(move.start),
              end: new Date(move.end),
              source: "CUSTOM_ACTIVITY",
              isPermanent: false,
            });
        }
        const other = payload.sessions.filter(
          (s) =>
            s.id !== sessionId &&
            !(s.taskId === selected.taskId && s.kind === "RECOVERY"),
        );
        const busy = [
          ...fixed.map((e) => ({
            ...e,
            kind: e.source === "RECOVERY_BREAK" ? "RECOVERY" : "WORK",
          })),
          ...other.map((s) => ({
            ...s,
            start: new Date(s.start),
            end: new Date(s.end),
          })),
        ];
        if (
          busy.some((b) =>
            overlaps(
              { start, end },
              {
                start: new Date(
                  +b.start - (b.kind === "RECOVERY" ? 0 : prefs.buffer * 60000),
                ),
                end: new Date(
                  +b.end + (b.kind === "RECOVERY" ? 0 : prefs.buffer * 60000),
                ),
              },
            ),
          )
        )
          throw new ConflictException(
            "Ten termin koliduje z planem lub wymaganym odstępem.",
          );
        const daily = busy
          .filter(
            (b) =>
              b.kind === "WORK" &&
              "taskId" in b &&
              dateKey(b.start, user.timezone) === input.date,
          )
          .reduce((sum, b) => sum + (+b.end - +b.start) / 60000, 0);
        if (daily + duration / 60000 > prefs.dailyLimit)
          throw new BadRequestException(
            "Zmiana przekracza dzienny limit pracy nad zadaniami.",
          );
        payload.sessions = payload.sessions.filter(
          (s) => !(s.taskId === selected.taskId && s.kind === "RECOVERY"),
        );
        const target = payload.sessions.find((s) => s.id === sessionId)!;
        target.start = start.toISOString();
        target.end = end.toISOString();
        const taskWork = payload.sessions
            .filter((s) => s.taskId === selected.taskId && s.kind === "WORK")
            .sort((a, b) => +new Date(a.start) - +new Date(b.start)),
          counts = new Map<string, number>();
        for (const event of fixed.filter(
          (e) => e.source === "SCHEDULED_TASK" && e.taskId === selected.taskId,
        )) {
          const day = dateKey(event.start, user.timezone);
          counts.set(day, (counts.get(day) ?? 0) + 1);
        }
        for (const s of taskWork) {
          const day = dateKey(new Date(s.start), user.timezone),
            count = (counts.get(day) ?? 0) + 1;
          counts.set(day, count);
          if (count % 2 || !prefs.recovery) continue;
          const recoveryStart = new Date(s.end),
            recoveryEnd = new Date(+recoveryStart + prefs.recovery * 60000),
            [, endMinute] = dayWindow(day, prefs);
          const allBusy = [
            ...fixed,
            ...payload.sessions
              .filter((b) => b.id !== s.id)
              .map((b) => ({
                ...b,
                start: new Date(b.start),
                end: new Date(b.end),
              })),
          ];
          if (
            recoveryEnd <=
              localInstant(day, minuteTime(endMinute), user.timezone) &&
            !allBusy.some((b) =>
              overlaps(b, { start: recoveryStart, end: recoveryEnd }),
            )
          )
            payload.sessions.push({
              id: randomUUID(),
              taskId: s.taskId,
              title: "Przerwa regeneracyjna",
              kind: "RECOVERY",
              start: recoveryStart.toISOString(),
              end: recoveryEnd.toISOString(),
            });
        }
        await tx.proposal.update({
          where: { id },
          data: { payload: json(payload) },
        });
        return { id, ...payload };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async commitImport(userId: string, id: string) {
    return this.db.mutate([userId], async (tx) => {
      const batch = await tx.importBatch.findFirst({ where: { id, userId } });
      if (!batch) throw new NotFoundException();
      if (batch.committed) return { ok: true, alreadyCommitted: true };
      if (batch.expiresAt < new Date())
        throw new ConflictException(
          "Podgląd importu wygasł. Wczytaj plik ponownie.",
        );
      checkVersion(
        (await tx.plannerState.findUniqueOrThrow({ where: { userId } }))
          .revision,
        batch.revision,
      );
      const payload = batch.payload as unknown as {
        events: ImportedItem[];
        removed: string[];
      };
      const existingEvents = await tx.importedEvent.findMany({
        where: { userId },
        select: { uid: true, occurrenceKey: true },
      });
      const keys = new Set(
        existingEvents.map((event) => `${event.uid}\0${event.occurrenceKey}`),
      );
      const additions = payload.events.filter(
        (event) => !keys.has(`${event.uid}\0${event.occurrenceKey}`),
      ).length;
      if (existingEvents.length + additions - payload.removed.length > 20000)
        throw new BadRequestException(
          "Osiągnięto limit 20 000 importowanych wydarzeń. Zastąp wcześniejszy plan lub skróć zakres importu.",
        );
      if (payload.removed.length)
        await tx.importedEvent.deleteMany({
          where: { userId, id: { in: payload.removed } },
        });
      for (const e of payload.events) {
        const where = {
          userId_sourceKey_uid_occurrenceKey: {
            userId,
            sourceKey: "usos",
            uid: e.uid,
            occurrenceKey: e.occurrenceKey,
          },
        };
        const old = await tx.importedEvent.findUnique({ where });
        if (old && old.sequence > e.sequence) continue;
        const data = { ...e, start: new Date(e.start), end: new Date(e.end) };
        await tx.importedEvent.upsert({
          where,
          create: { ...data, userId },
          update: data,
        });
      }
      await tx.importBatch.update({
        where: { id },
        data: { committed: true, payload: json({}) },
      });
      return { ok: true, count: payload.events.length };
    });
  }
  async trash(userId: string) {
    const [tasks, activities, sessions] = await Promise.all([
      this.db.task.findMany({ where: { userId, deletedAt: { not: null } } }),
      this.db.activity.findMany({ where: { userId } }),
      this.db.taskSession.findMany({
        where: { userId, deletedAt: { not: null } },
        include: { task: { select: { title: true } } },
      }),
    ]);
    const occurrences = activities
      .filter((a) => !a.deletedAt)
      .flatMap((a) =>
        Object.entries(a.exceptions as Record<string, { cancelled?: boolean }>)
          .filter(([, e]) => e.cancelled)
          .map(([date]) => ({
            id: `${a.id}:${date}`,
            title: `${a.title} (${date})`,
            kind: "occurrence",
            deletedAt: new Date(),
          })),
      );
    return [
      ...tasks.map((t) => ({
        id: t.id,
        title: t.title,
        kind: "task",
        deletedAt: t.deletedAt,
      })),
      ...activities
        .filter((a) => a.deletedAt)
        .map((a) => ({
          id: a.id,
          title: a.title,
          kind: "activity",
          deletedAt: a.deletedAt,
        })),
      ...sessions.map((s) => ({
        id: s.id,
        title: s.task.title,
        kind: "session",
        deletedAt: s.deletedAt,
      })),
      ...occurrences,
    ].sort((a, b) => +b.deletedAt! - +a.deletedAt!);
  }
  async restore(userId: string, kind: string, id: string) {
    return this.db.mutate([userId], async (tx) => {
      if (kind === "task") {
        const task = await tx.task.findFirst({
          where: { id, userId, deletedAt: { not: null } },
          include: { project: true },
        });
        if (!task) throw new NotFoundException();
        if (
          task.project &&
          !(await tx.membership.findUnique({
            where: { teamId_userId: { teamId: task.project.teamId, userId } },
          }))
        )
          throw new ForbiddenException();
        await tx.task.update({
          where: { id },
          data: { deletedAt: null, version: { increment: 1 } },
        });
      } else if (kind === "activity") {
        const a = await tx.activity.findFirst({
          where: { id, userId, deletedAt: { not: null } },
        });
        if (!a) throw new NotFoundException();
        await tx.activity.update({
          where: { id },
          data: { deletedAt: null, version: { increment: 1 } },
        });
      } else if (kind === "session") {
        const s = await tx.taskSession.findFirst({
          where: {
            id,
            userId,
            deletedAt: { not: null },
            task: { deletedAt: null },
          },
          include: { task: true },
        });
        if (!s)
          throw new NotFoundException("Najpierw przywróć zadanie tej sesji.");
        if (s.task.status === "DONE" && s.status === "PLANNED")
          throw new ConflictException(
            "Najpierw otwórz ponownie zadanie, aby przywrócić zaplanowaną sesję.",
          );
        await tx.taskSession.update({
          where: { id },
          data: { deletedAt: null, version: { increment: 1 } },
        });
      } else if (kind === "occurrence") {
        const [activityId, date] = id.split(":");
        const a = await tx.activity.findFirst({
          where: { id: activityId, userId, deletedAt: null },
        });
        if (!a) throw new NotFoundException();
        const exceptions = a.exceptions as Record<
          string,
          Record<string, unknown>
        >;
        if (!exceptions[date]) throw new NotFoundException();
        delete exceptions[date].cancelled;
        if (!Object.keys(exceptions[date]).length) delete exceptions[date];
        await tx.activity.update({
          where: { id: activityId },
          data: { exceptions: json(exceptions), version: { increment: 1 } },
        });
      } else throw new BadRequestException();
      return { ok: true };
    });
  }
}
