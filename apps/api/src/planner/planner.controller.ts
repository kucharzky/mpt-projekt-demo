import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiOkResponse, ApiCreatedResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { requireUser } from "../auth/session";
import { DatabaseService } from "../database/database.service";
import { PlannerService } from "./planner.service";
import {
  ActivityViewDto,
  TaskDetailsDto,
  ProposalViewDto,
  ActivityInputDto,
  OccurrenceDto,
  PreferencesInputDto,
  ProposalInputDto,
  ProposalSessionDto,
  SessionDto,
  SnapshotDto,
  StatusDto,
  TaskInputDto,
} from "../http.dto";
import { exportIcs } from "../imports/ics";
@ApiTags("planner")
@Controller()
export class PlannerController {
  constructor(
    readonly planner: PlannerService,
    readonly db: DatabaseService,
  ) {}
  @Get("planner/state")
  @ApiOkResponse({ type: SnapshotDto })
  state(
    @Req() req: Request,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.planner.snapshot(requireUser(req), from, to);
  }
  @Get("calendar/events") async events(
    @Req() req: Request,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return (await this.planner.snapshot(requireUser(req), from, to)).events;
  }
  @Get("calendar/export") async export(
    @Req() req: Request,
    @Query("from") from: string,
    @Query("to") to: string,
    @Res() res: Response,
  ) {
    const state = await this.planner.snapshot(requireUser(req), from, to);
    res
      .type("text/calendar")
      .attachment("smartuniplanner.ics")
      .send(exportIcs(state.events));
  }
  @Get("tasks/:id") @ApiOkResponse({ type: TaskDetailsDto }) details(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.planner.taskDetails(requireUser(req), id);
  }
  @Post("tasks") task(@Req() req: Request, @Body() data: TaskInputDto) {
    return this.planner.saveTask(requireUser(req), data);
  }
  @Patch("tasks/:id") editTask(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: TaskInputDto,
  ) {
    return this.planner.saveTask(requireUser(req), data, id);
  }
  @Post("tasks/:id/status") status(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: StatusDto,
  ) {
    return this.planner.changeStatus(
      requireUser(req),
      id,
      data.status,
      data.version,
    );
  }
  @Delete("tasks/:id") deleteTask(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("version", ParseIntPipe) version: number,
  ) {
    return this.planner.deleteTask(requireUser(req), id, version);
  }
  @Post("tasks/:id/sessions") session(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: SessionDto,
  ) {
    return this.planner.session(requireUser(req), id, data);
  }
  @Patch("task-sessions/:id") async editSession(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: SessionDto,
  ) {
    const uid = requireUser(req),
      s = await this.db.taskSession.findFirstOrThrow({
        where: { id, userId: uid },
      });
    return this.planner.session(uid, s.taskId, data, id);
  }
  @Delete("task-sessions/:id") deleteSession(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("version", ParseIntPipe) version: number,
  ) {
    return this.planner.deleteSession(requireUser(req), id, version);
  }
  @Post("activities") activity(
    @Req() req: Request,
    @Body() data: ActivityInputDto,
  ) {
    return this.planner.activity(requireUser(req), data);
  }
  @Get("activities/:id")
  @ApiOkResponse({ type: ActivityViewDto })
  activityDetails(@Req() req: Request, @Param("id") id: string) {
    return this.planner.activityDetails(requireUser(req), id);
  }
  @Patch("activities/:id") editActivity(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: ActivityInputDto,
  ) {
    return this.planner.activity(requireUser(req), data, id);
  }
  @Delete("activities/:id") deleteActivity(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("version", ParseIntPipe) version: number,
  ) {
    return this.planner.deleteActivity(requireUser(req), id, version);
  }
  @Patch("activities/:id/occurrences/:date") occurrence(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("date") date: string,
    @Body() data: OccurrenceDto,
  ) {
    return this.planner.occurrence(
      requireUser(req),
      id,
      date,
      data,
      data.version,
    );
  }
  @Delete("activities/:id/occurrences/:date") cancelOccurrence(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("date") date: string,
    @Query("version", ParseIntPipe) version: number,
  ) {
    return this.planner.occurrence(
      requireUser(req),
      id,
      date,
      undefined,
      version,
    );
  }
  @Patch("me/preferences") settings(
    @Req() req: Request,
    @Body() data: PreferencesInputDto,
  ) {
    return this.planner.settings(requireUser(req), data);
  }
  @Post("scheduler/proposals")
  @ApiCreatedResponse({ type: [ProposalViewDto] })
  proposals(@Req() req: Request, @Body() data: ProposalInputDto) {
    return this.planner.proposals(requireUser(req), data);
  }
  @Post("scheduler/proposals/:id/confirm") confirm(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.planner.confirmProposal(requireUser(req), id);
  }
  @Patch("scheduler/proposals/:id/sessions/:sessionId")
  @ApiOkResponse({ type: ProposalViewDto })
  editProposal(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("sessionId") sessionId: string,
    @Body() data: ProposalSessionDto,
  ) {
    return this.planner.editProposal(requireUser(req), id, sessionId, data);
  }
  @Post("scheduler/proposals/:id/undo") undo(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.planner.confirmProposal(requireUser(req), id, true);
  }
  @Get("trash") trash(@Req() req: Request) {
    return this.planner.trash(requireUser(req));
  }
  @Post("trash/:kind/:id/restore") restore(
    @Req() req: Request,
    @Param("kind") kind: string,
    @Param("id") id: string,
  ) {
    return this.planner.restore(requireUser(req), kind, id);
  }
}
