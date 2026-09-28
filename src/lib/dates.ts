/** Date-only helpers. All dates are ISO "YYYY-MM-DD" strings. */

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function leagueTimeZone(): string {
  return process.env.NEXT_PUBLIC_LEAGUE_TIMEZONE || "America/Chicago";
}

/** Today's date in the league's time zone. */
export function today(timeZone = leagueTimeZone()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}
