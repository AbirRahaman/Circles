import type { SupabaseClient } from "@supabase/supabase-js";

export type MemberLite = { id: string; name: string; avatar_url: string | null };

/** Active members of a group, sorted by name. */
export async function fetchMembers(supabase: SupabaseClient, groupId: string): Promise<MemberLite[]> {
  const { data } = await supabase
    .from("memberships")
    .select("user_id, profiles(id, name, avatar_url)")
    .eq("group_id", groupId)
    .eq("status", "active");
  return (data ?? [])
    .map((m) => (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as MemberLite | null)
    .filter((p): p is MemberLite => !!p)
    .sort((a, b) => a.name.localeCompare(b.name));
}
