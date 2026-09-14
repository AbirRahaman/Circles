"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

/** Name and picture are seeded from your sign-in provider once, then they
 *  belong to you — the signup trigger never overwrites an existing row. */
export async function updateProfile(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Your name can't be empty.");
  if (name.length > 40) throw new Error("Keep it under 40 characters.");

  const avatar = String(formData.get("avatar_url") ?? "").trim();
  if (avatar && !/^https:\/\//i.test(avatar)) throw new Error("A picture link must start with https://");

  const user = await requireUser();
  const supabase = await createClient();
  // RLS scopes this to your own row; the id filter is belt and braces.
  const { error } = await supabase
    .from("profiles")
    .update({ name, avatar_url: avatar || null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}

/** Whether other groups can see that you're busy. Days only, never what. */
export async function setShareBusy(share: boolean) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ share_busy: share }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
