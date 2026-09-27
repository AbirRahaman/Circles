/** Dealer commentary for Screw Your Neighbor.
 *
 *  Same pattern as the RTB dealer: lines are picked by a hash of the
 *  event index so every phone shows the same line. */

import { cardName, RANK_LABEL, type Card, type Persona } from "./ridethebus";
import type { SYNEvent, State } from "./screwyourneighbor";

const pick = <T>(arr: T[], n: number) => arr[Math.abs(n) % arr.length];

const ROUND_START: Record<Persona, string[]> = {
  neutral: ["Round {n}. Check your card.", "New round. Cards are out."],
  grudge: ["Round {n}. Try not to lose again.", "Cards out. You know the drill."],
  asshole: ["Round {n}. Someone's drinking.", "Fresh cards, same bad luck.", "Let's see who panics first."],
};

const KEEP_LINES: Record<Persona, string[]> = {
  neutral: ["{who} keeps.", "{who} is staying."],
  grudge: ["{who} keeps. Confident or foolish?", "{who} holds. We'll see."],
  asshole: ["{who} keeps. Bold move for someone with that face.", "{who} sits tight. Interesting."],
};

const TRADE_LINES: Record<Persona, string[]> = {
  neutral: ["{who} trades with {target}.", "{who} swaps."],
  grudge: ["{who} dumps on {target}. Love it.", "{who} trades. {target}, enjoy the gift."],
  asshole: ["{who} just made {target}'s problem worse.", "There goes {who}, throwing garbage at {target}.", "{who} trades. Because of course they did."],
};

const BLOCKED: Record<Persona, string[]> = {
  neutral: ["{target} has a King. {who} is stuck.", "King blocks. {who} keeps."],
  grudge: ["{target}'s King says no. Tough break, {who}.", "Blocked. {who} is stuck with it."],
  asshole: ["{target} flashes the King and {who} gets to sit there with their garbage.", "A King. {who} tried, though. Points for effort."],
};

const DEALER_KEEP: Record<Persona, string[]> = {
  neutral: ["Dealer keeps.", "Dealer stays."],
  grudge: ["Dealer likes what they've got.", "Dealer holds. Suspicious."],
  asshole: ["Dealer keeps. Must be nice.", "Dealer is sitting pretty."],
};

const DEALER_SWAP: Record<Persona, string[]> = {
  neutral: ["Dealer draws from the deck.", "Dealer swaps."],
  grudge: ["Dealer trades with the deck. Let's see if it helps.", "Deck swap. Risky."],
  asshole: ["Dealer doesn't like their hand either. Deck it is.", "Dealer's sweating. Went to the deck."],
};

const REVEAL_LINES: Record<Persona, string[]> = {
  neutral: ["Cards up. {loser} has the {card}. That's the round.", "{loser} loses with the {card}."],
  grudge: ["{loser} is holding the {card}. That's a loss.", "And there it is. {loser}, lowest card."],
  asshole: ["{loser} with the {card}. Drink up.", "Surprise, {loser}. You lost. {card}.", "The {card}. {loser}, that's pathetic."],
};

const REPEAT_LOSER: Record<Persona, string[]> = {
  neutral: ["That's {n} for {who}.", "{who} has lost {n} now."],
  grudge: ["{n} losses, {who}. Starting a collection?", "That's {n}. {who} cannot catch a break."],
  asshole: ["{n} times, {who}. Are you even trying?", "{who} with {n} losses. A record nobody wanted."],
};

export function synDealerLine(
  state: State,
  last: SYNEvent | null,
  index: number,
  name: (id: string) => string,
): string {
  const p = state.persona;

  if (!last || last.t === "created") {
    return pick(ROUND_START[p], index).replace("{n}", "1");
  }

  if (last.t === "dealt" || last.t === "nextRound") {
    const round = last.t === "dealt" ? last.round : last.round;
    let line = pick(ROUND_START[p], index).replace("{n}", String(round));
    if (last.t === "nextRound") {
      const loserName = name(last.loser);
      const loserScore = state.scores[last.loser] ?? 0;
      if (loserScore >= 2) {
        line += " " + pick(REPEAT_LOSER[p], index)
          .replace("{n}", String(loserScore))
          .replace("{who}", loserName);
      }
    }
    return line;
  }

  if (last.t === "keep") {
    return pick(KEEP_LINES[p], index).replace("{who}", name(last.player));
  }

  if (last.t === "trade") {
    return pick(TRADE_LINES[p], index)
      .replace("{who}", name(last.player))
      .replace("{target}", name(last.target));
  }

  if (last.t === "blocked") {
    return pick(BLOCKED[p], index)
      .replace("{who}", name(last.player))
      .replace("{target}", name(last.target));
  }

  if (last.t === "dealerKeep") {
    return pick(DEALER_KEEP[p], index);
  }

  if (last.t === "dealerSwap") {
    return pick(DEALER_SWAP[p], index);
  }

  if (last.t === "persona") {
    return last.persona === "neutral" ? "Fine. Straight calls from here." : "Gloves back on.";
  }

  if (last.t === "note") return last.text;

  return "Your move.";
}

export function synRevealLine(
  state: State,
  index: number,
  name: (id: string) => string,
): string {
  if (!state.loser) return "Cards up.";
  const card = state.cards[state.loser];
  const cardLabel = card ? RANK_LABEL[card.r] : "?";
  return pick(REVEAL_LINES[state.persona], index)
    .replace("{loser}", name(state.loser))
    .replace("{card}", cardLabel);
}
