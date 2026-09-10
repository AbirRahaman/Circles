import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { confirmTime, cancelEvent, reopenVoting } from "@/app/actions/events";
import { addAlbumLink } from "@/app/actions/albums";
import { Card, Pill, Avatar, Note, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { VoteButtons } from "@/components/VoteButtons";
import { RsvpControl } from "@/components/RsvpControl";
import { fmtDay, fmtTime, fmtFull } from "@/lib/format";
import type { Profile, RsvpResponse, VoteResponse } from "@/lib/types";

export default async function EventPage({
  params,
}: { params: Promise<{ groupId: string; eventId: string }> }) {
  const { groupId, eventId } = await params;
  const { supabase, user, isAdmin } = await requireMembership(groupId);

  const { data: event } = await supabase
    .from("events")
    .select("*, event_time_options(id, proposed_time), event_rsvps(user_id, response)")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) notFound();

  const { data: memberRows } = await supabase
    .from("memberships")
    .select("user_id, profiles(id, name, avatar_url)")
    .eq("group_id", groupId)
    .eq("status", "active");

  const members: Profile[] = (memberRows ?? [])
    .map((m) => (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Profile)
    .filter(Boolean);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Someone who left";

  const options = [...(event.event_time_options ?? [])].sort(
    (a: { proposed_time: string }, b: { proposed_time: string }) => a.proposed_time.localeCompare(b.proposed_time)
  );

  const { data: votes } = options.length
    ? await supabase.from("event_votes").select("time_option_id, user_id, response").in("time_option_id", options.map((o) => o.id))
    : { data: [] as { time_option_id: string; user_id: string; response: VoteResponse }[] };

  const tally = (optionId: string) => {
    const rows = (votes ?? []).filter((v) => v.time_option_id === optionId);
    const yes = rows.filter((r) => r.response === "yes").length;
    const maybe = rows.filter((r) => r.response === "maybe").length;
    const no = rows.filter((r) => r.response === "no").length;
    return { yes, maybe, no, score: yes * 2 + maybe };
  };
  const myVote = (optionId: string) =>
    (votes ?? []).find((v) => v.time_option_id === optionId && v.user_id === user.id)?.response as VoteResponse | undefined;

  const best = options.length
    ? [...options].sort((a, b) => tally(b.id).score - tally(a.id).score || a.proposed_time.localeCompare(b.proposed_time))[0]
    : null;

  const answered = new Set((votes ?? []).map((v) => v.user_id));
  const rsvps = (event.event_rsvps ?? []) as { user_id: string; response: RsvpResponse }[];
  const myRsvp = rsvps.find((r) => r.user_id === user.id)?.response;
  const canManage = isAdmin || event.created_by === user.id;

  const { data: albums } = await supabase.from("album_links").select("*").eq("event_id", eventId);

  return (
    <>
      <Card className="p-3.5 flex flex-col gap-2.5">
        <h1 className="font-display font-extrabold text-[22px]">{event.title}</h1>
        <div className="flex flex-wrap gap-1.5">
          {event.status === "proposed" && <Pill tone="maybe" dot>Voting open</Pill>}
          {event.status === "confirmed" && <Pill tone="go" dot>Confirmed</Pill>}
          {event.status === "cancelled" && <Pill tone="no" dot>Cancelled</Pill>}
          {event.confirmed_time && <Pill><span className="font-mono">{fmtFull(event.confirmed_time)}</span></Pill>}
          {event.location && <Pill>{event.location}</Pill>}
        </div>
        {event.notes && <p className="text-[13.5px] text-ink-2">{event.notes}</p>}
        <p className="text-[12px] text-ink-2">Proposed by {nameOf(event.created_by)}</p>
      </Card>

      {event.status === "proposed" && (
        <>
          <Card className="p-3.5">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="font-display font-bold text-[15.5px]">Which time works?</h2>
              <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">tap to answer</span>
            </div>
            {options.map((o) => {
              const t = tally(o.id);
              const isBest = best?.id === o.id && t.yes + t.maybe > 0;
              return (
                <div key={o.id} className={`flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-b-0 ${isBest ? "bg-accent-soft -mx-2 px-2 rounded-lg border-transparent" : ""}`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-[14.5px]">
                      {fmtDay(o.proposed_time)}
                      <span className="font-normal text-ink-2"> · {fmtTime(o.proposed_time)}</span>
                    </span>
                    <span className="flex gap-2 font-mono text-[11.5px]">
                      <span className="text-go">{t.yes} yes</span>
                      <span className="text-maybe">{t.maybe} maybe</span>
                      <span className="text-ink-3">{t.no} no</span>
                      {isBest && <span className="text-accent">best so far</span>}
                    </span>
                  </div>
                  <VoteButtons groupId={groupId} eventId={eventId} optionId={o.id} mine={myVote(o.id)} />
                </div>
              );
            })}
          </Card>

          <Card className="p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-semibold">Who has answered</span>
              <span className="font-mono text-[12px] text-ink-2">{answered.size} / {members.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <span key={m.id} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] font-semibold ${answered.has(m.id) ? "bg-go-soft text-go" : "bg-surface-2 text-ink-2"}`}>
                  <Avatar id={m.id} name={m.name} size={17} />
                  {m.name}
                </span>
              ))}
            </div>
            {canManage ? (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Confirm a time</span>
                {options.map((o) => (
                  <form key={o.id} action={confirmTime.bind(null, groupId, eventId, o.id)}>
                    <SubmitButton variant="ghost" className="w-full" pendingLabel="Locking in…">
                      {fmtFull(o.proposed_time)}
                    </SubmitButton>
                  </form>
                ))}
                <p className="text-[12px] text-ink-2">
                  Everyone who said yes or maybe to that slot is carried over as an RSVP.
                </p>
              </div>
            ) : (
              <Note>{nameOf(event.created_by)} picks the final time once enough people have voted.</Note>
            )}
          </Card>
        </>
      )}

      {event.status === "confirmed" && (
        <>
          <Card className="p-3.5 flex flex-col gap-3">
            <h2 className="font-display font-bold text-[15.5px]">Are you coming?</h2>
            <RsvpControl groupId={groupId} eventId={eventId} mine={myRsvp} />
            <div className="flex flex-col gap-2">
              {([["going", "Going", "go"], ["maybe", "Maybe", "maybe"], ["not_going", "Out", "no"]] as const).map(([key, label, tone]) => {
                const list = rsvps.filter((r) => r.response === key);
                if (!list.length) return null;
                return (
                  <div key={key} className="flex items-start gap-2">
                    <Pill tone={tone}>{label} {list.length}</Pill>
                    <span className="text-[13.5px] flex-1">{list.map((r) => nameOf(r.user_id)).join(", ")}</span>
                  </div>
                );
              })}
              {members.filter((m) => !rsvps.some((r) => r.user_id === m.id)).length > 0 && (
                <div className="flex items-start gap-2">
                  <Pill>Silent</Pill>
                  <span className="text-[13.5px] text-ink-2 flex-1">
                    {members.filter((m) => !rsvps.some((r) => r.user_id === m.id)).map((m) => m.name).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-3.5 flex flex-col gap-3">
            <h2 className="font-display font-bold text-[15.5px]">Photos</h2>
            {(albums ?? []).map((a) => (
              <a key={a.id} href={a.icloud_share_url} target="_blank" rel="noopener" className="text-[13px] break-all text-accent">
                {a.icloud_share_url}
              </a>
            ))}
            <form action={addAlbumLink.bind(null, groupId)} className="flex flex-col gap-2.5">
              <input type="hidden" name="event_id" value={eventId} />
              <Field label="iCloud album link">
                <input name="url" type="url" placeholder="https://www.icloud.com/sharedalbum/…" required />
              </Field>
              <SubmitButton size="sm" variant="quiet" pendingLabel="Saving…">Save album link</SubmitButton>
            </form>
            <p className="text-[12px] text-ink-2">
              One reminder goes out a day after the event. Circles stores the link, never the photos.
            </p>
          </Card>
        </>
      )}

      {canManage && event.status !== "cancelled" && (
        <div className="flex gap-2">
          {event.status === "confirmed" && (
            <form action={reopenVoting.bind(null, groupId, eventId)} className="flex-1">
              <SubmitButton variant="ghost" size="sm" className="w-full">Reopen voting</SubmitButton>
            </form>
          )}
          <form action={cancelEvent.bind(null, groupId, eventId)} className="flex-1">
            <SubmitButton variant="danger" size="sm" className="w-full">Cancel event</SubmitButton>
          </form>
        </div>
      )}
    </>
  );
}
