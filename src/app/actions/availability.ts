"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fromInput } from "@/lib/format";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Your whole answer in one upsert. An empty submission means "any day works",
 *  which is a real answer and distinct from never having replied. */
export async function saveAvailability(groupId: string, eventId: string, formData: FormData) {
  const days = formData.getAll("unavailable").map(String).filter((d) => DAY.test(d));

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("event_availability").upsert(
    {
      event_id: eventId,
      user_id: user.id,
      unavailable: days,
      note: String(formData.get("note") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" }
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

