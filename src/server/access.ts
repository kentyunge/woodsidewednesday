import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { golfers, user } from "@/db/schema";
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
  const golferId = await linkGolferForUser(u.id, u.email);
  return {
    userId: u.id,
    name: u.name,
    email: u.email,
    username: u.username ?? null,
    isAdmin: u.role === "admin",
    golferId,
  };
}

/**
 * The golfer this login belongs to. Links by email when the golfer has no login yet,
 * or when their current login is for a different address (e.g. the admin replaced a
 * test email with the real one after the golfer had signed in with it).
 */
export async function linkGolferForUser(userId: string, email: string): Promise<number | null> {
  const [linked] = await db.select({ id: golfers.id }).from(golfers).where(eq(golfers.userId, userId)).limit(1);
  if (linked) return linked.id;
  const [g] = await db
    .update(golfers)
    .set({ userId })
    .where(
      sql`lower(${golfers.email}) = ${email.toLowerCase()} and (${golfers.userId} is null or not exists (
        select 1 from ${user} where ${user.id} = ${golfers.userId} and lower(${user.email}) = lower(${golfers.email})
      ))`,
    )
    .returning({ id: golfers.id });
  return g?.id ?? null;
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
