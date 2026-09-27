/** Screw Your Neighbor — pure rules engine.
 *
 *  Same architecture as Ride the Bus: state is a fold over an append-only
 *  event log. No React, no Supabase, no I/O.
 *
 *  Rules: each player gets one card. Starting left of the dealer and going
 *  clockwise, each player keeps or trades with their left neighbor (the next
 *  person in seat order). A King blocks the trade — it's immediately face-up
 *  and locks the holder in. The dealer goes last and can keep or draw from the
 *  deck. Lowest card after everyone acts loses the round. Ace is low, King is
 *  high. Ties: the player closest to the dealer's left loses. */

import type { Card, Suit, Persona, Stakes } from "./ridethebus";

/* ── Types ─────────────────────────────────────────────────────────── */

export type Phase = "trading" | "dealer" | "reveal" | "done";

export type SYNEvent =
  | { t: "created"; order: string[]; persona: Persona; stakes: Stakes; by: string }
  | { t: "dealt"; round: number; cards: Record<string, Card>; dealer: number }
  | { t: "keep"; player: string }
  | { t: "trade"; player: string; target: string }
  | { t: "blocked"; player: string; target: string }
  | { t: "dealerKeep" }
  | { t: "dealerSwap"; drawn: Card }
  | { t: "nextRound"; loser: string; round: number; cards: Record<string, Card>; dealer: number }
  | { t: "endGame"; by: string }
  | { t: "persona"; persona: Persona; by: string }
  | { t: "note"; by: string; text: string };

export type RoundResult = { round: number; loser: string };

export type LogLine = { text: string; drinks?: string };

export type Award = { title: string; player: string; detail: string };

export type State = {
  phase: Phase;
  order: string[];
  dealer: number;           // index into order
  round: number;            // current round (1-based)
  tradeTurn: number;        // how many non-dealer players have acted this round
  persona: Persona;
  stakes: Stakes;
  cards: Record<string, Card>;
  kings: string[];          // players currently holding a King
  scores: Record<string, number>;
  loser: string | null;     // loser of current reveal, null until reveal phase
  roundHistory: RoundResult[];
  log: LogLine[];
};

/* ── Helpers ────────────────────────────────────────────────────────── */

/** Index of the player whose turn it is during trading. */
export function traderIndex(s: State): number {
  return (s.dealer + 1 + s.tradeTurn) % s.order.length;
}

/** Index of the trade target (the trader's left neighbor). */
export function targetIndex(s: State): number {
  return (s.dealer + 2 + s.tradeTurn) % s.order.length;
}

/** Whose tap the game is waiting for (null when anyone can act). */
export function actorFor(s: State): string | null {
  if (s.phase === "trading") return s.order[traderIndex(s)] ?? null;
  if (s.phase === "dealer") return s.order[s.dealer] ?? null;
  return null; // reveal and done are open
}

/** Find the loser: lowest rank, ties broken by proximity to dealer's left. */
export function findLoser(s: State): string {
  const n = s.order.length;
  let minRank = 14;
  let loser = s.order[0];
  for (let i = 1; i <= n; i++) {
    const idx = (s.dealer + i) % n;
    const p = s.order[idx];
    const rank = s.cards[p]?.r ?? 14;
    if (rank < minRank) {
      minRank = rank;
      loser = p;
    }
  }
  return loser;
}

function computeKings(cards: Record<string, Card>): string[] {
  return Object.entries(cards).filter(([, c]) => c.r === 13).map(([p]) => p);
}

/* ── Fold ───────────────────────────────────────────────────────────── */

