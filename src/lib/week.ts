/** Plain-date helpers for the weekly roommate tools. Dates are YYYY-MM-DD
 *  strings in the group's timezone; noon UTC keeps arithmetic off DST edges. */

const at = (key: string) => new Date(`${key}T12:00:00Z`);
const key = (d: Date) => d.toISOString().slice(0, 10);

export const isDateKey = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(at(v).getTime());

export const addDays = (k: string, n: number) => key(new Date(at(k).getTime() + n * 86_400_000));

/** The Monday on or before the given date. */
export function mondayOf(k: string) {
  const dow = at(k).getUTCDay(); // 0 = Sunday
  return addDays(k, -((dow + 6) % 7));
}

export const weeksBetween = (from: string, to: string) =>
  Math.round((at(mondayOf(to)).getTime() - at(mondayOf(from)).getTime()) / (7 * 86_400_000));

export const weekdayShort = (k: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(at(k));

/** Whose turn it is in a rotation for a given week. */
export function turnFor<T>(rotation: T[], startWeek: string, week: string, offset = 0): T | null {
  if (!rotation.length) return null;
  const n = rotation.length;
  const i = (((weeksBetween(startWeek, week) + offset) % n) + n) % n;
  return rotation[i];
}
