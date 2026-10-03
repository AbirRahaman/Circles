"use client";

import { useMemo } from "react";
import { RideTheBus } from "@/components/games/RideTheBus";
import { ScrewYourNeighbor } from "@/components/games/ScrewYourNeighbor";
import {
  adhocGuess, adhocRevealSlot, adhocFinishPyramid, adhocTiebreakDraw,
  adhocBusGuess, adhocFinishGame, adhocAbandonGame, adhocSetPersona,
  adhocSetPyramidMaster, adhocSetBusDealer,
  adhocSynKeep, adhocSynTrade, adhocSynDealerKeep, adhocSynDealerSwap,
  adhocSynNextRound, adhocSynEndGame,
} from "@/app/actions/adhoc-games";
import type { GameEvent } from "@/lib/games/ridethebus";
import type { SYNEvent } from "@/lib/games/screwyourneighbor";

type Row = { seq: number; payload: GameEvent | SYNEvent };

export function AdhocGame({
  gameId, token, kind, status, nameMap, guestToken, initialRows,
}: {
  gameId: string;
  token: string;
  kind: string;
  status: string;
  nameMap: Record<string, string>;
  guestToken: string;
  initialRows: Row[];
}) {
  // Build a fake players array matching the Player type the game components expect
  const players = useMemo(() =>
    Object.entries(nameMap).map(([id, name]) => ({
      id,
      name,
      avatar_url: null,
    })),
    [nameMap]
  );

  if (kind === "screwyourneighbor") {
    const synActions = {
      synKeep: (gid: string) => adhocSynKeep(gid),
      synTrade: (gid: string) => adhocSynTrade(gid),
      synDealerKeepAction: (gid: string) => adhocSynDealerKeep(gid),
      synDealerSwapAction: (gid: string) => adhocSynDealerSwap(gid),
      synNextRound: (gid: string) => adhocSynNextRound(gid),
      synEndGame: (gid: string) => adhocSynEndGame(gid),
      setPersona: (gid: string, persona: string) => adhocSetPersona(gid, persona as any),
      abandonGame: (gid: string) => adhocAbandonGame(gid),
    };

    return (
      <ScrewYourNeighbor
        gameId={gameId}
        groupId=""
        players={players}
        initialRows={initialRows.map((r) => ({ seq: r.seq, payload: r.payload as SYNEvent }))}
        me={guestToken}
        status={status}
        eventsTable="adhoc_events"
        actionOverrides={synActions}
      />
    );
  }

  const rtbActions = {
    makeGuess: (gid: string, guess: any) => adhocGuess(gid, guess),
    revealSlot: (gid: string) => adhocRevealSlot(gid),
    finishPyramid: (gid: string) => adhocFinishPyramid(gid),
    tiebreakDraw: (gid: string) => adhocTiebreakDraw(gid),
    busGuess: (gid: string, guess: any) => adhocBusGuess(gid, guess),
    finishGame: (gid: string) => adhocFinishGame(gid),
    abandonGame: (gid: string) => adhocAbandonGame(gid),
    setPersona: (gid: string, persona: string) => adhocSetPersona(gid, persona as any),
    setPyramidMaster: (gid: string, masterId: string) => adhocSetPyramidMaster(gid, masterId),
    setBusDealer: (gid: string, dealerId: string | "computer") => adhocSetBusDealer(gid, dealerId),
  };

  return (
    <RideTheBus
      gameId={gameId}
      groupId=""
      players={players}
      initialRows={initialRows.map((r) => ({ seq: r.seq, payload: r.payload as GameEvent }))}
      me={guestToken}
      status={status}
      mode="single"
      eventsTable="adhoc_events"
      actionOverrides={rtbActions}
    />
  );
}
