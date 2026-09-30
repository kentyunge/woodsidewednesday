"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dices, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { StrokeDots } from "@/components/league/score-mark";
import { api } from "@/lib/api-client";
import { roundHandicap, scoreMatch, type Hole } from "@/lib/scoring";
import { cn, fmt } from "@/lib/utils";
import type { MatchView, ResolvedSide } from "@/server/league";

type Status = "played" | "sub" | "ghost";

interface SideState {
  status: Status;
  playerId: string; // sub golfer id, or "new"
  newSubName: string;
  ghostId: string; // "" = draw at random
  scores: string[];
  override: string;
}

function initial(side: ResolvedSide, holeCount: number): SideState {
  return {
    status: side.status,
    playerId: side.status === "sub" && side.player ? String(side.player.id) : "",
    newSubName: "",
    ghostId: side.ghost ? String(side.ghost.id) : "",
    scores: Array.from({ length: holeCount }, (_, i) => (side.status === "ghost" ? "" : (side.scores?.[i]?.toString() ?? ""))),
    override: side.handicap.override && side.handicap.handicap !== null ? String(side.handicap.handicap) : "",
  };
}

const toScores = (s: string[]) => s.map((v) => (v.trim() === "" ? null : Number(v)));

interface Props {
  match: MatchView;
  holes: Hole[];
  par: number;
  provisionalPercent: number;
  isAdmin: boolean;
  subOptions: { id: number; name: string; isSub: boolean }[];
  ghostOptions: { id: number; name: string }[];
  lockDate: string;
}

