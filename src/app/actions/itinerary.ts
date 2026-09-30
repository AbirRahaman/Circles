"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fromInput } from "@/lib/format";

const bump = (groupId: string, eventId: string) => {
  revalidatePath(`/g/${groupId}/events/${eventId}`);
  revalidatePath(`/g/${groupId}`);
};

export async function addItineraryItem(groupId: string, eventId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Give it a name.");

  const startsAt = fromInput(formData.get("starts_at"));
  const endsAt = fromInput(formData.get("ends_at"));
  if (endsAt && startsAt && endsAt <= startsAt) {
    throw new Error("The end time has to come after the start.");
  }

  const user = await requireUser();
  const supabase = await createClient();

  // Position: put it at the end by default.
  const { data: last } = await supabase
    .from("event_itinerary")
    .select("position")
    .eq("event_id", eventId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? -1) + 1;

  const { error } = await supabase.from("event_itinerary").insert({
    event_id: eventId,
    title,
    starts_at: startsAt,
    ends_at: endsAt,
    location: String(formData.get("location") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    position,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

export async function updateItineraryItem(
  groupId: string,
  eventId: string,
  itemId: string,
  formData: FormData,
) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Give it a name.");

  const startsAt = fromInput(formData.get("starts_at"));
  const endsAt = fromInput(formData.get("ends_at"));
  if (endsAt && startsAt && endsAt <= startsAt) {
    throw new Error("The end time has to come after the start.");
  }

  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("event_itinerary")
    .update({
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      location: String(formData.get("location") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

export async function removeItineraryItem(groupId: string, eventId: string, itemId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("event_itinerary").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  bump(groupId, eventId);
}

export async function moveItineraryItem(
  groupId: string,
  eventId: string,
  itemId: string,
  direction: "up" | "down",
) {
  await requireUser();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("event_itinerary")
    .select("id, position")
    .eq("event_id", eventId)
    .order("position");

  if (!items || items.length < 2) return;

  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return;

  const a = items[idx];
  const b = items[swapIdx];

  // Swap positions.
  await Promise.all([
    supabase.from("event_itinerary").update({ position: b.position }).eq("id", a.id),
    supabase.from("event_itinerary").update({ position: a.position }).eq("id", b.id),
  ]);

  bump(groupId, eventId);
}
