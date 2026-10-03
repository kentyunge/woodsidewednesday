import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmt, cn } from "@/lib/utils";
import type { MatchView, ResolvedSide } from "@/server/league";

function SideLabel({ side }: { side: ResolvedSide }) {
  return (
    <span className="min-w-0 truncate">
      {side.owner.name}
      {side.status === "sub" && side.player && (
        <span className="text-muted-foreground text-xs"> (sub: {side.player.name})</span>
      )}
      {side.status === "ghost" && <span className="text-muted-foreground text-xs"> (ghost)</span>}
    </span>
  );
}

/** A side's points. In a live week a new value re-mounts (via key) and flashes so updates stand out. */
function Points({ value, live }: { value: string; live?: boolean }) {
  return (
    <span
      key={live ? value : undefined}
      className={cn(
        "rounded px-1 text-right font-semibold tabular-nums",
        live && value !== "" && "animate-in fade-in zoom-in-75 [animation-duration:600ms]",
      )}
    >
      {value}
    </span>
  );
}

/** Compact match summary linking to the scorecard. */
export function MatchRow({ match, highlight, live }: { match: MatchView; highlight?: number | null; live?: boolean }) {
  if (!match.b) {
    return (
      <div className="text-muted-foreground flex items-center justify-between px-3 py-2.5 text-sm">
        <span>{match.a.owner.name}</span>
        <Badge variant="outline">Bye</Badge>
      </div>
    );
  }
  const r = match.result;
  const started = !!(match.a.scores?.some((s) => s !== null) || match.b.scores?.some((s) => s !== null));
  const pts = (side: "a" | "b") => (r && started ? fmt(match[side]!.status === "ghost" ? 0 : r[side].points) : "");
  const mine = highlight && (match.a.owner.id === highlight || match.b.owner.id === highlight);
  return (
    <Link
      href={`/matches/${match.id}`}
      className={cn("hover:bg-muted/60 flex items-center gap-2 px-3 py-2.5 text-sm transition-colors", mine && "bg-primary/10")}
    >
      <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
        <SideLabel side={match.a} />
        <Points value={pts("a")} live={live} />
        <SideLabel side={match.b} />
        <Points value={pts("b")} live={live} />
      </div>
      {!match.complete && started && <Badge variant="secondary">In progress</Badge>}
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}
