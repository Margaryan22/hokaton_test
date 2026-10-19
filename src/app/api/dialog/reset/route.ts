import { cookies } from "next/headers";
import { db } from "@/db/client";
import type { OkResponse } from "@/shared/api";
import { resetDialog } from "@/server/dialog";
import { handleError, noUserResponse, resolveUser, SESSION_COOKIE } from "@/server/session";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await resolveUser(db, (await cookies()).get(SESSION_COOKIE)?.value);
    if (!user) return noUserResponse();
    await resetDialog(db, user.id);
    const body: OkResponse = { ok: true };
    return Response.json(body);
  } catch (error) {
    return handleError(error);
  }
}
