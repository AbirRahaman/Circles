import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { createPlan } from "@/app/actions/events";
import { Card, Field, Note } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { inputFor, groupToday } from "@/lib/format";
import { fetchBusyDays } from "@/lib/busy";

const addDay = (key: string, n: number) =>
  new Date(new Date(`${key}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export default async function NewPlanPage({
  params, searchParams,
}: { params: Promise<{ groupId: string }>; searchParams: Promise<{ d?: string }> }) {
  const { groupId } = await params;
  const sp = await searchParams;
  const { supabase } = await requireMembership(groupId);

  const today = groupToday();
  const horizon = addDay(today, 41);

  // Who already has something on, across every group they're in. Days only —
  // the function behind this can't reveal what, or with whom.
  const { data: memberRows } = await supabase
    .from("memberships")
    .select("user_id, profiles(id, name)")
    .eq("group_id", groupId)
    .eq("status", "active");

  const people = (memberRows ?? [])
    .map((m) => (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as { id: string; name: string })
    .filter(Boolean);

  const busyBy = await fetchBusyDays(supabase, people.map((p) => p.id), today, horizon);

  const busyCount = (day: string) =>
    people.filter((p) => busyBy.get(p.id)?.has(day)).length;

  const days = Array.from({ length: 42 }, (_, i) => addDay(today, i));
  const picked = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : null;
  const startDefault = picked ? `${picked}T19:00` : inputFor(7, 19);

  return (
    <>
      <h1 className="text-xl font-bold tracking-[-0.02em] px-0.5">Plan something</h1>

      <Card className="p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-2">Who&rsquo;s already busy</h2>
          <span className="text-[12.5px] text-ink-3">next 6 weeks</span>
        </div>
        <div className="-mx-1 overflow-x-auto">
          <div className="grid grid-rows-1 grid-flow-col gap-1 px-1 pb-1">
            {days.map((d) => {
              const n = busyCount(d);
              const isPicked = d === picked;
              const heavy = n > 0 && n >= Math.ceil(people.length / 2);
              return (
                <Link
                  key={d}
                  href={`/g/${groupId}/events/new?d=${d}`}
                  title={n === 0 ? "Everyone free" : `${n} of ${people.length} already have something on`}
                  className={`w-[38px] shrink-0 flex flex-col items-center gap-0.5 py-1.5 rounded-md border text-[11px] ${
                    isPicked ? "border-accent bg-accent-soft text-accent"
                    : heavy ? "border-no bg-no-soft text-no"
                    : n > 0 ? "border-maybe bg-maybe-soft text-maybe"
                    : "border-line-strong hover:bg-surface-2"
                  }`}
                >
                  <span className="text-[9px] uppercase leading-none opacity-70">
                    {new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).slice(0, 2)}
                  </span>
                  <span className="tabular-nums font-semibold leading-none">{Number(d.slice(8))}</span>
                  <span className="h-[9px] leading-none text-[9px] tabular-nums">{n > 0 ? n : ""}</span>
                </Link>
              );
            })}
          </div>
        </div>
        <p className="text-[12px] text-ink-2">
          The number is how many of the {people.length} already have a plan that day, across
          every group they&rsquo;re in — not just this one. Tap a day to start from it.
        </p>
      </Card>

      <Card className="p-3.5">
        <form action={createPlan.bind(null, groupId)} className="flex flex-col gap-3.5">
          <Field label="What is it">
            <input name="title" required maxLength={60} placeholder="Cabin weekend" />
          </Field>

          <div className="flex gap-2.5">
            <span className="flex-1 min-w-0">
              <Field label="Kind">
                <select name="kind" defaultValue="outing">
                  <option value="outing">An outing</option>
                  <option value="trip">A trip</option>
                </select>
              </Field>
            </span>
            <span className="flex-1 min-w-0">
              <Field label="Is it settled?">
                <select name="settled" defaultValue="yes">
                  <option value="yes">Locked in</option>
                  <option value="no">Still being decided</option>
                </select>
              </Field>
            </span>
          </div>

          <div className="flex gap-2.5">
            <span className="flex-1 min-w-0">
              <Field label="Starts"><input name="when" type="datetime-local" required defaultValue={startDefault} /></Field>
            </span>
            <span className="flex-1 min-w-0">
              <Field label="Ends"><input name="ends" type="datetime-local" /></Field>
            </span>
          </div>

          <Field label="Where (optional)">
            <input name="location" maxLength={60} placeholder="Mohonk, NY" />
          </Field>

          <Field label="Notes (optional)">
            <textarea name="notes" rows={3} placeholder="Who's driving, what to bring, why now…" />
          </Field>

          <Field label="Budget per person — trips only (optional)">
            <input name="budget_per_person" type="number" min="0" step="any" placeholder="250" />
          </Field>

          <SubmitButton pendingLabel="Saving…" className="w-full">Add it</SubmitButton>
        </form>
      </Card>

      <Note>
        <strong>Locked in</strong> records something you&rsquo;ve already agreed — RSVPs open
        straight away. <strong>Still being decided</strong> creates it as pending and opens the
        scheduling assistant on the plan, where everyone marks the days they can&rsquo;t do.
        The strip above is the first pass — existing commitments, known before anyone answers.
        The assistant on the plan is the second: people saying what actually works, which needs
        a plan to say it about.
      </Note>
    </>
  );
}
