"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateGuestToken } from "@/app/actions/guests";
import {
  reduceEvents, actorFor, findMatches, judge, busStep, busHand, rowValue,
  nextPyramidSlot, PYRAMID_ROWS, SUITS, buildAnalysis,
  type Card, type GameEvent, type Guess, type Persona, type Stakes, type Round,
} from "@/lib/games/ridethebus";
import {
  reduceEvents as synReduceEvents,
  actorFor as synActorFor, traderIndex, targetIndex, findLoser,
  type SYNEvent, type State as SYNState,
} from "@/lib/games/screwyourneighbor";

const draw = (): Card => ({ r: randomInt(1, 14), s: SUITS[randomInt(0, 4)] });

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

// ── Helpers ──────────────────────────────────────────────────────────

async function loadAdhoc(gameId: string) {
  const guestToken = await getOrCreateGuestToken();
  const supabase = await createClient();
  const [{ data: game }, { data: rows }] = await Promise.all([
    supabase.from("adhoc_games").select("*").eq("id", gameId).maybeSingle(),
    supabase.from("adhoc_events").select("seq, payload").eq("game_id", gameId).order("seq"),
  ]);
  if (!game) return { error: "Game not found." };
  const events = (rows ?? []).map((r) => r.payload as GameEvent);
  return { guestToken, supabase, game, events, state: reduceEvents(events) };
}

async function loadAdhocSYN(gameId: string) {
  const guestToken = await getOrCreateGuestToken();
  const supabase = await createClient();
  const [{ data: game }, { data: rows }] = await Promise.all([
    supabase.from("adhoc_games").select("*").eq("id", gameId).maybeSingle(),
    supabase.from("adhoc_events").select("seq, payload").eq("game_id", gameId).order("seq"),
  ]);
  if (!game) return { error: "Game not found." };
  const events = (rows ?? []).map((r) => r.payload as SYNEvent);
  return { guestToken, supabase, game, events, state: synReduceEvents(events) };
}

async function appendAdhoc(ctx: Awaited<ReturnType<typeof loadAdhoc>> & { error?: never }, events: GameEvent[]): Promise<Result> {
  if ("error" in ctx) return fail(ctx.error!);
  const { error } = await ctx.supabase.from("adhoc_events").insert(
    events.map((e) => ({ game_id: ctx.game.id, type: e.t, payload: e, actor: ctx.guestToken }))
  );
  if (error) return fail(error.message.includes("game_over") ? "This game is already over." : error.message);
  return { ok: true };
}

async function appendAdhocSYN(ctx: Awaited<ReturnType<typeof loadAdhocSYN>> & { error?: never }, events: SYNEvent[]): Promise<Result> {
  if ("error" in ctx) return fail(ctx.error!);
  const { error } = await ctx.supabase.from("adhoc_events").insert(
    events.map((e) => ({ game_id: ctx.game.id, type: e.t, payload: e, actor: ctx.guestToken }))
  );
  if (error) return fail(error.message.includes("game_over") ? "This game is already over." : error.message);
  return { ok: true };
}

// ── Create & Join ────────────────────────────────────────────────────

export async function createAdhocGame(formData: FormData) {
  const kind = String(formData.get("kind") ?? "ridethebus");
  const persona = String(formData.get("persona") ?? "asshole") as Persona;
  const stakes = String(formData.get("stakes") ?? "drinks") as Stakes;
  const hostName = (formData.get("name") as string)?.trim();

  if (!hostName) throw new Error("Enter your name.");
  if (!["ridethebus", "screwyourneighbor"].includes(kind)) throw new Error("Unknown game.");
  if (!["neutral", "grudge", "asshole"].includes(persona)) throw new Error("Unknown dealer.");
  if (!["drinks", "points"].includes(stakes)) throw new Error("Unknown stakes.");

  const guestToken = await getOrCreateGuestToken();
  const supabase = await createClient();
  const token = nanoid(8);

  const { data: game, error } = await supabase
    .from("adhoc_games")
    .insert({ token, kind, persona, stakes, mode: "single", host_token: guestToken })
    .select("id, token")
    .single();
  if (error) throw new Error(error.message);

  // Host auto-joins
  await supabase.from("adhoc_players").insert({
    game_id: game.id,
    guest_token: guestToken,
    name: hostName,
  });

  redirect(`/play/${game.token}`);
}

