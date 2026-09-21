import { requireMembership, requireFeature } from "@/lib/auth";
import { addChore, markChoreDone, removeChore, undoChoreDone } from "@/app/actions/home";
import { Avatar, Card, Disclosure, Empty, Field, Pill, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { fetchMembers } from "@/lib/members";
import { fmtDate, groupToday } from "@/lib/format";
import { addDays, mondayOf, turnFor } from "@/lib/week";

export const metadata = { title: "Chores · Circles" };

type Chore = { id: string; title: string; rotation: string[]; start_week: string; created_by: string };
type Done = { id: string; chore_id: string; week_start: string; done_by: string; done_at: string };

export default async function ChoresTab({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase, user } = await requireMembership(groupId);
  await requireFeature(groupId, "chores");

  const week = mondayOf(groupToday());
  const lastWeek = addDays(week, -7);

  const [{ data: choreRows }, members] = await Promise.all([
    supabase
      .from("chores")
      .select("id, title, rotation, start_week, created_by")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("created_at"),
    fetchMembers(supabase, groupId),
  ]);
  const chores = (choreRows ?? []) as Chore[];

  const { data: doneRows } = chores.length
    ? await supabase
        .from("chore_completions")
        .select("id, chore_id, week_start, done_by, done_at")
        .in("chore_id", chores.map((c) => c.id))
        .in("week_start", [week, lastWeek])
        .is("deleted_at", null)
    : { data: [] as Done[] };
  const done = (doneRows ?? []) as Done[];

  const byId = new Map(members.map((m) => [m.id, m]));
  const first = (id: string | null) => (id ? byId.get(id)?.name.split(" ")[0] ?? "Someone" : "Nobody");

  // People who left drop out of the rotation automatically.
  const rota = (c: Chore) => c.rotation.filter((id) => byId.has(id));

  const cards = chores.map((c) => {
    const r = rota(c);
    const who = turnFor(r, c.start_week, week);
    const next = r.length > 1 ? turnFor(r, c.start_week, week, 1) : null;
    const doneNow = done.find((d) => d.chore_id === c.id && d.week_start === week);
    const lastWho = turnFor(r, c.start_week, lastWeek);
    const missedLast = c.start_week <= lastWeek && !done.some((d) => d.chore_id === c.id && d.week_start === lastWeek);
    return { c, r, who, next, doneNow, lastWho, missedLast };
  });

  // Your chores first, then undone ones, then done.
  cards.sort((a, b) =>
    Number(b.who === user.id) - Number(a.who === user.id) ||
    Number(!!a.doneNow) - Number(!!b.doneNow));

  const myOpen = cards.filter((x) => x.who === user.id && !x.doneNow).length;

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <SectionHead
          title={`Week of ${fmtDate(week)}`}
          right={<span className="text-[12.5px] text-ink-3">{myOpen ? `${myOpen} on you` : `${cards.filter((x) => x.doneNow).length}/${cards.length} done`}</span>}
        />
        {cards.length === 0 ? (
          <Empty title="No chores yet">Add one below and pick who takes turns. It rotates every Monday.</Empty>
        ) : (
          <Card>
            {cards.map(({ c, r, who, next, doneNow, lastWho, missedLast }) => {
              const who_ = who ? byId.get(who) : null;
              const mine = who === user.id;
              return (
                <div key={c.id} className="flex items-center gap-3 px-3.5 py-3 border-b border-line last:border-b-0">
                  {who_ ? <Avatar id={who_.id} name={who_.name} src={who_.avatar_url} size={34} /> : <div className="w-[34px]" />}
                  <div className="flex-1 min-w-0">
                    <div className={`text-[15px] font-semibold ${doneNow ? "line-through text-ink-3" : ""}`}>{c.title}</div>
                    <div className="text-[12.5px] text-ink-2 flex flex-wrap gap-x-2">
                      <span>{mine ? <strong className="text-ink">Your turn</strong> : `${first(who)}'s turn`}</span>
                      {next && <span className="text-ink-3">next: {next === user.id ? "you" : first(next)}</span>}
                      {missedLast && lastWho && <span className="text-no">skipped last week ({lastWho === user.id ? "you" : first(lastWho)})</span>}
                    </div>
                    {doneNow && (
                      <div className="text-[12px] text-ink-3 mt-0.5">
                        Done by {doneNow.done_by === user.id ? "you" : first(doneNow.done_by)}
                      </div>
                    )}
                  </div>
                  {doneNow ? (
                    <form action={undoChoreDone.bind(null, groupId, doneNow.id)}>
                      <SubmitButton size="sm" variant="quiet" pendingLabel="…">Undo</SubmitButton>
                    </form>
                  ) : (
                    <form action={markChoreDone.bind(null, groupId, c.id, week)}>
                      <SubmitButton size="sm" variant={mine ? "primary" : "ghost"} pendingLabel="…">Done</SubmitButton>
                    </form>
                  )}
                  {r.length === 0 && <Pill tone="no">No one left in rotation</Pill>}
                </div>
              );
            })}
          </Card>
        )}
      </section>

      <Disclosure label="Add a chore">
        <form action={addChore.bind(null, groupId)} className="flex flex-col gap-3">
          <Field label="Chore">
            <input name="title" required maxLength={60} placeholder="Take out trash" />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[12.5px] font-semibold text-ink-2 mb-1.5">Who takes turns</legend>
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2.5 text-[14px] cursor-pointer">
                <input type="checkbox" name="who" value={m.id} defaultChecked className="!w-4 h-4 accent-[var(--accent)]" />
                {m.id === user.id ? `${m.name} (you)` : m.name}
              </label>
            ))}
          </fieldset>
          <Field label="Who goes first">
            <select name="first" defaultValue={user.id}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.id === user.id ? `${m.name} (you)` : m.name}</option>)}
            </select>
          </Field>
          <SubmitButton className="w-full" pendingLabel="Adding…">Add chore</SubmitButton>
        </form>
      </Disclosure>

      {chores.length > 0 && (
        <Disclosure label="Remove a chore">
          <div className="flex flex-col gap-2">
            {chores.map((c) => (
              <form key={c.id} action={removeChore.bind(null, groupId, c.id)} className="flex items-center justify-between gap-3">
                <span className="text-[14px]">{c.title}</span>
                <SubmitButton size="sm" variant="danger" pendingLabel="Removing…">Remove</SubmitButton>
              </form>
            ))}
          </div>
        </Disclosure>
      )}
    </>
  );
}
