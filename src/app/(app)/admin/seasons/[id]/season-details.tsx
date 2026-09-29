"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import type { Season } from "@/server/league";
import { SeasonFields, fromForm, toForm } from "../../season-form";
import { useAction } from "../../use-action";

interface Props {
  season: Season;
  players: number;
  weeks: number;
  scores: number;
}

function DeleteSeason({ season, players, weeks, scores }: Props) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  // Typing the name is only required once real results would be lost.
  const needsName = scores > 0;
  const canDelete = !needsName || confirm.trim() === season.name;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setConfirm("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 /> Delete season
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {season.name}?</DialogTitle>
          <DialogDescription>
            This permanently removes the season&apos;s {players} player{players === 1 ? "" : "s"}, {weeks} week
            {weeks === 1 ? "" : "s"} of schedule and {scores} entered card{scores === 1 ? "" : "s"}. Golfers and carried-over rounds are
            kept. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        {needsName && (
          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type <span className="font-semibold">{season.name}</span> to confirm
            </Label>
            <Input id="confirm-name" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !canDelete}
            onClick={async () => {
              const ok = await run(() => api(`/seasons/${season.id}`, { method: "DELETE" }), `${season.name} deleted`);
              if (ok) {
                setOpen(false);
                router.push("/admin");
              }
            }}
          >
            Delete season
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SeasonDetails(props: Props) {
  const { season } = props;
  const { busy, run } = useAction();
  const [form, setForm] = useState(toForm(season));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Setting a season to Active makes it the current season and completes the previous one.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api(`/seasons/${season.id}`, { method: "PATCH", body: fromForm(form) }), "Season saved");
            }}
          >
            <SeasonFields form={form} set={setForm} />
            <Button type="submit" disabled={busy}>
              Save season
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete season</CardTitle>
          <CardDescription>
            Removes this season&apos;s players, schedule and scores. Golfers and their carried-over rounds stay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteSeason {...props} />
        </CardContent>
      </Card>
    </div>
  );
}
