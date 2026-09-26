"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import {
  reduceEvents, actorFor, findMatches, judge, busStep, busHand, rowValue,
  PYRAMID_ROWS, SUITS, buildAnalysis,
  type Card, type GameEvent, type Guess, type Persona, type Stakes, type Round, type State,
} from "@/lib/games/ridethebus";

/** Cards are drawn here, on the server, never on a phone: a client that
 *  could compute the next card could guess with it. Full 52 every time,
 *  with replacement, exactly as the house plays it. */
const draw = (): Card => ({ r: randomInt(1, 14), s: SUITS[randomInt(0, 4)] });

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

type Ctx = {
  user: { id: string };
  supabase: Awaited<ReturnType<typeof createClient>>;
  game: { id: string; group_id: string; event_id: string | null; status: string; persona: string; stakes: string };
  events: GameEvent[];
  state: State;
};

async function load(gameId: string): Promise<Ctx | { error: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: game }, { data: rows }] = await Promise.all([
    supabase.from("games").select("id, group_id, event_id, status, persona, stakes").eq("id", gameId).maybeSingle(),
    supabase.from("game_events").select("seq, payload").eq("game_id", gameId).order("seq"),
  ]);
  if (!game) return { error: "That game is gone." };
  const events = (rows ?? []).map((r) => r.payload as GameEvent);
  return { user, supabase, game, events, state: reduceEvents(events) };
}

async function append(ctx: Ctx, events: GameEvent[]): Promise<Result> {
  const { error } = await ctx.supabase.from("game_events").insert(
    events.map((e) => ({ game_id: ctx.game.id, type: e.t, payload: e, actor: ctx.user.id }))
  );
  if (error) return fail(error.message.includes("game_over") ? "This game is already over." : error.message);
  revalidatePath(`/g/${ctx.game.group_id}/games/${ctx.game.id}`);
  return { ok: true };
}

/** ── Creating a game ────────────────────────────────────────────────── */

