"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { asGroupType, GROUP_TYPES, type GroupType } from "@/lib/groupTypes";

export async function createGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Give the group a name.");

  const type = asGroupType(formData.get("type"));

  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", { p_name: name, p_type: type });
  if (error) throw new Error(error.message);

  revalidatePath("/");
  redirect(`/g/${data}`);
}

export async function acceptInvite(token: string) {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) throw new Error(error.message === "invite_invalid" ? "That invite link is no longer valid." : error.message);

  revalidatePath("/");
  redirect(`/g/${data}`);
}

export async function renameGroup(groupId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name cannot be empty.");

  const supabase = await createClient();
  // RLS: only an admin's update passes the groups_update policy.
  const { error } = await supabase.from("friend_groups").update({ name }).eq("id", groupId);
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}`, "layout");
}

export async function setGroupType(groupId: string, formData: FormData) {
  const raw = formData.get("type");
  if (!GROUP_TYPES.includes(raw as GroupType)) throw new Error("Pick a group type.");

  const supabase = await createClient();
  // RLS: only an admin's update passes the groups_update policy.
  const { data, error } = await supabase
    .from("friend_groups")
    .update({ type: raw })
    .eq("id", groupId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Only admins can change the group type.");

  revalidatePath(`/g/${groupId}`, "layout");
}

export async function setBehaviorEnabled(groupId: string, enabled: boolean) {
  const supabase = await createClient();
  // RLS: only an admin's update passes the groups_update policy.
  const { data, error } = await supabase
    .from("friend_groups")
    .update({ behavior_enabled: enabled })
    .eq("id", groupId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Only admins can change group features.");

  revalidatePath(`/g/${groupId}`, "layout");
}

export async function setMemberRole(groupId: string, userId: string, role: "admin" | "member") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_group: groupId, p_user: userId, p_role: role });
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/members`);
}

export async function removeMember(groupId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_group: groupId, p_user: userId });
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/members`);
}

export async function leaveGroup(groupId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group", { p_group: groupId });
  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/");
}

export async function rotateInvite(groupId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("invites").update({ revoked_at: new Date().toISOString() }).eq("group_id", groupId).is("revoked_at", null);
  const { error } = await supabase.from("invites").insert({ group_id: groupId, created_by: user.id });
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/members`);
}
