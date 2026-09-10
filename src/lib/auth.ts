import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Membership } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/** Membership is the gate in front of every group screen. RLS would hide the
 *  rows anyway; this turns that into a redirect instead of an empty page. */
export async function requireMembership(groupId: string) {
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
}
