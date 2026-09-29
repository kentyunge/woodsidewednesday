import { Badge } from "@/components/ui/badge";
import type { HandicapResult } from "@/lib/scoring";
import { fmt } from "@/lib/utils";

/** "Hcp 8" once established, otherwise how many rounds are still needed. */
export function HandicapStatus({ handicap, roundsNeeded }: { handicap: HandicapResult; roundsNeeded: number }) {
  if (handicap.method === "rolling") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-semibold tabular-nums">{fmt(handicap.handicap)}</span>
        <Badge variant="secondary">Established</Badge>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant="outline">Provisional</Badge>
      <span className="text-muted-foreground text-xs">
        needs {roundsNeeded} more round{roundsNeeded === 1 ? "" : "s"}
      </span>
    </span>
  );
}
