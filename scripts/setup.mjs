import fs from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

const fresh = !fs.existsSync(".env");
let content = fs.readFileSync(fresh ? ".env.example" : ".env", "utf8");
const env = parseEnv(content);
function set(key, value) {
  const line = `${key}=${value}`;
  content = new RegExp(`^${key}=.*$`, "m").test(content)
    ? content.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : content + `\n${line}\n`;
  env[key] = value;
}
if (fresh || !env.POSTGRES_PASSWORD)
  set("POSTGRES_PASSWORD", randomBytes(24).toString("hex"));
if (!env.SESSION_SECRET) set("SESSION_SECRET", randomBytes(48).toString("hex"));
if (fresh || !env.DATABASE_URL)
  set(
    "DATABASE_URL",
    `postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:${env.POSTGRES_PORT}/${env.POSTGRES_DB}?schema=public`,
  );
if (fresh || !env.TEST_DATABASE_URL)
  set(
    "TEST_DATABASE_URL",
    `postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:${env.POSTGRES_TEST_PORT}/${env.POSTGRES_TEST_DB}?schema=public`,
  );
fs.writeFileSync(".env", content, { mode: 0o600 });
console.log("Local configuration ready. Secrets were not printed.");
execFileSync("docker", ["compose", "up", "-d", "--wait", "postgres"], {
  stdio: "inherit",
});
for (const command of ["db:generate", "db:migrate"])
  execFileSync("npm", ["run", command], { stdio: "inherit" });
console.log("Ready. Run npm run dev to start the API and web application.");
