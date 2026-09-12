/** Worst to best. The index in this array plus one is the stored level, so
 *  the order is the data — don't reorder without a migration. */
export const BEHAVIOR_LEVELS = [
  "L",
  "Canceled",
  "Washed / unc",
  "Timeout",
  "On thin ice",
  "Mid",
  "Might need a PIP",
  "Not taking or also not giving",
  "Not cooking but still eating",
  "GOAT",
  "W",
] as const;

export const levelLabel = (n: number) => BEHAVIOR_LEVELS[n - 1] ?? "—";

/** Four bands across eleven rungs, so the colour says roughly where you
 *  landed without pretending eleven distinct hues would read. */
export function levelTone(n: number): "no" | "maybe" | "plain" | "go" {
  if (n <= 4) return "no";
  if (n <= 7) return "maybe";
  if (n <= 9) return "plain";
  return "go";
}
