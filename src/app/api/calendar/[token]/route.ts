import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { buildIcs, type IcsEvent } from "@/lib/ics";

/* Calendar clients cannot authenticate, so the token in the URL is the
 * credential. It resolves to exactly one profile, and everything below is
 * filtered to that person's own active memberships — the service role is
 * used only because there is no session to run RLS against, never to widen
 * what is returned. */

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("calendar_token", token)
    .maybeSingle();
  if (!profile) return new NextResponse("Not found", { status: 404 });

  const { data: memberships } = await supabase
    .from("memberships")
    .select("group_id")
    .eq("user_id", profile.id)
    .eq("status", "active");

  const groupIds = (memberships ?? []).map((m) => m.group_id);
  if (groupIds.length === 0) {
    return ics(buildIcs("Circles", []));
  }

  // Six months back is enough history for a calendar client without
  // shipping the group's entire past on every poll.
  const since = new Date(Date.now() - 182 * 86_400_000).toISOString();

  const { data: rows } = await supabase
    .from("events")
    .select("id, title, location, notes, status, confirmed_time, ends_at, friend_groups(name)")
    .in("group_id", groupIds)
    .not("confirmed_time", "is", null)
    .gte("confirmed_time", since)
    .order("confirmed_time");

  const events: IcsEvent[] = (rows ?? []).map((e) => {
    const group = Array.isArray(e.friend_groups) ? e.friend_groups[0] : e.friend_groups;
    return {
      uid: `${e.id}@circles`,
      start: e.confirmed_time as string,
      end: e.ends_at,
      title: group?.name ? `${e.title} · ${group.name}` : e.title,
      location: e.location,
      description: e.notes,
      cancelled: e.status === "cancelled",
    };
  });

  return ics(buildIcs(`Circles · ${profile.name}`, events));
}

function ics(body: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="circles.ics"',
      // Personal, and clients poll on their own schedule anyway.
      "Cache-Control": "private, max-age=300",
    },
  });
}
