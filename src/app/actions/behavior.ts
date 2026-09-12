"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { BEHAVIOR_LEVELS } from "@/lib/behavior";

const bump = (groupId: string, eventId: string) =>
  revalidatePath(`/g/${groupId}/events/${eventId}`);

/** An empty level clears the rating rather than being ignored. */
export async function setBehavior(groupId: string, eventId: string, subjectId: string, formData: FormData) {
  const raw = String(formData.get("level") ?? "").trim();
  const user = await requireUser();
  const supabase = await createClient();

  if (!raw) {
    const { error } = await supabase
      .from("event_behavior")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", subjectId);
    if (error) throw new Error(error.message);
    bump(groupId, eventId);
    return;
  }

  const level = Number(raw);
  if (!Number.isInteger(level) || level < 1 || level > BEHAVIOR_LEVELS.length) {
    throw new Error("That isn't one of the levels.");
  }

  // RLS decides whether you hold the pen; a forged request writes nothing.
  const { error } = await supabase.from("event_behavior").upsert(
    {
      event_id: eventId,
      user_id: subjectId,
      level,
      note: String(formData.get("note") ?? "").trim() || null,
      set_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" }
  );
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

export async function addCohost(groupId: string, eventId: string, formData: FormData) {
  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId) throw new Error("Pick someone.");

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_cohosts")
    .insert({ event_id: eventId, user_id: userId, added_by: user.id });
  if (error && error.code !== "23505") throw new Error(error.message);
  bump(groupId, eventId);
}

export async function removeCohost(groupId: string, eventId: string, userId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_cohosts")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}
