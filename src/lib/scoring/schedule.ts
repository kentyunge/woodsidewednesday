/** A pairing; `null` means a bye (odd number of players). */
export type Pairing<T> = [T, T | null];

/**
 * Round-robin schedule using the circle method: everyone plays everyone once.
 * n players -> n-1 rounds (n even) or n rounds with byes (n odd).
 */
export function roundRobin<T>(players: T[]): Pairing<T>[][] {
  const list: (T | null)[] = [...players];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: Pairing<T>[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: Pairing<T>[] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = list[i];
      const y = list[n - 1 - i];
      if (x === null && y === null) continue;
      // Alternate the first seat so nobody is always "side A".
      const pair: Pairing<T> = x === null ? [y as T, null] : y === null ? [x, null] : r % 2 === 0 ? [x, y] : [y, x];
      round.push(pair);
    }
    rounds.push(round);
    // rotate everyone except the first seat
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

/** Position night: 1 v 2, 3 v 4, ... from a standings-ordered list. */
export function positionNight<T>(ordered: T[]): Pairing<T>[] {
  const out: Pairing<T>[] = [];
  for (let i = 0; i < ordered.length; i += 2) out.push([ordered[i], ordered[i + 1] ?? null]);
  return out;
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
