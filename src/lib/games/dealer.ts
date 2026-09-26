/** The dealer's mouth. Lines are picked from fixed pools with a hash of the
 *  event index, so every device shows the same line and nothing is random
 *  on re-render. Roasts stay on the game — the guess, the streak, the luck.
 *  Never appearance, identity, or anything off the table. */

import { cardName, type Card, type GameEvent, type Persona, type State } from "./ridethebus";

const pick = <T>(arr: T[], n: number) => arr[Math.abs(n) % arr.length];

const GUESS_WORD: Record<string, string> = {
  red: "red", black: "black", higher: "higher", lower: "lower",
  inside: "inside", outside: "outside", S: "spades", H: "hearts", D: "diamonds", C: "clubs",
};

const HIT: Record<Persona, string[]> = {
  neutral: ["Correct.", "That's good.", "Called it."],
  grudge: ["Fine. Lucky.", "Don't get comfortable.", "One. That's one."],
  asshole: ["Broken clock, right twice a day.", "Congratulations on the coin flip.", "Look at you, doing the bare minimum.", "Enjoy it, it won't last."],
};

const MISS: Record<Persona, string[]> = {
  neutral: ["Miss.", "Not this time.", "Wrong."],
  grudge: ["Knew it.", "That's what I thought.", "Sit down."],
  asshole: ["A fifty-fifty shot, and you still missed.", "Bold guess. Terrible, but bold.", "Was that a guess or a cry for help?", "You had two options. Amazing."],
};

const STREAK: Record<Persona, string[]> = {
  neutral: ["That's {n} in a row."],
  grudge: ["{n} straight. I'm keeping count.", "{n} in a row and still guessing."],
  asshole: ["{n} misses running. Someone take the cards away.", "{n} in a row. Genuinely impressive, in the worst way."],
};

export function dealerLine(state: State, last: GameEvent | null, index: number, name: (id: string) => string): string {
  const p = state.persona;
  if (!last) {
    return p === "neutral" ? "Round 1. Red or black."
      : p === "grudge" ? "Let's go. Red or black, and make it quick."
      : "Round one. Red or black. Try not to embarrass yourselves.";
  }

  if (last.t === "guess" || last.t === "bus") {
    const who = last.t === "guess" ? name(last.player) : name(state.rider ?? "");
    const verdict = last.correct ? pick(HIT[p], index) : pick(MISS[p], index);
    const call = GUESS_WORD[last.guess] ?? String(last.guess);
    const head = `${cardName(last.card)}. You said ${call}.`;
    const streak = last.t === "guess" && !last.correct
      ? state.stats[last.player]?.missStreak ?? 0
      : 0;
    const tail = streak >= 2 ? " " + pick(STREAK[p], index).replace("{n}", String(streak)) : "";
    return `${who}: ${head} ${verdict}${tail}`;
  }

  if (last.t === "pyramid") {
    if (!last.matches.length) {
      return p === "asshole"
        ? `${cardName(last.card)}. Nobody. What a waste of a card.`
        : `${cardName(last.card)}. No matches.`;
    }
    const who = [...new Set(last.matches.map((m) => name(m.player)))].join(", ");
    return `${cardName(last.card)} — ${who} lays down. ${last.each} each.`;
  }

  if (last.t === "pyramidDone") return "Pyramid's done. Count what's left in your hands.";
  if (last.t === "tiebreak") {
    return last.rider
      ? `${name(last.rider)} drew lowest. Get on the bus.`
      : "Tied again. Draw once more.";
  }
  if (last.t === "persona") return last.persona === "neutral" ? "Fine. Straight calls from here." : "Gloves back on.";
  if (last.t === "note") return last.text;
  return "Your move.";
}

export function riderLine(state: State, name: (id: string) => string): string {
  const runs = state.runsStarted;
  const who = name(state.rider ?? "");
  if (state.persona === "neutral") return `${who} is riding. Four in a row to get off.`;
  if (runs === 0) return `${who}, you're on the bus. Four in a row. Good luck.`;
  if (runs < 3) return `Run ${runs + 1}. ${who} is still on this bus.`;
  return state.persona === "asshole"
    ? `Run ${runs + 1}. ${who} lives here now.`
    : `Run ${runs + 1}. ${who} is still going.`;
}

export const cardLabel = (c: Card) => cardName(c);
