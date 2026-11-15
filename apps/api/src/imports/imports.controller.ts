import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse } from "@nestjs/swagger";
import { Request } from "express";
import { requireUser } from "../auth/session";
import { ImportDto, ImportPreviewDto } from "../http.dto";
import { ImportsService } from "./imports.service";
import { PlannerService } from "../planner/planner.service";
@Controller()
export class ImportsController {
  constructor(
    readonly imports: ImportsService,
    readonly planner: PlannerService,
  ) {}
  @Post("imports/usos/preview")
  @ApiCreatedResponse({ type: ImportPreviewDto })
  importPreview(@Req() req: Request, @Body() data: ImportDto) {
    return this.imports.previewImport(requireUser(req), data);
  }
  @Post("imports/:id/commit") importCommit(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.planner.commitImport(requireUser(req), id);
  }
}
