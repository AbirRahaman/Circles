import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser, type AuthUser } from "@/lib/supabase/verify";
import type { Membership } from "@/lib/types";
import { asGroupType, hasFeature, type Feature, type GroupType } from "@/lib/groupTypes";

/* Both of these are wrapped in React's cache(), which memoises per request.
 * A group page renders the layout and the page in the same pass and both
 * check membership — without this that is four extra round trips to
 * Supabase on every single navigation, asking the same two questions. */

export const requireUser = cache(async () => {
  const supabase = await createClient();

  // getVerifiedUser retries a transient failure before giving up, so a
  // momentary blip doesn't read as "signed out" and throw someone back to
  // the login screen mid-session.
  let user: AuthUser | null = null;
  try {
    user = await getVerifiedUser(supabase);
  } catch {
    throw new Error("Could not reach the sign-in service. Try again in a moment.");
  }
  if (!user) redirect("/login");
  return user;
});

/** Membership is the gate in front of every group screen. RLS would hide the
 *  rows anyway; this turns that into a redirect instead of an empty page. */
export const requireMembership = cache(async (groupId: string) => {
  const supabase = await createClient();
  const user = await requireUser();

  const { data } = await supabase
    .from("memberships")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!data) redirect("/");
  return { supabase, user, membership: data as Membership, isAdmin: data.role === "admin" };
});

/** The group row every group screen needs, fetched once per request. */
export const getGroup = cache(async (groupId: string) => {
  const { supabase } = await requireMembership(groupId);
  const { data } = await supabase
    .from("friend_groups")
    .select("id, name, created_at, type, behavior_enabled")
    .eq("id", groupId)
    .single();
  if (!data) redirect("/");
  return { ...data, type: asGroupType(data.type) as GroupType, behavior_enabled: data.behavior_enabled === true };
});

/** Gate a tab that only some group types have. Old links to a hidden tab
 *  land on a 404 rather than a half-working page. */
export async function requireFeature(groupId: string, feature: Feature) {
  const group = await getGroup(groupId);
  if (!hasFeature(group.type, feature)) notFound();
  return group;
}
