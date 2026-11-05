import { BadRequestException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { ImportDto } from "../http.dto";
import { assertRange, json } from "../planner/planner.service";
import { localInstant } from "../planner/domain/time";
import { parseIcs } from "./ics";
@Injectable()
export class ImportsService {
  constructor(readonly db: DatabaseService) {}
  async previewImport(userId: string, input: ImportDto) {
    assertRange(input.from, input.to, 367);
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    let parsed: ReturnType<typeof parseIcs>;
    try {
      parsed = parseIcs(input.content, user.timezone, input.from, input.to);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Nieprawidłowy plik ICS.",
      );
    }
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "userId" FROM "PlannerState" WHERE "userId" = ${userId} FOR UPDATE`;
        await tx.importBatch.deleteMany({
          where: { userId, committed: false, expiresAt: { lt: new Date() } },
        });
        if (
          (await tx.importBatch.count({
            where: { userId, committed: false },
          })) >= 10
        )
          throw new BadRequestException(
            "Osiągnięto limit aktywnych podglądów importu. Poczekaj 15 minut i spróbuj ponownie.",
          );
        const state = await tx.plannerState.findUniqueOrThrow({
            where: { userId },
          }),
          existing = await tx.importedEvent.findMany({
            where: { userId, sourceKey: "usos" },
          });
        const keys = new Set(
          parsed.events.map((e) => `${e.uid}\0${e.occurrenceKey}`),
        );
        const removed = input.replace
          ? existing
              .filter(
                (e) =>
                  e.start >= localInstant(input.from, "00:00", user.timezone) &&
                  e.start < localInstant(input.to, "00:00", user.timezone) &&
                  !keys.has(`${e.uid}\0${e.occurrenceKey}`),
              )
              .map((e) => e.id)
          : [];
        let added = 0,
          updated = 0,
          unchanged = 0;
        for (const e of parsed.events) {
          const old = existing.find(
            (o) => o.uid === e.uid && o.occurrenceKey === e.occurrenceKey,
          );
          if (!old) added++;
          else if (old.sequence > e.sequence) {
            unchanged++;
            parsed.warnings.push(`Zachowano nowszą wersję: ${e.title}`);
          } else if (
            old.start.toISOString() === e.start &&
            old.end.toISOString() === e.end &&
            old.title === e.title &&
            old.location === e.location &&
            old.description === e.description
          )
            unchanged++;
          else updated++;
        }
        const batch = await tx.importBatch.create({
          data: {
            userId,
            name: input.name,
            revision: state.revision,
            payload: json({ ...parsed, removed }),
            expiresAt: new Date(Date.now() + 15 * 60000),
          },
        });
        return {
          id: batch.id,
          added,
          updated,
          unchanged,
          removed: removed.length,
          warnings: parsed.warnings,
          events: parsed.events,
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
