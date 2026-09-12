import { requireMembership } from "@/lib/auth";
import { markNudgeSent } from "@/app/actions/albums";
import { Card, Empty, SectionHead, LinkButton, Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { EventCard, type EventCardData } from "@/components/EventCard";
import { fmtDay, effectiveEnd } from "@/lib/format";
import type { Profile } from "@/lib/types";

export default async function PlansTab({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase, user } = await requireMembership(groupId);

  const [{ data: events }, { data: members }, { data: albums }] = await Promise.all([
    supabase.from("events").select("*, event_time_options(id), event_rsvps(user_id, response)").eq("group_id", groupId),
    supabase.from("memberships").select("user_id, profiles(id, name, avatar_url)").eq("group_id", groupId).eq("status", "active"),
    supabase.from("album_links").select("*, events(title, confirmed_time)").eq("group_id", groupId).is("reminder_sent_at", null),
  ]);

  const profiles = new Map<string, Profile>(
    (members ?? []).map((m) => {
      const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Profile;
      return [m.user_id, p];
    })
  );

  // Votes for the group's proposed events, so the cards can show progress.
  const proposedIds = (events ?? []).filter((e) => e.status === "proposed").map((e) => e.id);
  const optionIds = (events ?? []).flatMap((e) => (e.event_time_options ?? []).map((o: { id: string }) => o.id));
  const { data: votes } = optionIds.length
    ? await supabase.from("event_votes").select("time_option_id, user_id").in("time_option_id", optionIds)
    : { data: [] as { time_option_id: string; user_id: string }[] };

  const optionOwner = new Map<string, string>();
  (events ?? []).forEach((e) => (e.event_time_options ?? []).forEach((o: { id: string }) => optionOwner.set(o.id, e.id)));

  const voters = new Map<string, Set<string>>();
  (votes ?? []).forEach((v) => {
    const evId = optionOwner.get(v.time_option_id);
    if (!evId) return;
    if (!voters.has(evId)) voters.set(evId, new Set());
    voters.get(evId)!.add(v.user_id);
  });

  const cards: EventCardData[] = (events ?? []).map((e) => {
    const rsvps = (e.event_rsvps ?? []) as { user_id: string; response: string }[];
    const voted = voters.get(e.id) ?? new Set<string>();
    return {
      ...e,
      optionCount: (e.event_time_options ?? []).length,
      votedCount: voted.size,
      memberCount: profiles.size,
      iVoted: voted.has(user.id),
      myRsvp: rsvps.find((r) => r.user_id === user.id)?.response,
      going: rsvps.filter((r) => r.response === "going").map((r) => profiles.get(r.user_id)).filter(Boolean) as Profile[],
    };
  });

  const isPast = (e: EventCardData) => {
    if (e.status === "cancelled") return true;
    const finish = effectiveEnd(e.confirmed_time, e.ends_at);
    return finish !== null && finish <= Date.now();
  };
  const sortKey = (e: EventCardData) => e.confirmed_time ?? e.created_at;

  const upcoming = cards.filter((e) => !isPast(e)).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const past = cards.filter(isPast).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

  // A nudge is due 24h after the event, once, per spec 4.2.
  const due = (albums ?? []).filter((a) => {
    const ev = Array.isArray(a.events) ? a.events[0] : a.events;
    return ev?.confirmed_time && Date.now() - new Date(ev.confirmed_time).getTime() > 24 * 3600_000;
  });

  return (
    <>
      <SectionHead
        title="Upcoming"
        right={<LinkButton href={`/g/${groupId}/events/new`} size="sm">Plan something</LinkButton>}
      />
      {upcoming.length ? (
        <Card>{upcoming.map((e) => <EventCard key={e.id} groupId={groupId} event={e} />)}</Card>
      ) : (
        <Empty title="Nothing on the calendar">Propose a few times and let everyone vote.</Empty>
      )}

      {due.map((a) => {
        const ev = Array.isArray(a.events) ? a.events[0] : a.events;
        return (
          <Card key={a.id} className="p-3.5 flex flex-col gap-2.5">
            <Pill tone="accent">Reminder due</Pill>
            <p className="text-[13.5px]">
              “Add your photos from <strong>{ev?.title}</strong>” — the shared album has been
              sitting untouched since {ev?.confirmed_time ? fmtDay(ev.confirmed_time) : "the event"}.
            </p>
            <div className="flex gap-2">
              <form action={markNudgeSent.bind(null, groupId, a.id)}>
                <SubmitButton size="sm" pendingLabel="Sending…">Send the nudge</SubmitButton>
              </form>
              <a href={a.icloud_share_url} target="_blank" rel="noopener" className="px-3 py-1.5 text-[13px] font-semibold rounded-md border border-line-strong hover:bg-surface-2">
                Open album
              </a>
            </div>
          </Card>
        );
      })}

      {past.length > 0 && (
        <>
          <SectionHead title="Past" right={<span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">{past.length}</span>} />
          <Card>{past.slice(0, 8).map((e) => <EventCard key={e.id} groupId={groupId} event={e} />)}</Card>
        </>
      )}
    </>
  );
}
