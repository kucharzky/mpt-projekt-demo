import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpException,
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { ApiOkResponse, ApiCreatedResponse, ApiTags } from "@nestjs/swagger";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  cookieName,
  isProduction,
  registrationCode,
  registrationRequiresCode,
} from "../config";
import { Request, Response } from "express";
import argon2 from "argon2";
import { DatabaseService } from "../database/database.service";
import { AuthDto, AuthSessionDto } from "../http.dto";
import { publicUser } from "./session";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  private activeHashes = 0;
  private dummyHash = argon2.hash("timing-equalization-placeholder", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  private async hashJob<T>(job: () => Promise<T>): Promise<T> {
    if (this.activeHashes >= 4)
      throw new HttpException(
        "Logowanie jest chwilowo niedostępne. Spróbuj ponownie.",
        429,
      );
    this.activeHashes++;
    try {
      return await job();
    } finally {
      this.activeHashes--;
    }
  }
  constructor(private readonly db: DatabaseService) {}
  @Get("session")
  @ApiOkResponse({ type: AuthSessionDto })
  async session(@Req() req: Request) {
    const u = req.session.userId
      ? await this.db.user.findUnique({ where: { id: req.session.userId } })
      : null;
    return {
      user: u ? publicUser(u) : null,
      csrfToken: req.session.csrfToken,
      registrationRequiresCode,
    };
  }
  @Post("register")
  @ApiCreatedResponse({ type: AuthSessionDto })
  async register(@Body() input: AuthDto, @Req() req: Request) {
    if (registrationRequiresCode) {
      const digest = (value: string) =>
        createHash("sha256").update(value).digest();
      if (
        !timingSafeEqual(
          digest(input.registrationCode ?? ""),
          digest(registrationCode!),
        )
      )
        throw new ForbiddenException(
          "Kod rejestracji jest nieprawidłowy. Skontaktuj się z administratorem.",
        );
    }
    const email = input.email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where: { email } }))
      throw new ConflictException("Konto z tym adresem już istnieje.");
    const passwordHash = await this.hashJob(() =>
      argon2.hash(input.password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      }),
    );
    const u = await this.db.user.create({
      data: {
        email,
        name: input.name?.trim() || email.split("@")[0],
        passwordHash,
        state: { create: {} },
      },
    });
    await this.establish(req, u.id);
    return {
      user: publicUser(u),
      csrfToken: req.session.csrfToken,
      registrationRequiresCode,
    };
  }
  @Post("login")
  @ApiCreatedResponse({ type: AuthSessionDto })
  async login(@Body() input: AuthDto, @Req() req: Request) {
    const u = await this.db.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    const valid = await this.hashJob(async () =>
      argon2.verify(u?.passwordHash ?? (await this.dummyHash), input.password),
    );
    if (!u || !valid)
      throw new UnauthorizedException("Nieprawidłowy adres e-mail lub hasło.");
    await this.establish(req, u.id);
    return {
      user: publicUser(u),
      csrfToken: req.session.csrfToken,
      registrationRequiresCode,
    };
  }
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    res.clearCookie(cookieName, {
      path: "/",
      secure: isProduction,
      httpOnly: true,
      sameSite: "lax",
    });
    return { ok: true };
  }
  private async establish(req: Request, userId: string) {
    const { randomBytes } = await import("node:crypto");
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
    req.session.userId = userId;
    req.session.authenticatedAt = Date.now();
    req.session.cookie.maxAge = 86400000;
    req.session.csrfToken = randomBytes(24).toString("hex");
    await new Promise<void>((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve())),
    );
  }
}
