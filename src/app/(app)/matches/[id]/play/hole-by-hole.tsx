"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, CloudOff, Loader2, Lock, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StrokeDots } from "@/components/league/score-mark";
import { roundHandicap, scoreMatch, type Hole } from "@/lib/scoring";
import { cn, fmt } from "@/lib/utils";
import type { MatchView, ResolvedSide } from "@/server/league";

type Scores = (number | null)[];
type SaveState = "idle" | "saving" | "saved" | "error" | "locked";

interface Props {
  match: MatchView;
  holes: Hole[];
  par: number;
  provisionalPercent: number;
}

/** Handicap for the live tally: known up front unless it's provisional, which needs the full card. */
function liveHandicap(side: ResolvedSide, scores: Scores, par: number, provisionalPercent: number): number | null {
  if (side.status === "ghost" || side.handicap.override || side.handicap.method === "rolling") return side.handicap.handicap;
  if (scores.some((s) => s === null)) return null;
  return roundHandicap(((scores as number[]).reduce((a, b) => a + b, 0) - par) * provisionalPercent);
}

/** The entry body for one side, keeping who played (played/sub) as the server has it. */
function entryBody(side: ResolvedSide, scores: Scores) {
  return side.status === "sub" ? { status: "sub", playerId: side.player?.id, scores } : { status: "played", scores };
}

