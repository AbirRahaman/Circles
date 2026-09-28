import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership, requireFeature } from "@/lib/auth";
import { RideTheBus } from "@/components/games/RideTheBus";
import { ScrewYourNeighbor } from "@/components/games/ScrewYourNeighbor";
import { fetchMembers } from "@/lib/members";
import type { GameEvent } from "@/lib/games/ridethebus";
import type { SYNEvent } from "@/lib/games/screwyourneighbor";

const GAME_LABELS: Record<string, string> = {
  ridethebus: "Ride the Bus",
  screwyourneighbor: "Screw Your Neighbor",
};

export async function generateMetadata({ params }: { params: Promise<{ groupId: string; gameId: string }> }) {
  return { title: "Game · Circles" };
}

export default async function GamePage({
  params,
}: { params: Promise<{ groupId: string; gameId: string }> }) {
  const { groupId, gameId } = await params;
  const { supabase, user } = await requireMembership(groupId);
  await requireFeature(groupId, "games");

  const [{ data: game }, { data: playerRows }, { data: eventRows }, members] = await Promise.all([
    supabase.from("games").select("id, kind, status, event_id, persona, stakes, mode").eq("id", gameId).eq("group_id", groupId).maybeSingle(),
    supabase.from("game_players").select("user_id, seat").eq("game_id", gameId).order("seat"),
    supabase.from("game_events").select("seq, payload").eq("game_id", gameId).order("seq"),
    fetchMembers(supabase, groupId),
  ]);
  if (!game) notFound();

  const players = (playerRows ?? [])
    .map((p) => members.find((m) => m.id === p.user_id))
    .filter((m): m is NonNullable<typeof m> => !!m);

  const kind = (game.kind as string) ?? "ridethebus";
  const title = GAME_LABELS[kind] ?? kind;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display font-bold text-[19px]">{title}</h1>
        <Link href={`/g/${groupId}/games`} className="text-[13px] font-semibold text-ink-2 hover:text-ink">All games</Link>
      </div>
      {game.status !== "active" && (
        <p className="text-[13px] text-ink-2">
          This game is {game.status === "finished" ? "in the books" : "abandoned"} — you're looking at the record.
        </p>
      )}
      {kind === "screwyourneighbor" ? (
        <ScrewYourNeighbor
          gameId={gameId}
          groupId={groupId}
          players={players}
          initialRows={(eventRows ?? []).map((r) => ({ seq: r.seq as number, payload: r.payload as SYNEvent }))}
          me={user.id}
          status={game.status}
        />
      ) : (
        <RideTheBus
          gameId={gameId}
          groupId={groupId}
          players={players}
          initialRows={(eventRows ?? []).map((r) => ({ seq: r.seq as number, payload: r.payload as GameEvent }))}
          me={user.id}
          status={game.status}
          mode={(game.mode as "single" | "multi") ?? "multi"}
        />
      )}
    </>
  );
}
