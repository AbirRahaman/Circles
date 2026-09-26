/** Ride the Bus — pure rules engine.
 *
 *  No React, no Supabase, no I/O. State is a fold over an append-only event
 *  log, so any client that has the log computes the same state, and a game
 *  can be replayed exactly.
 *
 *  Cards are drawn by the server (see actions/games.ts) and recorded in the
 *  event, rather than derived from a seed the clients hold: a shared seed
 *  would let anyone compute the next card before guessing.
 */

export type Suit = "S" | "H" | "D" | "C";
/** rank 1 = ace (low) … 13 = king (high) */
export type Card = { r: number; s: Suit };

export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const RANK_LABEL = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUIT_LABEL: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
export const isRed = (c: Card) => c.s === "H" || c.s === "D";
export const cardName = (c: Card) => `${RANK_LABEL[c.r]}${c.s === "S" ? "♠" : c.s === "H" ? "♥" : c.s === "D" ? "♦" : "♣"}`;

export type Round = 1 | 2 | 3 | 4;
export type Guess = "red" | "black" | "higher" | "lower" | "inside" | "outside" | Suit;
export type Persona = "neutral" | "grudge" | "asshole";
export type Stakes = "drinks" | "points";

export const PYRAMID_ROWS = [6, 5, 4, 3, 2, 1]; // index 0 = base, drinks = index + 1

export type GameEvent =
  | { t: "created"; order: string[]; persona: Persona; stakes: Stakes; by: string }
  | { t: "guess"; player: string; round: Round; guess: Guess; card: Card; correct: boolean; drinks: number }
  | { t: "pyramid"; row: number; col: number; card: Card; matches: { player: string; index: number }[]; each: number }
  | { t: "pyramidDone"; by: string }
  | { t: "tiebreak"; draws: { player: string; card: Card }[]; rider: string | null }
  | { t: "bus"; guess: Guess; card: Card; correct: boolean; reset: boolean; cleared: boolean }
  | { t: "persona"; persona: Persona; by: string }
  | { t: "note"; by: string; text: string };

export type Phase = "r1" | "r2" | "r3" | "r4" | "pyramid" | "tiebreak" | "bus" | "analysis";
const ROUND_PHASE: Record<Round, Phase> = { 1: "r1", 2: "r2", 3: "r3", 4: "r4" };
export const phaseRound = (p: Phase): Round | null =>
  p === "r1" ? 1 : p === "r2" ? 2 : p === "r3" ? 3 : p === "r4" ? 4 : null;

export type HandCard = { card: Card; played: boolean };

export type Stats = {
  correct: number;
  given: number;
  taken: number;
  laid: number;
  left: number;
  busRuns: number;
  longestMiss: number;
  missStreak: number;
};

export type LogLine = { text: string; drinks?: string };

export type State = {
  phase: Phase;
  order: string[];
  turn: number;                  // index into order, rounds 1–4 only
  persona: Persona;
  stakes: Stakes;
  hands: Record<string, HandCard[]>;
  pyramid: (Card | null)[][];    // [row][col], row 0 = base
  revealed: number;
  rider: string | null;
  tied: string[];                // tie set awaiting a tiebreak draw
  run: { card: Card; correct: boolean }[];
  runsStarted: number;
  busDraws: number;
  stats: Record<string, Stats>;
  log: LogLine[];
  notes: string[];
};

const blankStats = (): Stats => ({ correct: 0, given: 0, taken: 0, laid: 0, left: 0, busRuns: 0, longestMiss: 0, missStreak: 0 });

export const emptyPyramid = (): (Card | null)[][] => PYRAMID_ROWS.map((n) => Array.from({ length: n }, () => null));

/** ── Rules ──────────────────────────────────────────────────────────── */

