"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

import { fromInput as iso } from "@/lib/format";

export async function offerRide(groupId: string, eventId: string, formData: FormData) {
  const seats = Number(formData.get("seats"));
  if (!seats || seats < 1 || seats > 12) throw new Error("How many spare seats? Pick between 1 and 12.");

  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("event_cars").insert({
    event_id: eventId,
    driver_id: user.id,
    seats,
    leaving_from: String(formData.get("leaving_from") ?? "").trim() || null,
    leaves_at: iso(formData.get("leaves_at")),
    eta: iso(formData.get("eta")),
    note: String(formData.get("note") ?? "").trim() || null,
  });
  if (error) {
    throw new Error(
      error.code === "23505" ? "You have already offered a car for this event." : error.message
    );
  }

  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

export async function updateRide(groupId: string, eventId: string, carId: string, formData: FormData) {
  const seats = Number(formData.get("seats"));
  if (!seats || seats < 1 || seats > 12) throw new Error("Seats must be between 1 and 12.");

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_cars")
    .update({
      seats,
      leaving_from: String(formData.get("leaving_from") ?? "").trim() || null,
      leaves_at: iso(formData.get("leaves_at")),
      eta: iso(formData.get("eta")),
      note: String(formData.get("note") ?? "").trim() || null,
    })
    .eq("id", carId);
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

export async function cancelRide(groupId: string, eventId: string, carId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("event_cars").delete().eq("id", carId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

/** Claim a seat. You can only be in one car per event, so any earlier
 *  seat is given up first. */
export async function joinRide(groupId: string, eventId: string, carId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: cars } = await supabase.from("event_cars").select("id").eq("event_id", eventId);
  const ids = (cars ?? []).map((c) => c.id);
  if (ids.length) {
    await supabase.from("car_passengers").delete().eq("user_id", user.id).in("car_id", ids);
  }

  const { error } = await supabase.from("car_passengers").insert({ car_id: carId, user_id: user.id });
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

export async function leaveRide(groupId: string, eventId: string, carId: string, userId?: string) {
  const user = await requireUser();
  const supabase = await createClient();
  // RLS allows removing yourself, or the driver removing a passenger.
  const { error } = await supabase
    .from("car_passengers")
    .delete()
    .eq("car_id", carId)
    .eq("user_id", userId ?? user.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/events/${eventId}`);
}
