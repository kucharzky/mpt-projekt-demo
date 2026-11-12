import i18n, { t as tr } from "../i18n";
import type { components } from "./generated/schema";

export type PlannerState = components["schemas"]["SnapshotDto"];
export type Task = components["schemas"]["TaskViewDto"];
export type CalendarEvent = components["schemas"]["EventDto"];
export type User = components["schemas"]["UserViewDto"];
export type Preferences = components["schemas"]["PreferencesViewDto"];
export type Slot = components["schemas"]["SlotDto"];
export type AuthSession = components["schemas"]["AuthSessionDto"];
export type TaskDetails = components["schemas"]["TaskDetailsDto"];
export type Activity = components["schemas"]["ActivityViewDto"];
export type Proposal = components["schemas"]["ProposalViewDto"];
export type ImportPreview = components["schemas"]["ImportPreviewDto"];
export type Member = components["schemas"]["MemberDto"];
export type Project = components["schemas"]["ProjectDto"];
export type Meeting = components["schemas"]["MeetingViewDto"];
export type Team = components["schemas"]["TeamViewDto"];
export type Notice = components["schemas"]["NoticeDto"];
export type Assignments = components["schemas"]["AssignmentsDto"];

let csrf = "";
let pendingCsrf: Promise<void> | null = null;
async function refreshCsrf() {
  if (!pendingCsrf)
    pendingCsrf = (async () => {
      const response = await fetch("/api/auth/session", {
        credentials: "same-origin",
        headers: { "Accept-Language": i18n.language },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new ApiError(
          tr("Nie można odświeżyć sesji. Spróbuj ponownie."),
          response.status,
        );
      const data = await response.json();
      if (typeof data.csrfToken !== "string")
        throw new ApiError(tr("Nieprawidłowa odpowiedź aplikacji."), 503);
      csrf = data.csrfToken;
    })().finally(() => {
      pendingCsrf = null;
    });
  await pendingCsrf;
}
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  retryCsrf = true,
): Promise<T> {
  const mutating = !["GET", "HEAD"].includes(options.method ?? "GET");
  if (mutating && !csrf) await refreshCsrf();
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Accept-Language": i18n.language,
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(csrf ? { "x-csrf-token": csrf } : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
  } catch {
    throw new ApiError(
      tr("Nie można połączyć się z aplikacją. Spróbuj ponownie za chwilę."),
      0,
    );
  }
  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      tr("Aplikacja jest chwilowo niedostępna. Spróbuj ponownie."),
      response.status,
    );
  }
  if (
    mutating &&
    retryCsrf &&
    response.status === 403 &&
    data.code === "CSRF_INVALID"
  ) {
    await refreshCsrf();
    return api<T>(path, options, false);
  }
  if (response.status === 401 && !path.startsWith("/auth/"))
    window.dispatchEvent(new Event("smartuni:unauthorized"));
  if (!response.ok)
    throw new ApiError(
      Array.isArray(data.message)
        ? data.message.join(" ")
        : String(data.message || tr("Nie udało się wykonać operacji.")),
      response.status,
      typeof data.code === "string" ? data.code : undefined,
    );
  if (typeof data.csrfToken === "string") csrf = data.csrfToken;
  return data as T;
}
export const send = <T = unknown>(
  path: string,
  body?: unknown,
  method = "POST",
) => api<T>(path, { method, body });
export const remove = (path: string) => api(path, { method: "DELETE" });
