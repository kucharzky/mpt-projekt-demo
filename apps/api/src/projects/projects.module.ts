import { Module } from "@nestjs/common";
import { PlannerModule } from "../planner/planner.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
@Module({
  imports: [PlannerModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
