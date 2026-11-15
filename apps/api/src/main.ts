import "./config";
import "reflect-metadata";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import {
  ValidationPipe,
  HttpException,
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  BadRequestException,
} from "@nestjs/common";
import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import helmet from "helmet";
import { Prisma } from "@prisma/client";
import path from "node:path";
import fs from "node:fs";
import { AppModule } from "./app.module";
import {
  apiPort,
  appOrigin,
  isProduction,
  sessionSecret,
  cookieName,
  trustedProxies,
} from "./config";
import { DatabaseService } from "./database/database.service";
import { english } from "./security/messages";
import { RateLimiter } from "./security/rate-limit";

@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const defaults: Record<string, string> = {
        "Not Found": "Nie znaleziono danych.",
        Forbidden: "Brak uprawnień do wykonania tej operacji.",
        "Bad Request": "Nieprawidłowy format żądania.",
        Unauthorized: "Zaloguj się, aby kontynuować.",
        "Validation failed (numeric string is expected)":
          "Podaj poprawną liczbę.",
      };
      if (
        response &&
        typeof response === "object" &&
        "message" in response &&
        typeof response.message === "string"
      ) {
        const message =
          defaults[response.message] ??
          (response.message.startsWith("Cannot ")
            ? "Nie znaleziono danych."
            : response.message);
        res.status(error.getStatus()).json({ ...response, message });
      } else res.status(error.getStatus()).json(response);
      return;
    }
    if (
      error &&
      typeof error === "object" &&
      "type" in error &&
      (error.type === "entity.too.large" ||
        error.type === "entity.parse.failed")
    ) {
      const large = error.type === "entity.too.large";
      res.status(large ? 413 : 400).json({
        message: large
          ? "Żądanie przekracza dopuszczalny rozmiar."
          : "Nieprawidłowy format żądania.",
      });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const status =
        error.code === "P2025"
          ? 404
          : ["P2002", "P2034"].includes(error.code)
            ? 409
            : 400;
      res.status(status).json({
        message:
          status === 404
            ? "Nie znaleziono danych."
            : status === 409
              ? "Dane zmieniły się lub taki zapis już istnieje. Odśwież widok."
              : "Nie można zapisać danych.",
      });
      return;
    }
    console.error(
      "API operation failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    res
      .status(500)
      .json({ message: "Nie udało się wykonać operacji. Spróbuj ponownie." });
  }
}
export async function createApplication() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === "test" ? false : ["error", "warn", "log"],
    bodyParser: false,
  });
  app.setGlobalPrefix("api");
  const server = app.getHttpAdapter().getInstance();
  server.disable("x-powered-by");
  server.disable("etag");
  server.set("query parser", "simple");
  if (trustedProxies.length) server.set("trust proxy", trustedProxies);
  const http = app.getHttpServer();
  http.requestTimeout = 30000;
  http.headersTimeout = 15000;
  http.keepAliveTimeout = 5000;
  http.maxRequestsPerSocket = 1000;
  app.use(
    helmet({
      strictTransportSecurity: isProduction
        ? { maxAge: 15552000, includeSubDomains: false }
        : false,
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "no-referrer" },
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:"],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    }),
  );
  const limiter = new RateLimiter();
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Request-Id", randomUUID());
    const json = res.json.bind(res);
    const useEnglish = req.acceptsLanguages("pl", "en") === "en";
    res.json = (body: unknown) => {
      if (
        useEnglish &&
        res.statusCode >= 400 &&
        body &&
        typeof body === "object" &&
        "message" in body
      ) {
        const message = (body as { message: unknown }).message;
        body = {
          ...body,
          message:
            typeof message === "string"
              ? english(message)
              : Array.isArray(message)
                ? message.map((m) => (typeof m === "string" ? english(m) : m))
                : message,
        };
      }
      return json(body);
    };
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    const requestPath = req.path.toLowerCase().replace(/\/+$/, "");
    if (!requestPath.startsWith("/api")) return next();
    res.setHeader("Cache-Control", "no-store, private");
    if (
      requestPath === "/api/health" &&
      ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress ?? "",
      )
    )
      return next();
    void (async () => {
      if (Object.values(req.query).some((value) => typeof value !== "string")) {
        res.status(400).json({ message: "Nieprawidłowe parametry zapytania." });
        return;
      }
      if (req.get("sec-fetch-site") === "cross-site") {
        res.status(403).json({ message: "Niedozwolone źródło żądania." });
        return;
      }
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const rules: [string, number, number][] = [["requests", 300, 60000]];
      if (requestPath === "/api/auth/session")
        rules.push(["sessions", 60, 900000]);
      if (["/api/auth/login", "/api/auth/register"].includes(requestPath))
        rules.push(["authentication", 30, 900000]);
      for (const [scope, limit, window] of rules) {
        const result = await limiter.consume(scope, ip, limit, window);
        if (!result.allowed) {
          res.setHeader("Retry-After", result.retryAfter);
          res
            .status(429)
            .json({ message: "Zbyt wiele żądań. Spróbuj ponownie za chwilę." });
          return;
        }
      }
      next();
    })().catch(() => {
      res.status(503).json({
        message: "Aplikacja jest chwilowo niedostępna. Spróbuj ponownie.",
      });
    });
  });
  app.use(
    express.json({ limit: "3mb", strict: true, type: "application/json" }),
  );
  const Store = connectPg(session);
  const sessionStore = new Store({
    pool: limiter.pool,
    tableName: "session",
    createTableIfMissing: false,
    pruneSessionInterval: 900,
    errorLog: () => console.error("Session storage unavailable"),
  });
  app.use(
    session({
      name: cookieName,
      rolling: true,
      store: sessionStore,
      secret: sessionSecret!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 10 * 60000,
      },
    }),
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestPath = req.path.toLowerCase().replace(/\/+$/, "");
    if (!requestPath.startsWith("/api") || requestPath === "/api/health")
      return next();
    void (async () => {
      if (
        req.session.userId &&
        (!req.session.authenticatedAt ||
          Date.now() - req.session.authenticatedAt > 7 * 86400000)
      ) {
        await new Promise<void>((resolve, reject) =>
          req.session.destroy((error) => (error ? reject(error) : resolve())),
        );
        res.clearCookie(cookieName, {
          path: "/",
          secure: isProduction,
          httpOnly: true,
          sameSite: "lax",
        });
        res
          .status(401)
          .json({ message: "Sesja wygasła. Zaloguj się ponownie." });
        return;
      }
      if (requestPath === "/api/auth/session" && req.method === "GET")
        req.session.csrfToken ??= randomBytes(24).toString("hex");
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const received = req.get("x-csrf-token") || "",
          expected = req.session.csrfToken || "";
        const allowed = [
          appOrigin,
          ...(!isProduction
            ? ["http://127.0.0.1:5173", "http://localhost:5173"]
            : []),
        ];
        if (
          (req.get("origin") && !allowed.includes(req.get("origin")!)) ||
          !expected ||
          Buffer.byteLength(received) !== Buffer.byteLength(expected) ||
          !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
        ) {
          res.status(403).json({
            message: "Sesja formularza wygasła. Odśwież stronę.",
            code: "CSRF_INVALID",
          });
          return;
        }
        const ip = req.ip || "unknown";
        const auth = ["/api/auth/login", "/api/auth/register"].includes(
          requestPath,
        );
        const expensive =
          /\/(proposals|assignments|availability|preview)$/.test(requestPath);
        if (auth || expensive) {
          const identity = auth
            ? `${ip}\0${typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "invalid"}`
            : req.session.userId || ip;
          const result = await limiter.consume(
            auth ? "account-ip" : "planning",
            identity,
            auth ? 10 : 20,
            auth ? 900000 : 60000,
          );
          if (!result.allowed) {
            res.setHeader("Retry-After", result.retryAfter);
            res.status(429).json({
              message: "Zbyt wiele żądań. Spróbuj ponownie za chwilę.",
            });
            return;
          }
        }
      }
      next();
    })().catch(next);
  });
  // Expired proposals/import previews contain calendar data and are removed promptly.
  const cleanup = async () => {
    await limiter.cleanup();
    const db = app.get(DatabaseService),
      before = new Date(Date.now() - 86400000);
    await db.importBatch.deleteMany({
      where: { expiresAt: { lt: before }, committed: false },
    });
    await db.assignmentProposal.deleteMany({
      where: { expiresAt: { lt: before }, confirmed: false },
    });
    await db.invitation.deleteMany({ where: { expiresAt: { lt: before } } });
    await db.proposal.deleteMany({
      where: { expiresAt: { lt: before }, status: "PENDING" },
    });
  };
  const timer = setInterval(
    () => void cleanup().catch(() => console.error("Maintenance failed")),
    15 * 60000,
  );
  timer.unref();
  const close = app.close.bind(app);
  app.close = async () => {
    clearInterval(timer);
    sessionStore.close();
    await close();
    await limiter.close();
  };
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const names: Record<string, string> = {
          email: "Adres e-mail",
          password: "Hasło",
          name: "Imię",
          title: "Nazwa",
          deadlineDate: "Termin wykonania",
          requiredMinutes: "Czas pracy",
          startTime: "Początek",
          endTime: "Koniec",
          anchorDate: "Data",
          timezone: "Strefa czasowa",
          token: "Kod zaproszenia",
          body: "Treść",
          url: "Link",
          version: "Wersja danych",
        };
        return new BadRequestException(
          errors.map((e) =>
            e.constraints?.whitelistValidation
              ? "Formularz zawiera nieobsługiwane pola. Odśwież aplikację."
              : e.constraints?.isEmail
                ? "Podaj poprawny adres e-mail."
                : `Sprawdź pole „${names[e.property] ?? "Ustawienie"}”. Podana wartość jest nieprawidłowa.`,
          ),
        );
      },
    }),
  );
  app.useGlobalFilters(new Errors());
  const publicDir = path.resolve(__dirname, "../../web/dist");
  if (isProduction && fs.existsSync(publicDir))
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.toLowerCase().startsWith("/api")) return next();
      express.static(publicDir, {
        dotfiles: "deny",
        index: false,
        setHeaders: (response, file) => {
          response.setHeader(
            "Cache-Control",
            file.includes(`${path.sep}assets${path.sep}`)
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          );
        },
      })(req, res, () => {
        if (
          req.method === "GET" &&
          !path.extname(req.path) &&
          !req.path.startsWith("/.")
        ) {
          res.setHeader("Cache-Control", "no-cache");
          res.sendFile(path.join(publicDir, "index.html"));
        } else next();
      });
    });
  app.enableShutdownHooks();
  return app;
}
if (require.main === module)
  void createApplication()
    .then((app) => app.listen(apiPort, process.env.API_HOST || "127.0.0.1"))
    .catch((error) => {
      console.error(
        "API startup failed:",
        error instanceof Error ? error.name : "UnknownError",
      );
      process.exit(1);
    });
