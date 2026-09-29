import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { golfers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { forbidden, unauthorized } from "./errors";

export interface Actor {
  userId: string;
  name: string;
  email: string;
  username: string | null;
  isAdmin: boolean;
  golferId: number | null;
}

export async function getActor(headers: Headers): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string; username?: string | null };
  let [g] = await db.select({ id: golfers.id }).from(golfers).where(eq(golfers.userId, u.id)).limit(1);
  if (!g) {
    // Golfer may have been added after this login was created: link by email.
    [g] = await db
      .update(golfers)
      .set({ userId: u.id })
      .where(sql`lower(${golfers.email}) = ${u.email.toLowerCase()} and ${golfers.userId} is null`)
      .returning({ id: golfers.id });
  }
  return {
    userId: u.id,
    name: u.name,
    email: u.email,
    username: u.username ?? null,
    isAdmin: u.role === "admin",
    golferId: g?.id ?? null,
  };
}

export function requireActor(actor: Actor | null): Actor {
  if (!actor) throw unauthorized();
  return actor;
}

export function requireAdmin(actor: Actor | null): Actor {
  const a = requireActor(actor);
  if (!a.isAdmin) throw forbidden("League administrator only");
  return a;
}
