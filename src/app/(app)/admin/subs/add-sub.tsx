"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { PreviousScores, emptyRow, filledRows, type ScoreRow } from "../previous-scores";
import { useAction } from "../use-action";

export function AddSubButton() {
  const router = useRouter();
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<ScoreRow[]>([emptyRow()]);

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setRows([emptyRow()]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Add sub
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const previousRounds = filledRows(rows).map(({ playedOn, gross }) => ({ playedOn, gross }));
            const golfer = await run(
              () => api<{ id: number }>("/golfers", { body: { name, email: email || null, phone: phone || null, isSub: true, previousRounds } }),
              `${name} added`,
            );
            if (golfer) {
              setOpen(false);
              reset();
              router.push(`/admin/subs/${golfer.id}`);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a sub</DialogTitle>
            <DialogDescription>Email is only needed if they&apos;ll sign in to enter scores.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sub-name">Name</Label>
              <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-email">Email</Label>
              <Input id="sub-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-phone">Phone</Label>
              <Input id="sub-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Previous 9-hole scores (optional)</Label>
            <p className="text-muted-foreground text-xs">Gross scores at Woodside (par 36). Three or more establishes their handicap.</p>
            <PreviousScores rows={rows} onChange={setRows} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Add sub
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
