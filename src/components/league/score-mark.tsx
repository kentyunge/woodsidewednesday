import { classifyScore } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/**
 * Gross score in traditional scorecard notation:
 * eagle = double circle, birdie = circle, bogey = square, double+ = double square.
 */
export function ScoreMark({ gross, par, strokes = 0 }: { gross: number | null; par: number; strokes?: number }) {
  if (gross === null) return <span className="text-muted-foreground">–</span>;
  const t = classifyScore(gross, par);
  return (
    <span className="relative inline-flex">
      <span
        className={cn(
          "inline-flex size-7 items-center justify-center text-sm font-semibold tabular-nums",
          t === "eagle" && "text-eagle rounded-full ring-2 ring-current ring-offset-1 outline-2 outline-current outline-offset-2",
          t === "birdie" && "text-birdie rounded-full ring-2 ring-current",
          t === "bogey" && "text-bogey ring-1 ring-current",
          (t === "double" || t === "other") && "text-double ring-2 ring-current ring-offset-1 outline-1 outline-current outline-offset-2",
        )}
      >
        {gross}
      </span>
      {strokes > 0 && <StrokeDots count={strokes} className="absolute -top-1.5 -right-2" />}
    </span>
  );
}

/** One dot per handicap stroke received on a hole. */
export function StrokeDots({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={cn("flex gap-0.5", className)} aria-label={`${count} stroke${count > 1 ? "s" : ""}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="bg-primary size-1.5 rounded-full" />
      ))}
    </span>
  );
}
