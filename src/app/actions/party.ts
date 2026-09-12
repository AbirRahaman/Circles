"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const bump = (groupId: string, eventId: string) =>
  revalidatePath(`/g/${groupId}/events/${eventId}`);

export async function joinParty(groupId: string, eventId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_party")
    .insert({ event_id: eventId, user_id: user.id });
  if (error && error.code !== "23505") throw new Error(error.message);
  bump(groupId, eventId);
}

/** Leaving clears your tally too — the night's over for you. */
export async function leaveParty(groupId: string, eventId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("party_shots").delete().eq("event_id", eventId).eq("user_id", user.id);
  const { error } = await supabase
    .from("event_party")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

export async function logShot(groupId: string, eventId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("party_shots")
    .insert({ event_id: eventId, user_id: user.id });
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

/** Mis-taps happen, especially later on. */
export async function undoShot(groupId: string, eventId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("party_shots")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last) await supabase.from("party_shots").delete().eq("id", last.id);
  bump(groupId, eventId);
}

/** Done for the night. The count is kept — it just stops being live. */
export async function tapOut(groupId: string, eventId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_party")
    .update({ out_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

/** Second wind, or a mis-tap. */
export async function backIn(groupId: string, eventId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_party")
    .update({ out_at: null })
    .eq("event_id", eventId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}
