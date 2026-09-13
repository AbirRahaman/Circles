import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth";
import { confirmTime, cancelEvent, reopenVoting, updateEvent } from "@/app/actions/events";
import { addAlbumLink } from "@/app/actions/albums";
import { addCar, updateCar, removeCar, addPassenger, takeSeat, removePassenger } from "@/app/actions/rides";
import { setBehavior, addCohost, removeCohost } from "@/app/actions/behavior";
import { addJoke, removeJoke } from "@/app/actions/jokes";
import { createTally, deleteTally, logTally, undoTally, setTallyOptOut } from "@/app/actions/tallies";
import { BEHAVIOR_LEVELS, levelLabel, levelTone } from "@/lib/behavior";
import { Card, Pill, Avatar, Note, Field, Disclosure, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { VoteButtons } from "@/components/VoteButtons";
import { RsvpControl } from "@/components/RsvpControl";
import { fmtDay, fmtTime, fmtFull, fmtRange, isUnderway, toInput, plusMinutes, fmtDuration, timeAgo, num } from "@/lib/format";
import type { Profile, RsvpResponse, VoteResponse } from "@/lib/types";

type Car = {
  id: string;
  driver_id: string | null;
  label: string | null;
  seats: number;
  leaving_from: string | null;
  leaves_at: string | null;
  eta: string | null;
  drive_minutes: number | null;
  note: string | null;
  car_passengers: { user_id: string }[] | null;
};

export default async function EventPage({
  params,
}: { params: Promise<{ groupId: string; eventId: string }> }) {
  const { groupId, eventId } = await params;
  const { supabase, user, isAdmin } = await requireMembership(groupId);

  // One wave. None of these depend on each other; only the vote lookup
  // below needs the event first, because it keys off its time options.
  const [
    { data: event },
    { data: memberRows },
    { data: albums },
    { data: carRows },
    { data: behaviorRows },
    { data: cohostRows },
    { data: jokeRows },
    { data: tallyRows },
    { data: tallyEntryRows },
    { data: tallyPaxRows },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("*, event_time_options(id, proposed_time), event_rsvps(user_id, response)")
      .eq("id", eventId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("user_id, profiles(id, name, avatar_url)")
      .eq("group_id", groupId)
      .eq("status", "active"),
    supabase.from("album_links").select("*").eq("event_id", eventId),
    supabase.from("event_cars").select("*, car_passengers(user_id)").eq("event_id", eventId),
    supabase.from("event_behavior").select("user_id, level, note, set_by, updated_at").eq("event_id", eventId),
    supabase.from("event_cohosts").select("user_id").eq("event_id", eventId),
    supabase.from("event_jokes").select("id, user_id, text, created_at").eq("event_id", eventId).order("created_at", { ascending: false }),
    supabase.from("event_tallies").select("id, title, created_by, created_at").eq("event_id", eventId).order("created_at"),
    supabase.from("tally_entries").select("tally_id, user_id, amount"),
    supabase.from("tally_participants").select("tally_id, user_id, opted_out_at"),
  ]);

  if (!event) notFound();

  const members: Profile[] = (memberRows ?? [])
    .map((m) => (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Profile)
    .filter(Boolean);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Someone who left";
  const faceOf = (id: string) => members.find((m) => m.id === id)?.avatar_url ?? null;

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

  const cars = (carRows ?? []) as Car[];
  const ratings = behaviorRows ?? [];
  const cohosts = (cohostRows ?? []).map((c) => c.user_id);
  const ratingFor = (id: string) => ratings.find((r) => r.user_id === id) ?? null;
  const ownsEvent = event.created_by === user.id || isAdmin;
  const canRate = ownsEvent || cohosts.includes(user.id);
  const jokes = jokeRows ?? [];

  const tallies = tallyRows ?? [];
  const tallyIds = new Set(tallies.map((t) => t.id));
  // RLS already limits these to groups you belong to; narrow to this event.
  const tallyEntries = (tallyEntryRows ?? []).filter((e) => tallyIds.has(e.tally_id));
  const tallyPax = (tallyPaxRows ?? []).filter((p) => tallyIds.has(p.tally_id));

  const seatOf = (c: Car) => (c.car_passengers ?? []).map((p) => p.user_id);
  const inACar = new Set(cars.flatMap((c) => [c.driver_id, ...seatOf(c)]).filter(Boolean) as string[]);
  const drivers = new Set(cars.map((c) => c.driver_id).filter(Boolean) as string[]);
  const freeDrivers = members.filter((m) => !drivers.has(m.id));
  const going = rsvps.filter((r) => r.response === "going").map((r) => r.user_id);
  const strays = going.filter((id) => !inACar.has(id));

  return (
    <>
      <Card className="p-3.5 flex flex-col gap-2.5">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] leading-tight">{event.title}</h1>
        <div className="flex flex-wrap gap-1.5">
          {event.status === "proposed" && <Pill tone="maybe" dot>Voting open</Pill>}
          {event.status === "confirmed" && <Pill tone="go" dot>Confirmed</Pill>}
          {event.status === "cancelled" && <Pill tone="no" dot>Cancelled</Pill>}
          {isUnderway(event.confirmed_time, event.ends_at) && <Pill tone="accent" dot>Happening now</Pill>}
          {event.confirmed_time && <Pill><span className="font-mono">{fmtRange(event.confirmed_time, event.ends_at)}</span></Pill>}
          {event.location && <Pill>{event.location}</Pill>}
        </div>
        {event.notes && <p className="text-[13.5px] text-ink-2">{event.notes}</p>}
        <p className="text-[12.5px] text-ink-2">Proposed by {nameOf(event.created_by)}</p>
      </Card>

      {event.status !== "cancelled" && (
        <Disclosure label="Edit details">
          <form action={updateEvent.bind(null, groupId, eventId)} className="flex flex-col gap-3">
            <Field label="What is it"><input name="title" required maxLength={60} defaultValue={event.title} /></Field>
            <Field label="Where"><input name="location" maxLength={60} defaultValue={event.location ?? ""} /></Field>
            <Field label="Notes"><textarea name="notes" rows={3} defaultValue={event.notes ?? ""} /></Field>
            {event.status === "confirmed" && (
              <div className="flex gap-2.5">
                <span className="flex-1 min-w-0"><Field label="Starts"><input name="when" type="datetime-local" defaultValue={toInput(event.confirmed_time)} /></Field></span>
                <span className="flex-1 min-w-0"><Field label="Ends (optional)"><input name="ends" type="datetime-local" defaultValue={toInput(event.ends_at)} /></Field></span>
              </div>
            )}
            <SubmitButton className="w-full" pendingLabel="Saving…">Save changes</SubmitButton>
            {event.status === "confirmed" && (
              <p className="text-[12px] text-ink-2">
                Moving it keeps everyone&rsquo;s RSVPs — tell the group yourself if the time changed.
              </p>
            )}
          </form>
        </Disclosure>
      )}

      {event.status === "proposed" && (
        <>
          <Card className="p-3.5">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-2">Which time works?</h2>
              <span className="text-[12px] text-ink-3">tap to answer</span>
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
                <span key={m.id} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold ${answered.has(m.id) ? "bg-go-soft text-go" : "bg-surface-2 text-ink-2"}`}>
                  <Avatar id={m.id} name={m.name} src={m.avatar_url} size={17} />
                  {m.name}
                </span>
              ))}
            </div>
            {canManage ? (
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-3">Confirm a time</span>
                {options.map((o) => (
                  <form key={o.id} action={confirmTime.bind(null, groupId, eventId, o.id)}>
                    <SubmitButton variant="ghost" className="w-full" pendingLabel="Locking in…">
                      {fmtFull(o.proposed_time)}
                    </SubmitButton>
                  </form>
                ))}
                <p className="text-[12px] text-ink-2">Everyone who said yes or maybe to that slot is carried over as an RSVP.</p>
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
            <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-2">Are you coming?</h2>
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

          {/* ── Getting there ─────────────────────────────────────────── */}
          <section className="flex flex-col gap-2.5">
            <SectionHead
              title="Getting there"
              right={<span className="text-[12.5px] text-ink-3">{cars.length} car{cars.length === 1 ? "" : "s"}</span>}
            />

            {cars.length > 0 && (
              <Card>
                {cars.map((c) => {
                  const pax = seatOf(c);
                  const free = c.seats - pax.length;
                  const iAmAboard = pax.includes(user.id);
                  const canSeat = members.filter((m) => !pax.includes(m.id) && !drivers.has(m.id));
                  return (
                    <div key={c.id} className="px-3.5 py-3 border-b border-line last:border-b-0 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex items-center gap-2 min-w-0">
                          {c.driver_id
                            ? <Avatar id={c.driver_id} name={nameOf(c.driver_id)} src={faceOf(c.driver_id)} size={30} />
                            : <span className="w-[30px] h-[30px] rounded-full border border-dashed border-line-strong shrink-0" />}
                          <span className="flex flex-col min-w-0">
                            <span className="font-semibold text-[14.5px] truncate">
                              {c.driver_id ? `${nameOf(c.driver_id)} driving` : "No driver yet"}
                            </span>
                            <span className="text-[12.5px] text-ink-2 truncate">
                              {[c.label, c.leaving_from && `from ${c.leaving_from}`].filter(Boolean).join(" · ") || "pickup point TBC"}
                            </span>
                          </span>
                        </span>
                        {free > 0
                          ? <Pill tone="go">{free} seat{free === 1 ? "" : "s"} free</Pill>
                          : <Pill tone="no">Full</Pill>}
                      </div>

                      {(() => {
                        const derived = !c.eta && c.leaves_at && c.drive_minutes
                          ? plusMinutes(c.leaves_at, c.drive_minutes) : null;
                        const arrival = c.eta ?? derived;
                        const leaveNow = !arrival && c.drive_minutes
                          ? plusMinutes(new Date().toISOString(), c.drive_minutes) : null;
                        if (!c.leaves_at && !arrival && !leaveNow) return null;
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-4 flex-wrap font-mono text-[12.5px] text-ink-2">
                              {c.leaves_at && <span>leaves {fmtTime(c.leaves_at)}</span>}
                              {c.drive_minutes && <span>{fmtDuration(c.drive_minutes)} drive</span>}
                              {arrival && (
                                <span className="text-ink">
                                  ETA {fmtTime(arrival)}{derived ? " (est.)" : ""}
                                </span>
                              )}
                            </div>
                            {leaveNow && (
                              <span className="text-[12.5px] text-accent">
                                Leave now and you&rsquo;d get there around {fmtTime(leaveNow)}.
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {c.note && <p className="text-[12.5px] text-ink-2">{c.note}</p>}

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {pax.length ? pax.map((pid) => (
                          <span key={pid} className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-[12px]">
                            <Avatar id={pid} name={nameOf(pid)} src={faceOf(pid)} size={17} />
                            {nameOf(pid)}
                            <form action={removePassenger.bind(null, groupId, eventId, c.id, pid)}>
                              <button type="submit" aria-label={`Remove ${nameOf(pid)}`} className="text-ink-3 hover:text-no leading-none">×</button>
                            </form>
                          </span>
                        )) : <span className="text-[12.5px] text-ink-3">No passengers yet</span>}
                      </div>

                      {free > 0 && canSeat.length > 0 && (
                        <form action={addPassenger.bind(null, groupId, eventId, c.id)} className="flex gap-2 items-center">
                          <select name="user_id" defaultValue="" className="flex-1 min-w-0 text-[13.5px] py-1.5">
                            <option value="" disabled>Add someone…</option>
                            {canSeat.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                          <SubmitButton size="sm" variant="quiet" pendingLabel="Adding…">Add</SubmitButton>
                        </form>
                      )}

                      <div className="flex gap-2 flex-wrap items-center">
                        {!iAmAboard && c.driver_id !== user.id && free > 0 && (
                          <form action={takeSeat.bind(null, groupId, eventId, c.id)}>
                            <SubmitButton size="sm" pendingLabel="Claiming…">I&rsquo;ll ride here</SubmitButton>
                          </form>
                        )}
                        <details className="w-full">
                          <summary className="text-[12.5px] text-accent cursor-pointer list-none [&::-webkit-details-marker]:hidden">Edit this car</summary>
                          <div className="pt-2.5 flex flex-col gap-2.5">
                            <form action={updateCar.bind(null, groupId, eventId, c.id)} className="flex flex-col gap-2.5">
                  <div className="flex gap-2.5">
                    <span className="flex-1 min-w-0">
                      <Field label="Driver">
                        <select name="driver_id" defaultValue={c.driver_id ?? ""}>
                          <option value="">Not decided yet</option>
                          {members.filter((m) => !drivers.has(m.id) || m.id === c.driver_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </Field>
                    </span>
                    <span className="w-20 shrink-0"><Field label="Seats"><input name="seats" type="number" min="1" max="12" required defaultValue={c.seats} /></Field></span>
                  </div>
                  <Field label="Car name (optional)"><input name="label" maxLength={40} placeholder="The van" defaultValue={c.label ?? ""} /></Field>
                  <Field label="Leaving from"><input name="leaving_from" maxLength={40} placeholder="Bed-Stuy" defaultValue={c.leaving_from ?? ""} /></Field>
                  <div className="flex gap-2.5">
                    <span className="flex-1 min-w-0"><Field label="Leaves"><input name="leaves_at" type="datetime-local" defaultValue={toInput(c.leaves_at)} /></Field></span>
                    <span className="flex-1 min-w-0"><Field label="ETA (optional)"><input name="eta" type="datetime-local" defaultValue={toInput(c.eta)} /></Field></span>
                  </div>
                  <Field label="Drive time in minutes">
                    <input name="drive_minutes" type="number" min="1" max="2880" placeholder="45" defaultValue={c.drive_minutes ?? ""} />
                  </Field>
                  <Field label="Note (optional)"><input name="note" maxLength={80} placeholder="Room for one bag each" defaultValue={c.note ?? ""} /></Field>
                              <SubmitButton size="sm" pendingLabel="Saving…">Save car</SubmitButton>
                            </form>
                            <form action={removeCar.bind(null, groupId, eventId, c.id)}>
                              <SubmitButton size="sm" variant="danger" pendingLabel="Removing…">Remove this car</SubmitButton>
                            </form>
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}

            {strays.length > 0 && (
              <Note>
                <strong>No ride yet:</strong> {strays.map((id) => nameOf(id)).join(", ")}
              </Note>
            )}

            <Disclosure label="Add a car">
              <form action={addCar.bind(null, groupId, eventId)} className="flex flex-col gap-3">
                  <div className="flex gap-2.5">
                    <span className="flex-1 min-w-0">
                      <Field label="Driver">
                        <select name="driver_id" defaultValue={""}>
                          <option value="">Not decided yet</option>
                          {freeDrivers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </Field>
                    </span>
                    <span className="w-20 shrink-0"><Field label="Seats"><input name="seats" type="number" min="1" max="12" required defaultValue={3} /></Field></span>
                  </div>
                  <Field label="Car name (optional)"><input name="label" maxLength={40} placeholder="The van" /></Field>
                  <Field label="Leaving from"><input name="leaving_from" maxLength={40} placeholder="Bed-Stuy" /></Field>
                  <div className="flex gap-2.5">
                    <span className="flex-1 min-w-0"><Field label="Leaves"><input name="leaves_at" type="datetime-local" defaultValue={""} /></Field></span>
                    <span className="flex-1 min-w-0"><Field label="ETA (optional)"><input name="eta" type="datetime-local" defaultValue={""} /></Field></span>
                  </div>
                  <Field label="Drive time in minutes">
                    <input name="drive_minutes" type="number" min="1" max="2880" placeholder="45" />
                  </Field>
                  <Field label="Note (optional)"><input name="note" maxLength={80} placeholder="Room for one bag each" /></Field>
                <SubmitButton className="w-full" pendingLabel="Adding…">Add the car</SubmitButton>
              </form>
            </Disclosure>
          </section>

          {/* ── Tallies ───────────────────────────────────────────────── */}
          <section className="flex flex-col gap-2.5">
            <SectionHead
              title="Tallies"
              right={tallies.length > 0 ? <span className="text-[12.5px] text-ink-3">{tallies.length}</span> : null}
            />

            {tallies.map((t) => {
              const rows = tallyEntries.filter((e) => e.tally_id === t.id);
              const pax = tallyPax.filter((p) => p.tally_id === t.id);
              const total = rows.reduce((a, e) => a + Number(e.amount), 0);
              const subtotal = (id: string) =>
                rows.filter((e) => e.user_id === id).reduce((a, e) => a + Number(e.amount), 0);

              const shown = members.filter(
                (m) => rows.some((e) => e.user_id === m.id) || pax.some((p) => p.user_id === m.id)
              );
              const mine = subtotal(user.id);
              const iAmOut = !!pax.find((p) => p.user_id === user.id)?.opted_out_at;

              return (
                <Card key={t.id} className="p-3.5 flex flex-col gap-4">
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-3 truncate">
                        {t.title}
                      </span>
                      <span className="font-mono text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums">
                        {num(total)}
                      </span>
                    </div>
                    {(t.created_by === user.id || ownsEvent) && (
                      <form action={deleteTally.bind(null, groupId, eventId, t.id)}>
                        <button type="submit" aria-label={`Delete ${t.title}`} className="text-[12.5px] text-ink-3 hover:text-no">
                          Remove
                        </button>
                      </form>
                    )}
                  </div>

                  {iAmOut ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[13.5px] text-ink-2">
                        You&rsquo;re sitting this one out. Your {num(mine)} stays counted.
                      </p>
                      <form action={setTallyOptOut.bind(null, groupId, eventId, t.id, false)}>
                        <SubmitButton variant="ghost" className="w-full" pendingLabel="Joining…">Join back in</SubmitButton>
                      </form>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <form action={logTally.bind(null, groupId, eventId, t.id)} className="flex-1">
                          <SubmitButton className="w-full" pendingLabel="Adding…">+1</SubmitButton>
                        </form>
                        {mine > 0 && (
                          <form action={undoTally.bind(null, groupId, eventId, t.id)}>
                            <SubmitButton variant="ghost" pendingLabel="Undoing…">Undo</SubmitButton>
                          </form>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <form action={logTally.bind(null, groupId, eventId, t.id)} className="flex gap-2 items-center flex-1">
                          <input
                            name="amount"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Other amount"
                            className="flex-1 min-w-0 text-[13.5px] py-1.5"
                          />
                          <SubmitButton size="sm" variant="quiet" pendingLabel="Adding…">Add</SubmitButton>
                        </form>
                        <form action={setTallyOptOut.bind(null, groupId, eventId, t.id, true)}>
                          <button type="submit" className="text-[12.5px] text-ink-3 hover:text-ink whitespace-nowrap">
                            Sit out
                          </button>
                        </form>
                      </div>
                    </div>
                  )}

                  {shown.length > 0 && (
                    <div className="flex flex-col">
                      {shown.map((m) => {
                        const isOut = !!pax.find((p) => p.user_id === m.id)?.opted_out_at;
                        return (
                          <div
                            key={m.id}
                            className={`flex items-center gap-2.5 py-2 border-t border-line first:border-t-0 ${isOut ? "opacity-50" : ""}`}
                          >
                            <Avatar id={m.id} name={m.name} src={m.avatar_url} size={26} />
                            <span className={`flex-1 text-[14px] truncate ${m.id === user.id ? "font-semibold" : ""}`}>
                              {m.name}{m.id === user.id ? " (you)" : ""}
                              {isOut && <span className="text-ink-3 font-normal"> · sitting out</span>}
                            </span>
                            <span className="font-mono text-[15px] tabular-nums">{num(subtotal(m.id))}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}

            <Disclosure label={tallies.length ? "Add another tally" : "Start a tally"}>
              <form action={createTally.bind(null, groupId, eventId)} className="flex flex-col gap-3">
                <Field label="What are you counting">
                  <input name="title" required maxLength={60} />
                </Field>
                <SubmitButton className="w-full" pendingLabel="Creating…">Create tally</SubmitButton>
              </form>
            </Disclosure>
          </section>

          {/* ── Conduct ───────────────────────────────────────────────── */}
          <section className="flex flex-col gap-2.5">
            <SectionHead
              title="Behavior"
              right={<span className="text-[12.5px] text-ink-3">{ratings.length} rated</span>}
            />

            <Card>
              {members.map((m) => {
                const r = ratingFor(m.id);
                return (
                  <div key={m.id} className="px-3.5 py-3 border-b border-line last:border-b-0 flex flex-col gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar id={m.id} name={m.name} src={m.avatar_url} size={28} />
                      <span className="flex-1 text-[14.5px] truncate">
                        {m.name}{m.id === user.id ? " (you)" : ""}
                      </span>
                      {r
                        ? <Pill tone={levelTone(r.level)}>{levelLabel(r.level)}</Pill>
                        : <span className="text-[12.5px] text-ink-3">unrated</span>}
                    </div>

                    {r?.note && <p className="text-[12.5px] text-ink-2 pl-[38px]">{r.note}</p>}

                    {canRate && (
                      <form action={setBehavior.bind(null, groupId, eventId, m.id)} className="flex gap-2 items-center pl-[38px]">
                        <select name="level" defaultValue={r ? String(r.level) : ""} className="flex-1 min-w-0 text-[13.5px] py-1.5">
                          <option value="">No rating</option>
                          {BEHAVIOR_LEVELS.map((label, i) => (
                            <option key={label} value={i + 1}>{i + 1}. {label}</option>
                          ))}
                        </select>
                        <SubmitButton size="sm" variant="quiet" pendingLabel="Saving…">Set</SubmitButton>
                      </form>
                    )}
                  </div>
                );
              })}
            </Card>

            {!canRate && (
              <Note>
                {nameOf(event.created_by)} runs the ratings for this event, along with anyone
                they&rsquo;ve made a co-host.
              </Note>
            )}

            {ownsEvent && (
              <Disclosure label="Who can rate">
                <div className="flex flex-col gap-3">
                  <p className="text-[12.5px] text-ink-2">
                    You can always rate, as the person who made this event. Co-hosts can rate
                    too, but can&rsquo;t appoint further co-hosts.
                  </p>

                  {cohosts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {cohosts.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-[12px]">
                          <Avatar id={id} name={nameOf(id)} src={faceOf(id)} size={17} />
                          {nameOf(id)}
                          <form action={removeCohost.bind(null, groupId, eventId, id)}>
                            <button type="submit" aria-label={`Remove ${nameOf(id)} as co-host`} className="text-ink-3 hover:text-no leading-none">×</button>
                          </form>
                        </span>
                      ))}
                    </div>
                  )}

                  {members.filter((m) => m.id !== event.created_by && !cohosts.includes(m.id)).length > 0 && (
                    <form action={addCohost.bind(null, groupId, eventId)} className="flex gap-2 items-center">
                      <select name="user_id" defaultValue="" className="flex-1 min-w-0 text-[13.5px] py-1.5">
                        <option value="" disabled>Add a co-host…</option>
                        {members
                          .filter((m) => m.id !== event.created_by && !cohosts.includes(m.id))
                          .map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <SubmitButton size="sm" pendingLabel="Adding…">Add</SubmitButton>
                    </form>
                  )}
                </div>
              </Disclosure>
            )}
          </section>

          {/* ── Quote book ────────────────────────────────────────────── */}
          <section className="flex flex-col gap-2.5">
            <SectionHead
              title="Inside jokes"
              right={jokes.length > 0 ? <span className="text-[12.5px] text-ink-3">{jokes.length}</span> : null}
            />

            <Card className="p-3.5">
              <form action={addJoke.bind(null, groupId, eventId)} className="flex gap-2 items-start">
                <input
                  name="text"
                  required
                  maxLength={280}
                  placeholder="Something someone said…"
                  className="flex-1 min-w-0"
                />
                <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
              </form>
            </Card>

            {jokes.length > 0 && (
              <Card>
                {jokes.map((j) => (
                  <div key={j.id} className="px-3.5 py-3 border-b border-line last:border-b-0 flex items-start gap-3">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <p className="text-[15px] leading-snug">{j.text}</p>
                      <span className="text-[12px] text-ink-3">
                        {nameOf(j.user_id)} · {timeAgo(j.created_at)}
                      </span>
                    </div>
                    {j.user_id === user.id && (
                      <form action={removeJoke.bind(null, groupId, eventId, j.id)}>
                        <button
                          type="submit"
                          aria-label="Delete this one"
                          className="text-ink-3 hover:text-no text-[15px] leading-none pt-0.5"
                        >
                          ×
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </section>

          <Card className="p-3.5 flex flex-col gap-3">
            <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-2">Photos</h2>
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
