"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignOut } from "@/components/layout/nav";
import { api } from "@/lib/api-client";

interface Props {
  name: string;
  email: string;
  username: string;
  phone: string;
  hasPassword: boolean;
  isAdmin: boolean;
}

export function ProfileForm(props: Props) {
  const router = useRouter();
  const signOut = useSignOut();
  const [name, setName] = useState(props.name);
  const [username, setUsername] = useState(props.username);
  const [phone, setPhone] = useState(props.phone);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Account {props.isAdmin && <Badge>Admin</Badge>}
          </CardTitle>
          <CardDescription>{props.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  api("/me", {
                    method: "PATCH",
                    body: { name, phone: phone || null, ...(username && username !== props.username && { username }) },
                  }),
                "Profile saved",
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                placeholder="for password sign-in"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{props.hasPassword ? "Change password" : "Set a password"}</CardTitle>
          <CardDescription>
            {props.hasPassword
              ? "Sign in with your username or email and password."
              : "Optional. Lets you sign in with a username and password instead of an email link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("/me/password", {
                  method: "POST",
                  body: { newPassword, ...(props.hasPassword && { currentPassword }) },
                });
                setCurrentPassword("");
                setNewPassword("");
              }, "Password saved");
            }}
          >
            {props.hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="current">Current password</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              {props.hasPassword ? "Change password" : "Set password"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Button variant="outline" className="w-full sm:w-auto" onClick={signOut}>
        <LogOut /> Sign out
      </Button>
    </>
  );
}