export async function joinAdhocGame(gameId: string, _prev: unknown, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Enter your name." };
  if (name.length > 40) return { error: "Name is too long." };

  const guestToken = await getOrCreateGuestToken();
  const supabase = await createClient();

  const { data: game } = await supabase
    .from("adhoc_games").select("id, status").eq("id", gameId).maybeSingle();
  if (!game) return { error: "Game not found." };
  if (game.status !== "lobby") return { error: "This game already started." };

  // Check player count
  const { count } = await supabase
    .from("adhoc_players").select("*", { count: "exact", head: true }).eq("game_id", gameId);
  if ((count ?? 0) >= 10) return { error: "Game is full (10 players max)." };

  const { error } = await supabase.from("adhoc_players").upsert(
    { game_id: gameId, guest_token: guestToken, name },
    { onConflict: "game_id,guest_token" }
  );
  if (error) return { error: error.message };
  return { success: true };
}

export async function startAdhocGame(gameId: string): Promise<Result> {
  const guestToken = await getOrCreateGuestToken();
  const supabase = await createClient();

  const { data: game } = await supabase
    .from("adhoc_games").select("*").eq("id", gameId).maybeSingle();
  if (!game) return fail("Game not found.");
  if (game.host_token !== guestToken) return fail("Only the host can start.");
  if (game.status !== "lobby") return fail("Already started.");

  const { data: playerRows } = await supabase
    .from("adhoc_players").select("guest_token, name").eq("game_id", gameId).order("joined_at");
  const players = playerRows ?? [];

  const minPlayers = game.kind === "screwyourneighbor" ? 3 : 2;
  if (players.length < minPlayers) return fail(`Need at least ${minPlayers} players.`);

  // Assign seats
  const order = players.map((p) => p.guest_token);
  for (let i = 0; i < players.length; i++) {
    await supabase.from("adhoc_players")
      .update({ seat: i })
      .eq("game_id", gameId)
      .eq("guest_token", players[i].guest_token);
  }

  // Set status to active
  await supabase.from("adhoc_games").update({ status: "active" }).eq("id", gameId);

  // Initial events
  if (game.kind === "screwyourneighbor") {
    const created: SYNEvent = { t: "created", order, persona: game.persona as Persona, stakes: game.stakes as Stakes, by: guestToken };
    await supabase.from("adhoc_events").insert({ game_id: gameId, type: created.t, payload: created, actor: guestToken });
    const cards: Record<string, Card> = {};
    for (const p of order) cards[p] = draw();
    const dealt: SYNEvent = { t: "dealt", round: 1, cards, dealer: order.length - 1 };
    await supabase.from("adhoc_events").insert({ game_id: gameId, type: dealt.t, payload: dealt, actor: guestToken });
  } else {
    const created: GameEvent = { t: "created", order, persona: game.persona as Persona, stakes: game.stakes as Stakes, mode: "single", by: guestToken };
    await supabase.from("adhoc_events").insert({ game_id: gameId, type: created.t, payload: created, actor: guestToken });
  }

  return { ok: true };
}

// ── Ride the Bus actions (mirror of games.ts, using guest tokens) ────

