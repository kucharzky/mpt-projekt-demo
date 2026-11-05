ALTER TABLE "Activity" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Warsaw';
UPDATE "Activity" AS a SET "timezone" = u."timezone" FROM "User" AS u WHERE a."userId" = u."id";
