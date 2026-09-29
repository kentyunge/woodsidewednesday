import { redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { getPageActor } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getPageActor()) redirect("/");
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-primary/15 to-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground rounded-full p-3">
            <Flag className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Woodside Wednesday</h1>
          <p className="text-muted-foreground text-sm">Golf league scores, standings & stats</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
