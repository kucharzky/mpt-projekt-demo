import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  IsArray,
  ArrayMaxSize,
  IsUrl,
} from "class-validator";

export class AuthDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  registrationCode?: string;
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}
export class TaskInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(180)
  title!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) deadlineDate!: string;
  @ApiProperty() @IsInt() @Min(30) @Max(60000) requiredMinutes!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(240)
  minSessionMinutes?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(240)
  maxSessionMinutes?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  importance?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["TODO", "IN_PROGRESS", "DONE"])
  status?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["WEEKLY", "BIWEEKLY", "MONTHLY", "NONE"])
  recurrence?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) version?: number;
}
export class StatusDto {
  @ApiProperty() @IsIn(["TODO", "IN_PROGRESS", "DONE"]) status!: string;
  @ApiProperty() @IsInt() @Min(0) version!: number;
}
export class VersionDto {
  @ApiProperty() @IsInt() @Min(0) version!: number;
}
export class ActivityInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(180)
  title!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) anchorDate!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  untilDate?: string;
  @ApiProperty() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @ApiProperty() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
  @ApiProperty()
  @IsIn(["ONE_TIME", "WEEKLY", "BIWEEKLY", "MONTHLY"])
  recurrence!: string;
  @ApiProperty() @IsBoolean() isPermanent!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowConflict?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) version?: number;
}
export class OccurrenceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(180)
  title!: string;
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @ApiProperty() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @ApiProperty() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
  @ApiProperty() @IsInt() @Min(0) version!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowConflict?: boolean;
}
export class SessionDto extends OccurrenceDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pinned?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(["PLANNED", "COMPLETED", "MISSED"])
  status?: string;
}
export class PreferencesInputDto {
  @ApiProperty() @IsString() @MaxLength(60) timezone!: string;
  @ApiProperty() @IsInt() @Min(0) @Max(1410) workStart!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1410) workEnd!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1410) weekendStart!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(1410) weekendEnd!: number;
  @ApiProperty() @IsInt() @Min(30) @Max(720) dailyLimit!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(60) buffer!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(120) recovery!: number;
  @ApiProperty() @IsInt() @Min(0) revision!: number;
}
export class ProposalInputDto {
  @ApiProperty() @IsIn(["SEQUENTIAL", "EVEN_SPLIT"]) allocationMode!:
    "SEQUENTIAL" | "EVEN_SPLIT";
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID("4", { each: true })
  order?: string[];
}
export class ProposalSessionDto {
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @ApiProperty() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @ApiProperty() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) endTime!: string;
}
export class ImportDto {
  @ApiProperty() @IsString() @MaxLength(200) name!: string;
  @ApiProperty() @IsString() @MaxLength(2000000) content!: string;
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() replace?: boolean;
}
export class TitleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(180)
  title!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
export class InvitationDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty() @IsIn(["ADMIN", "MEMBER"]) role!: string;
}
export class TokenDto {
  @ApiProperty() @IsString() @MinLength(32) @MaxLength(128) token!: string;
}
export class MembershipDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(["ADMIN", "MEMBER"]) role?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() shareAvailability?: boolean;
}
export class CommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(4000)
  body!: string;
}
export class ResourceDto extends TitleDto {
  @ApiProperty()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(2000)
  url!: string;
}
export class AvailabilityDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  participantIds!: string[];
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
  @ApiProperty() @IsInt() @Min(15) @Max(240) durationMinutes!: number;
}
export class MeetingDto extends TitleDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  participantIds!: string[];
  @ApiProperty() @IsString() start!: string;
  @ApiProperty() @IsString() end!: string;
}

