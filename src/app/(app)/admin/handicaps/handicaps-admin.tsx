"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/utils";
import { useAction } from "../use-action";

interface Props {
  golfers: { id: number; name: string; isSub: boolean; handicap: number | null; method: string; basis: number[] }[];
  rounds: { id: number; golferId: number; playedOn: string; gross: number; note: string | null }[];
}

type G = Props["golfers"][number];

/** Regulars first, then subs. */
function groups(golfers: G[]): [string, G[]][] {
  return (
    [
      ["Regulars", golfers.filter((g) => !g.isSub)],
      ["Subs", golfers.filter((g) => g.isSub)],
    ] as [string, G[]][]
  ).filter(([, list]) => list.length > 0);
}

function GolferOptions({ golfers }: { golfers: G[] }) {
  return groups(golfers).map(([label, list]) => (
    <optgroup key={label} label={label}>
      {list.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </optgroup>
  ));
}

export function HandicapsAdmin({ golfers, rounds }: Props) {
  const { busy, run } = useAction();
  const [csv, setCsv] = useState("");
  const [golferId, setGolferId] = useState<number | "">("");
  const [date, setDate] = useState("");
  const [gross, setGross] = useState("");
  const [filter, setFilter] = useState<number | "">("");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Current handicaps</CardTitle>
          <CardDescription>Going into each golfer&apos;s next round.</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Golfer</TableHead>
                <TableHead className="text-right">Hcp</TableHead>
                <TableHead>Last rounds (over par)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups(golfers).map(([label, list]) => [
                <TableRow key={label} className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={3} className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {label}
                  </TableCell>
                </TableRow>,
                ...list.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <Link href={`/admin/golfers/${g.id}`} className="hover:underline">
                        {g.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {g.method === "rolling" ? fmt(g.handicap) : <span className="text-muted-foreground text-xs font-normal">provisional</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">
                      {g.basis.map((d) => (d > 0 ? `+${d}` : d)).join(", ") || "–"}
                    </TableCell>
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Import last season</CardTitle>
            <CardDescription>
              Paste rows from the Google Sheet: <code>name or email, YYYY-MM-DD, gross</code> (comma or tab separated). Unknown names become new golfers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={6}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"Alex Carter, 2025-08-06, 41\nBen Foster, 2025-08-06, 44"}
              className="font-mono text-xs"
            />
            <Button
              disabled={busy || !csv.trim()}
              onClick={async () => {
                const r = await run(() => api<{ imported: number; errors: string[] }>("/historical-rounds/import", { body: { csv } }));
                if (r) {
                  alert(`Imported ${r.imported} rounds.${r.errors.length ? `\n\nSkipped:\n${r.errors.join("\n")}` : ""}`);
                  if (!r.errors.length) setCsv("");
                }
              }}
            >
              <Upload /> Import
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Carried-over rounds</CardTitle>
            <CardDescription>These count toward the rolling average alongside league rounds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_9rem_5rem_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api("/historical-rounds", { body: { rounds: [{ golferId: Number(golferId), playedOn: date, gross: Number(gross) }] } }), "Round added").then(() =>
                  setGross(""),
                );
              }}
            >
              <NativeSelect value={golferId} onChange={(e) => setGolferId(e.target.value ? Number(e.target.value) : "")} required className="col-span-2 sm:col-span-1">
                <option value="">Golfer…</option>
                <GolferOptions golfers={golfers} />
              </NativeSelect>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              <Input inputMode="numeric" placeholder="Gross" value={gross} onChange={(e) => setGross(e.target.value.replace(/\D/g, ""))} required />
              <Button type="submit" disabled={busy}>
                Add
              </Button>
            </form>
            <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value ? Number(e.target.value) : "")}>
              <option value="">All golfers</option>
              <GolferOptions golfers={golfers} />
            </NativeSelect>
            <Table>
              <TableBody>
                {rounds
                  .filter((r) => !filter || r.golferId === filter)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{golfers.find((g) => g.id === r.golferId)?.name ?? "Archived golfer"}</TableCell>
                      <TableCell className="tabular-nums">{r.playedOn}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{r.gross}</TableCell>
                      <TableCell className="w-8">
                        <Button size="icon-sm" variant="ghost" title="Delete" disabled={busy} onClick={() => run(() => api(`/historical-rounds/${r.id}`, { method: "DELETE" }), "Deleted")}>
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
