import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink, username } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Only league golfers and admins may sign in by magic link. */
async function isAllowedEmail(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (adminEmails().includes(e)) return true;
  const [g] = await db
    .select({ id: schema.golfers.id })
    .from(schema.golfers)
    .where(sql`lower(${schema.golfers.email}) = ${e}`)
    .limit(1);
  if (g) return true;
  const [u] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, e)).limit(1);
  return !!u;
}

export const auth = betterAuth({
  appName: "Woodside Wednesday",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "golfer", input: false },
    },
  },
  plugins: [
    username(),
    magicLink({
      expiresIn: 60 * 15,
      async sendMagicLink({ email, url }) {
        if (!(await isAllowedEmail(email))) {
          console.warn(`[auth] magic link requested for unknown email ${email}`);
          return; // don't reveal whether the address is in the league
        }
        await sendEmail(
          email,
          "Your Woodside Wednesday sign-in link",
          `<p>Tap to sign in to Woodside Wednesday:</p><p><a href="${url}">Sign in</a></p><p>This link expires in 15 minutes.</p>`,
          `Sign in to Woodside Wednesday: ${url}\n\nThis link expires in 15 minutes.`,
        );
      },
    }),
    nextCookies(),
  ],
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          const email = user.email.toLowerCase();
          const role = adminEmails().includes(email) ? "admin" : "golfer";
          let name = user.name;
          if (!name) {
            // Magic-link sign-ups have no name: use the golfer record's, else the email prefix.
            const [g] = await db
              .select({ name: schema.golfers.name })
              .from(schema.golfers)
              .where(sql`lower(${schema.golfers.email}) = ${email}`)
              .limit(1);
            name = g?.name ?? email.split("@")[0];
          }
          return { data: { ...user, name, role } };
        },
        async after(user) {
          // Link the login to the golfer record with the same email.
          await db
            .update(schema.golfers)
            .set({ userId: user.id })
            .where(sql`lower(${schema.golfers.email}) = ${user.email.toLowerCase()} and ${schema.golfers.userId} is null`);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
