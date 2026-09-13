"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { MOOD_LEVELS } from "@/lib/mood";
import { groupToday } from "@/lib/format";

export async function saveCheckin(groupId: string, formData: FormData) {
  const level = Number(formData.get("level"));
  if (!Number.isInteger(level) || level < 1 || level > MOOD_LEVELS.length) {
    throw new Error("Pick how the day's going.");
  }

  const note = String(formData.get("note") ?? "").trim();
  if (note.length > 280) throw new Error("Keep the note under 280 characters.");

  const visibility = String(formData.get("visibility") ?? "group") === "private" ? "private" : "group";

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("checkins").upsert(
    {
      group_id: groupId,
      user_id: user.id,
      for_date: groupToday(),
      level,
      note: note || null,
      visibility,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "group_id,user_id,for_date" }
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/mood`);
}

export async function clearCheckin(groupId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("checkins")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("for_date", groupToday());
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/mood`);
}
