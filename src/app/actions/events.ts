"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { RsvpResponse, VoteResponse } from "@/lib/types";
import { fromInput } from "@/lib/format";

export async function createEvent(groupId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("What are you planning?");

  // Two ways in: a date you already know, or a poll over several options.
  const when = String(formData.get("when") ?? "").trim();
  const times = formData.getAll("time").map(String).filter(Boolean);

  if (!when && times.length === 0) throw new Error("Pick a date, or add times to vote on.");
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
      status: when ? "confirmed" : "proposed",
      confirmed_time: when ? fromInput(when) : null,
      ends_at: when ? fromInput(formData.get("ends")) : null,
    })
    .select("id")
    .single();
  if (error || !ev) throw new Error(error?.message ?? "Could not create the event.");

  if (when) {
    // Whoever sets the date is going, or they wouldn't have set it.
    await supabase.from("event_rsvps").insert({ event_id: ev.id, user_id: user.id, response: "going" });
  } else {
    const rows = times.map((t) => ({ event_id: ev.id, proposed_time: fromInput(t) }));
    const { error: optErr } = await supabase.from("event_time_options").insert(rows);
    if (optErr) throw new Error(optErr.message);
  }

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

/** Any active member can correct an event's details — spec 3, events are
 *  not admin-gated. Changing the date of a confirmed event keeps the RSVPs;
 *  people are told what changed rather than being reset. */
export async function updateEvent(groupId: string, eventId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("An event needs a title.");

  await requireUser();
  const supabase = await createClient();

  const when = String(formData.get("when") ?? "").trim();
  const patch: Record<string, unknown> = {
    title,
    location: String(formData.get("location") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
  if (when) patch.confirmed_time = fromInput(when);
  // An empty field clears the end rather than being ignored — that is how
  // a multi-day plan gets shortened back to a single evening.
  patch.ends_at = fromInput(formData.get("ends"));

  const { error } = await supabase.from("events").update(patch).eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/events/${eventId}`);
  revalidatePath(`/g/${groupId}`);
}
