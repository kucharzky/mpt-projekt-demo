import { createHmac } from "node:crypto";
import { Pool } from "pg";
import { sessionSecret } from "../config";

/** Atomic fixed windows shared by all app processes; keys never contain raw addresses. */
export class RateLimiter {
  readonly pool: Pool;
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 3000,
      statement_timeout: 3000,
    });
    this.pool.on("error", () =>
      console.error("Rate limit database unavailable"),
    );
  }
  async consume(
    scope: string,
    identity: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ) {
    if (this.pool.waitingCount >= 50)
      throw new Error("Request capacity exceeded");
    const until = new Date((Math.floor(now / windowMs) + 1) * windowMs);
    const key = createHmac("sha256", sessionSecret!)
      .update(`${scope}\0${identity}`)
      .digest("hex");
    const result = await this.pool.query<{ count: number }>(
      `
      INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt") VALUES ($1, 1, $2)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= $3 THEN 1 ELSE LEAST("RateLimitBucket"."count" + 1, $4 + 1) END,
        "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= $3 THEN $2 ELSE "RateLimitBucket"."expiresAt" END
      RETURNING "count"`,
      [key, until, new Date(now), limit],
    );
    return {
      allowed: result.rows[0].count <= limit,
      retryAfter: Math.max(1, Math.ceil((+until - now) / 1000)),
    };
  }
  async cleanup() {
    await this.pool.query(
      'DELETE FROM "RateLimitBucket" WHERE "expiresAt" < NOW()',
    );
  }
  close() {
    return this.pool.end();
  }
}
