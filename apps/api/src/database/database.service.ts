import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

export type Transaction = Prisma.TransactionClient;

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
  async mutate<T>(
    userIds: string[],
    execute: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(
      async (tx) => {
        for (const userId of [...new Set(userIds)].sort()) {
          await tx.$queryRaw`SELECT "userId" FROM "PlannerState" WHERE "userId" = ${userId} FOR UPDATE`;
        }
        const result = await execute(tx);
        const repeated =
          result &&
          typeof result === "object" &&
          ("alreadyConfirmed" in result || "alreadyCommitted" in result);
        if (!repeated)
          await tx.plannerState.updateMany({
            where: { userId: { in: userIds } },
            data: { revision: { increment: 1 } },
          });
        return result;
      },
      { timeout: 15_000 },
    );
  }
}
