"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth";

// ── Authenticated actions (group members) ────────────────────────────

export async function createInviteLink(groupId: string, eventId: string) {
  const { supabase } = await requireMembership(groupId);

  // Check if one already exists
  const { data: existing } = await supabase
    .from("event_invite_links")
    .select("token, active")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    // Reactivate if it was revoked
    if (!existing.active) {
      await supabase
        .from("event_invite_links")
        .update({ active: true })
        .eq("event_id", eventId);
    }
    revalidatePath(`/g/${groupId}/events/${eventId}`);
    return existing.token;
  }

  const token = nanoid(8);
  const { error } = await supabase.from("event_invite_links").insert({
    event_id: eventId,
    token,
    created_by: (await supabase.auth.getUser()).data.user!.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/g/${groupId}/events/${eventId}`);
  return token;
}

export async function revokeInviteLink(groupId: string, eventId: string) {
  const { supabase } = await requireMembership(groupId);

  const { error } = await supabase
    .from("event_invite_links")
    .update({ active: false })
    .eq("event_id", eventId);

  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/events/${eventId}`);
}

// ── Public actions (no auth required) ────────────────────────────────

export async function getOrCreateGuestToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get("socius_guest")?.value;
  if (existing) return existing;

  const token = nanoid(16);
  cookieStore.set("socius_guest", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
  return token;
}

export async function guestRsvp(inviteToken: string, _prev: unknown, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const contact = (formData.get("contact") as string)?.trim() || null;
  const status = formData.get("status") as string;

  if (!name) return { error: "Name is required" };
  if (!["going", "maybe", "declined"].includes(status)) {
    return { error: "Invalid status" };
  }

  const supabase = await createClient();

  // Look up the invite link to find the event
  const { data: result } = await supabase.rpc("get_event_by_invite_token", {
    invite_token: inviteToken,
  });

  if (!result || !result.invite_link?.active) {
    return { error: "This invite link is no longer active" };
  }

  const eventId = result.invite_link.event_id;
  const guestToken = await getOrCreateGuestToken();

  // Upsert the RSVP
  const { error } = await supabase.from("event_guest_rsvps").upsert(
    {
      event_id: eventId,
      name,
      contact,
      status,
      guest_token: guestToken,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,guest_token" }
  );

  if (error) return { error: error.message };

  revalidatePath(`/e/${inviteToken}`);
  return { success: true };
}