export function ScoreEntry({ match, holes, par, provisionalPercent, isAdmin, subOptions, ghostOptions, lockDate }: Props) {
  const router = useRouter();
  const sides = useMemo(() => [match.a, ...(match.b ? [match.b] : [])], [match]);
  const [state, setState] = useState<SideState[]>(() => sides.map((s) => initial(s, holes.length)));
  const [saving, setSaving] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (i: number, patch: Partial<SideState>) =>
    setState((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const setScore = (sideIdx: number, hole: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(0, 2);
    setState((prev) => prev.map((s, j) => (j === sideIdx ? { ...s, scores: s.scores.map((x, k) => (k === hole ? v : x)) } : s)));
    // Advance hole by hole (A then B) once the score is unambiguous.
    if (v.length === 2 || (v.length === 1 && v !== "1")) {
      const order = hole * sides.length + sideIdx;
      for (let n = order + 1; n < inputs.current.length; n++) {
        const el = inputs.current[n];
        if (el && !el.disabled) {
          el.focus();
          el.select();
          break;
        }
      }
    }
  };

  /** Best-effort handicap for the live preview; the server makes the final call on save. */
  const previewHandicap = (i: number): number | null => {
    const s = state[i];
    const server = sides[i];
    if (isAdmin && s.override.trim() !== "") return Number(s.override);
    const sameConfig =
      s.status === server.status &&
      (s.status !== "sub" || s.playerId === String(server.player?.id ?? "")) &&
      (s.status !== "ghost" || s.ghostId === String(server.ghost?.id ?? ""));
    if (!sameConfig) return null;
    if (s.status === "ghost" || server.handicap.override) return server.handicap.handicap;
    if (server.handicap.method === "rolling") return server.handicap.handicap;
    const scores = toScores(s.scores);
    if (scores.some((x) => x === null)) return null;
    return roundHandicap(((scores as number[]).reduce((a, b) => a + b, 0) - par) * provisionalPercent);
  };

  const hcps = state.map((_, i) => previewHandicap(i));
  const previewScores = state.map((s, i) => (s.status === "ghost" ? (sides[i].status === "ghost" ? sides[i].scores : null) : toScores(s.scores)));
  const preview =
    sides.length === 2
      ? scoreMatch(holes, { handicap: hcps[0], scores: previewScores[0] }, { handicap: hcps[1], scores: previewScores[1] })
      : null;

  async function save() {
    setSaving(true);
    try {
      for (const [i, s] of state.entries()) {
        const side = i === 0 ? "A" : "B";
        const body: Record<string, unknown> = { status: s.status };
        if (s.status === "sub") {
          if (s.playerId === "new") body.newSubName = s.newSubName;
          else body.playerId = s.playerId ? Number(s.playerId) : null;
        }
        if (s.status === "ghost") body.ghostId = s.ghostId ? Number(s.ghostId) : null;
        else body.scores = toScores(s.scores);
        if (isAdmin) body.handicapOverride = s.override.trim() === "" ? null : Number(s.override);
        await api(`/matches/${match.id}/entries/${side}`, { method: "PUT", body });
      }
      toast.success("Scores saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (match.bye) return null;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Enter scores</CardTitle>
        <CardDescription>
          Enter gross strokes for both players. The latest save wins{isAdmin ? "" : `; open until ${lockDate}`}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-3 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {sides.map((side, i) => {
            const s = state[i];
            return (
              <div key={i} className="space-y-3 rounded-lg border p-3">
                <div className="font-medium">{side.owner.name}</div>
                <div className="bg-muted grid grid-cols-3 gap-1 rounded-md p-1" role="radiogroup">
                  {(
                    [
                      ["played", "Played"],
                      ["sub", "Sub"],
                      ["ghost", "Absent"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={s.status === v}
                      onClick={() => update(i, { status: v })}
                      className={cn(
                        "rounded px-2 py-1.5 text-sm font-medium transition-colors",
                        s.status === v ? "bg-background shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {s.status === "sub" && (
                  <div className="space-y-2">
                    <Label>Who subbed?</Label>
                    <NativeSelect value={s.playerId} onChange={(e) => update(i, { playerId: e.target.value })}>
                      <option value="">Choose a golfer…</option>
                      <option value="new">+ New sub</option>
                      {[
                        { label: "Subs", list: subOptions.filter((g) => g.isSub) },
                        { label: "Regulars", list: subOptions.filter((g) => !g.isSub) },
                      ]
                        .filter((group) => group.list.length > 0)
                        .map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.list.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                    </NativeSelect>
                    {s.playerId === "new" && (
                      <Input placeholder="Sub's name" value={s.newSubName} onChange={(e) => update(i, { newSubName: e.target.value })} />
                    )}
                  </div>
                )}
                {s.status === "ghost" && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Dices className="size-4" /> Ghost card
                    </Label>
                    <NativeSelect value={s.ghostId} onChange={(e) => update(i, { ghostId: e.target.value })}>
                      <option value="">Draw a random player on save</option>
                      {ghostOptions.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <p className="text-muted-foreground text-xs">
                      The opponent plays against this golfer&apos;s card and handicap from tonight. The absent golfer earns no points.
                    </p>
                  </div>
                )}
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`ovr-${i}`} className="text-muted-foreground shrink-0 text-xs">
                      Handicap override
                    </Label>
                    <Input
                      id={`ovr-${i}`}
                      inputMode="numeric"
                      className="h-8 w-20"
                      placeholder={fmt(side.handicap.override ? null : side.handicap.handicap)}
                      value={s.override}
                      onChange={(e) => update(i, { override: e.target.value.replace(/[^\d-]/g, "") })}
                    />
                  </div>
                )}
                <div className="text-muted-foreground text-xs">
                  Handicap: <span className="text-foreground font-medium">{fmt(hcps[i])}</span>
                  {hcps[i] === null && " (calculated on save)"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="bg-muted/60 text-muted-foreground grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 px-3 py-2 text-xs font-medium sm:grid-cols-[1fr_6rem_6rem]">
            <span>Hole</span>
            {sides.map((s, i) => (
              <span key={i} className="truncate text-center">
                {s.owner.name.split(" ")[0]}
              </span>
            ))}
          </div>
          {holes.map((h, hi) => (
            <div
              key={h.number}
              className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 border-t px-3 py-1.5 sm:grid-cols-[1fr_6rem_6rem]"
            >
              <div className="text-sm">
                <span className="font-semibold">{h.number}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  Par {h.par} · Hdcp {h.handicap}
                </span>
              </div>
              {sides.map((_, si) => {
                const ghost = state[si].status === "ghost";
                const strokes = preview?.holes[hi][si === 0 ? "a" : "b"].strokes ?? 0;
                const pts = preview?.holes[hi][si === 0 ? "a" : "b"].points;
                return (
                  <div key={si} className="relative flex items-center justify-center">
                    <Input
                      ref={(el) => {
                        inputs.current[hi * sides.length + si] = el;
                      }}
                      aria-label={`Hole ${h.number} ${sides[si].owner.name}`}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      disabled={ghost}
                      value={ghost ? (previewScores[si]?.[hi]?.toString() ?? "") : state[si].scores[hi]}
                      onChange={(e) => setScore(si, hi, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className={cn(
                        "h-11 w-full text-center text-lg font-semibold tabular-nums",
                        pts === 2 && "border-primary bg-primary/10",
                      )}
                    />
                    <StrokeDots count={strokes} className="absolute top-1 right-1.5" />
                  </div>
                );
              })}
            </div>
          ))}
          {preview && (
            <div className="bg-muted/40 grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 border-t px-3 py-2 text-sm sm:grid-cols-[1fr_6rem_6rem]">
              <span className="font-medium">
                Total <span className="text-muted-foreground text-xs">gross / net</span>
              </span>
              {(["a", "b"] as const).map((k) => (
                <span key={k} className="text-center tabular-nums">
                  {fmt(preview[k].gross)} / {fmt(preview[k].net)}
                </span>
              ))}
              <span className="font-medium">Points</span>
              {(["a", "b"] as const).map((k) => (
                <span key={k} className="text-center text-lg font-bold tabular-nums">
                  {fmt(preview[k].points)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-background/95 sticky bottom-0 -mx-3 border-t px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:p-0">
          <Button onClick={save} disabled={saving} size="lg" className="w-full sm:w-auto">
            <Save /> {saving ? "Saving…" : "Save scores"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
