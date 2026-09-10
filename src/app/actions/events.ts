"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { RsvpResponse, VoteResponse } from "@/lib/types";

export async function createEvent(groupId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("What are you planning?");

  const times = formData.getAll("time").map(String).filter(Boolean);
  if (times.length === 0) throw new Error("Add at least one time option.");
  if (times.length > 5) throw new Error("Five options is the maximum.");

  const user = await requireUser();
  const supabase = await createClient();

  const { data: ev, error } = await supabase
    .from("events")
    .insert({
      group_id: groupId,
      created_by: user.id,
      title,
      location: String(formData.get("location") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      status: "proposed",
    })
    .select("id")
    .single();
  if (error || !ev) throw new Error(error?.message ?? "Could not create the event.");

  const rows = times.map((t) => ({ event_id: ev.id, proposed_time: new Date(t).toISOString() }));
  const { error: optErr } = await supabase.from("event_time_options").insert(rows);
  if (optErr) throw new Error(optErr.message);

  revalidatePath(`/g/${groupId}`);
  redirect(`/g/${groupId}/events/${ev.id}`);
}

/** Tapping the response you already gave clears it. */
export async function castVote(groupId: string, eventId: string, optionId: string, response: VoteResponse) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("event_votes")
    .select("id, response")
    .eq("time_option_id", optionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.response === response) {
    await supabase.from("event_votes").delete().eq("id", existing.id);
  } else if (existing) {
    await supabase.from("event_votes").update({ response, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await supabase.from("event_votes").insert({ time_option_id: optionId, user_id: user.id, response });
  }

  revalidatePath(`/g/${groupId}/events/${eventId}`);
  revalidatePath(`/g/${groupId}`);
}

export async function confirmTime(groupId: string, eventId: string, optionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_event_time", { p_event: eventId, p_option: optionId });
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
  revalidatePath(`/g/${groupId}`);
}

export async function setRsvp(groupId: string, eventId: string, response: RsvpResponse) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_rsvps")
    .upsert({ event_id: eventId, user_id: user.id, response, updated_at: new Date().toISOString() }, { onConflict: "event_id,user_id" });
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
  revalidatePath(`/g/${groupId}`);
}

export async function cancelEvent(groupId: string, eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ status: "cancelled" }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}`);
  redirect(`/g/${groupId}`);
}

export async function reopenVoting(groupId: string, eventId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ status: "proposed", confirmed_time: null })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
}
