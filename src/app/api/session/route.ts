import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { getOrCreateUser } from "@/db/users";
import type { SessionResponse } from "@/shared/api";
import { SessionRequestSchema } from "@/shared/schemas";
import { now } from "@/server/clock";
import { RateLimiter } from "@/server/services/rate-limit";
import {
  clientKey,
  errorResponse,
  handleError,
  resolveUser,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/server/session";

export const dynamic = "force-dynamic";

// 30 user switches or creations per minute per client address (security review M1).
const limiter = new RateLimiter(30, 60_000);

export async function GET() {
  try {
    const store = await cookies();
    const body: SessionResponse = { user: await resolveUser(db, store.get(SESSION_COOKIE)?.value) };
    return Response.json(body);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!limiter.allow(clientKey(request.headers), Date.now())) {
      return errorResponse("rate_limited", "Слишком много попыток, подождите минуту");
    }
    const parsed = SessionRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse("invalid_input", parsed.error.issues[0]?.message ?? "Некорректные данные");
    }
    const user = await getOrCreateUser(db, parsed.data.name, now().toJSDate());
    (await cookies()).set(SESSION_COOKIE, String(user.id), sessionCookieOptions());
    const body: SessionResponse = { user: { id: user.id, name: user.name } };
    return Response.json(body);
  } catch (error) {
    return handleError(error);
  }
}
