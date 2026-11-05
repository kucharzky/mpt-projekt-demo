import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import dotenv from "dotenv";
dotenv.config({ quiet: true });
if (
  !process.env.TEST_DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")
)
  throw new Error("Registration tests require an isolated _test database");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.REGISTRATION_CODE = randomBytes(32).toString("hex");
const require = createRequire(import.meta.url),
  { createApplication } = require("../apps/api/dist/main.js"),
  { PrismaClient } = require("@prisma/client");
let app, db, base, cookie, csrf, user;
before(async () => {
  db = new PrismaClient();
  await db.rateLimitBucket.deleteMany();
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
});
after(async () => {
  if (user) await db.user.delete({ where: { id: user } });
  await app?.close();
  await db?.$disconnect();
});
test("restricted registration advertises the requirement without disclosing its code", async () => {
  const r = await fetch(base + "/auth/session");
  assert.equal(r.status, 200);
  cookie = r.headers.getSetCookie()[0].split(";")[0];
  const data = await r.json();
  csrf = data.csrfToken;
  assert.equal(data.registrationRequiresCode, true);
  assert.ok(!JSON.stringify(data).includes(process.env.REGISTRATION_CODE));
});
test("missing and incorrect registration codes fail before creating an account", async () => {
  const email = `gated-${randomUUID()}@smartuni.test`;
  for (const code of [undefined, "incorrect", process.env.REGISTRATION_CODE]) {
    const r = await fetch(base + "/auth/register", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        origin: "http://localhost:5173",
        "x-csrf-token": csrf,
        "accept-language": "en",
      },
      body: JSON.stringify({
        email,
        name: "Registration QA",
        password: "Registration-QA-2026!",
        ...(code ? { registrationCode: code } : {}),
      }),
    });
    const body = await r.json();
    assert.equal(r.status, code === process.env.REGISTRATION_CODE ? 201 : 403);
    if (r.status === 403) {
      assert.match(body.message, /registration code is invalid/);
      assert.equal(await db.user.count({ where: { email } }), 0);
    } else {
      user = body.user.id;
      assert.equal(body.registrationRequiresCode, true);
    }
  }
});
