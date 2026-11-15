import { Controller, Get, Req } from "@nestjs/common";
import type { Request } from "express";
import { DatabaseService } from "./database/database.service";

@Controller()
export class AppController {
  constructor(readonly db: DatabaseService) {}

  @Get("health")
  health() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("session")
  session(@Req() req: Request) {
    return { authenticated: Boolean(req.session?.userId), userId: req.session?.userId };
  }
}
