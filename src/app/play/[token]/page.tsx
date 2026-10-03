import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { AdhocLobby } from "./AdhocLobby";
import { AdhocGame } from "./AdhocGame";
import type { GameEvent } from "@/lib/games/ridethebus";
import type { SYNEvent } from "@/lib/games/screwyourneighbor";

const GAME_LABELS: Record<string, string> = {
  ridethebus: "Ride the Bus",
  screwyourneighbor: "Screw Your Neighbor",
};

type AdhocGameData = {
  id: string;
  token: string;
  kind: string;
  status: string;
  persona: string;
  stakes: string;
  mode: string;
  host_token: string;
  players: { guest_token: string; name: string; seat: number | null }[];
  events: { seq: number; payload: GameEvent | SYNEvent }[];
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_adhoc_game", { game_token: token });
  const game = data as AdhocGameData | null;
  const title = game ? `${GAME_LABELS[game.kind] ?? "Game"} · Socius` : "Game · Socius";
  return {
    title,
    openGraph: { title, description: "Join this game — no account needed." },
  };
}

export default async function AdhocGamePage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_adhoc_game", { game_token: token });
  const game = data as AdhocGameData | null;
  if (!game) notFound();

  const cookieStore = await cookies();
  const guestToken = cookieStore.get("socius_guest")?.value ?? "";

  const nameMap: Record<string, string> = {};
  for (const p of game.players) nameMap[p.guest_token] = p.name;

  const isHost = game.host_token === guestToken;
  const hasJoined = game.players.some((p) => p.guest_token === guestToken);
  const gameName = GAME_LABELS[game.kind] ?? game.kind;

  return (
    <div className="min-h-svh bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto max-w-[468px] px-4 py-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-display font-extrabold text-[22px] tracking-[-0.02em]">{gameName}</h1>
          {game.status === "lobby" && (
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold bg-[var(--accent-soft)] text-[var(--accent)]">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              Lobby
            </span>
          )}
        </div>

        {game.status === "lobby" ? (
          <AdhocLobby
            gameId={game.id}
            token={game.token}
            kind={game.kind}
            players={game.players}
            guestToken={guestToken}
            isHost={isHost}
            hasJoined={hasJoined}
            minPlayers={game.kind === "screwyourneighbor" ? 3 : 2}
          />
        ) : game.status === "active" || game.status === "finished" || game.status === "abandoned" ? (
          <AdhocGame
            gameId={game.id}
            token={game.token}
            kind={game.kind}
            status={game.status}
            nameMap={nameMap}
            guestToken={guestToken}
            initialRows={game.events.map((e) => ({ seq: e.seq, payload: e.payload }))}
          />
        ) : null}

        {/* Footer */}
        <p className="text-center text-[12px] text-[var(--ink-3)] pt-4">
          Powered by <a href="/" className="font-semibold text-[var(--accent)] hover:underline">Socius</a>
        </p>
      </div>
    </div>
  );
}
