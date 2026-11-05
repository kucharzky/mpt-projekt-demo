const path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../../.env"),
  quiet: true,
});
if (process.env.MIGRATE_TEST === "1") {
  if (
    !process.env.TEST_DATABASE_URL ||
    !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")
  )
    throw new Error("Test migrations require a database ending in _test");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
require("node:child_process").execFileSync(
  path.resolve(__dirname, "../../../node_modules/.bin/prisma"),
  ["migrate", "deploy"],
  { cwd: path.resolve(__dirname, ".."), env: process.env, stdio: "inherit" },
);

// Runtime credentials must never be able to rewrite migration history.
if (
  process.env.NODE_ENV === "production" ||
  process.env.DATABASE_URL?.includes("smartuni_migrator:")
) {
  const { Client } = require("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  void client
    .connect()
    .then(() =>
      client.query(
        'REVOKE ALL ON TABLE "_prisma_migrations" FROM smartuni_app',
      ),
    )
    .finally(() => client.end());
}
