"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { today } from "@/lib/dates";

export interface ScoreRow {
  playedOn: string;
  gross: string;
}

export const emptyRow = (): ScoreRow => ({ playedOn: "", gross: "" });

/** Rows that have both a date and a score. */
export function filledRows(rows: ScoreRow[]) {
  return rows.filter((r) => r.playedOn && r.gross).map((r) => ({ playedOn: r.playedOn, gross: Number(r.gross), note: "Previous score" }));
}

/** Editable list of previous 9-hole scores (date + gross). */
export function PreviousScores({ rows, onChange }: { rows: ScoreRow[]; onChange: (rows: ScoreRow[]) => void }) {
  const max = today();
  const set = (i: number, patch: Partial<ScoreRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2">
          <Input type="date" max={max} value={r.playedOn} onChange={(e) => set(i, { playedOn: e.target.value })} aria-label={`Date ${i + 1}`} />
          <Input
            inputMode="numeric"
            placeholder="Score"
            value={r.gross}
            onChange={(e) => set(i, { gross: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            aria-label={`Score ${i + 1}`}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Remove"
            disabled={rows.length === 1}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, emptyRow()])}>
        <Plus /> Add another
      </Button>
    </div>
  );
}
