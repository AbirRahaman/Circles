"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

/** Mints a feed token, or replaces the existing one. Replacing it breaks
 *  every calendar already subscribed, which is the point of rotating. */
export async function rotateCalendarToken() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error: genErr } = await supabase.rpc("new_calendar_token");
  if (genErr) throw new Error(genErr.message);

  const { error } = await supabase
    .from("profiles")
    .update({ calendar_token: data })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/calendar");
}

export async function disableCalendarFeed() {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ calendar_token: null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
}
