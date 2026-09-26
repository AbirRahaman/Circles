/** Group types and the features each one turns on.
 *  Switching a group's type only shows or hides things; no data is removed,
 *  so switching back brings everything back. Change the feature sets here. */

export const GROUP_TYPES = ["friends", "professional", "roommates"] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export type Feature =
  // tabs
  | "money" | "challenges" | "photos" | "checkin" | "games"
  | "groceries" | "meals" | "chores"
  // sections inside an event
  | "trips" | "tallies" | "jokes" | "behavior";

const FEATURES: Record<GroupType, ReadonlySet<Feature>> = {
  friends: new Set<Feature>(["money", "challenges", "photos", "checkin", "games", "trips", "tallies", "jokes", "behavior"]),
  professional: new Set<Feature>([]),
  roommates: new Set<Feature>(["money", "groceries", "meals", "chores", "games"]),
};

export const GROUP_TYPE_INFO: Record<GroupType, { label: string; blurb: string }> = {
  friends: {
    label: "Friend group",
    blurb: "Plans, trips, money, photos, challenges, games and check-ins.",
  },
  professional: {
    label: "Professional",
    blurb: "Event coordination for work: happy hours, potlucks, offsites.",
  },
  roommates: {
    label: "Roommates",
    blurb: "Grocery list, meal plan, chore rotation, shared costs, games and plans.",
  },
};

export function asGroupType(v: unknown): GroupType {
  return GROUP_TYPES.includes(v as GroupType) ? (v as GroupType) : "friends";
}

export function hasFeature(type: GroupType, f: Feature): boolean {
  return FEATURES[type].has(f);
}
