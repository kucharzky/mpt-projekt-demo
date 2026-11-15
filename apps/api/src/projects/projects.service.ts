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
  async comment(_userId: string, _taskId: string, _body: string): Promise<unknown> { return {}; }
  async resource(_userId: string, _taskId: string, _title: string, _url: string): Promise<unknown> { return {}; }
  async deleteResource(_userId: string, _taskId: string, _id: string): Promise<unknown> { return {}; }
  async availability(_userId: string, _teamId: string, _input: AvailabilityDto): Promise<unknown> { return {}; }
  async meeting(_userId: string, _teamId: string, _input: MeetingDto): Promise<unknown> { return {}; }
  async acceptMeeting(_userId: string, _teamId: string, _id: string): Promise<unknown> { return {}; }
  async cancelMeeting(_userId: string, _teamId: string, _id: string): Promise<unknown> { return {}; }
  async assignments(_userId: string, _teamId: string): Promise<unknown> { return {}; }
  async confirmAssignments(_userId: string, _teamId: string, _id: string): Promise<unknown> { return {}; }
}
