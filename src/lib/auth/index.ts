import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink, username } from "better-auth/plugins";
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

/** Sign-in links and codes last 15 minutes. */
const SIGN_IN_TTL = 60 * 15;

function signInEmail(link: string | null, code: string) {
  const green = "#2f6b45";
  const button = link
    ? `<p style="margin:24px 0"><a href="${link}" style="background:${green};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Sign in to Woodside Wednesday</a></p><p style="margin:0 0 8px">Or enter this code on the sign-in page:</p>`
    : `<p style="margin:0 0 8px">Enter this code on the sign-in page:</p>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d2a22;max-width:480px">
<p style="margin:0 0 8px;font-size:18px;font-weight:700">Woodside Wednesday</p>
${button}
<p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,Menlo,Consolas,monospace">${code}</p>
<p style="margin:0;color:#5b6b60;font-size:13px">The link and code expire in 15 minutes. If you didn't ask to sign in, you can ignore this email.</p>
</div>`;
  const text = [
    "Woodside Wednesday sign-in",
    "",
    ...(link ? [`Sign in: ${link}`, "", "Or enter this code on the sign-in page:"] : ["Enter this code on the sign-in page:"]),
    code,
    "",
    "The link and code expire in 15 minutes.",
  ].join("\n");
  return { subject: `Your Woodside Wednesday sign-in code: ${code}`, html, text };
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
      expiresIn: SIGN_IN_TTL,
      async sendMagicLink({ email, url }) {
        if (!(await isAllowedEmail(email))) {
          console.warn(`[auth] sign-in link requested for unknown email ${email}`);
          return; // don't reveal whether the address is in the league
        }
        // Email scanners (e.g. Microsoft Safe Links) open every link to check it. Better Auth's
        // verify URL signs in on first open, so a scan would burn the link. Instead the email links
        // to our own page, which only signs in when a person presses its button.
        const token = new URL(url).searchParams.get("token");
        if (!token) throw new Error("Magic link URL had no token");
        const link = new URL(`/login/verify?token=${encodeURIComponent(token)}`, url).toString();
        // Same email also carries a code, for signing in on a different device or browser.
        const code = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" } });
        const { subject, html, text } = signInEmail(link, code);
        await sendEmail(email, subject, html, text);
      },
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: SIGN_IN_TTL,
      allowedAttempts: 5,
      // Codes normally go out inside the sign-in link email above; this covers a direct code request.
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in" || !(await isAllowedEmail(email))) return;
        const { subject, html, text } = signInEmail(null, otp);
        await sendEmail(email, subject, html, text);
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