export class EventDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() start!: string;
  @ApiProperty() end!: string;
  @ApiProperty() source!: string;
  @ApiProperty() isPermanent!: boolean;
  @ApiPropertyOptional() taskId?: string;
  @ApiPropertyOptional() activityId?: string;
  @ApiPropertyOptional() occurrenceDate?: string;
  @ApiPropertyOptional() location?: string;
  @ApiPropertyOptional() status?: string;
  @ApiPropertyOptional() pinned?: boolean;
  @ApiPropertyOptional() version?: number;
}
export class TaskViewDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() status!: string;
  @ApiProperty() deadlineDate!: string;
  @ApiProperty() requiredMinutes!: number;
  @ApiProperty() minSessionMinutes!: number;
  @ApiProperty() maxSessionMinutes!: number;
  @ApiProperty() importance!: number;
  @ApiProperty() completedMinutes!: number;
  @ApiProperty() plannedMinutes!: number;
  @ApiProperty() missingMinutes!: number;
  @ApiProperty() version!: number;
  @ApiPropertyOptional({ nullable: true, type: String }) recurrence?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) projectId?:
    string | null;
  @ApiProperty() assigneeName!: string;
}
export class UserViewDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() timezone!: string;
}
export class PreferencesViewDto {
  @ApiProperty() workStart!: number;
  @ApiProperty() workEnd!: number;
  @ApiProperty() weekendStart!: number;
  @ApiProperty() weekendEnd!: number;
  @ApiProperty() dailyLimit!: number;
  @ApiProperty() buffer!: number;
  @ApiProperty() recovery!: number;
}
export class SlotDto {
  @ApiProperty() start!: string;
  @ApiProperty() end!: string;
}
export class SnapshotDto {
  @ApiProperty() revision!: number;
  @ApiProperty({ type: UserViewDto }) user!: UserViewDto;
  @ApiProperty({ type: PreferencesViewDto }) preferences!: PreferencesViewDto;
  @ApiProperty({ type: [TaskViewDto] }) tasks!: TaskViewDto[];
  @ApiProperty({ type: [EventDto] }) events!: EventDto[];
  @ApiProperty({ type: [SlotDto] }) freeSlots!: SlotDto[];
  @ApiProperty({ type: [String] }) conflicts!: string[];
}
export class AuthSessionDto {
  @ApiProperty() registrationRequiresCode!: boolean;
  @ApiProperty({ type: UserViewDto, nullable: true }) user!: UserViewDto | null;
  @ApiProperty() csrfToken!: string;
}
export class ActivityViewDto {
  @ApiProperty() timezone!: string;
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() location!: string;
  @ApiProperty() anchorDate!: string;
  @ApiProperty({ type: String, nullable: true }) untilDate!: string | null;
  @ApiProperty() startTime!: string;
  @ApiProperty() endTime!: string;
  @ApiProperty() recurrence!: string;
  @ApiProperty() isPermanent!: boolean;
  @ApiProperty() version!: number;
}
export class CommentViewDto {
  @ApiProperty() id!: string;
  @ApiProperty() body!: string;
  @ApiProperty() author!: string;
  @ApiProperty() createdAt!: string;
}
export class ResourceViewDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() url!: string;
}
export class TaskDetailsDto extends TaskViewDto {
  @ApiProperty({ type: [CommentViewDto] }) comments!: CommentViewDto[];
  @ApiProperty({ type: [ResourceViewDto] }) resources!: ResourceViewDto[];
}
export class PlannedSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() taskId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() start!: string;
  @ApiProperty() end!: string;
  @ApiProperty() kind!: string;
}
export class SoftMoveDto {
  @ApiProperty() activityId!: string;
  @ApiProperty() occurrenceDate!: string;
  @ApiProperty() title!: string;
  @ApiProperty() from!: string;
  @ApiProperty() start!: string;
  @ApiProperty() end!: string;
}
export class TaskAllocationDto {
  @ApiProperty() taskId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() requested!: number;
  @ApiProperty() placed!: number;
  @ApiProperty() missing!: number;
}
export class ProposalViewDto {
  @ApiProperty() id!: string;
  @ApiProperty() strategy!: string;
  @ApiProperty({ type: [PlannedSessionDto] }) sessions!: PlannedSessionDto[];
  @ApiProperty({ type: [SoftMoveDto] }) moves!: SoftMoveDto[];
  @ApiProperty({ type: [TaskAllocationDto] }) totals!: TaskAllocationDto[];
}
export class ImportedViewDto {
  @ApiProperty() title!: string;
  @ApiProperty() start!: string;
  @ApiProperty() end!: string;
}
export class ImportPreviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() added!: number;
  @ApiProperty() updated!: number;
  @ApiProperty() unchanged!: number;
  @ApiProperty() removed!: number;
  @ApiProperty({ type: [String] }) warnings!: string[];
  @ApiProperty({ type: [ImportedViewDto] }) events!: ImportedViewDto[];
}
export class MemberUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
}
export class MemberDto {
  @ApiProperty() userId!: string;
  @ApiProperty() role!: string;
  @ApiProperty() shareAvailability!: boolean;
  @ApiProperty({ type: MemberUserDto }) user!: MemberUserDto;
}
export class ProjectDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [TaskViewDto] }) tasks!: TaskViewDto[];
}
export class MeetingViewDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() start!: string;
  @ApiProperty() end!: string;
  @ApiProperty({ type: [String] }) participantIds!: string[];
  @ApiProperty({ type: [String] }) acceptedIds!: string[];
  @ApiProperty() status!: string;
  @ApiProperty() creatorId!: string;
}
export class TeamViewDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: [MemberDto] }) members!: MemberDto[];
  @ApiProperty({ type: [ProjectDto] }) projects!: ProjectDto[];
  @ApiProperty({ type: [MeetingViewDto] }) meetings!: MeetingViewDto[];
}
export class NoticeDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() seen!: boolean;
  @ApiProperty() createdAt!: string;
}
export class AssignmentDto {
  @ApiProperty() taskId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() userName!: string;
  @ApiProperty() availableMinutes!: number;
  @ApiProperty() requiredMinutes!: number;
  @ApiProperty() overloaded!: boolean;
}
export class AssignmentsDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: [AssignmentDto] }) suggestions!: AssignmentDto[];
}
