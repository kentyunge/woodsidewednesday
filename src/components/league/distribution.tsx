import type { ScoreType } from "@/lib/scoring";

const LABELS: Record<ScoreType, string> = {
  eagle: "Eagles+",
  birdie: "Birdies",
  par: "Pars",
  bogey: "Bogeys",
  double: "Doubles",
  other: "Triple+",
};

/** Single-series horizontal bars: count of each score type, direct-labeled. */
export function Distribution({ data }: { data: Record<ScoreType, number> }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  const max = Math.max(1, ...Object.values(data));
  return (
    <div className="space-y-2" role="table" aria-label="Score distribution">
      {(Object.keys(LABELS) as ScoreType[]).map((k) => {
        const pct = total ? (data[k] / total) * 100 : 0;
        return (
          <div
            key={k}
            role="row"
            className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 text-sm"
            title={`${LABELS[k]}: ${data[k]} (${pct.toFixed(1)}% of holes)`}
          >
            <span role="cell" className="text-muted-foreground">
              {LABELS[k]}
            </span>
            <span role="cell" className="bg-muted h-3 overflow-hidden rounded-r">
              <span className="bg-chart-1 block h-full rounded-r" style={{ width: `${(data[k] / max) * 100}%` }} />
            </span>
            <span role="cell" className="text-right tabular-nums">
              <span className="font-medium">{data[k]}</span>
              <span className="text-muted-foreground ml-1 text-xs">{pct.toFixed(0)}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
