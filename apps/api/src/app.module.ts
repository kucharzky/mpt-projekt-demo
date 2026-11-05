import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { PlannerModule } from "./planner/planner.module";
import { ImportsModule } from "./imports/imports.module";
import { ProjectsModule } from "./projects/projects.module";
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    PlannerModule,
    ImportsModule,
    ProjectsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
