import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { account, golfers } from "@/db/schema";
import { InstallCard } from "@/components/layout/install-prompt";
import { requirePageActor } from "@/server/session";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const actor = await requirePageActor();
  const [cred] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, actor.userId), eq(account.providerId, "credential")));
  const [golfer] = actor.golferId ? await db.select().from(golfers).where(eq(golfers.id, actor.golferId)) : [];
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <InstallCard />
      <ProfileForm
        name={actor.name}
        email={actor.email}
        username={actor.username ?? ""}
        phone={golfer?.phone ?? ""}
        hasPassword={!!cred}
        isAdmin={actor.isAdmin}
      />
    </div>
  );
}
