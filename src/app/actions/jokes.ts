"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function addJoke(groupId: string, eventId: string, formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) throw new Error("Type the joke first.");
  if (text.length > 280) throw new Error("Keep it under 280 characters.");

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_jokes")
    .insert({ event_id: eventId, user_id: user.id, text });
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

export async function removeJoke(groupId: string, eventId: string, jokeId: string) {
  await requireUser();
  const supabase = await createClient();
  // RLS keeps this to your own entries.
  const { error } = await supabase.from("event_jokes").delete().eq("id", jokeId);
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/events/${eventId}`);
}
