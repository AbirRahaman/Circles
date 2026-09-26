"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { groupToday } from "@/lib/format";

export async function addQuote(groupId: string, formData: FormData) {
  const text = String(formData.get("text") ?? "").trim().replace(/^["“”]+|["“”]+$/g, "").trim();
  const saidBy = String(formData.get("said_by") ?? "").trim().replace(/^[-—–\s]+/, "");
  if (!text) throw new Error("Type the quote first.");
  if (text.length > 280) throw new Error("Keep the quote under 280 characters.");
  if (saidBy.length > 60) throw new Error("Keep the name under 60 characters.");

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("group_quotes").insert({
    group_id: groupId,
    for_date: groupToday(),
    text,
    said_by: saidBy || null,
    added_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/mood`);
}

export async function removeQuote(groupId: string, quoteId: string) {
  await requireUser();
  const supabase = await createClient();
  // RLS limits this to the poster or an admin.
  const { data, error } = await supabase
    .from("group_quotes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("group_id", groupId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Only whoever posted it, or an admin, can remove a quote.");
  revalidatePath(`/g/${groupId}/mood`);
}
