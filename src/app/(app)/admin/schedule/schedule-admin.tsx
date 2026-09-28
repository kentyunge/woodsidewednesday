"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Plus, Trash2, Trophy, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { api } from "@/lib/api-client";
import { useAction } from "../seasons-admin";

interface WeekRow {
  id: number;
  number: number;
  date: string;
  kind: "regular" | "position";
  notes: string | null;
  postponements: number;
  complete: boolean;
  matches: { id: number; a: number; b: number | null; hasScores: boolean }[];
}

interface Props {
  season: { id: number; name: string; startDate: string };
  players: { id: number; name: string }[];
  playerCount: number;
  hasScores: boolean;
  weeks: WeekRow[];
}

function GolferSelect({ value, onChange, players, allowBye }: { value: number | null; onChange: (v: number | null) => void; players: Props["players"]; allowBye?: boolean }) {
  return (
    <NativeSelect value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      {allowBye ? <option value="">Bye</option> : <option value="" disabled>Choose…</option>}
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function MatchEditor({ match, players }: { match: WeekRow["matches"][number]; players: Props["players"] }) {
  const { busy, run } = useAction();
  const [a, setA] = useState<number | null>(match.a);
  const [b, setB] = useState<number | null>(match.b);
  const dirty = a !== match.a || b !== match.b;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
      <GolferSelect value={a} onChange={setA} players={players} />
      <span className="text-muted-foreground text-xs">vs</span>
      <GolferSelect value={b} onChange={setB} players={players} allowBye />
      <div className="flex gap-1">
        {dirty && (
          <Button size="sm" disabled={busy || !a} onClick={() => run(() => api(`/matches/${match.id}`, { method: "PATCH", body: { golferAId: a, golferBId: b } }), "Match updated")}>
            Save
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          title="Delete match"
          disabled={busy}
          onClick={() => {
            if (!match.hasScores || confirm("This match has scores. Delete it anyway?"))
              run(() => api(`/matches/${match.id}`, { method: "DELETE" }), "Match deleted");
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

function WeekCard({ week, players, seasonId }: { week: WeekRow; players: Props["players"]; seasonId: number }) {
  const { busy, run } = useAction();
  const [date, setDate] = useState(week.date);
  const [notes, setNotes] = useState(week.notes ?? "");
  const [kind, setKind] = useState(week.kind);
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [reason, setReason] = useState("Rainout");
  const [newA, setNewA] = useState<number | null>(null);
  const [newB, setNewB] = useState<number | null>(null);
  const dirty = date !== week.date || notes !== (week.notes ?? "") || kind !== week.kind;

  const used = new Set(week.matches.flatMap((m) => [m.a, m.b]));
  const unscheduled = players.filter((p) => !used.has(p.id));

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Week {week.number}
          {week.kind === "position" && <Badge>Position night</Badge>}
          {week.complete && <Badge variant="secondary">Final</Badge>}
        </CardTitle>
        <CardAction className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setPostponeOpen(true)} disabled={busy}>
            <CalendarClock /> Postpone
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Delete week"
            disabled={busy}
            onClick={() => {
              if (confirm(`Delete week ${week.number} and its matches?`)) run(() => api(`/weeks/${week.id}`, { method: "DELETE" }), "Week deleted");
            }}
          >
            <Trash2 />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[10rem_10rem_1fr]">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as WeekRow["kind"])} aria-label="Type">
            <option value="regular">Regular</option>
            <option value="position">Position night</option>
          </NativeSelect>
          <Input className="col-span-2 sm:col-span-1" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {dirty && (
          <Button size="sm" disabled={busy} onClick={() => run(() => api(`/weeks/${week.id}`, { method: "PATCH", body: { date, notes: notes || null, kind } }), "Week saved")}>
            Save week
          </Button>
        )}
        <div className="space-y-2">
          {week.matches.map((m) => (
            <MatchEditor key={`${m.id}-${m.a}-${m.b}`} match={m} players={players} />
          ))}
          {week.kind === "position" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                const r = await run(
                  () => api<{ incompleteWeeks: number[] }>(`/seasons/${seasonId}/position-night`, { body: { weekId: week.id } }),
                  "Position night paired from standings",
                );
                if (r?.incompleteWeeks.length) alert(`Heads up: weeks ${r.incompleteWeeks.join(", ")} aren't complete yet. Re-pair after scores are in.`);
              }}
            >
              <Trophy /> Pair from standings (1v2, 3v4…)
            </Button>
          )}
          {unscheduled.length > 0 && (
            <div className="border-t pt-3">
              <div className="text-muted-foreground mb-2 text-xs">
                Not scheduled: {unscheduled.map((p) => p.name).join(", ")}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                <GolferSelect value={newA} onChange={setNewA} players={players} />
                <span className="text-muted-foreground text-xs">vs</span>
                <GolferSelect value={newB} onChange={setNewB} players={players} allowBye />
                <Button
                  size="icon-sm"
                  title="Add match"
                  disabled={busy || !newA}
                  onClick={() =>
                    run(() => api(`/weeks/${week.id}/matches`, { body: { golferAId: newA, golferBId: newB } }), "Match added").then(() => {
                      setNewA(null);
                      setNewB(null);
                    })
                  }
                >
                  <Plus />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={postponeOpen} onOpenChange={setPostponeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Postpone week {week.number}?</DialogTitle>
            <DialogDescription>Week {week.number} and every later week move back one week. Matchups stay the same.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`reason-${week.id}`}>Reason</Label>
            <Input id={`reason-${week.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostponeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(() => api(`/weeks/${week.id}/postpone`, { body: { reason } }), "Schedule pushed back a week").then(() => setPostponeOpen(false))
              }
            >
              Postpone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function ScheduleAdmin({ season, players, playerCount, hasScores, weeks }: Props) {
  const { busy, run } = useAction();
  const [start, setStart] = useState(season.startDate);
  const [positionNight, setPositionNight] = useState(true);

  return (
    <div className="space-y-4">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="size-5" /> Generate schedule
          </CardTitle>
          <CardDescription>
            {season.name}: {playerCount} players → {playerCount % 2 ? playerCount : Math.max(playerCount - 1, 0)} round-robin weeks
            {positionNight && " + position night"}, one week apart. Everyone plays everyone once.
            {weeks.length > 0 && " Replaces the current schedule."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasScores ? (
            <p className="text-muted-foreground text-sm">Scores have been entered, so edit weeks individually below.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start">First week</Label>
                <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-44" />
              </div>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary size-4" checked={positionNight} onChange={(e) => setPositionNight(e.target.checked)} />
                Final week is position night
              </label>
              <Button
                disabled={busy || playerCount < 2}
                onClick={() => {
                  if (!weeks.length || confirm("Replace the existing schedule?"))
                    run(() => api(`/seasons/${season.id}/schedule`, { body: { startDate: start, positionNight } }), "Schedule generated");
                }}
              >
                Generate
              </Button>
              {playerCount < 2 && (
                <Link href={`/admin?season=${season.id}`} className="text-sm underline">
                  Add players first
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {weeks.map((w) => (
          <WeekCard key={`${w.id}-${w.date}-${w.kind}-${w.notes}`} week={w} players={players} seasonId={season.id} />
        ))}
      </div>

      <Button variant="outline" disabled={busy} onClick={() => run(() => api(`/seasons/${season.id}/weeks`, { body: {} }), "Week added")}>
        <Plus /> Add week
      </Button>
    </div>
  );
}
