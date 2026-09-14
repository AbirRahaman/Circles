"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fromInput } from "@/lib/format";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function createDateSearch(groupId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("What are you trying to arrange?");

  const start = String(formData.get("window_start") ?? "");
  const end = String(formData.get("window_end") ?? "");
  if (!DAY.test(start) || !DAY.test(end)) throw new Error("Set the window you're looking in.");
  if (end < start) throw new Error("The window ends before it starts.");

  const span = (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000;
  if (span > 60) throw new Error("Keep the window to 60 days or fewer — past that nobody answers honestly.");

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
      window_start: start,
      window_end: end,
    })
    .select("id")
    .single();
  if (error || !ev) throw new Error(error?.message ?? "Could not start the search.");

  revalidatePath(`/g/${groupId}`);
  redirect(`/g/${groupId}/events/${ev.id}`);
}

/** Your whole answer in one upsert. An empty submission means "any day works",
 *  which is a real answer and distinct from never having replied. */
export async function saveAvailability(groupId: string, eventId: string, formData: FormData) {
  const days = formData.getAll("unavailable").map(String).filter((d) => DAY.test(d));

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("event_availability").upsert(
    {
      event_id: eventId,
      user_id: user.id,
      unavailable: days,
      note: String(formData.get("note") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" }
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

/** Settling on a day turns the search into an ordinary confirmed event. */
export async function confirmFromWindow(groupId: string, eventId: string, formData: FormData) {
  const when = fromInput(formData.get("when"));
  if (!when) throw new Error("Pick a day and time.");
  const ends = fromInput(formData.get("ends"));
  if (ends && ends <= when) throw new Error("The end has to come after the start.");

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ status: "confirmed", confirmed_time: when, ends_at: ends })
    .eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/events/${eventId}`);
  revalidatePath(`/g/${groupId}`);
}
