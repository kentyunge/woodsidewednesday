"use client";

import { useState } from "react";
import { KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { useAction } from "./use-action";

const WORDS = ["birdie", "eagle", "bogey", "fairway", "bunker", "divot", "wedge", "putter", "mulligan", "dogleg", "chip", "green"];

/** Easy to read out over text: two golf words and a number, e.g. "birdie-bunker-47". */
function tempPassword() {
  const rand = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const first = rand(WORDS.length);
  const second = (first + 1 + rand(WORDS.length - 1)) % WORDS.length; // never the same word twice
  return `${WORDS[first]}-${WORDS[second]}-${10 + rand(90)}`;
}

export function SetPasswordButton({ golfer }: { golfer: { id: number; name: string; email: string | null } }) {
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setPassword(tempPassword());
          setDone(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!golfer.email} title={golfer.email ? undefined : "Add an email first"}>
          <KeyRound /> Set password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a password for {golfer.name}</DialogTitle>
          <DialogDescription>
            For golfers who can&apos;t get the sign-in email to work. This replaces any password they already have.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="space-y-2 text-sm">
            <p>Send {golfer.name} these details. They can change the password on their Profile page.</p>
            <div className="bg-muted rounded-md p-3 font-mono text-sm">
              <div>Site: {typeof window !== "undefined" ? window.location.origin : ""}</div>
              <div>Email: {golfer.email}</div>
              <div>Password: {password}</div>
            </div>
            <p className="text-muted-foreground text-xs">On the sign-in page they choose the Password tab.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`pw-${golfer.id}`}>Temporary password</Label>
            <div className="flex gap-2">
              <Input id={`pw-${golfer.id}`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
              <Button type="button" size="icon" variant="outline" title="Generate another" onClick={() => setPassword(tempPassword())}>
                <RefreshCw />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">At least 8 characters. They sign in with {golfer.email}.</p>
          </div>
        )}
        <DialogFooter>
          {done ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={busy || password.length < 8}
                onClick={async () => {
                  const r = await run(() => api(`/golfers/${golfer.id}/password`, { body: { password } }), "Password set");
                  if (r) setDone(true);
                }}
              >
                Set password
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