/** Every tie counts as a miss (runbook, Edge cases). */
export function judge(round: Round, guess: Guess, hand: Card[], card: Card): boolean {
  if (round === 1) return guess === "red" ? isRed(card) : guess === "black" ? !isRed(card) : false;
  if (round === 2) {
    const first = hand[0];
    if (!first) return false;
    return guess === "higher" ? card.r > first.r : guess === "lower" ? card.r < first.r : false;
  }
  if (round === 3) {
    const [a, b] = hand;
    if (!a || !b) return false;
    const lo = Math.min(a.r, b.r);
    const hi = Math.max(a.r, b.r);
    if (guess === "inside") return card.r > lo && card.r < hi;
    if (guess === "outside") return card.r < lo || card.r > hi;
    return false;
  }
  return guess === card.s;
}

/** Guesses that cannot win — the UI warns before accepting them. */
export function impossible(round: Round, guess: Guess, hand: Card[]): string | null {
  if (round === 2) {
    const r = hand[0]?.r;
    if (r === 13 && guess === "higher") return "Nothing beats a king. This can only lose.";
    if (r === 1 && guess === "lower") return "Nothing is lower than an ace. This can only lose.";
  }
  if (round === 3 && guess === "inside") {
    const [a, b] = hand;
    if (a && b && Math.abs(a.r - b.r) <= 1) return "No rank sits between those two. Inside can only lose.";
  }
  return null;
}

export const rowValue = (row: number) => row + 1;

/** ── Fold ───────────────────────────────────────────────────────────── */

export function reduceEvents(events: GameEvent[]): State {
  const s: State = {
    phase: "r1", order: [], turn: 0, persona: "asshole", stakes: "drinks",
    hands: {}, pyramid: emptyPyramid(), revealed: 0,
    rider: null, tied: [], run: [], runsStarted: 0, busDraws: 0,
    stats: {}, log: [], notes: [],
  };

  for (const e of events) {
    switch (e.t) {
      case "created": {
        s.order = [...e.order];
        s.persona = e.persona;
        s.stakes = e.stakes;
        for (const p of e.order) {
          s.hands[p] = [];
          s.stats[p] = blankStats();
        }
        break;
      }
      case "guess": {
        const st = s.stats[e.player] ?? (s.stats[e.player] = blankStats());
        s.hands[e.player] = [...(s.hands[e.player] ?? []), { card: e.card, played: false }];
        if (e.correct) {
          st.correct += 1;
          st.given += e.drinks;
          st.missStreak = 0;
        } else {
          st.taken += e.drinks;
          st.missStreak += 1;
          st.longestMiss = Math.max(st.longestMiss, st.missStreak);
        }
        // Advance the seat, and the round once the table has been round.
        s.turn += 1;
        if (s.turn >= s.order.length) {
          s.turn = 0;
          s.phase = e.round === 4 ? "pyramid" : ROUND_PHASE[(e.round + 1) as Round];
        }
        break;
      }
      case "pyramid": {
        s.pyramid[e.row][e.col] = e.card;
        s.revealed += 1;
        for (const m of e.matches) {
          const hand = s.hands[m.player];
          if (hand?.[m.index]) hand[m.index] = { ...hand[m.index], played: true };
          const st = s.stats[m.player] ?? (s.stats[m.player] = blankStats());
          st.laid += 1;
          st.given += e.each;
        }
        break;
      }
      case "pyramidDone": {
        for (const p of s.order) {
          s.stats[p].left = (s.hands[p] ?? []).filter((h) => !h.played).length;
        }
        const most = Math.max(0, ...s.order.map((p) => s.stats[p].left));
        const top = s.order.filter((p) => s.stats[p].left === most);
        if (top.length === 1) {
          s.rider = top[0];
          s.phase = "bus";
        } else {
          s.tied = top;
          s.phase = "tiebreak";
        }
        break;
      }
      case "tiebreak": {
        if (e.rider) {
          s.rider = e.rider;
          s.tied = [];
          s.phase = "bus";
        } else {
          // Another tie: only the players who drew the lowest rank draw again.
          const low = Math.min(...e.draws.map((d) => d.card.r));
          s.tied = e.draws.filter((d) => d.card.r === low).map((d) => d.player);
        }
        break;
      }
      case "bus": {
        const rider = s.rider;
        s.busDraws += 1;
        if (e.correct) {
          s.run = [...s.run, { card: e.card, correct: true }];
          if (rider) s.stats[rider].missStreak = 0;
          if (e.cleared) s.phase = "analysis";
        } else {
          s.run = [];
          s.runsStarted += 1;
          if (rider) {
            const st = s.stats[rider];
            st.busRuns += 1;
            st.missStreak += 1;
            st.longestMiss = Math.max(st.longestMiss, st.missStreak);
          }
        }
        break;
      }
      case "persona": {
        s.persona = e.persona;
        break;
      }
      case "note": {
        s.notes = [...s.notes, e.text];
        break;
      }
    }
  }

  return s;
}