/** Phone-first score entry: one hole at a time, big +/- buttons, autosaves as you go. */
export function HoleByHole({ match, holes, par, provisionalPercent }: Props) {
  const router = useRouter();
  const sides = useMemo(() => [match.a, match.b!], [match]);
  const editable = sides.map((s) => s.status !== "ghost");
  const [scores, setScores] = useState<Scores[]>(() =>
    sides.map((s) => holes.map((_, i) => s.scores?.[i] ?? null)),
  );
  const [hole, setHole] = useState(() => {
    const first = holes.findIndex((_, i) => sides.some((s, si) => editable[si] && (s.scores?.[i] ?? null) === null));
    return first === -1 ? holes.length - 1 : first;
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Sides changed since the last save; only those are sent, so a playing partner's card isn't overwritten.
  const dirty = useRef<Set<number>>(new Set());
  const latest = useRef(scores);
  useEffect(() => {
    latest.current = scores;
  }, [scores]);

  const save = useCallback(
    async (opts: { keepalive?: boolean } = {}) => {
      const pending = [...dirty.current];
      if (!pending.length) return true;
      dirty.current.clear();
      setSaveState("saving");
      try {
        for (const si of pending) {
          const res = await fetch(`/api/v1/matches/${match.id}/entries/${si === 0 ? "A" : "B"}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(entryBody(sides[si], latest.current[si])),
            credentials: "same-origin",
            keepalive: opts.keepalive,
          });
          if (res.status === 403) {
            // Entry closed (midnight after the match) or the week was marked complete: retrying won't help.
            setSaveState("locked");
            return false;
          }
          if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Save failed");
        }
        setSaveState("saved");
        return true;
      } catch {
        pending.forEach((si) => dirty.current.add(si));
        setSaveState("error");
        return false;
      }
    },
    [match.id, sides],
  );

  // Save shortly after each change, and right away if the phone locks or the app is backgrounded.
  useEffect(() => {
    if (!dirty.current.size) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
  }, [scores, save]);
  useEffect(() => {
    if (saveState !== "error") return;
    const t = setTimeout(save, 5000);
    return () => clearTimeout(t);
  }, [saveState, save]);
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") save({ keepalive: true });
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [save]);

  const setScore = (si: number, value: number | null) => {
    dirty.current.add(si);
    setScores((prev) => prev.map((s, j) => (j === si ? s.map((v, k) => (k === hole ? value : v)) : s)));
  };

  const hcps = sides.map((s, i) => liveHandicap(s, scores[i], par, provisionalPercent));
  const shown = sides.map((s, i) => (editable[i] ? scores[i] : (s.scores ?? null)));
  const result = scoreMatch(holes, { handicap: hcps[0], scores: shown[0] }, { handicap: hcps[1], scores: shown[1] });
  const h = holes[hole];
  const hr = result.holes[hole];
  const holeDone = (i: number) => sides.every((_, si) => shown[si]?.[i] != null);
  const thru = (si: number) => shown[si]?.filter((v) => v != null).length ?? 0;
  const grossSoFar = (si: number) => (shown[si] ?? []).reduce<number>((a, v) => a + (v ?? 0), 0);
  const pointsSoFar = (k: "a" | "b") => result.holes.reduce((a, r) => a + (r[k].points ?? 0), 0);
  const allDone = holes.every((_, i) => holeDone(i));
  const last = hole === holes.length - 1;

  async function finish() {
    if (await save()) {
      router.push(`/matches/${match.id}`);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto -mt-2 max-w-md space-y-2.5 sm:mt-0">
      <div className="flex items-center justify-between text-sm">
        <Link href={`/matches/${match.id}`} className="text-muted-foreground inline-flex items-center gap-1 hover:underline">
          <ChevronLeft className="size-4" /> Scorecard
        </Link>
        <SaveStatus state={saveState} />
      </div>

      {/* Hole picker */}
      <div className="grid grid-cols-9 gap-1" role="tablist" aria-label="Holes">
        {holes.map((x, i) => (
          <button
            key={x.number}
            role="tab"
            aria-selected={i === hole}
            aria-label={`Hole ${x.number}`}
            onClick={() => setHole(i)}
            className={cn(
              "flex h-9 items-center justify-center rounded-md border text-sm font-semibold tabular-nums [-webkit-tap-highlight-color:transparent]",
              i === hole ? "border-primary bg-primary text-primary-foreground" : holeDone(i) ? "bg-primary/10 border-primary/30" : "bg-card",
            )}
          >
            {x.number}
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between px-1">
        <h1 className="text-xl font-bold">Hole {h.number}</h1>
        <div className="text-muted-foreground text-sm">
          Par <b className="text-foreground">{h.par}</b> · Hdcp {h.handicap}
        </div>
      </div>

      {sides.map((side, si) => {
        const k = si === 0 ? "a" : "b";
        const v = shown[si]?.[hole] ?? null;
        const strokes = hr[k].strokes;
        const pts = hr[k].points;
        const player = side.status === "sub" ? `${side.player?.name} (for ${side.owner.name})` : side.owner.name;
        const bump = (d: number) => setScore(si, Math.min(20, Math.max(1, (v ?? h.par) + d)));
        return (
          <div key={si} className={cn("bg-card rounded-xl border p-3", pts === 2 && "border-primary ring-primary/30 ring-2")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{side.status === "ghost" ? `${side.owner.name} (absent)` : player}</div>
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  Hcp {fmt(hcps[si])}
                  {hcps[si] === null && " (set when the card is done)"}
                  {strokes > 0 && (
                    <>
                      · gets {strokes} stroke{strokes > 1 ? "s" : ""} <StrokeDots count={strokes} />
                    </>
                  )}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="text-muted-foreground">Net</div>
                <div className="text-base font-semibold tabular-nums">{fmt(hr[k].net)}</div>
              </div>
            </div>
            {editable[si] ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  className="size-14 rounded-full"
                  aria-label={`${side.owner.name} one less`}
                  disabled={v !== null && v <= 1}
                  onClick={() => bump(-1)}
                >
                  <Minus className="size-6" />
                </Button>
                <button
                  type="button"
                  onClick={() => v === null && setScore(si, h.par)}
                  aria-label={`${side.owner.name} score`}
                  className="flex min-w-0 flex-1 flex-col items-center [-webkit-tap-highlight-color:transparent]"
                >
                  <span className={cn("text-5xl leading-none font-bold tabular-nums", v === null && "text-muted-foreground/40")}>
                    {v ?? h.par}
                  </span>
                  <span className="text-muted-foreground mt-1 h-4 text-xs">{v === null ? "tap for par" : label(v - h.par)}</span>
                </button>
                <Button
                  variant="outline"
                  className="size-14 rounded-full"
                  aria-label={`${side.owner.name} one more`}
                  disabled={v !== null && v >= 20}
                  onClick={() => bump(1)}
                >
                  <Plus className="size-6" />
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                Playing {side.ghost?.name}&apos;s card: <b className="text-foreground">{fmt(v)}</b>
              </p>
            )}
          </div>
        );
      })}

      {/* Running tally */}
      <div className="bg-muted/50 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 rounded-xl p-3 text-sm">
        <span className="text-muted-foreground text-xs">Thru {Math.min(thru(0), thru(1))}</span>
        <span className="text-muted-foreground text-right text-xs">Gross</span>
        <span className="text-muted-foreground text-right text-xs">Hole pts</span>
        {sides.map((s, si) => (
          <div key={si} className="contents">
            <span className="truncate font-medium">{s.owner.name}</span>
            <span className="text-right tabular-nums">{grossSoFar(si) || "–"}</span>
            <span className="text-right font-semibold tabular-nums">{pointsSoFar(si === 0 ? "a" : "b")}</span>
          </div>
        ))}
        {allDone && result.complete && (
          <p className="text-muted-foreground col-span-3 pt-1 text-xs">
            Final with net total: {sides[0].owner.name} {fmt(result.a.points)} · {sides[1].owner.name} {fmt(result.b.points)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" className="h-12" disabled={hole === 0} onClick={() => setHole(hole - 1)}>
          <ChevronLeft /> Hole {hole === 0 ? 1 : holes[hole - 1].number}
        </Button>
        {last ? (
          <Button size="lg" className="h-12" disabled={saveState === "saving"} onClick={finish}>
            <Check /> {allDone ? "Done" : "Save & view card"}
          </Button>
        ) : (
          <Button size="lg" className="h-12" onClick={() => setHole(hole + 1)}>
            Hole {holes[hole + 1].number} <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}

function label(toPar: number) {
  if (toPar <= -2) return toPar === -2 ? "Eagle" : `${toPar}`;
  return ["Birdie", "Par", "Bogey", "Double", "Triple"][toPar + 1] ?? `+${toPar}`;
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "saving")
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Loader2 className="size-3.5 animate-spin" /> Saving
      </span>
    );
  if (state === "saved")
    return (
      <span className="text-primary inline-flex items-center gap-1 text-xs">
        <Check className="size-3.5" /> Saved
      </span>
    );
  if (state === "locked")
    return (
      <span className="text-destructive inline-flex items-center gap-1 text-xs">
        <Lock className="size-3.5" /> Locked, ask the admin
      </span>
    );
  if (state === "error")
    return (
      <span className="text-destructive inline-flex items-center gap-1 text-xs">
        <CloudOff className="size-3.5" /> Not saved, will retry
      </span>
    );
  return null;
}
