import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt, cn } from "@/lib/utils";
import type { StandingRow } from "@/server/league";

export function StandingsTable({ rows, highlight, seasonId }: { rows: StandingRow[]; highlight?: number | null; seasonId: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">#</TableHead>
          <TableHead>Golfer</TableHead>
          <TableHead className="text-right">Pts</TableHead>
          <TableHead className="text-right">W-L-T</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Avg</TableHead>
          <TableHead className="text-right">Hcp</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.golfer.id} className={cn(highlight === r.golfer.id && "bg-primary/10 font-medium")}>
            <TableCell className="tabular-nums">{r.rank}</TableCell>
            <TableCell>
              <Link href={`/golfers/${r.golfer.id}?season=${seasonId}`} className="hover:underline">
                {r.golfer.name}
              </Link>
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{fmt(r.points)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {r.wins}-{r.losses}-{r.ties}
            </TableCell>
            <TableCell className="hidden text-right tabular-nums sm:table-cell">{fmt(r.avgPoints)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt(r.handicap)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
