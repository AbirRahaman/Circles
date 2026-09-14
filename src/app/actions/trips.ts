"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fromInput } from "@/lib/format";

const bump = (groupId: string, eventId: string) => {
  revalidatePath(`/g/${groupId}/events/${eventId}`);
  revalidatePath(`/g/${groupId}`);
};

const optionalMoney = (v: FormDataEntryValue | null, label: string) => {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} should be a number, or left blank.`);
  return n;
};

export async function setTripBudget(groupId: string, eventId: string, formData: FormData) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ budget_per_person: optionalMoney(formData.get("budget_per_person"), "The budget") })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

export async function addTripItem(groupId: string, eventId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Give it a name.");

  const url = String(formData.get("url") ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) throw new Error("A link must start with http:// or https://");

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("trip_items").insert({
    event_id: eventId,
    kind: String(formData.get("kind") ?? "other"),
    status: String(formData.get("status") ?? "idea"),
    title,
    detail: String(formData.get("detail") ?? "").trim() || null,
    url: url || null,
    starts_at: fromInput(formData.get("starts_at")),
    cost: optionalMoney(formData.get("cost"), "The cost"),
    per_person: String(formData.get("per_person") ?? "") === "on",
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

/** Flipping an idea to booked is the one edit people make constantly, so it
 *  is its own action rather than a trip through the whole form. */
export async function setTripItemStatus(groupId: string, eventId: string, itemId: string, status: "idea" | "booked") {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("trip_items").update({ status }).eq("id", itemId);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

export async function removeTripItem(groupId: string, eventId: string, itemId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("trip_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}
