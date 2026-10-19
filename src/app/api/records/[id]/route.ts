import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import type { RecordResponse } from "@/shared/api";
import { RecordPatchSchema } from "@/shared/schemas";
import { now } from "@/server/clock";
import { setDone } from "@/server/services/records";
import {
  errorResponse,
  handleError,
  noUserResponse,
  parseRecordId,
  resolveUser,
  SESSION_COOKIE,
} from "@/server/session";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/records/[id]">) {
  try {
    const user = await resolveUser(db, (await cookies()).get(SESSION_COOKIE)?.value);
    if (!user) return noUserResponse();
    const id = parseRecordId((await ctx.params).id);
    if (id === null) return errorResponse("not_found", "Запись не найдена");
    const body = RecordPatchSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return errorResponse("invalid_input", "Некорректные данные");
    const result: RecordResponse = { record: await setDone(db, user.id, id, body.data.done, now()) };
    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
