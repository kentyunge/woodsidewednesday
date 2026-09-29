"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Season } from "@/server/league";

export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const r = await fn();
      if (ok) toast.success(ok);
      router.refresh();
      return r;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

type SeasonForm = {
  name: string;
  year: string;
  startDate: string;
  status: Season["status"];
  handicapPercent: string;
  provisionalPercent: string;
  rollingRounds: string;
  establishRounds: string;
};

const toForm = (s?: Season | null): SeasonForm => ({
  name: s?.name ?? `${new Date().getFullYear()} Season`,
  year: String(s?.year ?? new Date().getFullYear()),
  startDate: s?.startDate ?? "",
  status: s?.status ?? "upcoming",
  handicapPercent: String((s?.handicapPercent ?? 0.9) * 100),
  provisionalPercent: String((s?.provisionalPercent ?? 0.8) * 100),
  rollingRounds: String(s?.rollingRounds ?? 5),
  establishRounds: String(s?.establishRounds ?? 3),
});

const fromForm = (f: SeasonForm) => ({
  name: f.name,
  year: Number(f.year),
  startDate: f.startDate,
  status: f.status,
  handicapPercent: Number(f.handicapPercent) / 100,
  provisionalPercent: Number(f.provisionalPercent) / 100,
  rollingRounds: Number(f.rollingRounds),
  establishRounds: Number(f.establishRounds),
});

function SeasonFields({ form, set }: { form: SeasonForm; set: (f: SeasonForm) => void }) {
  const field = (k: keyof SeasonForm, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={form[k]} onChange={(e) => set({ ...form, [k]: e.target.value })} required {...props} />
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field("name", "Name")}
      {field("year", "Year", { inputMode: "numeric" })}
      {field("startDate", "First week", { type: "date" })}
      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <NativeSelect id="status" value={form.status} onChange={(e) => set({ ...form, status: e.target.value as Season["status"] })}>
          <option value="upcoming">Upcoming</option>
          <option value="active">Active (current)</option>
          <option value="completed">Completed</option>
        </NativeSelect>
      </div>
      {field("handicapPercent", "Handicap % of rolling average", { inputMode: "decimal" })}
      {field("rollingRounds", "Rounds in rolling average", { inputMode: "numeric" })}
      {field("provisionalPercent", "Provisional % (new golfers/subs)", { inputMode: "decimal" })}
      {field("establishRounds", "Rounds to establish a handicap", { inputMode: "numeric" })}
    </div>
  );
}

interface Props {
  seasons: Season[];
  selected: Season | null;
  playerIds: number[];
  golfers: { id: number; name: string; active: boolean }[];
}

export function SeasonsAdmin({ seasons, selected, playerIds, golfers }: Props) {
  const { busy, run } = useAction();
  const router = useRouter();
  const [newForm, setNewForm] = useState(toForm(null));
  const [editForm, setEditForm] = useState(toForm(selected));
  const [editingId, setEditingId] = useState(selected?.id);
  const [players, setPlayers] = useState<Set<number>>(new Set(playerIds));
  if (selected?.id !== editingId) {
    // switched season: reset local form state
    setEditingId(selected?.id);
    setEditForm(toForm(selected));
    setPlayers(new Set(playerIds));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Seasons</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasons.map((s) => (
                <TableRow key={s.id} className={cn(s.id === selected?.id && "bg-primary/10")}>
                  <TableCell>
                    <Link href={`/admin?season=${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>{s.startDate}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New season</CardTitle>
          <CardDescription>Then pick its players and generate the schedule.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const s = await run(() => api<Season>("/seasons", { body: fromForm(newForm) }), "Season created");
              if (s) router.push(`/admin?season=${s.id}`);
            }}
          >
            <SeasonFields form={newForm} set={setNewForm} />
            <Button type="submit" disabled={busy}>
              Create season
            </Button>
          </form>
        </CardContent>
      </Card>

      {selected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Edit {selected.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => api(`/seasons/${selected.id}`, { method: "PATCH", body: fromForm(editForm) }), "Season saved");
                }}
              >
                <SeasonFields form={editForm} set={setEditForm} />
                <Button type="submit" disabled={busy}>
                  Save season
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Players ({players.size})</CardTitle>
              <CardDescription>
                The season&apos;s regulars. Add new golfers on the{" "}
                <Link href="/admin/golfers" className="underline">
                  Golfers
                </Link>{" "}
                tab.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {golfers
                  .filter((g) => g.active || players.has(g.id))
                  .map((g) => (
                    <label key={g.id} className="hover:bg-muted flex items-center gap-2 rounded px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="accent-primary size-4"
                        checked={players.has(g.id)}
                        onChange={(e) => {
                          const next = new Set(players);
                          if (e.target.checked) next.add(g.id);
                          else next.delete(g.id);
                          setPlayers(next);
                        }}
                      />
                      {g.name}
                    </label>
                  ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api(`/seasons/${selected.id}/players`, { method: "PUT", body: { golferIds: [...players] } }),
                      "Players saved",
                    )
                  }
                >
                  Save players
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/admin/schedule?season=${selected.id}`}>Go to schedule</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