export async function adhocGuess(gameId: string, guess: Guess): Promise<Result> {
  const ctx = await loadAdhoc(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  const { state, guestToken } = ctx;

  const round = state.phase === "r1" ? 1 : state.phase === "r2" ? 2 : state.phase === "r3" ? 3 : state.phase === "r4" ? 4 : null;
  if (!round) return fail("That part of the game is over.");

  const currentActor = actorFor(state);
  // Single-phone: any player in the game can act for the current turn
  if (!state.order.includes(guestToken)) return fail("You're not in this game.");
  const player = currentActor!;

  const hand = (state.hands[player] ?? []).map((h) => h.card);
  const card = draw();
  const correct = judge(round as Round, guess, hand, card);
  return appendAdhoc(ctx as any, [{ t: "guess", player, round: round as Round, guess, card, correct, drinks: round }]);
}

export async function adhocSetPyramidMaster(gameId: string, masterId: string): Promise<Result> {
  const ctx = await loadAdhoc(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "pickPyramidMaster") return fail("Not time to pick yet.");
  if (!ctx.state.order.includes(masterId)) return fail("That player isn't in this game.");
  return appendAdhoc(ctx as any, [{ t: "setPyramidMaster", by: ctx.guestToken, master: masterId }]);
}

export async function adhocSetBusDealer(gameId: string, dealerId: string | "computer"): Promise<Result> {
  const ctx = await loadAdhoc(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "pickBusDealer") return fail("Not time to pick yet.");
  if (dealerId !== "computer" && !ctx.state.order.includes(dealerId)) return fail("That player isn't in this game.");
  return appendAdhoc(ctx as any, [{ t: "setBusDealer", by: ctx.guestToken, dealer: dealerId }]);
}

export async function adhocRevealSlot(gameId: string): Promise<Result> {
  const ctx = await loadAdhoc(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "pyramid") return fail("The pyramid isn't up yet.");

  const next = nextPyramidSlot(ctx.state.pyramid);
  if (!next) return fail("Every card has been flipped.");
  const { row, col } = next;

  const hasUnplayed = ctx.state.order.some((p) =>
    (ctx.state.hands[p] ?? []).some((h) => !h.played)
  );
  let card = draw();
  let matches = findMatches(ctx.state, card.r);
  if (hasUnplayed) {
    let attempts = 0;
    while (matches.length === 0 && attempts < 200) {
      card = draw();
      matches = findMatches(ctx.state, card.r);
      attempts++;
    }
  }

  return appendAdhoc(ctx as any, [{ t: "pyramid", row, col, card, matches, each: rowValue(row) }]);
}

export async function adhocFinishPyramid(gameId: string): Promise<Result> {
  const ctx = await loadAdhoc(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "pyramid") return fail("The pyramid is already done.");
  return appendAdhoc(ctx as any, [{ t: "pyramidDone", by: ctx.guestToken }]);
}

export async function adhocTiebreakDraw(gameId: string): Promise<Result> {
  const ctx = await loadAdhoc(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "tiebreak") return fail("Nothing to break.");

  const draws = ctx.state.tied.map((player) => ({ player, card: draw() }));
  const low = Math.min(...draws.map((d) => d.card.r));
  const lowest = draws.filter((d) => d.card.r === low);
  return appendAdhoc(ctx as any, [{ t: "tiebreak", draws, rider: lowest.length === 1 ? lowest[0].player : null }]);
}

export async function adhocBusGuess(gameId: string, guess: Guess): Promise<Result> {
  const ctx = await loadAdhoc(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "bus") return fail("Nobody's on the bus.");
  if (!ctx.state.order.includes(ctx.guestToken)) return fail("You're not in this game.");

  const step = busStep(ctx.state);
  const card = draw();
  const correct = judge(step, guess, busHand(ctx.state), card);
  const cleared = correct && ctx.state.run.length === 3;
  return appendAdhoc(ctx as any, [{ t: "bus", guess, card, correct, reset: !correct, cleared }]);
}

export async function adhocSetPersona(gameId: string, persona: Persona): Promise<Result> {
  const ctx = await loadAdhoc(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (!["neutral", "grudge", "asshole"].includes(persona)) return fail("Unknown dealer.");
  if (!ctx.state.order.includes(ctx.guestToken)) return fail("You're not in this game.");
  await ctx.supabase.from("adhoc_games").update({ persona }).eq("id", gameId);
  return appendAdhoc(ctx as any, [{ t: "persona", persona, by: ctx.guestToken }]);
}

export async function adhocFinishGame(gameId: string): Promise<Result> {
  const ctx = await loadAdhoc(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.game.status !== "active") return fail("Already filed.");
  if (ctx.state.phase !== "analysis") return fail("The bus is still running.");
  await ctx.supabase.from("adhoc_games")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("id", gameId);
  return { ok: true };
}

export async function adhocAbandonGame(gameId: string): Promise<Result> {
  const ctx = await loadAdhoc(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (!ctx.state.order.includes(ctx.guestToken)) return fail("You're not in this game.");
  await ctx.supabase.from("adhoc_games").update({ status: "abandoned" }).eq("id", gameId);
  return { ok: true };
}

// ── Screw Your Neighbor actions ──────────────────────────────────────

export async function adhocSynKeep(gameId: string): Promise<Result> {
  const ctx = await loadAdhocSYN(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "trading") return fail("Not the trading phase.");
  if (!ctx.state.order.includes(ctx.guestToken)) return fail("You're not in this game.");
  const actor = synActorFor(ctx.state)!;
  return appendAdhocSYN(ctx as any, [{ t: "keep", player: actor }]);
}

export async function adhocSynTrade(gameId: string): Promise<Result> {
  const ctx = await loadAdhocSYN(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "trading") return fail("Not the trading phase.");
  if (!ctx.state.order.includes(ctx.guestToken)) return fail("You're not in this game.");
  const actor = synActorFor(ctx.state)!;
  if (ctx.state.kings.includes(actor)) return fail("This player has a King — they can't trade.");

  const tIdx = targetIndex(ctx.state);
  const target = ctx.state.order[tIdx];
  if (ctx.state.kings.includes(target)) {
    return appendAdhocSYN(ctx as any, [{ t: "blocked", player: actor, target }]);
  }
  return appendAdhocSYN(ctx as any, [{ t: "trade", player: actor, target }]);
}

export async function adhocSynDealerKeep(gameId: string): Promise<Result> {
  const ctx = await loadAdhocSYN(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "dealer") return fail("Not the dealer's turn.");
  if (!ctx.state.order.includes(ctx.guestToken)) return fail("You're not in this game.");
  return appendAdhocSYN(ctx as any, [{ t: "dealerKeep" }]);
}

export async function adhocSynDealerSwap(gameId: string): Promise<Result> {
  const ctx = await loadAdhocSYN(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "dealer") return fail("Not the dealer's turn.");
  if (!ctx.state.order.includes(ctx.guestToken)) return fail("You're not in this game.");
  return appendAdhocSYN(ctx as any, [{ t: "dealerSwap", drawn: draw() }]);
}

export async function adhocSynNextRound(gameId: string): Promise<Result> {
  const ctx = await loadAdhocSYN(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (ctx.state.phase !== "reveal") return fail("Round isn't over yet.");
  if (!ctx.state.order.includes(ctx.guestToken)) return fail("You're not in this game.");

  const loser = findLoser(ctx.state);
  const newDealer = (ctx.state.dealer + 1) % ctx.state.order.length;
  const newRound = ctx.state.round + 1;
  const cards: Record<string, Card> = {};
  for (const p of ctx.state.order) cards[p] = draw();

  return appendAdhocSYN(ctx as any, [{
    t: "nextRound", loser, round: newRound, cards, dealer: newDealer,
  }]);
}

export async function adhocSynEndGame(gameId: string): Promise<Result> {
  const ctx = await loadAdhocSYN(gameId);
  if ("error" in ctx) return fail(ctx.error!);
  if (!ctx.state.order.includes(ctx.guestToken)) return fail("You're not in this game.");
  if (ctx.game.status !== "active") return fail("Already filed.");

  const res = await appendAdhocSYN(ctx as any, [{ t: "endGame", by: ctx.guestToken }]);
  if (!res.ok) return res;

  await ctx.supabase.from("adhoc_games")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("id", gameId);
  return { ok: true };
}
