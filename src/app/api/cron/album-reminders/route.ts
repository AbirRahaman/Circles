import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/* Spec 4.2 step 3: one reminder per album, 24–48h after the event.
   Schedule it with a Vercel cron (see vercel.json) or Supabase pg_cron.
   Runs with the service role because no user is signed in. */

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { data: due, error } = await supabase.rpc("album_reminders_due");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sent: string[] = [];
  for (const row of due ?? []) {
    // TODO: deliver the push/email here — "Add your photos from {event_title}".
    // Until a notification provider is wired up, marking it sent is what makes
    // the in-app nudge disappear, which is the v1 behaviour.
    const { error: markErr } = await supabase
      .from("album_links")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", row.album_id);
    if (!markErr) sent.push(row.album_id);
  }

  return NextResponse.json({ due: (due ?? []).length, sent: sent.length });
}
