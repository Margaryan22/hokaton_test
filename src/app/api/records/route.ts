import { cookies } from "next/headers";
import { db } from "@/db/client";
import { now } from "@/server/clock";
import { upcomingPanel } from "@/server/services/records";
import { handleError, noUserResponse, resolveUser, SESSION_COOKIE } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await resolveUser(db, (await cookies()).get(SESSION_COOKIE)?.value);
    if (!user) return noUserResponse();
    return Response.json(await upcomingPanel(db, user.id, now()));
  } catch (error) {
    return handleError(error);
  }
}
