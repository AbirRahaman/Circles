"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { RsvpResponse, VoteResponse } from "@/lib/types";
import { fromInput, toInput } from "@/lib/format";

const addDays = (key: string, n: number) =>
  new Date(new Date(`${key}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** One way to make a plan. It is an outing or a trip, and it is either
 *  locked in or still being decided — nothing else branches. A pending plan
 *  gets a window around its proposed dates so the scheduling assistant has
 *  somewhere to look. */
export async function createPlan(groupId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("What are you planning?");

  const isTrip = String(formData.get("kind") ?? "outing") === "trip";
  const pending = String(formData.get("settled") ?? "yes") === "no";

  const when = fromInput(formData.get("when"));
  const ends = fromInput(formData.get("ends"));
  if (!when) throw new Error("Give it a date, even a rough one.");
  if (ends && ends <= when) throw new Error("The end has to come after the start.");
  if (isTrip && !ends) throw new Error("A trip needs an end date — that's what makes it a trip.");

  const budgetRaw = String(formData.get("budget_per_person") ?? "").trim();
  const budget = budgetRaw ? Number(budgetRaw) : null;
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    throw new Error("The budget should be a number, or left blank.");
  }

  const user = await requireUser();
  const supabase = await createClient();

  // A week before the proposal, two after: enough room to move it without
  // asking people to consider a month they'll never read.
  const anchor = toInput(when).slice(0, 10);
  const tail = toInput(ends ?? when).slice(0, 10);

  const { data: ev, error } = await supabase
    .from("events")
    .insert({
      group_id: groupId,
      created_by: user.id,
      kind: isTrip ? "trip" : "outing",
      title,
      location: String(formData.get("location") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      status: pending ? "proposed" : "confirmed",
      confirmed_time: when,
      ends_at: ends,
      budget_per_person: isTrip ? budget : null,
      window_start: pending ? addDays(anchor, -7) : null,
      window_end: pending ? addDays(tail, 14) : null,
    })
    .select("id")
    .single();
  if (error || !ev) throw new Error(error?.message ?? "Could not create the plan.");

  // Whoever puts it in is in.
  await supabase.from("event_rsvps").insert({ event_id: ev.id, user_id: user.id, response: "going" });

  revalidatePath(`/g/${groupId}`);
  redirect(`/g/${groupId}/events/${ev.id}`);
}

/** Turn a pending plan into a settled one, optionally moving the dates. */
export async function confirmPlan(groupId: string, eventId: string, formData: FormData) {
  const when = fromInput(formData.get("when"));
  if (!when) throw new Error("Pick the date you're locking in.");
  const ends = fromInput(formData.get("ends"));
  if (ends && ends <= when) throw new Error("The end has to come after the start.");

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ status: "confirmed", confirmed_time: when, ends_at: ends, window_start: null, window_end: null })
    .eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/events/${eventId}`);
  revalidatePath(`/g/${groupId}`);
}

/** Put a settled plan back in play — the dates stay as a starting point. */
export async function unconfirmPlan(groupId: string, eventId: string) {
  await requireUser();
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("confirmed_time, ends_at").eq("id", eventId).single();
  const anchor = toInput(ev?.confirmed_time ?? new Date().toISOString()).slice(0, 10);
  const tail = toInput(ev?.ends_at ?? ev?.confirmed_time ?? new Date().toISOString()).slice(0, 10);

  const { error } = await supabase
    .from("events")
    .update({ status: "proposed", window_start: addDays(anchor, -7), window_end: addDays(tail, 14) })
    .eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/events/${eventId}`);
  revalidatePath(`/g/${groupId}`);
}

/** Widen or narrow where the scheduling assistant looks. */
export async function setPlanWindow(groupId: string, eventId: string, formData: FormData) {
  const from = String(formData.get("window_start") ?? "");
  const to = String(formData.get("window_end") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Set both ends of the window.");
  }
  if (to < from) throw new Error("The window ends before it starts.");
  if ((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000 > 60) {
    throw new Error("Keep the window to 60 days or fewer.");
  }

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ window_start: from, window_end: to })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
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
