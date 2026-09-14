/** Order is how a trip plan reads top to bottom: where you sleep, how you
 *  get there, what you do, what you eat, everything else. */
export const TRIP_KINDS = [
  { value: "housing",   label: "Housing" },
  { value: "transport", label: "Transport" },
  { value: "activity",  label: "Activities" },
  { value: "food",      label: "Food" },
  { value: "other",     label: "Other" },
] as const;

export type TripKind = (typeof TRIP_KINDS)[number]["value"];

export const kindLabel = (k: string) =>
  TRIP_KINDS.find((x) => x.value === k)?.label ?? "Other";

export const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: n % 1 === 0 ? 0 : 2 });

/** What each person is looking at, given items priced either way.
 *  `heads` is how many are actually going, floored at one. */
export function perPersonEstimate(
  items: { cost: number | null; per_person: boolean }[],
  heads: number
) {
  const people = Math.max(heads, 1);
  let each = 0;
  let shared = 0;
  for (const i of items) {
    if (i.cost == null) continue;
    if (i.per_person) each += Number(i.cost);
    else shared += Number(i.cost);
  }
  return { each: each + shared / people, shared, people };
}
