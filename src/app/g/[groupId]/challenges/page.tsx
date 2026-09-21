import Link from "next/link";
import { requireMembership, requireFeature } from "@/lib/auth";
import { createChallenge } from "@/app/actions/challenges";
import { Card, Disclosure, Empty, Field, Pill, ProgressBar, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { daysUntil, num } from "@/lib/format";

export default async function ChallengesTab({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase, user } = await requireMembership(groupId);
  await requireFeature(groupId, "challenges");

  const [{ data: challenges }, { data: memberRows }] = await Promise.all([
    supabase.from("challenges").select("*").eq("group_id", groupId).order("end_date"),
    supabase.from("memberships").select("user_id, profiles(id, name)").eq("group_id", groupId).eq("status", "active"),
  ]);

  const names = new Map<string, string>();
  (memberRows ?? []).forEach((m) => {
    const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as { id: string; name: string } | null;
    if (p) names.set(p.id, p.name);
  });
  const memberCount = names.size;

  const ids = (challenges ?? []).map((c) => c.id);
  const { data: totals } = ids.length
    ? await supabase.from("challenge_totals").select("*").in("challenge_id", ids)
    : { data: [] as { challenge_id: string; user_id: string; total: number }[] };

  const today = new Date().toISOString().slice(0, 10);
  const live = (challenges ?? []).filter((c) => c.end_date >= today);
  const closed = (challenges ?? []).filter((c) => c.end_date < today);

  const row = (c: (typeof live)[number], isClosed: boolean) => {
    const mine = (totals ?? []).filter((t) => t.challenge_id === c.id);
    const sum = mine.reduce((a, t) => a + Number(t.total), 0);
    const goal = c.target ? (c.target_mode === "group" ? c.target : c.target * Math.max(memberCount, 1)) : null;
    const pct = goal ? Math.round((sum / goal) * 100) : 0;
    const leader = [...mine].sort((a, b) => Number(b.total) - Number(a.total))[0];
    const mineTotal = mine.find((t) => t.user_id === user.id)?.total ?? 0;

    return (
      <Link key={c.id} href={`/g/${groupId}/challenges/${c.id}`} className="block px-3.5 py-3 border-b border-line last:border-b-0 hover:bg-surface-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-[15.5px]">{c.title}</span>
          {isClosed ? <Pill dot>Closed</Pill> : <Pill tone="accent"><span className="font-mono">{Math.max(0, daysUntil(`${c.end_date}T23:59:59`))}d left</span></Pill>}
        </div>
        {goal ? (
          <div className="flex flex-col gap-1.5 mt-2">
            <ProgressBar pct={pct} />
            <div className="flex justify-between font-mono text-[12px] text-ink-2">
              <span>{num(sum)} / {num(goal)} {c.unit}</span><span>{pct}%</span>
            </div>
          </div>
        ) : (
          <div className="font-mono text-[12px] text-ink-2 mt-1">{num(sum)} {c.unit} logged</div>
        )}
        <div className="flex gap-3 text-[12px] text-ink-2 mt-1.5">
          <span>
            {leader
              ? <>Leading: <strong className="text-ink">{names.get(leader.user_id) ?? "—"}</strong> {num(Number(leader.total))} {c.unit}</>
              : "No entries yet"}
          </span>
          <span className="font-mono">you {num(Number(mineTotal))}</span>
        </div>
      </Link>
    );
  };

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <SectionHead
          title="Active"
          right={<span className="text-[12.5px] text-ink-3 tabular">{live.length}</span>}
        />
        {live.length ? <Card>{live.map((c) => row(c, false))}</Card> : (
          <Empty title="No challenges running">Miles, books, gym days — anything you can count.</Empty>
        )}
      </section>

      <Disclosure label="New challenge">
        <form action={createChallenge.bind(null, groupId)} className="flex flex-col gap-3">
          <Field label="Title"><input name="title" required maxLength={60} placeholder="100 miles in October" /></Field>
          <div className="flex gap-2.5">
            <Field label="Type">
              <select name="type" defaultValue="distance">
                <option value="distance">Distance</option>
                <option value="count">Count</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Unit"><input name="unit" placeholder="miles" maxLength={16} /></Field>
          </div>
          <div className="flex gap-2.5">
            <Field label="Target (optional)"><input name="target" type="number" min="0" step="any" placeholder="100" /></Field>
            <Field label="Applies">
              <select name="target_mode" defaultValue="per_person">
                <option value="per_person">Per person</option>
                <option value="group">To the group</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2.5">
            <Field label="Start"><input name="start_date" type="date" required defaultValue={today} /></Field>
            <Field label="End"><input name="end_date" type="date" required /></Field>
          </div>
          <SubmitButton className="w-full" pendingLabel="Starting…">Start challenge</SubmitButton>
        </form>
      </Disclosure>

      {closed.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHead
            title="Finished"
            right={<span className="text-[12.5px] text-ink-3">read-only</span>}
          />
          <Card>{closed.map((c) => row(c, true))}</Card>
        </section>
      )}
    </>
  );
}
