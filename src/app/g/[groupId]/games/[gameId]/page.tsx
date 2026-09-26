import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership, requireFeature } from "@/lib/auth";
import { RideTheBus } from "@/components/games/RideTheBus";
import { fetchMembers } from "@/lib/members";
import type { GameEvent } from "@/lib/games/ridethebus";

export const metadata = { title: "Ride the Bus · Circles" };

export default async function GamePage({
  params,
}: { params: Promise<{ groupId: string; gameId: string }> }) {
  const { groupId, gameId } = await params;
  const { supabase, user } = await requireMembership(groupId);
  await requireFeature(groupId, "games");

  const [{ data: game }, { data: playerRows }, { data: eventRows }, members] = await Promise.all([
    supabase.from("games").select("id, status, event_id, persona, stakes").eq("id", gameId).eq("group_id", groupId).maybeSingle(),
    supabase.from("game_players").select("user_id, seat").eq("game_id", gameId).order("seat"),
    supabase.from("game_events").select("seq, payload").eq("game_id", gameId).order("seq"),
    fetchMembers(supabase, groupId),
  ]);
  if (!game) notFound();

  const players = (playerRows ?? [])
    .map((p) => members.find((m) => m.id === p.user_id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  const rows = (eventRows ?? []).map((r) => ({ seq: r.seq as number, payload: r.payload as GameEvent }));

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display font-bold text-[19px]">Ride the Bus</h1>
        <Link href={`/g/${groupId}/games`} className="text-[13px] font-semibold text-ink-2 hover:text-ink">All games</Link>
      </div>
      {game.status !== "active" && (
        <p className="text-[13px] text-ink-2">
          This game is {game.status === "finished" ? "in the books" : "abandoned"} — you're looking at the record.
        </p>
      )}
      <RideTheBus
        gameId={gameId}
        groupId={groupId}
        players={players}
        initialRows={rows}
        me={user.id}
        status={game.status}
      />
    </>
  );
}
