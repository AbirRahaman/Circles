import { requireMembership, requireFeature } from "@/lib/auth";
import { saveCheckin, clearCheckin } from "@/app/actions/checkins";
import { addQuote, removeQuote } from "@/app/actions/quotes";
import { Card, Avatar, Disclosure, Field, Note, SectionHead, Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { MOOD_LEVELS, moodLabel, moodTone } from "@/lib/mood";
import { fmtDate, groupToday } from "@/lib/format";
import type { Profile } from "@/lib/types";

type Checkin = {
  user_id: string;
  for_date: string;
  level: number;
  note: string | null;
  visibility: string;
};

type Quote = {
  id: string;
  for_date: string;
  text: string;
  said_by: string | null;
  added_by: string;
  created_at: string;
};

export default async function MoodTab({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase, user, isAdmin } = await requireMembership(groupId);
  await requireFeature(groupId, "checkin");
  const today = groupToday();

  const since = new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: memberRows }, { data: rows }, { data: quoteRows }] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, profiles(id, name, avatar_url)")
      .eq("group_id", groupId)
      .eq("status", "active"),
    // RLS returns other people's rows only where they chose to share.
    supabase
      .from("checkins")
      .select("user_id, for_date, level, note, visibility")
      .eq("group_id", groupId)
      .gte("for_date", since)
      .order("for_date", { ascending: false }),
    supabase
      .from("group_quotes")
      .select("id, for_date, text, said_by, added_by, created_at")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("for_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const members: Profile[] = (memberRows ?? [])
    .map((m) => (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Profile)
    .filter(Boolean);

  const checkins = (rows ?? []) as Checkin[];
  const mine = checkins.find((c) => c.user_id === user.id && c.for_date === today) ?? null;
  const myRecent = checkins.filter((c) => c.user_id === user.id).slice(0, 14);
  const todayOthers = members
    .filter((m) => m.id !== user.id)
    .map((m) => ({ m, c: checkins.find((c) => c.user_id === m.id && c.for_date === today) ?? null }));

  const answered = todayOthers.filter((x) => x.c).length;

  const nameOf = new Map(members.map((m) => [m.id, m.name.split(" ")[0]]));
  const quotes = (quoteRows ?? []) as Quote[];
  const todays = quotes.filter((q) => q.for_date === today);
  const past = quotes.filter((q) => q.for_date < today);
  // No quote yet today? Resurface an old one, the same one all day.
  const throwback = !todays.length && past.length
    ? past[[...today].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % past.length]
    : null;

  const quoteBlock = (q: Quote, big: boolean) => (
    <figure key={q.id} className="flex flex-col gap-1.5">
      <blockquote className={big ? "text-[18px] leading-snug font-semibold" : "text-[15px] leading-snug"}>
        &ldquo;{q.text}&rdquo;
      </blockquote>
      <figcaption className="flex items-center gap-2 text-[12.5px] text-ink-2">
        <span className="flex-1 min-w-0">
          {q.said_by && <span className="text-ink font-medium">— {q.said_by}</span>}
          <span className="text-ink-3">{q.said_by ? " · " : ""}posted by {q.added_by === user.id ? "you" : nameOf.get(q.added_by) ?? "someone"}</span>
        </span>
        {(q.added_by === user.id || isAdmin) && (
          <form action={removeQuote.bind(null, groupId, q.id)}>
            <button type="submit" className="text-[12px] text-ink-3 hover:text-ink">Remove</button>
          </form>
        )}
      </figcaption>
    </figure>
  );

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <SectionHead
          title="Quote of the day"
          right={todays.length > 1 ? <span className="text-[12.5px] text-ink-3">{todays.length} today</span> : null}
        />
        <Card className="p-3.5 flex flex-col gap-3.5">
          {todays.length > 0 ? (
            <>
              {quoteBlock(todays[0], true)}
              {todays.slice(1).map((q) => (
                <div key={q.id} className="border-t border-line pt-3">{quoteBlock(q, false)}</div>
              ))}
            </>
          ) : throwback ? (
            <>
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                Nothing yet today · from {fmtDate(throwback.for_date)}
              </span>
              {quoteBlock(throwback, true)}
            </>
          ) : (
            <p className="text-[14px] text-ink-2">No quote yet. Something someone said, a line you read — put it here.</p>
          )}
        </Card>
        <Disclosure label={todays.length ? "Add another quote" : "Add today's quote"}>
          <form action={addQuote.bind(null, groupId)} className="flex flex-col gap-3">
            <Field label="Quote">
              <textarea name="text" rows={2} maxLength={280} required />
            </Field>
            <Field label="Who said it (optional)">
              <input name="said_by" maxLength={60} />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Posting…">Post quote</SubmitButton>
          </form>
        </Disclosure>
        {past.length > 0 && (
          <Disclosure label={`Past quotes (${past.length})`}>
            <div className="flex flex-col gap-3.5">
              {past.slice(0, 30).map((q, i) => (
                <div key={q.id} className={i ? "border-t border-line pt-3 flex flex-col gap-1" : "flex flex-col gap-1"}>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{fmtDate(q.for_date)}</span>
                  {quoteBlock(q, false)}
                </div>
              ))}
            </div>
          </Disclosure>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHead title={mine ? "Today — checked in" : "How's today going?"} />
        <Card className="p-3.5">
          <form action={saveCheckin.bind(null, groupId)} className="flex flex-col gap-3.5">
            <div className="grid grid-cols-5 gap-1.5">
              {MOOD_LEVELS.map((label, i) => {
                const value = i + 1;
                const chosen = mine?.level === value;
                return (
                  <label
                    key={label}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border cursor-pointer text-[12px] font-semibold transition-colors ${
                      chosen
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line-strong text-ink-2 hover:bg-surface-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="level"
                      value={value}
                      defaultChecked={chosen}
                      required
                      className="sr-only w-0 h-0 p-0 border-0"
                    />
                    <span className="font-mono text-[15px] tabular-nums">{value}</span>
                    {label}
                  </label>
                );
              })}
            </div>

            <Field label="Anything to add (optional)">
              <input name="note" maxLength={280} defaultValue={mine?.note ?? ""} />
            </Field>

            <Field label="Who sees this">
              <select name="visibility" defaultValue={mine?.visibility ?? "group"}>
                <option value="group">The group</option>
                <option value="private">Just me</option>
              </select>
            </Field>

            <SubmitButton className="w-full" pendingLabel="Saving…">
              {mine ? "Update today" : "Check in"}
            </SubmitButton>
          </form>
        </Card>

        {mine && (
          <form action={clearCheckin.bind(null, groupId)}>
            <SubmitButton size="sm" variant="quiet" pendingLabel="Removing…">
              Remove today&rsquo;s check-in
            </SubmitButton>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHead
          title="The group today"
          right={<span className="text-[12.5px] text-ink-3">{answered} of {members.length - 1}</span>}
        />
        <Card>
          {todayOthers.map(({ m, c }) => (
            <div key={m.id} className="px-3.5 py-3 border-b border-line last:border-b-0 flex items-start gap-2.5">
              <Avatar id={m.id} name={m.name} src={m.avatar_url} size={28} />
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[14.5px] truncate">{m.name}</span>
                {c?.note && <span className="text-[12.5px] text-ink-2">{c.note}</span>}
              </div>
              {c
                ? <Pill tone={moodTone(c.level)}>{moodLabel(c.level)}</Pill>
                : <span className="text-[12.5px] text-ink-3">—</span>}
            </div>
          ))}
          {todayOthers.length === 0 && (
            <p className="px-3.5 py-3 text-[13.5px] text-ink-2">Nobody else in this group yet.</p>
          )}
        </Card>
        <Note>
          People only appear here when they chose to share. A check-in marked
          &ldquo;just me&rdquo; is invisible to everyone else, including admins — the database
          enforces that, not the screen.
        </Note>
      </section>

      {myRecent.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHead title="Your last two weeks" />
          <Card>
            {myRecent.map((c) => (
              <div key={c.for_date} className="px-3.5 py-2.5 border-b border-line last:border-b-0 flex items-center gap-3">
                <span className="font-mono text-[12.5px] text-ink-2 w-16 shrink-0">{fmtDate(c.for_date)}</span>
                <span className="flex-1 min-w-0 text-[13.5px] truncate text-ink-2">{c.note ?? ""}</span>
                {c.visibility === "private" && <span className="text-[11.5px] text-ink-3">private</span>}
                <Pill tone={moodTone(c.level)}>{moodLabel(c.level)}</Pill>
              </div>
            ))}
          </Card>
        </section>
      )}
    </>
  );
}
