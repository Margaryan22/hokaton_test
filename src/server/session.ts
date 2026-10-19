import { z } from "zod";
import type { Db } from "@/db/client";
import { getUser } from "@/db/users";
import type { ApiError, ApiErrorCode, UserDto } from "@/shared/api";
import { RecordIdSchema } from "@/shared/schemas";
import { ServiceError } from "./services/errors";

export const SESSION_COOKIE = "uid";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const UidSchema = z.coerce.number().int().positive();

/** Resolves the cookie value to an existing user; garbage, absent or unknown ids give null (never a throw). */
export async function resolveUser(db: Db, rawUid: string | undefined): Promise<UserDto | null> {
  if (rawUid === undefined) return null;
  const parsed = UidSchema.safeParse(rawUid);
  if (!parsed.success) return null;
  const user = await getUser(db, parsed.data);
  return user ? { id: user.id, name: user.name } : null;
}

export function sessionCookieOptions(env: Record<string, string | undefined> = process.env) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** The route id segment: a positive integer or null. */
export function parseRecordId(raw: string): number | null {
  const parsed = RecordIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const STATUS: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  no_user: 401,
  not_found: 404,
  rate_limited: 429,
  internal: 500,
};

export function errorResponse(code: ApiErrorCode, message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status: STATUS[code] });
}

export const noUserResponse = () => errorResponse("no_user", "Выберите пользователя");

/** Maps a thrown error to a response; unexpected errors become a generic 500 without details or user text. */
export function handleError(error: unknown): Response {
  if (error instanceof ServiceError) {
    const code: ApiErrorCode = error.code === "limit_reached" ? "invalid_input" : error.code;
    return errorResponse(code, error.message);
  }
  console.error("Unexpected API error:", error instanceof Error ? error.name : "unknown");
  return errorResponse("internal", "Что-то пошло не так, попробуйте ещё раз");
}

/** Client address for rate limiting (first X-Forwarded-For hop on Vercel). */
export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
