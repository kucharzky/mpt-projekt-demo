import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });
for (const name of ["DATABASE_URL", "SESSION_SECRET", "REGISTRATION_CODE"]) {
  const file = process.env[`${name}_FILE`];
  if (file) process.env[name] = fs.readFileSync(file, "utf8").trim();
}
export const apiPort = Number(process.env.API_PORT || 3001);
export const appOrigin = process.env.APP_ORIGIN || "http://localhost:5173";
export const isProduction = process.env.NODE_ENV === "production";
export const sessionSecret = process.env.SESSION_SECRET;
export const registrationCode = process.env.REGISTRATION_CODE;
export const registrationRequiresCode = Boolean(registrationCode);
export const cookieName = isProduction ? "__Host-session" : "smartuni.sid";
export const trustedProxies =
  process.env.TRUSTED_PROXIES?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
if (!sessionSecret || sessionSecret.length < 32)
  throw new Error("SESSION_SECRET must have at least 32 characters.");
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535)
  throw new Error("Invalid API_PORT.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (new URL(appOrigin).origin !== appOrigin)
  throw new Error("APP_ORIGIN must be an origin without a path.");
if (isProduction) {
  if (!registrationCode || registrationCode.length < 32)
    throw new Error(
      "Production REGISTRATION_CODE requires a random value of at least 32 characters.",
    );
  if (!appOrigin.startsWith("https://"))
    throw new Error("Production APP_ORIGIN requires HTTPS.");
  if (
    sessionSecret.length < 64 ||
    /development|change|example/i.test(sessionSecret)
  )
    throw new Error(
      "Production SESSION_SECRET requires a random value of at least 64 characters.",
    );
  if (
    !trustedProxies.length ||
    trustedProxies.some((value) => value === "0.0.0.0/0" || value === "::/0")
  )
    throw new Error(
      "Configure the exact production reverse proxy address in TRUSTED_PROXIES.",
    );
  if (
    process.execArgv.some((arg) => /inspect|insecure-http-parser/.test(arg)) ||
    /inspect|insecure-http-parser/.test(process.env.NODE_OPTIONS ?? "")
  )
    throw new Error("Unsafe Node runtime flags are forbidden in production.");
}
