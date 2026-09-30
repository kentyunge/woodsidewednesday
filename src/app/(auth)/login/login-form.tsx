"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth/client";

/** Friendly text for errors Better Auth puts on the URL (e.g. an old-style link that was already used). */
function errorMessage(code: string): string {
  if (code === "INVALID_TOKEN" || code === "EXPIRED_TOKEN") {
    return "That sign-in link has expired or was already used. Send yourself a new one below.";
  }
  return "Sign-in didn't work. Please try again.";
}

export function LoginForm({ error }: { error: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function signedIn() {
    router.push("/");
    router.refresh();
  }

  async function sendEmail(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    const { error } = await authClient.signIn.magicLink({ email: email.trim(), callbackURL: "/", errorCallbackURL: "/login" });
    setBusy(false);
    if (error) toast.error(error.message ?? "Could not send the email");
    else {
      setCode("");
      setSent(true);
    }
  }

  async function signInCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() });
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "TOO_MANY_ATTEMPTS"
          ? "Too many tries. Send yourself a new code."
          : "That code didn't work. Check it, or send yourself a new one.",
      );
      return;
    }
    signedIn();
  }

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const id = login.trim();
    const { error } = id.includes("@")
      ? await authClient.signIn.email({ email: id, password })
      : await authClient.signIn.username({ username: id, password });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "Sign in failed");
      return;
    }
    signedIn();
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        {error && !sent && (
          <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {errorMessage(error)}
          </p>
        )}
        <Tabs defaultValue="email">
          <TabsList className="w-full">
            <TabsTrigger value="email">
              <Mail /> Email
            </TabsTrigger>
            <TabsTrigger value="password">
              <KeyRound /> Password
            </TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="pt-4">
            {sent ? (
              <form onSubmit={signInCode} className="space-y-4">
                <div className="space-y-1 text-center text-sm">
                  <p className="font-medium">Check your email</p>
                  <p className="text-muted-foreground">
                    If <span className="font-medium">{email}</span> is in the league, a sign-in link and code are on their way.
                    Tap the link, or enter the code here.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">6-digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl font-semibold tracking-[0.4em] tabular-nums"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                <div className="flex justify-center gap-4 text-sm">
                  <Button type="button" variant="link" className="h-auto p-0" onClick={sendEmail} disabled={busy}>
                    Send a new email
                  </Button>
                  <Button type="button" variant="link" className="h-auto p-0" onClick={() => setSent(false)}>
                    Use a different email
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={sendEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Sending…" : "Email me a sign-in link"}
                </Button>
              </form>
            )}
          </TabsContent>
          <TabsContent value="password" className="pt-4">
            <form onSubmit={signInPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login">Username or email</Label>
                <Input id="login" autoComplete="username" required value={login} onChange={(e) => setLogin(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <p className="text-muted-foreground text-center text-xs">
                No password yet? Sign in by email, then set one on your profile, or ask the league admin.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
