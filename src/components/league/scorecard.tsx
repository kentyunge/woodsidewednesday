import type { Hole } from "@/lib/scoring";
import { fmt, cn } from "@/lib/utils";
import type { MatchView, ResolvedSide } from "@/server/league";
import { ScoreMark, StrokeDots } from "./score-mark";

function handicapNote(side: ResolvedSide) {
  const h = side.handicap;
  if (h.override) return "admin override";
  if (h.method === "provisional") return "provisional (80% of tonight)";
  if (h.method === "pending") return "set when card is complete";
  return null;
}

export function sideName(side: ResolvedSide) {
  if (side.status === "sub" && side.player) return `${side.player.name} (sub for ${side.owner.name})`;
  if (side.status === "ghost") return `${side.owner.name} — absent, ghost: ${side.ghost?.name ?? "not drawn"}`;
  return side.owner.name;
}

/** Summary line: who gives strokes to whom and on which holes. */
export function StrokeSummary({ match }: { match: MatchView }) {
  const r = match.result;
  if (!r || !match.b) return null;
  const [giver, receiver] = r.strokesTo === "A" ? [match.b, match.a] : [match.a, match.b];
  if (giver.handicap.handicap === null || receiver.handicap.handicap === null)
    return <p className="text-muted-foreground text-sm">Strokes are set once both handicaps are known.</p>;
  if (!r.strokesTo) return <p className="text-muted-foreground text-sm">Even handicaps — no strokes given.</p>;
  const side = r.strokesTo === "A" ? "a" : "b";
  const holeList = r.holes
    .filter((h) => h[side].strokes > 0)
    .sort((x, y) => x.handicap - y.handicap)
    .map((h) => `#${h.hole}${h[side].strokes > 1 ? ` (×${h[side].strokes})` : ""}`)
    .join(", ");
  return (
    <p className="text-sm">
      <span className="font-medium">{(giver.player ?? giver.ghost ?? giver.owner).name}</span> gives{" "}
      <span className="font-semibold">{r.strokeDifference}</span> stroke{r.strokeDifference === 1 ? "" : "s"} to{" "}
      <span className="font-medium">{(receiver.player ?? receiver.ghost ?? receiver.owner).name}</span>
      <span className="text-muted-foreground"> on {holeList}</span>
    </p>
  );
}

export function Scorecard({ match, holes }: { match: MatchView; holes: Hole[] }) {
  const r = match.result;
  const par = holes.reduce((s, h) => s + h.par, 0);
  const sides = [
    { key: "a" as const, side: match.a },
    ...(match.b ? [{ key: "b" as const, side: match.b }] : []),
  ];
  const cell = "px-1 py-1.5 text-center";
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="bg-primary sticky left-0 z-10 px-2 py-1.5 text-left font-medium">Hole</th>
            {holes.map((h) => (
              <th key={h.number} className={cn(cell, "font-semibold")}>
                {h.number}
              </th>
            ))}
            <th className={cn(cell, "font-semibold")}>Tot</th>
          </tr>
          <tr className="bg-muted/60 text-muted-foreground text-xs">
            <td className="bg-muted sticky left-0 z-10 px-2 py-1">Par</td>
            {holes.map((h) => (
              <td key={h.number} className={cn(cell, "py-1")}>
                {h.par}
              </td>
            ))}
            <td className={cn(cell, "py-1 font-medium")}>{par}</td>
          </tr>
          <tr className="bg-muted/60 text-muted-foreground border-b text-xs">
            <td className="bg-muted sticky left-0 z-10 px-2 py-1">Hdcp</td>
            {holes.map((h) => (
              <td key={h.number} className={cn(cell, "py-1")}>
                {h.handicap}
              </td>
            ))}
            <td />
          </tr>
        </thead>
        {sides.map(({ key, side }) => {
          const t = r?.[key];
          const note = handicapNote(side);
          return (
            <tbody key={key} className="border-b last:border-b-0">
              <tr>
                <td className="bg-card sticky left-0 z-10 max-w-36 px-2 pt-2 pb-1 align-top">
                  <div className="truncate font-medium">{(side.player ?? side.owner).name}</div>
                  <div className="text-muted-foreground text-xs">
                    Hcp {fmt(side.handicap.handicap)}
                    {note && <span className="block truncate">{note}</span>}
                    {side.status === "sub" && <span className="block truncate">sub for {side.owner.name}</span>}
                    {side.status === "ghost" && (
                      <span className="block truncate">ghost: {side.ghost?.name ?? "—"}</span>
                    )}
                  </div>
                </td>
                {holes.map((h, i) => (
                  <td key={h.number} className={cn(cell, "pt-2")}>
                    <ScoreMark gross={side.scores?.[i] ?? null} par={h.par} strokes={r?.holes[i][key].strokes ?? 0} />
                  </td>
                ))}
                <td className={cn(cell, "pt-2 font-semibold tabular-nums")}>{fmt(t?.gross)}</td>
              </tr>
              <tr className="text-muted-foreground text-xs">
                <td className="bg-card sticky left-0 z-10 px-2">Net</td>
                {holes.map((h, i) => (
                  <td key={h.number} className={cn(cell, "py-0.5 tabular-nums")}>
                    {fmt(r?.holes[i][key].net)}
                  </td>
                ))}
                <td className={cn(cell, "py-0.5 font-medium tabular-nums")}>{fmt(t?.net)}</td>
              </tr>
              <tr className="text-xs">
                <td className="bg-card sticky left-0 z-10 px-2 pb-2">Points</td>
                {holes.map((h, i) => {
                  const p = r?.holes[i][key].points ?? null;
                  return (
                    <td
                      key={h.number}
                      className={cn(cell, "pt-0.5 pb-2 tabular-nums", p === 2 && "text-primary font-bold", p === 0 && "text-muted-foreground")}
                    >
                      {fmt(p)}
                    </td>
                  );
                })}
                <td className={cn(cell, "pt-0.5 pb-2 font-bold tabular-nums")}>
                  {t && r?.complete ? (
                    <span title={`${fmt(t.holePoints)} hole + ${fmt(t.totalPoints)} total`}>{fmt(t.points)}</span>
                  ) : (
                    fmt(t?.holePoints)
                  )}
                </td>
              </tr>
            </tbody>
          );
        })}
      </table>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5">
          <StrokeDots count={1} /> stroke received
        </span>
        <span>◯ birdie · ◎ eagle · □ bogey · ▣ double+</span>
        <span>Total column points include 2 for low net total</span>
      </div>
    </div>
  );
}
