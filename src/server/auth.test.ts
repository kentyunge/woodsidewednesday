import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { golfers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createGolfer, setGolferPassword } from "./admin";

/** With no RESEND_API_KEY, sendEmail prints the message; capture it. */
function captureEmails() {
  const logged: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args) => void logged.push(args.join(" ")));
  return { logged, restore: () => spy.mockRestore() };
}

async function requestSignIn(email: string) {
  const mail = captureEmails();
  await auth.api.signInMagicLink({ body: { email, callbackURL: "/" }, headers: new Headers() });
  mail.restore();
  const text = mail.logged.join("\n");
  const link = text.match(/Sign in: (\S+)/)?.[1] ?? null;
  const code = text.match(/^(\d{6})$/m)?.[1] ?? null;
  return { text, link, code };
}

beforeAll(async () => {
  await migrate(db as never, { migrationsFolder: "drizzle" });
});

afterEach(() => vi.restoreAllMocks());

describe("email sign-in", () => {
  it("emails a scanner-safe link plus a code", async () => {
    await createGolfer({ name: "Link Tester", email: "link@example.com" });
    const { text, link, code } = await requestSignIn("link@example.com");
    expect(link).toMatch(/^http:\/\/localhost:3000\/login\/verify\?token=/);
    // Opening the emailed URL must not sign anyone in, so it can't be Better Auth's verify endpoint.
    expect(text).not.toContain("/api/auth/magic-link/verify");
    expect(code).toMatch(/^\d{6}$/);
  });

  it("the link's token signs in exactly once", async () => {
    await createGolfer({ name: "Once", email: "once@example.com" });
    const { link } = await requestSignIn("once@example.com");
    const token = new URL(link!).searchParams.get("token")!;
    const first = await auth.api.magicLinkVerify({ query: { token }, headers: new Headers() });
    expect(first.user.email).toBe("once@example.com");
    await expect(auth.api.magicLinkVerify({ query: { token }, headers: new Headers() })).rejects.toBeTruthy();
    const [g] = await db.select().from(golfers).where(eq(golfers.email, "once@example.com"));
    expect(g.userId).toBe(first.user.id); // login linked to the golfer
  });

  it("the code signs in on any device", async () => {
    await createGolfer({ name: "Code Tester", email: "code@example.com" });
    const { code } = await requestSignIn("code@example.com");
    await expect(auth.api.signInEmailOTP({ body: { email: "code@example.com", otp: "000000" === code ? "111111" : "000000" } })).rejects.toBeTruthy();
    const res = await auth.api.signInEmailOTP({ body: { email: "code@example.com", otp: code! } });
    expect(res.user.email).toBe("code@example.com");
    expect(res.token).toBeTruthy();
  });

  it("sends nothing to addresses outside the league", async () => {
    const { text } = await requestSignIn("stranger@example.com");
    expect(text).toBe("");
  });
});

describe("admin-set passwords", () => {
  it("creates a login for a golfer who never signed in, and replaces it later", async () => {
    const g = await createGolfer({ name: "Pw Tester", email: "pw@example.com" });
    await setGolferPassword(g.id, "birdie-bunker-47");
    const signedIn = await auth.api.signInEmail({ body: { email: "pw@example.com", password: "birdie-bunker-47" } });
    expect(signedIn.user.email).toBe("pw@example.com");
    const [linked] = await db.select().from(golfers).where(eq(golfers.id, g.id));
    expect(linked.userId).toBe(signedIn.user.id);

    await setGolferPassword(g.id, "eagle-divot-12");
    await expect(auth.api.signInEmail({ body: { email: "pw@example.com", password: "birdie-bunker-47" } })).rejects.toBeTruthy();
    const again = await auth.api.signInEmail({ body: { email: "pw@example.com", password: "eagle-divot-12" } });
    expect(again.user.id).toBe(signedIn.user.id);
  });

  it("needs an email and a long enough password", async () => {
    const noEmail = await createGolfer({ name: "No Email" });
    await expect(setGolferPassword(noEmail.id, "long-enough-1")).rejects.toThrow(/email/);
    const g = await createGolfer({ name: "Short", email: "short@example.com" });
    await expect(setGolferPassword(g.id, "short")).rejects.toThrow(/8 characters/);
  });
});
