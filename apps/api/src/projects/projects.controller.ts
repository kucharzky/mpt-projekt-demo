import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOkResponse, ApiCreatedResponse } from "@nestjs/swagger";
import { Request } from "express";
import { requireUser } from "../auth/session";
import { ProjectsService } from "./projects.service";
import {
  TeamViewDto,
  AssignmentsDto,
  AvailabilityDto,
  CommentDto,
  InvitationDto,
  MeetingDto,
  MembershipDto,
  ResourceDto,
  TitleDto,
  TokenDto,
} from "../http.dto";
@ApiTags("projects")
@Controller()
export class ProjectsController {
  constructor(readonly projects: ProjectsService) {}
  @Get("teams") @ApiOkResponse({ type: [TeamViewDto] }) teams(
    @Req() req: Request,
  ) {
    return this.projects.list(requireUser(req));
  }
  @Post("teams") team(@Req() req: Request, @Body() data: TitleDto) {
    return this.projects.create(requireUser(req), data.title);
  }
  @Post("teams/:id/invitations") invite(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: InvitationDto,
  ) {
    return this.projects.invite(requireUser(req), id, data.email, data.role);
  }
  @Post("invitations/accept") acceptInvite(
    @Req() req: Request,
    @Body() data: TokenDto,
  ) {
    return this.projects.accept(requireUser(req), data.token);
  }
  @Patch("teams/:id/members/:userId") membership(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("userId") targetId: string,
    @Body() data: MembershipDto,
  ) {
    return this.projects.membership(
      requireUser(req),
      id,
      targetId,
      data.role,
      data.shareAvailability,
    );
  }
  @Delete("teams/:id/members/:userId") removeMember(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("userId") targetId: string,
  ) {
    return this.projects.removeMember(requireUser(req), id, targetId);
  }
  @Post("teams/:id/projects") project(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: TitleDto,
  ) {
    return this.projects.project(
      requireUser(req),
      id,
      data.title,
      data.description ?? "",
    );
  }
  @Patch("teams/:id/projects/:projectId") editProject(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("projectId") projectId: string,
    @Body() data: TitleDto,
  ) {
    return this.projects.project(
      requireUser(req),
      id,
      data.title,
      data.description ?? "",
      projectId,
    );
  }
  @Delete("teams/:id/projects/:projectId") deleteProject(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("projectId") projectId: string,
  ) {
    return this.projects.deleteProject(requireUser(req), id, projectId);
  }
  @Post("tasks/:id/comments") comment(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: CommentDto,
  ) {
    return this.projects.comment(requireUser(req), id, data.body);
  }
  @Post("tasks/:id/resources") resource(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: ResourceDto,
  ) {
    return this.projects.resource(requireUser(req), id, data.title, data.url);
  }
  @Delete("tasks/:id/resources/:resourceId") deleteResource(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("resourceId") resourceId: string,
  ) {
    return this.projects.deleteResource(requireUser(req), id, resourceId);
  }
  @Post("teams/:id/availability") availability(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: AvailabilityDto,
  ) {
    return this.projects.availability(requireUser(req), id, data);
  }
  @Post("teams/:id/meetings") meeting(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: MeetingDto,
  ) {
    return this.projects.meeting(requireUser(req), id, data);
  }
  @Post("teams/:id/meetings/:meetingId/accept") acceptMeeting(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("meetingId") meetingId: string,
  ) {
    return this.projects.acceptMeeting(requireUser(req), id, meetingId);
  }
  @Delete("teams/:id/meetings/:meetingId") cancelMeeting(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("meetingId") meetingId: string,
  ) {
    return this.projects.cancelMeeting(requireUser(req), id, meetingId);
  }
  @Post("teams/:id/assignments")
  @ApiCreatedResponse({ type: AssignmentsDto })
  assignments(@Req() req: Request, @Param("id") id: string) {
    return this.projects.assignments(requireUser(req), id);
  }
  @Post("teams/:id/assignments/:proposalId/confirm") confirmAssignments(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("proposalId") proposalId: string,
  ) {
    return this.projects.confirmAssignments(requireUser(req), id, proposalId);
  }
}
