import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt } from "@/lib/utils";
import { upcomingHandicap } from "@/server/league";
import { requirePageActor, resolveSeason } from "@/server/session";

export const metadata = { title: "Golfers" };

export default async function GolfersPage({ searchParams }: PageProps<"/golfers">) {
  await requirePageActor();
  const { season, data } = await resolveSeason((await searchParams).season);
  if (!data || !season) return <p className="text-muted-foreground">No season yet.</p>;
  const regulars = new Set(data.players.map((p) => p.id));
  const all = [...data.golfers.values()].filter((g) => g.active).sort((a, b) => a.name.localeCompare(b.name));
  const subs = all.filter((g) => !regulars.has(g.id) && g.isSub);
  const others = all.filter((g) => !regulars.has(g.id) && !g.isSub);
  const rows = (list: typeof all) =>
    list.map((g) => {
      const h = upcomingHandicap(data, g.id);
      const rounds = data.history.get(g.id)?.length ?? 0;
      return (
        <TableRow key={g.id}>
          <TableCell>
            <Link href={`/golfers/${g.id}?season=${season.id}`} className="font-medium hover:underline">
              {g.name}
            </Link>
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {h.method === "rolling" ? fmt(h.handicap) : <span className="text-muted-foreground text-xs">not established</span>}
          </TableCell>
          <TableCell className="text-right tabular-nums">{rounds}</TableCell>
          <TableCell className="hidden sm:table-cell">
            {g.email && (
              <a href={`mailto:${g.email}`} className="text-muted-foreground hover:underline">
                {g.email}
              </a>
            )}
          </TableCell>
          <TableCell className="hidden md:table-cell">
            {g.phone && (
              <a href={`tel:${g.phone}`} className="text-muted-foreground hover:underline">
                {g.phone}
              </a>
            )}
          </TableCell>
        </TableRow>
      );
    });
  const head = (
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead className="text-right">Hcp</TableHead>
        <TableHead className="text-right">Rounds</TableHead>
        <TableHead className="hidden sm:table-cell">Email</TableHead>
        <TableHead className="hidden md:table-cell">Phone</TableHead>
      </TableRow>
    </TableHeader>
  );
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Golfers</h1>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>{season.name} regulars</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <Table>
            {head}
            <TableBody>{rows(all.filter((g) => regulars.has(g.id)))}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Subs</CardTitle>
          <CardDescription>Subs play at 80% of the night&apos;s round until they have 3 rounds, then 90% of their rolling average.</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <Table>
            {head}
            <TableBody>{rows(subs)}</TableBody>
          </Table>
        </CardContent>
      </Card>
      {others.length > 0 && (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Not playing this season</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <Table>
              {head}
              <TableBody>{rows(others)}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
