"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { PreviousScores, emptyRow, filledRows, type ScoreRow } from "../../previous-scores";
import { SetPasswordButton } from "../../set-password";
import { useAction } from "../../use-action";

interface Contact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
}

export function GolferContact({ golfer }: { golfer: Contact }) {
  const { busy, run } = useAction();
  const [name, setName] = useState(golfer.name);
  const [email, setEmail] = useState(golfer.email ?? "");
  const [phone, setPhone] = useState(golfer.phone ?? "");
  const dirty = name !== golfer.name || email !== (golfer.email ?? "") || phone !== (golfer.phone ?? "");
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Contact</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api(`/golfers/${golfer.id}`, { method: "PATCH", body: { name, email: email || null, phone: phone || null } }), "Saved");
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Name</Label>
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-email">Email</Label>
              <Input id="g-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-phone">Phone</Label>
              <Input id="g-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !dirty}>
              Save
            </Button>
            <SetPasswordButton golfer={golfer} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Moves a golfer between the regulars and subs groups. */
export function SubToggle({ golfer }: { golfer: { id: number; name: string; isSub: boolean } }) {
  const { busy, run } = useAction();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() =>
        run(
          () => api(`/golfers/${golfer.id}`, { method: "PATCH", body: { isSub: !golfer.isSub } }),
          `${golfer.name} moved to ${golfer.isSub ? "regulars" : "subs"}`,
        )
      }
    >
      {golfer.isSub ? "Make regular" : "Make sub"}
    </Button>
  );
}

export function AddPreviousScores({ golferId }: { golferId: number }) {
  const { busy, run } = useAction();
  const [rows, setRows] = useState<ScoreRow[]>([emptyRow()]);
  const rounds = filledRows(rows).map((r) => ({ ...r, golferId }));
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Add previous scores</CardTitle>
        <CardDescription>9-hole gross scores at Woodside (par 36) from before they played in the league.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="max-w-md space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(
              () => api("/historical-rounds", { body: { rounds } }),
              `${rounds.length} score${rounds.length === 1 ? "" : "s"} added`,
            );
            if (ok) setRows([emptyRow()]);
          }}
        >
          <PreviousScores rows={rows} onChange={setRows} />
          <Button type="submit" disabled={busy || rounds.length === 0}>
            Save scores
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DeleteRound({ id }: { id: number }) {
  const { busy, run } = useAction();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      title="Delete this score"
      disabled={busy}
      onClick={() => {
        if (confirm("Delete this previous score?")) run(() => api(`/historical-rounds/${id}`, { method: "DELETE" }), "Score deleted");
      }}
    >
      <Trash2 />
    </Button>
  );
}
