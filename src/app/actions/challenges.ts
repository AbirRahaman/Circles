"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function createChallenge(groupId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Name the challenge.");

  const start = String(formData.get("start_date") ?? "");
  const end = String(formData.get("end_date") ?? "");
  if (!start || !end || end < start) throw new Error("Check the dates.");

  const user = await requireUser();
  const supabase = await createClient();
  const targetRaw = String(formData.get("target") ?? "").trim();

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      group_id: groupId,
      title,
      type: String(formData.get("type") ?? "custom"),
      unit: String(formData.get("unit") ?? "").trim() || "points",
      target: targetRaw ? Number(targetRaw) : null,
      target_mode: String(formData.get("target_mode") ?? "per_person"),
      start_date: start,
      end_date: end,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create the challenge.");

  revalidatePath(`/g/${groupId}/challenges`);
  redirect(`/g/${groupId}/challenges/${data.id}`);
}

export async function logEntry(groupId: string, challengeId: string, formData: FormData) {
  const amount = Number(formData.get("amount"));
  if (!amount || Number.isNaN(amount) || amount <= 0) throw new Error("Enter an amount above zero.");

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("challenge_entries").insert({
    challenge_id: challengeId,
    user_id: user.id,
    amount,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/challenges/${challengeId}`);
  revalidatePath(`/g/${groupId}/challenges`);
}
