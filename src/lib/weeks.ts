/**
 * Split a season's weeks for display: the current week is the earliest one the admin
 * hasn't marked complete; completed weeks are listed newest first.
 */
export function splitWeeks<W extends { closed: boolean }>(weeks: W[]) {
  const open = weeks.filter((w) => !w.closed);
  return {
    current: open[0] ?? null,
    upcoming: open.slice(1),
    completed: weeks.filter((w) => w.closed).reverse(),
  };
}

/** A week whose scores are coming in now: open for entry and not every match is final. */
export function isLive(
  week: { closed: boolean; date: string; lockDate: string; matches: { complete: boolean; bye: boolean }[] },
  today: string,
) {
  return !week.closed && week.date <= today && today < week.lockDate && week.matches.some((m) => !m.bye && !m.complete);
}
