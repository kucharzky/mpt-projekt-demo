import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseService, Transaction } from "../database/database.service";
import {
  PlannerService,
  assertRange,
  checkVersion,
  json,
  taskInclude,
  taskView,
} from "../planner/planner.service";
import { AvailabilityDto, MeetingDto } from "../http.dto";
import {
  addDays,
  dateKey,
  freeWindows,
  localInstant,
  overlaps,
} from "../planner/domain/time";

const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
@Injectable()
export class ProjectsService {
  constructor(
    readonly db: DatabaseService,
    readonly planner: PlannerService,
  ) {}
  async member(
    tx: Transaction,
    userId: string,
    teamId: string,
    manager = false,
  ) {
    const member = await tx.membership.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new NotFoundException("Nie znaleziono zespołu.");
    if (manager && member.role === "MEMBER")
      throw new ForbiddenException("To działanie wymaga roli administratora.");
    return member;
  }
  async list(userId: string) {
    const teams = await this.db.team.findMany({
      where: { memberships: { some: { userId } } },
      include: {
        memberships: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        projects: {
          include: {
            tasks: { where: { deletedAt: null }, include: taskInclude },
          },
        },
        meetings: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { start: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return teams.map((t) => ({
      ...t,
      members: t.memberships.map((m) => ({ ...m, user: m.user })),
      memberships: undefined,
      projects: t.projects.map((p) => ({ ...p, tasks: p.tasks.map(taskView) })),
    }));
  }
  async create(userId: string, name: string) {
    return this.db.team.create({
      data: {
        name: name.trim(),
        memberships: { create: { userId, role: "OWNER" } },
      },
    });
  }
  async invite(userId: string, teamId: string, email: string, role: string) {
    await this.member(this.db, userId, teamId, true);
    const token = randomBytes(24).toString("hex");
    await this.db.invitation.create({
      data: {
        teamId,
        email: email.toLowerCase().trim(),
        role,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return { token, expiresInDays: 7 };
  }
  async accept(userId: string, token: string) {
    return this.db.mutate([userId], async (tx) => {
      const invite = await tx.invitation.findUnique({
          where: { tokenHash: tokenHash(token) },
        }),
        u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!invite || invite.expiresAt < new Date() || invite.accepted)
        throw new BadRequestException(
          "Zaproszenie jest nieprawidłowe, wykorzystane lub wygasło.",
        );
      if (invite.email !== u.email)
        throw new ForbiddenException(
          "Zaproszenie jest przeznaczone dla innego adresu e-mail.",
        );
      const updated = await tx.invitation.updateMany({
        where: { id: invite.id, accepted: false },
        data: { accepted: true },
      });
      if (!updated.count)
        throw new ConflictException("Zaproszenie zostało już wykorzystane.");
      await tx.membership.upsert({
        where: { teamId_userId: { teamId: invite.teamId, userId } },
        create: { teamId: invite.teamId, userId, role: invite.role },
        update: {},
      });
      return { ok: true, teamId: invite.teamId };
    });
  }
  async membership(
    userId: string,
    teamId: string,
    targetId: string,
    role?: string,
    shareAvailability?: boolean,
  ) {
    const actor = await this.member(this.db, userId, teamId),
      target = await this.member(this.db, targetId, teamId);
    if (role && (actor.role !== "OWNER" || target.role === "OWNER"))
      throw new ForbiddenException(
        "Tylko właściciel zmienia role administratora i członka.",
      );
    if (shareAvailability !== undefined && targetId !== userId)
      throw new ForbiddenException(
        "Każda osoba samodzielnie udostępnia swoją dostępność.",
      );
    return this.db.mutate([targetId], async (tx) =>
      tx.membership.update({
        where: { teamId_userId: { teamId, userId: targetId } },
        data: {
          ...(role ? { role } : {}),
          ...(shareAvailability !== undefined ? { shareAvailability } : {}),
        },
      }),
    );
  }
  async removeMember(userId: string, teamId: string, targetId: string) {
    const actor = await this.member(this.db, userId, teamId),
      target = await this.member(this.db, targetId, teamId);
    if (
      target.role === "OWNER" ||
      (actor.role === "MEMBER" && userId !== targetId)
    )
      throw new ForbiddenException("Nie możesz usunąć tej osoby z zespołu.");
    const members = await this.db.membership.findMany({ where: { teamId } }),
      owner = members.find((m) => m.role === "OWNER")!;
    return this.db.mutate(
      members.map((m) => m.userId),
      async (tx) => {
        const tasks = await tx.task.findMany({
          where: { userId: targetId, project: { teamId } },
        });
        await tx.taskSession.deleteMany({
          where: {
            taskId: { in: tasks.map((t) => t.id) },
            start: { gt: new Date() },
            status: "PLANNED",
          },
        });
        await tx.task.updateMany({
          where: { id: { in: tasks.map((t) => t.id) } },
          data: { userId: owner.userId, version: { increment: 1 } },
        });
        await tx.meeting.updateMany({
          where: {
            teamId,
            participantIds: { has: targetId },
            start: { gt: new Date() },
          },
          data: { status: "CANCELLED" },
        });
        await tx.membership.delete({
          where: { teamId_userId: { teamId, userId: targetId } },
        });
        return { ok: true };
      },
    );
  }
  async project(
    userId: string,
    teamId: string,
    title: string,
    description: string,
    id?: string,
  ) {
    await this.member(this.db, userId, teamId, true);
    if (id) {
      const p = await this.db.project.findFirst({ where: { id, teamId } });
      if (!p) throw new NotFoundException();
      return this.db.project.update({
        where: { id },
        data: { title: title.trim(), description },
      });
    }
    return this.db.project.create({
      data: { teamId, title: title.trim(), description },
    });
  }
  async deleteProject(userId: string, teamId: string, id: string) {
    await this.member(this.db, userId, teamId, true);
    const members = await this.db.membership.findMany({ where: { teamId } });
    return this.db.mutate(
      members.map((m) => m.userId),
      async (tx) => {
        const p = await tx.project.findFirst({ where: { id, teamId } });
        if (!p) throw new NotFoundException();
        await tx.project.delete({ where: { id } });
        return { ok: true };
      },
    );
  }
  async comment(userId: string, taskId: string, body: string) {
    await this.planner.taskAccess(this.db, userId, taskId);
    return this.db.comment.create({
      data: { userId, taskId, body: body.trim() },
    });
  }
  async resource(userId: string, taskId: string, title: string, url: string) {
    await this.planner.taskAccess(this.db, userId, taskId, true);
    return this.db.resource.create({
      data: { taskId, title: title.trim(), url },
    });
  }
  async deleteResource(userId: string, taskId: string, id: string) {
    await this.planner.taskAccess(this.db, userId, taskId, true);
    return this.db.resource.deleteMany({ where: { id, taskId } });
  }
  async availability(userId: string, teamId: string, input: AvailabilityDto) {
    await this.member(this.db, userId, teamId);
    assertRange(input.from, input.to, 31);
    if (
      !input.participantIds.length ||
      new Set(input.participantIds).size !== input.participantIds.length
    )
      throw new BadRequestException("Wybierz co najmniej jedną osobę.");
    return this.db.$transaction(
      async (tx) => {
        const windows: ReturnType<typeof freeWindows>[] = [];
        for (const id of input.participantIds) {
          const member = await this.member(tx, id, teamId);
          if (!member.shareAvailability)
            throw new ForbiddenException(
              "Wybrana osoba nie udostępnia dostępności.",
            );
          const u = await tx.user.findUniqueOrThrow({ where: { id } }),
            events = await this.planner.events(
              tx,
              id,
              addDays(input.from, -1),
              addDays(input.to, 1),
            );
          windows.push(
            freeWindows(
              events.filter((e) => e.status !== "MISSED"),
              addDays(input.from, -1),
              addDays(input.to, 1),
              u.timezone,
              this.planner.prefs(u.preferences),
              false,
            ),
          );
        }
        const actor = await tx.user.findUniqueOrThrow({
            where: { id: userId },
          }),
          from = Math.max(
            Date.now(),
            +localInstant(input.from, "00:00", actor.timezone),
          ),
          to = +localInstant(input.to, "00:00", actor.timezone);
        const slots: { start: string; end: string }[] = [];
        for (
          let start = Math.ceil(from / 900000) * 900000;
          start + input.durationMinutes * 60000 <= to && slots.length < 30;
          start += 900000
        ) {
          const end = start + input.durationMinutes * 60000;
          if (
            windows.every((ws) =>
              ws.some((w) => +w.start <= start && +w.end >= end),
            )
          )
            slots.push({
              start: new Date(start).toISOString(),
              end: new Date(end).toISOString(),
            });
        }
        return slots;
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async meeting(userId: string, teamId: string, input: MeetingDto) {
    await this.member(this.db, userId, teamId);
    const ids = [...new Set(input.participantIds)],
      start = new Date(input.start),
      end = new Date(input.end);
    if (
      !ids.includes(userId) ||
      !Number.isFinite(+start) ||
      !Number.isFinite(+end) ||
      +end <= +start ||
      +end - +start > 240 * 60000 ||
      start < new Date()
    )
      throw new BadRequestException(
        "Wybierz poprawny przyszły termin i uwzględnij siebie na liście uczestników.",
      );
    return this.db.$transaction(
      async (tx) => {
        const revisions: Record<string, number> = {};
        for (const id of ids) {
          const m = await this.member(tx, id, teamId);
          if (!m.shareAvailability)
            throw new ForbiddenException(
              "Każdy uczestnik musi udostępnić dostępność.",
            );
          const u = await tx.user.findUniqueOrThrow({ where: { id } });
          const events = await this.planner.events(
            tx,
            id,
            dateKey(start, u.timezone),
            addDays(dateKey(end, u.timezone), 1),
          );
          if (
            events
              .filter((e) => e.status !== "MISSED")
              .some((e) => overlaps(e, { start, end }))
          )
            throw new ConflictException("Wybrany termin nie jest już wolny.");
          revisions[id] = (
            await tx.plannerState.findUniqueOrThrow({ where: { userId: id } })
          ).revision;
        }
        const meeting = await tx.meeting.create({
          data: {
            teamId,
            creatorId: userId,
            title: input.title.trim(),
            start,
            end,
            participantIds: ids,
            acceptedIds: [],
            revisions: json(revisions),
          },
        });
        for (const id of ids)
          await tx.notification.create({
            data: {
              userId: id,
              key: `meeting:${meeting.id}`,
              title: "Nowa propozycja spotkania",
              body: input.title.trim(),
            },
          });
        return meeting;
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async acceptMeeting(userId: string, teamId: string, id: string) {
    const before = await this.db.meeting.findFirst({ where: { id, teamId } });
    if (!before || !before.participantIds.includes(userId))
      throw new NotFoundException();
    return this.db.$transaction(async (tx) => {
      for (const uid of [...before.participantIds].sort())
        await tx.$queryRaw`SELECT "userId" FROM "PlannerState" WHERE "userId" = ${uid} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Meeting" WHERE "id" = ${id} FOR UPDATE`;
      const meeting = await tx.meeting.findUniqueOrThrow({ where: { id } });
      if (meeting.status === "CONFIRMED") return { ok: true, confirmed: true };
      if (meeting.status !== "PENDING" || meeting.start < new Date())
        throw new ConflictException("Propozycja spotkania jest nieaktualna.");
      const acceptedIds = [...new Set([...meeting.acceptedIds, userId])],
        confirmed = acceptedIds.length === meeting.participantIds.length;
      if (confirmed) {
        const revisions = meeting.revisions as Record<string, number>;
        for (const uid of meeting.participantIds) {
          const m = await this.member(tx, uid, teamId);
          if (!m.shareAvailability)
            throw new ConflictException(
              "Zmieniono zgodę na udostępnianie dostępności.",
            );
          checkVersion(
            (
              await tx.plannerState.findUniqueOrThrow({
                where: { userId: uid },
              })
            ).revision,
            revisions[uid],
          );
        }
        await tx.plannerState.updateMany({
          where: { userId: { in: meeting.participantIds } },
          data: { revision: { increment: 1 } },
        });
      }
      await tx.meeting.update({
        where: { id },
        data: { acceptedIds, status: confirmed ? "CONFIRMED" : "PENDING" },
      });
      return { ok: true, confirmed };
    });
  }
  async cancelMeeting(userId: string, teamId: string, id: string) {
    const member = await this.member(this.db, userId, teamId),
      meeting = await this.db.meeting.findFirst({ where: { id, teamId } });
    if (!meeting) throw new NotFoundException();
    if (member.role === "MEMBER" && meeting.creatorId !== userId)
      throw new ForbiddenException();
    return this.db.mutate(meeting.participantIds, async (tx) => {
      await tx.meeting.update({ where: { id }, data: { status: "CANCELLED" } });
      return { ok: true };
    });
  }
  async assignments(_userId: string, _teamId: string): Promise<unknown> { return {}; }
  async confirmAssignments(_userId: string, _teamId: string, _id: string): Promise<unknown> { return {}; }
}
