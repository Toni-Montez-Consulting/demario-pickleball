/**
 * Coaching prices for Drilling sessions and Play with the Pro, per person, in
 * whole US dollars. Source: DeMario's texts to Tonio on 2026-10-20; the spec is
 * docs/specs/2026-10-20-drilling-and-play-with-the-pro.md.
 *
 * Court reservation fees are never included: DeMario confirms them separately.
 * The server must quote from this table, never from a price the browser sends.
 */

export type SessionFormat = "drill" | "play_pro";
export type DrillLength = 60 | 90;

/** Index 0 is one player, index 7 is eight. */
const DRILL_PER_PERSON: Record<DrillLength, readonly number[]> = {
  60: [60, 30, 25, 20, 18, 15, 15, 15],
  90: [80, 40, 35, 30, 25, 22, 20, 18],
};

/** One to four players. The price is the same whether the session runs one hour or two. */
const PLAY_PRO_PER_PERSON: readonly number[] = [70, 40, 35, 30];

export const GROUP_SIZE_LIMITS: Record<SessionFormat, { min: number; max: number }> = {
  drill: { min: 1, max: DRILL_PER_PERSON[60].length },
  play_pro: { min: 1, max: PLAY_PRO_PER_PERSON.length },
};

export type SessionQuote = {
  format: SessionFormat;
  groupSize: number;
  perPerson: number;
  total: number;
};

export function quoteSession(format: SessionFormat, groupSize: number, length?: DrillLength): SessionQuote {
  const limits = GROUP_SIZE_LIMITS[format];
  if (!Number.isInteger(groupSize) || groupSize < limits.min || groupSize > limits.max) {
    throw new RangeError(`${format} takes ${limits.min} to ${limits.max} players, not ${groupSize}`);
  }

  let table: readonly number[];
  if (format === "drill") {
    if (length !== 60 && length !== 90) {
      throw new RangeError(`a drilling session is 60 or 90 minutes, not ${String(length)}`);
    }
    table = DRILL_PER_PERSON[length];
  } else {
    table = PLAY_PRO_PER_PERSON;
  }

  const perPerson = table[groupSize - 1];
  return { format, groupSize, perPerson, total: perPerson * groupSize };
}

/** The price for one player. Drilling quotes its 60-minute session unless told otherwise. */
export function soloPrice(format: SessionFormat, length: DrillLength = 60): number {
  return format === "drill" ? DRILL_PER_PERSON[length][0] : PLAY_PRO_PER_PERSON[0];
}

/** The lowest price per player: for one drilling length, or across both when none is given. */
export function lowestPerPerson(format: SessionFormat, length?: DrillLength): number {
  const tables =
    format === "play_pro"
      ? [PLAY_PRO_PER_PERSON]
      : length
        ? [DRILL_PER_PERSON[length]]
        : Object.values(DRILL_PER_PERSON);
  return Math.min(...tables.flat());
}

/** "$25", or "$22.50" should a price ever carry cents. */
export function usd(dollars: number): string {
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function playersLabel(groupSize: number): string {
  return `${groupSize} ${groupSize === 1 ? "player" : "players"}`;
}

/** "$25 per person · 3 players · $75 total", the same line everywhere a quote appears. */
export function quoteLine(quote: Pick<SessionQuote, "perPerson" | "groupSize" | "total">): string {
  return `${usd(quote.perPerson)} per person · ${playersLabel(quote.groupSize)} · ${usd(quote.total)} total`;
}
