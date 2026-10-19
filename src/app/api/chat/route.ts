import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { ChatRequestSchema } from "@/shared/schemas";
import { now } from "@/server/clock";
import { handleChat } from "@/server/dialog";
import { RateLimiter } from "@/server/services/rate-limit";
import { clientKey, errorResponse, handleError, noUserResponse, resolveUser, SESSION_COOKIE } from "@/server/session";

export const dynamic = "force-dynamic";

// 60 messages per minute per client address and user (security review M1).
const limiter = new RateLimiter(60, 60_000);

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUser(db, (await cookies()).get(SESSION_COOKIE)?.value);
    if (!user) return noUserResponse();
    if (!limiter.allow(`${clientKey(request.headers)}:${user.id}`, Date.now())) {
      return errorResponse("rate_limited", "Слишком много сообщений, подождите минуту");
    }
    const body: unknown = await request.json().catch(() => undefined);
    if (body === undefined) return errorResponse("invalid_input", "Некорректный запрос: ожидается JSON");
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("invalid_input", parsed.error.issues[0]?.message ?? "Некорректные данные");
    }
    return Response.json(await handleChat(db, user.id, parsed.data.text, now()));
  } catch (error) {
    return handleError(error);
  }
}
