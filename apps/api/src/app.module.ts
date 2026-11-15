import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./auth/auth.module";
import { PlannerModule } from "./planner/planner.module";
import { ImportsModule } from "./imports/imports.module";

@Module({
  imports: [DatabaseModule, AuthModule, PlannerModule, ImportsModule],
  controllers: [AppController],
})
export class AppModule {}
