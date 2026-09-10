"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function addAlbumLink(groupId: string, formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("Paste the full album link.");

  const user = await requireUser();
  const supabase = await createClient();
  const eventId = String(formData.get("event_id") ?? "") || null;

  const { error } = await supabase.from("album_links").insert({
    group_id: groupId,
    event_id: eventId,
    icloud_share_url: url,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/photos`);
  revalidatePath(`/g/${groupId}`);
}

/** Marks the one-time nudge as delivered. The cron route does this for real
 *  sends; this is the manual "send it now" path from the Plans tab. */
export async function markNudgeSent(groupId: string, albumId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("album_links")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", albumId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}`);
  revalidatePath(`/g/${groupId}/photos`);
}
