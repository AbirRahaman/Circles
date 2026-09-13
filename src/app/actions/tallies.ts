"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const bump = (groupId: string, eventId: string) =>
  revalidatePath(`/g/${groupId}/events/${eventId}`);

/** Title is whatever the person types. No presets, no suggestions, no
 *  defaulting — the app supplies no vocabulary of its own here. */
export async function createTally(groupId: string, eventId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Give the tally a name.");
  if (title.length > 60) throw new Error("Keep the name under 60 characters.");

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_tallies")
    .insert({ event_id: eventId, title, created_by: user.id });
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

export async function deleteTally(groupId: string, eventId: string, tallyId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("event_tallies").delete().eq("id", tallyId);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

/** amount defaults to 1; a custom amount comes from the form. */
export async function logTally(groupId: string, eventId: string, tallyId: string, formData?: FormData) {
  const raw = String(formData?.get("amount") ?? "").trim();
  const amount = raw ? Number(raw) : 1;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount above zero.");

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tally_entries")
    .insert({ tally_id: tallyId, user_id: user.id, amount });
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

/** Undo is deleting your most recent row — the reason entries are rows. */
export async function undoTally(groupId: string, eventId: string, tallyId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("tally_entries")
    .select("id")
    .eq("tally_id", tallyId)
    .eq("user_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last) await supabase.from("tally_entries").delete().eq("id", last.id);
  bump(groupId, eventId);
}

/** Sitting out is presentational: it greys you and keeps every row you logged. */
export async function setTallyOptOut(groupId: string, eventId: string, tallyId: string, out: boolean) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("tally_participants").upsert(
    { tally_id: tallyId, user_id: user.id, opted_out_at: out ? new Date().toISOString() : null },
    { onConflict: "tally_id,user_id" }
  );
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}
