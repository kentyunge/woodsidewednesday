"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useAction } from "../../../use-action";

interface Props {
  seasonId: number;
  playerIds: number[];
  golfers: { id: number; name: string; active: boolean }[];
}

export function SeasonPlayers({ seasonId, playerIds, golfers }: Props) {
  const { busy, run } = useAction();
  const [players, setPlayers] = useState<Set<number>>(new Set(playerIds));
  const dirty = players.size !== playerIds.length || playerIds.some((id) => !players.has(id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Players ({players.size})</CardTitle>
        <CardDescription>
          The season&apos;s regulars. Add new golfers on the{" "}
          <Link href="/admin/golfers" className="underline">
            Golfers
          </Link>{" "}
          tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {golfers
            .filter((g) => g.active || players.has(g.id))
            .map((g) => (
              <label key={g.id} className="hover:bg-muted flex items-center gap-2 rounded px-2 py-1.5 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={players.has(g.id)}
                  onChange={(e) => {
                    const next = new Set(players);
                    if (e.target.checked) next.add(g.id);
                    else next.delete(g.id);
                    setPlayers(next);
                  }}
                />
                {g.name}
              </label>
            ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !dirty}
            onClick={() =>
              run(() => api(`/seasons/${seasonId}/players`, { method: "PUT", body: { golferIds: [...players] } }), "Players saved")
            }
          >
            Save players
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/admin/seasons/${seasonId}/schedule`}>Next: schedule</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
