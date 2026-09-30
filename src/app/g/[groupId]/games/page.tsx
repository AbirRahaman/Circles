import Link from "next/link";
import { requireMembership, requireFeature } from "@/lib/auth";
import { Card, Empty, Pill, SectionHead } from "@/components/ui";
import { GameSelector } from "@/components/games/GameSelector";
import { fetchMembers } from "@/lib/members";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Games · Socius" };

const GAME_LABELS: Record<string, string> = {
  ridethebus: "Ride the Bus",
  screwyourneighbor: "Screw Your Neighbor",
};

type GameRow = {
  id: string; kind: string; status: string; stakes: string;
  created_at: string; finished_at: string | null; created_by: string; event_id: string | null;
};
type ResultRow = {
  game_id: string; user_id: string; correct: number; given: number; taken: number; rode_bus: boolean;
};

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
      .select("id, kind, status, stakes, created_at, finished_at, created_by, event_id")
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
      {/* Live games */}
      {live.length > 0 && (
        <Card>
          {live.map((g) => (
            <Link key={g.id} href={`/g/${groupId}/games/${g.id}`}
              className="flex items-center gap-3 px-3.5 py-3 border-b border-line last:border-b-0 hover:bg-surface-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px]">{GAME_LABELS[g.kind] ?? g.kind}</div>
                <div className="text-[12.5px] text-ink-2">started by {first(g.created_by)} · {timeAgo(g.created_at)}</div>
              </div>
              <Pill tone="go" dot>Live</Pill>
            </Link>
          ))}
        </Card>
      )}

      {/* Game selector tiles */}
      <SectionHead title="Pick a game" />
      <GameSelector
        groupId={groupId}
        members={members}
        userId={user.id}
        eventId={event ?? null}
      />

      {/* Leaderboard */}
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

      {/* Past games */}
      {done.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHead title="Past games" />
          <Card>
            {done.slice(0, 20).map((g) => {
              const rider = results.find((r) => r.game_id === g.id && r.rode_bus);
              const label = GAME_LABELS[g.kind] ?? g.kind;
              return (
                <Link key={g.id} href={`/g/${groupId}/games/${g.id}`}
                  className="flex items-center gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0 hover:bg-surface-2">
                  <span className="flex-1 min-w-0 text-[13.5px]">
                    <span className="font-semibold">{label}</span>
                    <span className="text-ink-2">
                      {rider ? <> — {first(rider.user_id)} rode the bus</> : ""}
                    </span>
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
          Pick a game above and deal it out. Everyone plays from their own phone.
        </Empty>
      )}
    </>
  );
}
