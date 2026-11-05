import { Controller, Get, Post, Req } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { NoticeDto } from "./http.dto";
import { Request } from "express";
import { requireUser } from "./auth/session";
import { DatabaseService } from "./database/database.service";
import { dateKey, daysBetween } from "./planner/domain/time";
@Controller()
export class AppController {
  constructor(readonly db: DatabaseService) {}
  @Get("health") async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Get("notifications")
  @ApiOkResponse({ type: [NoticeDto] })
  async notifications(@Req() req: Request) {
    const userId = requireUser(req),
      user = await this.db.user.findUniqueOrThrow({ where: { id: userId } }),
      today = dateKey(new Date(), user.timezone),
      tasks = await this.db.task.findMany({
        where: { userId, deletedAt: null, status: { not: "DONE" } },
      });
    for (const task of tasks) {
      const days = daysBetween(
        today,
        task.deadlineDate.toISOString().slice(0, 10),
      );
      if (days <= 2)
        await this.db.notification.upsert({
          where: {
            userId_key: { userId, key: `deadline:${task.id}:${today}` },
          },
          create: {
            userId,
            key: `deadline:${task.id}:${today}`,
            title:
              days < 0
                ? "Termin zadania minął"
                : days === 0
                  ? "Zadanie na dzisiaj"
                  : "Zbliża się termin zadania",
            body: task.title,
          },
          update: {},
        });
    }
    const sessions = await this.db.taskSession.findMany({
      where: {
        userId,
        deletedAt: null,
        task: { deletedAt: null },
        kind: "WORK",
        status: "PLANNED",
        start: {
          gte: new Date(Date.now() - 7 * 86400000),
          lte: new Date(Date.now() + 60 * 60000),
        },
      },
      include: { task: true },
    });
    for (const s of sessions)
      await this.db.notification.upsert({
        where: { userId_key: { userId, key: `session:${s.id}` } },
        create: {
          userId,
          key: `session:${s.id}`,
          title:
            s.end < new Date()
              ? "Potwierdź wykonanie sesji"
              : "Nadchodząca sesja pracy",
          body: s.task.title,
        },
        update: {},
      });
    return this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
  @Post("notifications/read") async readNotifications(@Req() req: Request) {
    await this.db.notification.updateMany({
      where: { userId: requireUser(req) },
      data: { seen: true },
    });
    return { ok: true };
  }
}