export async function createGame(groupId: string, formData: FormData) {
  const players = formData.getAll("players").map(String).filter(Boolean);
  const persona = String(formData.get("persona") ?? "asshole") as Persona;
  const stakes = String(formData.get("stakes") ?? "drinks") as Stakes;
  const eventId = String(formData.get("event_id") ?? "") || null;

  if (players.length < 2) throw new Error("Pick at least two players.");
  if (players.length > 10) throw new Error("Ten players is the limit.");
  if (!["neutral", "grudge", "asshole"].includes(persona)) throw new Error("Unknown dealer.");
  if (!["drinks", "points"].includes(stakes)) throw new Error("Unknown stakes.");

  const user = await requireUser();
  if (!players.includes(user.id)) throw new Error("You have to be in the game to start it.");

  const supabase = await createClient();
  const { data: game, error } = await supabase
    .from("games")
    .insert({ group_id: groupId, event_id: eventId, persona, stakes, created_by: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: pErr } = await supabase
    .from("game_players")
    .insert(players.map((id, seat) => ({ game_id: game.id, user_id: id, seat })));
  if (pErr) throw new Error(pErr.message);

  const created: GameEvent = { t: "created", order: players, persona, stakes, by: user.id };
  const { error: eErr } = await supabase
    .from("game_events")
    .insert({ game_id: game.id, type: created.t, payload: created, actor: user.id });
  if (eErr) throw new Error(eErr.message);

  revalidatePath(`/g/${groupId}/games`);
  redirect(`/g/${groupId}/games/${game.id}`);
}

/** ── Playing ────────────────────────────────────────────────────────── */

export async function makeGuess(gameId: string, guess: Guess): Promise<Result> {
  const ctx = await load(gameId);
  if ("error" in ctx) return fail(ctx.error);
  const { state, user } = ctx;

  const round = state.phase === "r1" ? 1 : state.phase === "r2" ? 2 : state.phase === "r3" ? 3 : state.phase === "r4" ? 4 : null;
  if (!round) return fail("That part of the game is over.");
  if (actorFor(state) !== user.id) return fail("It isn't your turn.");

  const hand = (state.hands[user.id] ?? []).map((h) => h.card);
  const card = draw();
  const correct = judge(round as Round, guess, hand, card);
  return append(ctx, [{ t: "guess", player: user.id, round: round as Round, guess, card, correct, drinks: round }]);
}

export async function revealSlot(gameId: string, row: number, col: number): Promise<Result> {
  const ctx = await load(gameId);
  if ("error" in ctx) return fail(ctx.error);
  const { state, user } = ctx;
  if (state.phase !== "pyramid") return fail("The pyramid isn't up yet.");
  if (!state.order.includes(user.id)) return fail("You're not in this game.");
  if (!PYRAMID_ROWS[row] || col < 0 || col >= PYRAMID_ROWS[row]) return fail("No such slot.");

  const card = draw();
  const matches = findMatches(state, card.r);
  return append(ctx, [{ t: "pyramid", row, col, card, matches, each: rowValue(row) }]);
}

export async function finishPyramid(gameId: string): Promise<Result> {
  const ctx = await load(gameId);
  if ("error" in ctx) return fail(ctx.error);
  if (ctx.state.phase !== "pyramid") return fail("The pyramid is already done.");
  if (!ctx.state.order.includes(ctx.user.id)) return fail("You're not in this game.");
  return append(ctx, [{ t: "pyramidDone", by: ctx.user.id }]);
}

export async function tiebreakDraw(gameId: string): Promise<Result> {
  const ctx = await load(gameId);
  if ("error" in ctx) return fail(ctx.error);
  const { state } = ctx;
  if (state.phase !== "tiebreak") return fail("Nothing to break.");

  const draws = state.tied.map((player) => ({ player, card: draw() }));
  const low = Math.min(...draws.map((d) => d.card.r));
  const lowest = draws.filter((d) => d.card.r === low);
  return append(ctx, [{ t: "tiebreak", draws, rider: lowest.length === 1 ? lowest[0].player : null }]);
}

export async function busGuess(gameId: string, guess: Guess): Promise<Result> {
  const ctx = await load(gameId);
  if ("error" in ctx) return fail(ctx.error);
  const { state, user } = ctx;
  if (state.phase !== "bus") return fail("Nobody's on the bus.");
  if (state.rider !== user.id) return fail("Only the rider taps here.");

  const step = busStep(state);
  const card = draw();
  const correct = judge(step, guess, busHand(state), card);
  const cleared = correct && state.run.length === 3;
  return append(ctx, [{ t: "bus", guess, card, correct, reset: !correct, cleared }]);
}

export async function setPersona(gameId: string, persona: Persona): Promise<Result> {
  const ctx = await load(gameId);
  if ("error" in ctx) return fail(ctx.error);
  if (!["neutral", "grudge", "asshole"].includes(persona)) return fail("Unknown dealer.");
  // Any player can drop the persona; the runbook makes that a table right.
  if (!ctx.state.order.includes(ctx.user.id)) return fail("You're not in this game.");
  await ctx.supabase.from("games").update({ persona }).eq("id", gameId);
  return append(ctx, [{ t: "persona", persona, by: ctx.user.id }]);
}

export async function addNote(gameId: string, text: string): Promise<Result> {
  const clean = text.trim().slice(0, 200);
  if (!clean) return fail("Nothing to say.");
  const ctx = await load(gameId);
  if ("error" in ctx) return fail(ctx.error);
  return append(ctx, [{ t: "note", by: ctx.user.id, text: clean }]);
}

/** ── Ending ─────────────────────────────────────────────────────────── */

export async function finishGame(gameId: string): Promise<Result> {
  const ctx = await load(gameId);
  if ("error" in ctx) return fail(ctx.error);
  const { state, supabase, game, user } = ctx;
  if (game.status !== "active") return fail("Already filed.");
  if (state.phase !== "analysis") return fail("The bus is still running.");
  if (!state.order.includes(user.id)) return fail("You're not in this game.");

  const rows = state.order.map((p) => ({
    game_id: gameId,
    user_id: p,
    correct: state.stats[p].correct,
    given: state.stats[p].given,
    taken: state.stats[p].taken,
    laid: state.stats[p].laid,
    cards_left: state.stats[p].left,
    bus_runs: state.stats[p].busRuns,
    longest_miss: state.stats[p].longestMiss,
    rode_bus: state.rider === p,
  }));
  const { error } = await supabase.from("game_results").insert(rows);
  if (error && error.code !== "23505") return fail(error.message);

  await supabase.from("games").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", gameId);
  revalidatePath(`/g/${game.group_id}/games`);
  revalidatePath(`/g/${game.group_id}/games/${gameId}`);
  return { ok: true };
}

export async function abandonGame(gameId: string): Promise<Result> {
  const ctx = await load(gameId);
  if ("error" in ctx) return fail(ctx.error);
  if (!ctx.state.order.includes(ctx.user.id)) return fail("You're not in this game.");
  await ctx.supabase.from("games").update({ status: "abandoned" }).eq("id", ctx.game.id);
  revalidatePath(`/g/${ctx.game.group_id}/games`);
  return { ok: true };
}

/** Used by the recap screen; kept here so the page stays a server component. */
export async function analysisFor(gameId: string, names: Record<string, string>) {
  const ctx = await load(gameId);
  if ("error" in ctx) return null;
  return buildAnalysis(ctx.state, (id) => names[id] ?? "Someone");
}
