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

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await authClient.signIn.magicLink({ email: email.trim(), callbackURL: "/" });
    setBusy(false);
    if (error) toast.error(error.message ?? "Could not send link");
    else setSent(true);
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
    router.push("/");
    router.refresh();
  }

  return (
    <Card>
      <CardContent>
        <Tabs defaultValue="link">
          <TabsList className="w-full">
            <TabsTrigger value="link">
              <Mail /> Email link
            </TabsTrigger>
            <TabsTrigger value="password">
              <KeyRound /> Password
            </TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="pt-4">
            {sent ? (
              <div className="space-y-2 text-center text-sm">
                <p className="font-medium">Check your email</p>
                <p className="text-muted-foreground">
                  If <span className="font-medium">{email}</span> is in the league, a sign-in link is on its way.
                </p>
                <Button variant="link" onClick={() => setSent(false)}>
                  Use a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={sendLink} className="space-y-4">
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
                First time? Use an email link, then set a username and password on your profile.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
