import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";
dotenv.config({ quiet: true });
if (
  !process.env.TEST_DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")
)
  throw new Error("Security tests require an isolated _test database");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
const require = createRequire(import.meta.url);
const { createApplication } = require("../apps/api/dist/main.js");
const { PrismaClient } = require("@prisma/client");
const { RateLimiter } = require("../apps/api/dist/security/rate-limit.js");
let app,
  base,
  db,
  userId,
  cookie = "",
  csrf = "";
before(async () => {
  db = new PrismaClient();
  await db.rateLimitBucket.deleteMany();
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
});
after(async () => {
  if (userId) await db.user.delete({ where: { id: userId } });
  await app?.close();
  await db?.$disconnect();
});
async function call(path, body, extra = {}) {
  return fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie,
      origin: "http://localhost:5173",
      ...(csrf ? { "x-csrf-token": csrf } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test("API headers protect private responses and unauthenticated routes do not create sessions", async () => {
  const r = await call("/teams");
  assert.equal(r.status, 401);
  assert.equal(r.headers.get("set-cookie"), null);
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("referrer-policy"), "no-referrer");
  assert.match(r.headers.get("x-request-id"), /^[\da-f-]{36}$/);
});
test("malformed, oversized and ambiguous inputs fail with controlled messages", async () => {
  for (const [body, status] of [
    ["{invalid", 400],
    [JSON.stringify({ content: "x".repeat(3_200_000) }), 413],
  ]) {
    const r = await fetch(base + "/tasks", {
      method: "POST",
      headers: { "content-type": "application/json", "accept-language": "en" },
      body,
    });
    assert.equal(r.status, status);
    const data = await r.json();
    assert.equal(typeof data.message, "string");
    assert.doesNotMatch(data.message, /SyntaxError|stack|Unexpected/);
  }
  const r = await call(
    "/planner/state?from=2026-01-01&from=2026-02-01&to=2026-03-01",
  );
  assert.equal(r.status, 400);
  const cross = await call("/auth/session", undefined, {
    "sec-fetch-site": "cross-site",
  });
  assert.equal(cross.status, 403);
});
test("case variations and trailing slashes cannot bypass CSRF", async () => {
  let r = await call("/auth/session");
  cookie = r.headers.getSetCookie()[0].split(";")[0];
  csrf = (await r.json()).csrfToken;
  assert.match(cookie, /^smartuni\.sid=/);
  r = await call("/auth/register", {
    email: `security-${randomUUID()}@smartuni.test`,
    password: "Security-Test-2026!",
    name: "Security QA",
  });
  assert.equal(r.status, 201);
  const auth = await r.json();
  userId = auth.user.id;
  csrf = auth.csrfToken;
  cookie = r.headers.getSetCookie()[0].split(";")[0];
  for (const path of ["/tasks/", "/TASKS", "/Tasks/"]) {
    const response = await call(
      path,
      { title: "Blocked" },
      { "x-csrf-token": "" },
    );
    assert.equal(response.status, 403, path);
  }
  const response = await call(
    "/tasks",
    { title: "Blocked" },
    { origin: "https://attacker.example" },
  );
  assert.equal(response.status, 403);
});
test("shared rate limits are atomic across independent processes and expire", async () => {
  const one = new RateLimiter(),
    two = new RateLimiter(),
    identity = randomUUID(),
    now = Date.now();
  try {
    const result = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        (i % 2 ? one : two).consume(
          "concurrency-test",
          identity,
          10,
          60000,
          now,
        ),
      ),
    );
    assert.equal(result.filter((r) => r.allowed).length, 10);
    assert.equal(
      (await two.consume("concurrency-test", identity, 10, 60000, now)).allowed,
      false,
    );
    assert.equal(
      (await one.consume("concurrency-test", identity, 10, 60000, now + 120000))
        .allowed,
      true,
    );
    const buckets = await db.rateLimitBucket.findMany();
    assert.ok(buckets.every((b) => /^[a-f0-9]{64}$/.test(b.key)));
  } finally {
    await one.close();
    await two.close();
  }
});
test("login limits reject forged forwarded addresses and return localized retry guidance", async () => {
  const address = `unknown-${randomUUID()}@smartuni.test`;
  for (let i = 0; i < 11; i++) {
    const r = await call(
      "/auth/login",
      { email: address, password: "Incorrect-Password-2026!" },
      { "x-forwarded-for": `198.51.100.${i + 1}`, "accept-language": "en" },
    );
    assert.equal(r.status, i === 10 ? 429 : 401);
    const body = await r.json();
    if (i === 10) {
      assert.match(body.message, /Too many requests/);
      assert.ok(Number(r.headers.get("retry-after")) > 0);
    } else assert.match(body.message, /incorrect/);
  }
});
test("server-side absolute session expiry revokes an otherwise valid cookie", async () => {
  await db.$executeRaw`UPDATE session SET sess = jsonb_set(sess::jsonb, '{authenticatedAt}', '1')::json WHERE sess->>'userId' = ${userId}`;
  const r = await call("/auth/session", undefined, { "accept-language": "en" });
  assert.equal(r.status, 401);
  assert.match((await r.json()).message, /expired/);
  assert.match(r.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
});
test("PL and EN catalogs cover the same nonempty messages and interpolation variables", () => {
  const pl = JSON.parse(fs.readFileSync("apps/web/src/i18n/pl.json", "utf8")),
    en = JSON.parse(fs.readFileSync("apps/web/src/i18n/en.json", "utf8"));
  assert.deepEqual(Object.keys(pl).sort(), Object.keys(en).sort());
  for (const key of Object.keys(pl)) {
    assert.ok(en[key].trim(), key);
    assert.deepEqual(
      (pl[key].match(/{{\w+}}/g) || []).sort(),
      (en[key].match(/{{\w+}}/g) || []).sort(),
      key,
    );
  }
});
