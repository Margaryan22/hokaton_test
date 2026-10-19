import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { now } from "@/server/clock";

export const dynamic = "force-dynamic";

export async function GET() {
  await db.run(sql`select 1`);
  return Response.json({ ok: true, now: now().toISO() });
}
