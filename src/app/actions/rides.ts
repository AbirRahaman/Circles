"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fromInput } from "@/lib/format";

/** Fields shared by adding and editing a car. */
function carFields(formData: FormData) {
  const seats = Number(formData.get("seats"));
  if (!seats || seats < 1 || seats > 12) throw new Error("Seats must be between 1 and 12.");

  return {
    driver_id: String(formData.get("driver_id") ?? "").trim() || null,
    label: String(formData.get("label") ?? "").trim() || null,
    seats,
    leaving_from: String(formData.get("leaving_from") ?? "").trim() || null,
    leaves_at: fromInput(formData.get("leaves_at")),
    eta: fromInput(formData.get("eta")),
    note: String(formData.get("note") ?? "").trim() || null,
  };
}

export async function addCar(groupId: string, eventId: string, formData: FormData) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("event_cars").insert({ event_id: eventId, ...carFields(formData) });
  if (error) {
    throw new Error(
      error.code === "23505" ? "That person already has a car for this event." : error.message
    );
  }
  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

export async function updateCar(groupId: string, eventId: string, carId: string, formData: FormData) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("event_cars").update(carFields(formData)).eq("id", carId);
  if (error) {
    throw new Error(
      error.code === "23505" ? "That person already has a car for this event." : error.message
    );
  }
  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

export async function removeCar(groupId: string, eventId: string, carId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("event_cars").delete().eq("id", carId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

/** Seat someone. Nobody can be in two cars for the same event, so any
 *  earlier seat is vacated first — that is what stops two drivers both
 *  believing they have the same passenger. */
export async function addPassenger(groupId: string, eventId: string, carId: string, formData: FormData) {
  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId) throw new Error("Pick someone to add.");

  await requireUser();
  const supabase = await createClient();

  const { data: cars } = await supabase.from("event_cars").select("id").eq("event_id", eventId);
  const ids = (cars ?? []).map((c) => c.id);
  if (ids.length) {
    await supabase.from("car_passengers").delete().eq("user_id", userId).in("car_id", ids);
  }

  const { error } = await supabase.from("car_passengers").insert({ car_id: carId, user_id: userId });
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

/** Same move, bound to yourself, for the one-tap case. */
export async function takeSeat(groupId: string, eventId: string, carId: string) {
  const user = await requireUser();
  const fd = new FormData();
  fd.set("user_id", user.id);
  return addPassenger(groupId, eventId, carId, fd);
}

export async function removePassenger(groupId: string, eventId: string, carId: string, userId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("car_passengers")
    .delete()
    .eq("car_id", carId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
}
