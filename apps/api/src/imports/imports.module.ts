import { Module } from "@nestjs/common";
import { PlannerModule } from "../planner/planner.module";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";
@Module({
  imports: [PlannerModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
