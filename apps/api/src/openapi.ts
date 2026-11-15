import "./config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { createApplication } from "./main";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
void (async () => {
  const app = await createApplication();
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("SmartUniPlanner API")
      .setVersion("1.0.0")
      .build(),
  );
  const output = path.resolve(__dirname, "../openapi.json");
  fs.writeFileSync(output, JSON.stringify(document, null, 2) + "\n");
  execFileSync(
    path.resolve(__dirname, "../../../node_modules/.bin/openapi-typescript"),
    [
      output,
      "-o",
      path.resolve(__dirname, "../../web/src/api/generated/schema.ts"),
    ],
    { stdio: "inherit" },
  );
  execFileSync(
    path.resolve(__dirname, "../../../node_modules/.bin/prettier"),
    [
      "--write",
      output,
      path.resolve(__dirname, "../../web/src/api/generated/schema.ts"),
    ],
    { stdio: "inherit" },
  );
  await app.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
