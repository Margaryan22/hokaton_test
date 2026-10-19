import { db } from "@/db/client";
import { listUsers } from "@/db/users";
import type { UsersResponse } from "@/shared/api";
import { handleError } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const body: UsersResponse = { users: await listUsers(db) };
    return Response.json(body);
  } catch (error) {
    return handleError(error);
  }
}
