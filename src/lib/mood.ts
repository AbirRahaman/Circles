/** Five rungs, plain words, no clinical framing. Index + 1 is the stored
 *  level, so the order is the data. */
export const MOOD_LEVELS = ["Rough", "Low", "OK", "Good", "Great"] as const;

export const moodLabel = (n: number) => MOOD_LEVELS[n - 1] ?? "—";

export function moodTone(n: number): "no" | "maybe" | "plain" | "go" {
  if (n <= 1) return "no";
  if (n === 2) return "maybe";
  if (n === 3) return "plain";
  return "go";
}
