import { UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
declare module "express-session" {
  interface SessionData {
    userId?: string;
    authenticatedAt?: number;
    csrfToken?: string;
  }
}
export const publicUser = (u: {
  id: string;
  name: string;
  email: string;
  timezone: string;
}) => ({ id: u.id, name: u.name, email: u.email, timezone: u.timezone });
export function requireUser(req: Request): string {
  if (!req.session.userId)
    throw new UnauthorizedException("Zaloguj się, aby kontynuować.");
  return req.session.userId;
}
