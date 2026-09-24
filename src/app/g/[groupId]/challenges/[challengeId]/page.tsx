import { notFound } from "next/navigation";
import { requireMembership, requireFeature } from "@/lib/auth";
import { logEntry, updateEntry, deleteEntry } from "@/app/actions/challenges";
import { Card, Field, Pill, ProgressBar, Avatar } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { daysUntil, fmtDate, num } from "@/lib/format";
import type { Profile } from "@/lib/types";

export default async function ChallengePage({
  params,
}: { params: Promise<{ groupId: string; challengeId: string }> }) {
  const { groupId, challengeId } = await params;
  const { supabase, user } = await requireMembership(groupId);
  await requireFeature(groupId, "challenges");

  const { data: c } = await supabase.from("challenges").select("*").eq("id", challengeId).maybeSingle();
  if (!c) notFound();

  const [{ data: entries }, { data: memberRows }] = await Promise.all([
    supabase.from("challenge_entries").select("*").eq("challenge_id", challengeId).order("logged_at", { ascending: false }),
    supabase.from("memberships").select("user_id, profiles(id, name, avatar_url)").eq("group_id", groupId).eq("status", "active"),
  ]);

  const members: Profile[] = (memberRows ?? [])
    .map((m) => (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Profile)
    .filter(Boolean);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Someone who left";
  const faceOf = (id: string) => members.find((m) => m.id === id)?.avatar_url ?? null;

  const per = new Map<string, number>();
  (entries ?? []).forEach((e) => per.set(e.user_id, (per.get(e.user_id) ?? 0) + Number(e.amount)));
  const board = [...per.entries()].map(([userId, total]) => ({ userId, total })).sort((a, b) => b.total - a.total);
  const sum = board.reduce((a, r) => a + r.total, 0);

  const goal = c.target ? (c.target_mode === "group" ? Number(c.target) : Number(c.target) * Math.max(members.length, 1)) : null;
  const pct = goal ? Math.round((sum / goal) * 100) : 0;
  const closed = c.end_date < new Date().toISOString().slice(0, 10);
  const max = Math.max(...board.map((r) => r.total), 1);

  return (
    <>
      <Card className="p-3.5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display font-extrabold text-[21px]">{c.title}</h1>
          {closed ? <Pill dot>Closed</Pill> : <Pill tone="accent"><span className="font-mono">{Math.max(0, daysUntil(`${c.end_date}T23:59:59`))}d left</span></Pill>}
        </div>
        <div className="font-mono text-[12px] text-ink-2">
          {fmtDate(c.start_date)} – {fmtDate(c.end_date)} · counting {c.unit}
          {c.target ? ` · target ${num(Number(c.target))} ${c.unit} ${c.target_mode === "per_person" ? "each" : "as a group"}` : ""}
        </div>
        {goal ? (
          <div className="flex flex-col gap-1.5">
            <ProgressBar pct={pct} />
            <div className="flex justify-between font-mono text-[12px] text-ink-2">
              <span>{num(sum)} of {num(goal)}</span><span>{pct}%</span>
            </div>
          </div>
        ) : (
          <div className="font-mono text-2xl">{num(sum)} {c.unit}</div>
        )}
      </Card>

      <Card className="p-3.5 flex flex-col gap-3">
        <h2 className="font-display font-bold text-[15.5px]">Leaderboard</h2>
        {board.length ? board.map((r, i) => (
          <div key={r.userId} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-ink-3 w-3.5">{i + 1}</span>
                <Avatar id={r.userId} name={nameOf(r.userId)} src={faceOf(r.userId)} size={24} />
                <span className={`text-[13.5px] ${r.userId === user.id ? "font-bold" : ""}`}>
                  {nameOf(r.userId)}{r.userId === user.id ? " (you)" : ""}
                </span>
              </span>
              <span className="font-mono text-[13.5px]">{num(r.total)} <span className="text-ink-2 text-[12px]">{c.unit}</span></span>
            </div>
            <ProgressBar pct={(r.total / max) * 100} tone={r.userId === user.id ? "accent" : "muted"} />
          </div>
        )) : <p className="text-[13.5px] text-ink-2">Nobody has logged anything yet.</p>}
      </Card>

      {!closed && (
        <Card className="p-3.5">
          <form
            action={logEntry.bind(null, groupId, challengeId)}
            className="flex flex-col gap-3"
          >
            <Field label={`Amount in ${c.unit}`}>
              <input
                name="amount"
                type="number"
                step="any"
                min="0"
                required
                placeholder="5"
              />
            </Field>
        
            <Field label="Date">
              <input
                name="entry_date"
                type="date"
                defaultValue={new Date().toLocaleDateString("en-CA")}
                required
              />
            </Field>
        
            <Field label="Note (optional)">
              <input
                name="note"
                maxLength={60}
                placeholder="Add a Note"
              />
            </Field>
        
            <SubmitButton className="w-full" pendingLabel="Logging…">
              Add entry
            </SubmitButton>
          </form>
        </Card>
      )}

      {(entries ?? []).length > 0 && (
        <Card>
          <div className="px-3.5 pt-3.5 pb-1.5">
            <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-2">Entries</h2>
          </div>
          {(entries ?? [])
            .slice()
            .sort(
              (a, b) =>
                new Date(b.entry_date).getTime() -
                new Date(a.entry_date).getTime()
            )
            .map((e) => {
            const mine = e.user_id === user.id && !closed;
            const line = (
              <>
                <span className="flex items-start gap-2 min-w-0">
                  <Avatar
                    id={e.user_id}
                    name={nameOf(e.user_id)}
                    src={faceOf(e.user_id)}
                    size={24}
                  />
            
                  <span className="flex flex-col min-w-0">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-[13.5px] truncate">
                        {nameOf(e.user_id)}
                      </span>
            
                      <span className="text-[11.5px] text-ink-2 shrink-0">
                        {(() => {
                          const [year, month, day] = e.entry_date.split("-");
                          return `${month}/${day}/${year}`;
                        })()}
                      </span>
                    </span>
            
                    {e.note && (
                      <span className="text-[12px] text-ink-2 truncate">
                        {e.note}
                      </span>
                    )}
                  </span>
                </span>
            
                <span className="flex items-center gap-2 shrink-0">
                  {mine && (
                    <span
                      className="text-ink-2 group-open:hidden"
                      aria-label="Edit entry"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </span>
                  )}
            
                  <span className="font-mono text-[13.5px]">
                    +{num(Number(e.amount))}
                  </span>
                </span>
              </>
            );

            if (!mine) {
              return (
                <div key={e.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0">
                  {line}
                </div>
              );
            }

            return (
              <details key={e.id} className="group border-b border-line last:border-b-0">
                <summary className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer list-none hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                  {line}
                </summary>
                <div className="px-3.5 pb-3 pt-1 flex flex-col gap-2 bg-surface-2">
                <form
                  action={updateEntry.bind(null, groupId, challengeId, e.id)}
                  className="grid grid-cols-2 sm:flex sm:items-end gap-2"
                >
                  <span className="min-w-0">
                    <Field label={c.unit}>
                      <input
                        name="amount"
                        type="number"
                        step="any"
                        min="0"
                        required
                        defaultValue={Number(e.amount)}
                      />
                    </Field>
                  </span>

                  <span className="min-w-0">
                  <Field label="Date">
                    <input
                      name="entry_date"
                      type="date"
                      required
                      defaultValue={e.entry_date}
                    />
                  </Field>
                  </span>

                  <span className="col-span-2 min-w-0 sm:flex-1">
                    <Field label="Note">
                      <input
                        name="note"
                        maxLength={60}
                        defaultValue={e.note ?? ""}
                      />
                    </Field>
                  </span>

                  <div className="col-span-2 sm:shrink-0">
                    <SubmitButton size="sm" pendingLabel="Saving…">
                      Save
                    </SubmitButton>
                  </div>
                </form>
                  <form action={deleteEntry.bind(null, groupId, challengeId, e.id)}>
                    <SubmitButton size="sm" variant="danger" pendingLabel="Deleting…">Delete this entry</SubmitButton>
                  </form>
                </div>
              </details>
            );
          })}
        </Card>
      )}
    </>
  );
}
