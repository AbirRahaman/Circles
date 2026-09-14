import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { rotateCalendarToken, disableCalendarFeed } from "@/app/actions/calendar";
import { Card, Note, SectionHead, Disclosure } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { TopBar } from "@/components/TopBar";
import { MonthCalendar, type CalEvent, type DayCell } from "@/components/MonthCalendar";
import { fmtTime, fmtRange, isUnderway, toInput, groupToday } from "@/lib/format";

export const metadata = { title: "Calendar · Circles" };

/* Date arithmetic on YYYY-MM-DD strings anchored at noon UTC — far enough
 * from either edge that adding days never lands on the wrong date. */
const addDays = (key: string, n: number) =>
  new Date(new Date(`${key}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();
const monthOf = (key: string) => key.slice(0, 7);

export default async function CalendarPage({
  searchParams,
}: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const today = groupToday();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : monthOf(today);
  const first = `${month}-01`;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("calendar_token").eq("id", user.id).single(),
    supabase.from("memberships").select("group_id").eq("user_id", user.id).eq("status", "active"),
  ]);
  const groupIds = (memberships ?? []).map((m) => m.group_id);

  // The grid shows leading and trailing days from the neighbouring months,
  // so fetch a fortnight either side of the month itself.
  const from = addDays(first, -14);
  const to = addDays(addDays(first, 45), 0);

  const { data: rows } = groupIds.length
    ? await supabase
        .from("events")
        .select("id, group_id, title, location, status, confirmed_time, ends_at, friend_groups(name), event_rsvps(user_id, response)")
        .in("group_id", groupIds)
        .not("confirmed_time", "is", null)
        .neq("status", "cancelled")
        .gte("confirmed_time", `${from}T00:00:00Z`)
        .lte("confirmed_time", `${to}T23:59:59Z`)
        .order("confirmed_time")
    : { data: [] };

  // A weekend away should darken every day it covers, not just the Friday.
  const byDate: Record<string, CalEvent[]> = {};
  for (const e of rows ?? []) {
    const group = Array.isArray(e.friend_groups) ? e.friend_groups[0] : e.friend_groups;
    const rsvps = (e.event_rsvps ?? []) as { user_id: string; response: string }[];
    const item: CalEvent = {
      id: e.id,
      groupId: e.group_id,
      title: e.title,
      groupName: group?.name ?? "",
      when: e.ends_at ? fmtRange(e.confirmed_time!, e.ends_at) : fmtTime(e.confirmed_time!),
      location: e.location,
      rsvp: rsvps.find((r) => r.user_id === user.id)?.response ?? null,
      underway: isUnderway(e.confirmed_time, e.ends_at),
    };

    const startKey = toInput(e.confirmed_time!).slice(0, 10);
    const endKey = e.ends_at ? toInput(e.ends_at).slice(0, 10) : startKey;
    let key = startKey;
    for (let guard = 0; guard < 31; guard++) {
      byDate[key] = [...(byDate[key] ?? []), item];
      if (key >= endKey) break;
      key = addDays(key, 1);
    }
  }

  // Six rows always, so the grid doesn't jump height between months.
  const gridStart = addDays(first, -weekdayOf(first));
  const cells: DayCell[] = Array.from({ length: 42 }, (_, i) => {
    const key = addDays(gridStart, i);
    return { key, day: Number(key.slice(8)), inMonth: monthOf(key) === month, isToday: key === today };
  });

  const selected = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "")
    ? sp.d!
    : monthOf(today) === month ? today : first;

  const label = new Date(`${first}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
  const prev = monthOf(addDays(first, -1));
  const next = monthOf(addDays(first, 40));

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${h.get("host")}`;
  const feed = profile?.calendar_token ? `${origin}/api/calendar/${profile.calendar_token}` : null;

  return (
    <div className="shell">
      <TopBar title="Your calendar" sub="every group, one view" back="/groups" />
      <main className="flex-1 flex flex-col gap-5 px-3.5 py-4">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 px-0.5">
            <h2 className="text-[17px] font-bold tracking-[-0.02em]">{label}</h2>
            <div className="flex gap-1">
              <Link href={`/calendar?m=${prev}`} aria-label="Previous month" className="w-9 h-9 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </Link>
              <Link href="/calendar" aria-label="This month" className="h-9 px-3 grid place-items-center rounded-lg text-[13px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
                Today
              </Link>
              <Link href={`/calendar?m=${next}`} aria-label="Next month" className="w-9 h-9 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </Link>
            </div>
          </div>

          <MonthCalendar cells={cells} byDate={byDate} initialSelected={selected} />
        </section>

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
                    <SubmitButton variant="ghost" className="w-full" pendingLabel="Rotating…">Rotate the address</SubmitButton>
                  </form>
                  <p className="text-[12px] text-ink-2">
                    Rotating breaks every calendar already subscribed to the old address, including
                    your own. You&rsquo;d re-add the new one.
                  </p>
                  <form action={disableCalendarFeed}>
                    <SubmitButton variant="danger" className="w-full" pendingLabel="Turning off…">Turn the feed off</SubmitButton>
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
