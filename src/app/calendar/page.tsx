import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { rotateCalendarToken, disableCalendarFeed } from "@/app/actions/calendar";
import { Card, Empty, Note, Pill, SectionHead, Disclosure } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { TopBar } from "@/components/TopBar";
import { fmtDay, fmtTime, fmtRange, isUnderway, toInput, countdown } from "@/lib/format";

export const metadata = { title: "Calendar · Circles" };

export default async function CalendarPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("calendar_token").eq("id", user.id).single(),
    supabase.from("memberships").select("group_id").eq("user_id", user.id).eq("status", "active"),
  ]);

  const groupIds = (memberships ?? []).map((m) => m.group_id);

  // RLS would scope this anyway; the filter keeps the query small.
  const { data: rows } = groupIds.length
    ? await supabase
        .from("events")
        .select("id, group_id, title, location, status, confirmed_time, ends_at, friend_groups(name), event_rsvps(user_id, response)")
        .in("group_id", groupIds)
        .not("confirmed_time", "is", null)
        .neq("status", "cancelled")
        .order("confirmed_time")
    : { data: [] };

  const cutoff = Date.now();
  const upcoming = (rows ?? []).filter((e) => {
    const finish = e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.confirmed_time!).getTime() + 6 * 3_600_000;
    return finish >= cutoff;
  });

  // One heading per calendar day, in the group timezone.
  const days = new Map<string, typeof upcoming>();
  for (const e of upcoming) {
    const key = toInput(e.confirmed_time!).slice(0, 10);
    days.set(key, [...(days.get(key) ?? []), e]);
  }

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${h.get("host")}`;
  const feed = profile?.calendar_token ? `${origin}/api/calendar/${profile.calendar_token}` : null;

  return (
    <div className="shell">
      <TopBar title="Your calendar" sub={`${upcoming.length} coming up`} back="/groups" />
      <main className="flex-1 flex flex-col gap-5 px-3.5 py-4">
        {upcoming.length === 0 ? (
          <Empty title="Nothing on the horizon">
            Confirmed events from every group you&rsquo;re in show up here together.
          </Empty>
        ) : (
          [...days.entries()].map(([day, list]) => (
            <section key={day} className="flex flex-col gap-2.5">
              <SectionHead
                title={fmtDay(list[0].confirmed_time!)}
                right={<span className="text-[12.5px] text-ink-3">{countdown(list[0].confirmed_time!)}</span>}
              />
              <Card>
                {list.map((e) => {
                  const group = Array.isArray(e.friend_groups) ? e.friend_groups[0] : e.friend_groups;
                  const rsvps = (e.event_rsvps ?? []) as { user_id: string; response: string }[];
                  const mine = rsvps.find((r) => r.user_id === user.id)?.response;
                  return (
                    <Link
                      key={e.id}
                      href={`/g/${e.group_id}/events/${e.id}`}
                      className="block px-3.5 py-3 border-b border-line last:border-b-0 hover:bg-surface-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-[15.5px] truncate">{e.title}</span>
                        {isUnderway(e.confirmed_time, e.ends_at)
                          ? <Pill tone="accent" dot>Now</Pill>
                          : mine === "going" ? <Pill tone="go" dot>Going</Pill>
                          : mine === "maybe" ? <Pill tone="maybe" dot>Maybe</Pill>
                          : mine === "not_going" ? <Pill tone="no" dot>Out</Pill>
                          : <Pill dot>No answer</Pill>}
                      </div>
                      <div className="font-mono text-[12.5px] text-ink-2 mt-1">
                        {e.ends_at ? fmtRange(e.confirmed_time!, e.ends_at) : fmtTime(e.confirmed_time!)}
                        {e.location ? ` · ${e.location}` : ""}
                      </div>
                      <div className="text-[12px] text-ink-3 mt-0.5">{group?.name}</div>
                    </Link>
                  );
                })}
              </Card>
            </section>
          ))
        )}

        <section className="flex flex-col gap-2.5">
          <SectionHead title="Sync to your calendar app" />
          {feed ? (
            <Card className="p-3.5 flex flex-col gap-3">
              <p className="text-[13.5px]">
                Add this address to Google Calendar, Apple Calendar or Outlook once, and your
                groups&rsquo; events keep themselves up to date.
              </p>
              <code className="font-mono text-[11.5px] break-all bg-surface-2 rounded-md px-2.5 py-2">{feed}</code>
              <Note>
                <strong>Google Calendar:</strong> Other calendars → From URL. <strong>Apple:</strong> File →
                New Calendar Subscription. <strong>Outlook:</strong> Add calendar → Subscribe from web.
                Google refreshes on its own schedule, often several hours behind.
              </Note>
              <Note tone="warn">
                Anyone with this address can read your events without signing in. Don&rsquo;t post
                it anywhere public — rotate it below if it gets out.
              </Note>
              <Disclosure label="Feed settings">
                <div className="flex flex-col gap-2.5">
                  <form action={rotateCalendarToken}>
                    <SubmitButton variant="ghost" className="w-full" pendingLabel="Rotating…">
                      Rotate the address
                    </SubmitButton>
                  </form>
                  <p className="text-[12px] text-ink-2">
                    Rotating breaks every calendar already subscribed to the old address, including
                    your own. You&rsquo;d re-add the new one.
                  </p>
                  <form action={disableCalendarFeed}>
                    <SubmitButton variant="danger" className="w-full" pendingLabel="Turning off…">
                      Turn the feed off
                    </SubmitButton>
                  </form>
                </div>
              </Disclosure>
            </Card>
          ) : (
            <Card className="p-3.5 flex flex-col gap-3">
              <p className="text-[13.5px]">
                Generate a private address you can subscribe to from Google, Apple or Outlook
                Calendar. Events from every group you join appear automatically.
              </p>
              <form action={rotateCalendarToken}>
                <SubmitButton className="w-full" pendingLabel="Generating…">Turn on calendar sync</SubmitButton>
              </form>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
