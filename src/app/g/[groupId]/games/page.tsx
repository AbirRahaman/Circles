import Link from "next/link";
import { requireMembership, requireFeature } from "@/lib/auth";
import { createGame } from "@/app/actions/games";
import { Card, Disclosure, Empty, Field, Pill, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { fetchMembers } from "@/lib/members";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Games · Circles" };

type GameRow = { id: string; status: string; stakes: string; created_at: string; finished_at: string | null; created_by: string; event_id: string | null };
type ResultRow = { game_id: string; user_id: string; correct: number; given: number; taken: number; rode_bus: boolean };

export default async function GamesTab({
  params, searchParams,
}: { params: Promise<{ groupId: string }>; searchParams: Promise<{ event?: string }> }) {
  const { groupId } = await params;
  const { event } = await searchParams;
  const { supabase, user } = await requireMembership(groupId);
  await requireFeature(groupId, "games");

  const [{ data: gameRows }, members] = await Promise.all([
    supabase
      .from("games")
      .select("id, status, stakes, created_at, finished_at, created_by, event_id")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    fetchMembers(supabase, groupId),
  ]);
  const games = (gameRows ?? []) as GameRow[];

  const { data: resultRows } = games.length
    ? await supabase
        .from("game_results")
        .select("game_id, user_id, correct, given, taken, rode_bus")
        .in("game_id", games.map((g) => g.id))
    : { data: [] as ResultRow[] };
  const results = (resultRows ?? []) as ResultRow[];

  const live = games.filter((g) => g.status === "active");
  const done = games.filter((g) => g.status === "finished");

  const board = members
    .map((m) => {
      const mine = results.filter((r) => r.user_id === m.id);
      return {
        m,
        played: mine.length,
        correct: mine.reduce((a, r) => a + r.correct, 0),
        given: mine.reduce((a, r) => a + r.given, 0),
        taken: mine.reduce((a, r) => a + r.taken, 0),
        rides: mine.filter((r) => r.rode_bus).length,
      };
    })
    .filter((r) => r.played > 0)
    .sort((a, b) => b.given - a.given || a.taken - b.taken);

  const first = (id: string) => members.find((m) => m.id === id)?.name.split(" ")[0] ?? "Someone";

  return (
    <>
      <SectionHead title="Ride the Bus" right={<span className="text-[12.5px] text-ink-3">{games.length} played</span>} />

      {live.length > 0 && (
        <Card>
          {live.map((g) => (
            <Link key={g.id} href={`/g/${groupId}/games/${g.id}`}
              className="flex items-center gap-3 px-3.5 py-3 border-b border-line last:border-b-0 hover:bg-surface-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px]">Game in progress</div>
                <div className="text-[12.5px] text-ink-2">started by {first(g.created_by)} · {timeAgo(g.created_at)}</div>
              </div>
              <Pill tone="go" dot>Live</Pill>
            </Link>
          ))}
        </Card>
      )}

      <Disclosure label="Deal a new game">
        <form action={createGame.bind(null, groupId)} className="flex flex-col gap-3">
          {event && <input type="hidden" name="event_id" value={event} />}
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[12.5px] font-semibold text-ink-2 mb-1.5">Who's playing — tap in seat order</legend>
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2.5 text-[14px] cursor-pointer">
                <input type="checkbox" name="players" value={m.id} defaultChecked={m.id === user.id} className="!w-4 h-4 accent-[var(--accent)]" />
                {m.id === user.id ? `${m.name} (you)` : m.name}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2.5">
            <span className="flex-1 min-w-0">
              <Field label="Dealer">
                <select name="persona" defaultValue="asshole">
                  <option value="asshole">Roasts everyone</option>
                  <option value="grudge">Holds a grudge</option>
                  <option value="neutral">Plain announcer</option>
                </select>
              </Field>
            </span>
            <span className="flex-1 min-w-0">
              <Field label="Counting">
                <select name="stakes" defaultValue="drinks">
                  <option value="drinks">Drinks</option>
                  <option value="points">Points</option>
                </select>
              </Field>
            </span>
          </div>
          <SubmitButton className="w-full" pendingLabel="Shuffling…">Start the game</SubmitButton>
          <p className="text-[12px] text-ink-2">
            Everyone plays from their own phone. Seat order follows the list above.
          </p>
        </form>
      </Disclosure>

      {board.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHead title="All time" right={<span className="text-[12.5px] text-ink-3">{done.length} finished</span>} />
          <Card className="overflow-hidden">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-surface-2 text-ink-2 text-[11.5px] uppercase tracking-wider">
                  <th className="text-left font-semibold px-3.5 py-2">Player</th>
                  <th className="text-right font-semibold px-2 py-2">Games</th>
                  <th className="text-right font-semibold px-2 py-2">Out</th>
                  <th className="text-right font-semibold px-2 py-2">In</th>
                  <th className="text-right font-semibold px-3.5 py-2">Rides</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r) => (
                  <tr key={r.m.id} className="border-t border-line">
                    <td className="px-3.5 py-2.5">{r.m.id === user.id ? "You" : r.m.name.split(" ")[0]}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.played}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.given}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.taken}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">{r.rides}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHead title="Past games" />
          <Card>
            {done.slice(0, 20).map((g) => {
              const rider = results.find((r) => r.game_id === g.id && r.rode_bus);
              return (
                <Link key={g.id} href={`/g/${groupId}/games/${g.id}`}
                  className="flex items-center gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0 hover:bg-surface-2">
                  <span className="flex-1 min-w-0 text-[13.5px]">
                    {rider ? <>{first(rider.user_id)} rode the bus</> : "No rider"}
                  </span>
                  <span className="font-mono text-[12px] text-ink-3">{timeAgo(g.finished_at ?? g.created_at)}</span>
                </Link>
              );
            })}
          </Card>
        </section>
      )}

      {games.length === 0 && (
        <Empty title="No games yet">
          Ride the Bus: four guesses each, then the pyramid, then somebody rides.
        </Empty>
      )}
    </>
  );
}
