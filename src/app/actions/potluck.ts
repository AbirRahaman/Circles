"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const bump = (groupId: string, eventId: string) => {
  revalidatePath(`/g/${groupId}/events/${eventId}`);
  revalidatePath(`/g/${groupId}`);
};

/** Add something you're bringing, or post an unclaimed item for someone
 *  else to pick up. If claimed_by is left empty, the item is unclaimed. */
export async function addPotluckItem(groupId: string, eventId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Give it a name.");

  const claimSelf = String(formData.get("claim_self") ?? "") === "on";

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("event_potluck").insert({
    event_id: eventId,
    title,
    note: String(formData.get("note") ?? "").trim() || null,
    claimed_by: claimSelf ? user.id : null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

/** Claim an unclaimed item — you're bringing it. */
export async function claimPotluckItem(groupId: string, eventId: string, itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  // Only claim if currently unclaimed.
  const { error } = await supabase
    .from("event_potluck")
    .update({ claimed_by: user.id })
    .eq("id", itemId)
    .is("claimed_by", null);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

/** Unclaim an item you previously claimed. */
export async function unclaimPotluckItem(groupId: string, eventId: string, itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  // Only the person who claimed it can unclaim it.
  const { error } = await supabase
    .from("event_potluck")
    .update({ claimed_by: null })
    .eq("id", itemId)
    .eq("claimed_by", user.id);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

/** Remove an item. The person who added it or claimed it can remove it,
 *  and so can the event creator or a group admin. */
export async function removePotluckItem(groupId: string, eventId: string, itemId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("event_potluck").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}
