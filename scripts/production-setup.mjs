import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
const [domain, email] = process.argv.slice(2);
if (
  !domain ||
  !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    domain,
  ) ||
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
) {
  console.error(
    "Usage: node scripts/production-setup.mjs planner.example.com admin@example.com",
  );
  process.exit(1);
}
const file = path.resolve("deploy/.env.production");
const secret = () => randomBytes(48).toString("hex");
const admin = secret(),
  migrator = secret(),
  app = secret(),
  backup = secret();
const databaseUrl = (role, password) =>
  `postgresql://${role}:${password}@postgres:5432/smartuniplanner?schema=public&connection_limit=10&connect_timeout=5`;
fs.writeFileSync(
  file,
  [
    `APP_DOMAIN=${domain}`,
    `ACME_EMAIL=${email}`,
    `POSTGRES_ADMIN_PASSWORD=${admin}`,
    `MIGRATOR_PASSWORD=${migrator}`,
    `APP_DB_PASSWORD=${app}`,
    `BACKUP_DB_PASSWORD=${backup}`,
    `MIGRATOR_DATABASE_URL=${databaseUrl("smartuni_migrator", migrator)}`,
    `APP_DATABASE_URL=${databaseUrl("smartuni_app", app)}`,
    `SESSION_SECRET=${secret()}`,
    `REGISTRATION_CODE=${secret()}`,
    `RESTIC_PASSWORD=${secret()}`,
    "",
  ].join("\n"),
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Production configuration created in deploy/.env.production (0600). Store a secure copy outside this server. Existing configuration is never overwritten.",
);