/** ── Turn rules ─────────────────────────────────────────────────────── */

/** Whose tap the game is waiting for, or null when anyone may act. */
export function actorFor(s: State): string | null {
  if (phaseRound(s.phase)) return s.order[s.turn] ?? null;
  if (s.phase === "bus") return s.rider;
  return null; // pyramid and tiebreak are open to the table
}

/** Unplayed cards, used for the rider choice and the pyramid display. */
export const unplayed = (s: State, player: string) => (s.hands[player] ?? []).filter((h) => !h.played).length;

/** Matches for a revealed rank: every unplayed card of that rank, any suit. */
export function findMatches(s: State, rank: number): { player: string; index: number }[] {
  const out: { player: string; index: number }[] = [];
  for (const p of s.order) {
    (s.hands[p] ?? []).forEach((h, i) => {
      if (!h.played && h.card.r === rank) out.push({ player: p, index: i });
    });
  }
  return out;
}

export const busStep = (s: State): Round => ((s.run.length % 4) + 1) as Round;
export const busHand = (s: State): Card[] => s.run.map((x) => x.card);

/** ── Analysis ───────────────────────────────────────────────────────── */

export type Award = { title: string; player: string; detail: string };

export function buildAnalysis(s: State, name: (id: string) => string) {
  const rows = s.order.map((p) => ({ player: p, ...s.stats[p] }));
  const by = <K extends keyof Stats>(k: K) => [...rows].sort((a, b) => Number(b[k]) - Number(a[k]));

  const awards: Award[] = [];
  const mostCorrect = by("correct")[0];
  if (mostCorrect && mostCorrect.correct > 0) {
    awards.push({ title: "Sharpest eye", player: mostCorrect.player, detail: `${mostCorrect.correct} of 4 correct` });
  }
  const mostGiven = by("given")[0];
  if (mostGiven && mostGiven.given > 0) {
    awards.push({ title: "Most handed out", player: mostGiven.player, detail: `${mostGiven.given} given` });
  }
  const cleanest = [...rows].sort((a, b) => a.left - b.left || b.laid - a.laid)[0];
  if (cleanest) {
    awards.push({ title: "Cleanest pyramid", player: cleanest.player, detail: `${cleanest.laid} laid down, ${cleanest.left} left` });
  }
  const mostTaken = by("taken")[0];
  if (mostTaken && mostTaken.taken > 0) {
    awards.push({ title: "Took the most", player: mostTaken.player, detail: `${mostTaken.taken} taken` });
  }
  const streak = by("longestMiss")[0];
  if (streak && streak.longestMiss >= 2) {
    awards.push({ title: "Coldest streak", player: streak.player, detail: `${streak.longestMiss} misses in a row` });
  }
  if (s.rider) {
    const st = s.stats[s.rider];
    awards.push({
      title: "Rode the bus",
      player: s.rider,
      detail: `${st.busRuns + 1} run${st.busRuns === 0 ? "" : "s"}, ${s.busDraws} cards drawn`,
    });
  }

  return {
    rows: rows.sort((a, b) => b.correct - a.correct || a.taken - b.taken),
    awards: awards.map((a) => ({ ...a, name: name(a.player) })),
  };
}