export function reduceEvents(events: SYNEvent[]): State {
  const s: State = {
    phase: "trading", order: [], dealer: 0, round: 0,
    tradeTurn: 0, persona: "asshole", stakes: "drinks",
    cards: {}, kings: [], scores: {}, loser: null,
    roundHistory: [], log: [],
  };

  for (const e of events) {
    switch (e.t) {
      case "created": {
        s.order = [...e.order];
        s.persona = e.persona;
        s.stakes = e.stakes;
        for (const p of e.order) s.scores[p] = 0;
        break;
      }
      case "dealt": {
        s.round = e.round;
        s.dealer = e.dealer;
        s.cards = { ...e.cards };
        s.kings = computeKings(e.cards);
        s.tradeTurn = 0;
        s.loser = null;
        s.phase = "trading";
        // Auto-skip traders who have Kings
        while (
          s.tradeTurn < s.order.length - 1 &&
          s.kings.includes(s.order[traderIndex(s)])
        ) {
          s.tradeTurn += 1;
        }
        if (s.tradeTurn >= s.order.length - 1) s.phase = "dealer";
        break;
      }
      case "keep": {
        s.tradeTurn += 1;
        // Skip any following players who hold Kings
        while (
          s.tradeTurn < s.order.length - 1 &&
          s.kings.includes(s.order[traderIndex(s)])
        ) {
          s.tradeTurn += 1;
        }
        if (s.tradeTurn >= s.order.length - 1) s.phase = "dealer";
        break;
      }
      case "trade": {
        const pCard = s.cards[e.player];
        const tCard = s.cards[e.target];
        s.cards[e.player] = tCard;
        s.cards[e.target] = pCard;
        s.kings = computeKings(s.cards);
        s.tradeTurn += 1;
        while (
          s.tradeTurn < s.order.length - 1 &&
          s.kings.includes(s.order[traderIndex(s)])
        ) {
          s.tradeTurn += 1;
        }
        if (s.tradeTurn >= s.order.length - 1) s.phase = "dealer";
        break;
      }
      case "blocked": {
        // Target had a King, no swap
        s.tradeTurn += 1;
        while (
          s.tradeTurn < s.order.length - 1 &&
          s.kings.includes(s.order[traderIndex(s)])
        ) {
          s.tradeTurn += 1;
        }
        if (s.tradeTurn >= s.order.length - 1) s.phase = "dealer";
        break;
      }
      case "dealerKeep": {
        s.phase = "reveal";
        s.loser = findLoser(s);
        break;
      }
      case "dealerSwap": {
        const dealerPlayer = s.order[s.dealer];
        s.cards[dealerPlayer] = e.drawn;
        s.kings = computeKings(s.cards);
        s.phase = "reveal";
        s.loser = findLoser(s);
        break;
      }
      case "nextRound": {
        s.roundHistory.push({ round: s.round, loser: e.loser });
        s.scores[e.loser] = (s.scores[e.loser] ?? 0) + 1;
        s.round = e.round;
        s.dealer = e.dealer;
        s.cards = { ...e.cards };
        s.kings = computeKings(e.cards);
        s.tradeTurn = 0;
        s.loser = null;
        s.phase = "trading";
        while (
          s.tradeTurn < s.order.length - 1 &&
          s.kings.includes(s.order[traderIndex(s)])
        ) {
          s.tradeTurn += 1;
        }
        if (s.tradeTurn >= s.order.length - 1) s.phase = "dealer";
        break;
      }
      case "endGame": {
        if (s.loser && !s.roundHistory.find((r) => r.round === s.round)) {
          s.roundHistory.push({ round: s.round, loser: s.loser });
          s.scores[s.loser] = (s.scores[s.loser] ?? 0) + 1;
        }
        s.phase = "done";
        break;
      }
      case "persona": {
        s.persona = e.persona;
        break;
      }
      case "note": {
        break;
      }
    }
  }

  return s;
}

/* ── Analysis ──────────────────────────────────────────────────────── */

export function buildAnalysis(s: State, name: (id: string) => string) {
  const rows = s.order.map((p) => ({
    player: p,
    roundsLost: s.scores[p] ?? 0,
    roundsPlayed: s.roundHistory.length,
  }));

  const awards: Award[] = [];

  const sorted = [...rows].sort((a, b) => b.roundsLost - a.roundsLost);
  if (sorted[0]?.roundsLost > 0) {
    awards.push({
      title: "Biggest loser",
      player: sorted[0].player,
      detail: `${sorted[0].roundsLost} of ${s.roundHistory.length} rounds`,
    });
  }

  const untouched = rows.filter((r) => r.roundsLost === 0);
  if (untouched.length > 0 && untouched.length < rows.length) {
    awards.push({
      title: "Untouchable",
      player: untouched[0].player,
      detail: `${s.roundHistory.length} round${s.roundHistory.length === 1 ? "" : "s"}, never lost`,
    });
  }

  // Streak calculation
  const streaks: Record<string, number> = {};
  const current: Record<string, number> = {};
  for (const h of s.roundHistory) {
    for (const p of s.order) {
      if (h.loser === p) {
        current[p] = (current[p] ?? 0) + 1;
        streaks[p] = Math.max(streaks[p] ?? 0, current[p]);
      } else {
        current[p] = 0;
      }
    }
  }
  const worst = Object.entries(streaks).sort(([, a], [, b]) => b - a)[0];
  if (worst && worst[1] >= 2) {
    awards.push({
      title: "Cold streak",
      player: worst[0],
      detail: `${worst[1]} losses in a row`,
    });
  }

  // Best trader — never lost
  const leastLost = [...rows].sort((a, b) => a.roundsLost - b.roundsLost);
  if (rows.length >= 3 && leastLost[0]?.roundsLost < leastLost[1]?.roundsLost) {
    awards.push({
      title: "Card shark",
      player: leastLost[0].player,
      detail: `only ${leastLost[0].roundsLost} loss${leastLost[0].roundsLost === 1 ? "" : "es"}`,
    });
  }

  return {
    rows: rows.sort((a, b) => a.roundsLost - b.roundsLost),
    awards: awards.map((a) => ({ ...a, name: name(a.player) })),
  };
}
