"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlayingCard } from "./PlayingCard";
import {
  reduceEvents, actorFor, busStep, busHand, impossible, phaseRound, buildAnalysis, cardName,
  type GameEvent, type Guess, type Round,
} from "@/lib/games/ridethebus";
import { dealerLine, riderLine } from "@/lib/games/dealer";
import {
  makeGuess, revealSlot, finishPyramid, tiebreakDraw, busGuess, finishGame, abandonGame, setPersona,
} from "@/app/actions/games";

type Player = { id: string; name: string; avatar_url: string | null };
type Row = { seq: number; payload: GameEvent };

const GUESSES: Record<Round, { value: Guess; label: string }[]> = {
  1: [{ value: "red", label: "Red" }, { value: "black", label: "Black" }],
  2: [{ value: "higher", label: "Higher" }, { value: "lower", label: "Lower" }],
  3: [{ value: "inside", label: "Inside" }, { value: "outside", label: "Outside" }],
  4: [{ value: "S", label: "Spades ♠" }, { value: "H", label: "Hearts ♥" }, { value: "D", label: "Diamonds ♦" }, { value: "C", label: "Clubs ♣" }],
};
const ROUND_ASK: Record<Round, string> = {
  1: "Red or black?", 2: "Higher or lower than your first card?",
  3: "Inside or outside your first two?", 4: "Pick the suit.",
};

export function RideTheBus({
  gameId, groupId, players, initialRows, me, status,
}: {
  gameId: string; groupId: string; players: Player[]; initialRows: Row[]; me: string; status: string;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const lastSeq = useRef(initialRows.at(-1)?.seq ?? -1);

  const merge = useCallback((incoming: Row[]) => {
    setRows((prev) => {
      const bySeq = new Map(prev.map((r) => [r.seq, r]));
      for (const r of incoming) bySeq.set(r.seq, r);
      const next = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
      lastSeq.current = next.at(-1)?.seq ?? -1;
      return next;
    });
  }, []);

  // Everyone's phone watches the same log. Realtime carries the events;
  // the poll is a safety net for a dropped socket, and stops when the
  // tab is hidden or the game is over.
  useEffect(() => {
    if (status !== "active") return;
    const supabase = createClient();
    const channel = supabase
      .channel(`game:${gameId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const r = payload.new as { seq: number; payload: GameEvent };
          merge([{ seq: r.seq, payload: r.payload }]);
        })
      .subscribe();

    const poll = setInterval(async () => {
      if (document.hidden) return;
      const { data } = await supabase
        .from("game_events").select("seq, payload").eq("game_id", gameId).gt("seq", lastSeq.current).order("seq");
      if (data?.length) merge(data as Row[]);
    }, 9000);

    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [gameId, status, merge]);

  const events = useMemo(() => rows.map((r) => r.payload), [rows]);
  const state = useMemo(() => reduceEvents(events), [events]);
  const nameOf = useCallback((id: string) => players.find((p) => p.id === id)?.name ?? "Someone", [players]);
  const first = (id: string) => nameOf(id).split(" ")[0];

  const last = events.at(-1) ?? null;
  const line = dealerLine(state, last, events.length, nameOf);
  const actor = actorFor(state);
  const myTurn = actor === me;
  const round = phaseRound(state.phase);
  const inGame = state.order.includes(me);
  const unit = state.stakes === "drinks" ? "drink" : "point";

  const run = useCallback((fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    setWarn(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  }, []);

  const guess = (g: Guess) => {
    if (!round) return;
    const hand = (state.hands[me] ?? []).map((h) => h.card);
    const bad = impossible(round, g, hand);
    if (bad && warn !== bad) { setWarn(bad); return; } // tap again to confirm
    run(() => makeGuess(gameId, g));
  };

  const busTap = (g: Guess) => {
    const step = busStep(state);
    const bad = impossible(step, g, busHand(state));
    if (bad && warn !== bad) { setWarn(bad); return; }
    run(() => busGuess(gameId, g));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Dealer */}
      <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-ink-3 mb-1">Dealer</div>
        <p className="text-[15px] leading-snug">{line}</p>
        {state.phase === "bus" && <p className="text-[13px] text-ink-2 mt-1">{riderLine(state, nameOf)}</p>}
      </div>

      {error && <p className="text-[13.5px] text-no border border-no-soft bg-no-soft rounded-lg px-3 py-2">{error}</p>}
      {warn && <p className="text-[13.5px] text-maybe border border-maybe-soft bg-maybe-soft rounded-lg px-3 py-2">{warn} Tap the same button again to go ahead.</p>}

      {/* Hands */}
      <div className="flex flex-col gap-2">
        {state.order.map((p) => {
          const hand = state.hands[p] ?? [];
          const isActor = actor === p;
          return (
            <div key={p} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isActor ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
              <div className="w-[76px] shrink-0">
                <div className="text-[13.5px] font-semibold truncate">{p === me ? "You" : first(p)}</div>
                <div className="font-mono text-[11px] text-ink-3">
                  {state.stats[p]?.given ?? 0} out · {state.stats[p]?.taken ?? 0} in
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {hand.length === 0 && <span className="text-[12.5px] text-ink-3">no cards yet</span>}
                {hand.map((h, i) => <PlayingCard key={i} card={h.card} size="sm" dim={h.played} />)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rounds 1–4 */}
      {round && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-bold text-[16px]">Round {round}</h2>
            <span className="text-[12.5px] text-ink-3">{round} {unit}{round === 1 ? "" : "s"} on the line</span>
          </div>
          {myTurn ? (
            <>
              <p className="text-[14px] text-ink-2">{ROUND_ASK[round]}</p>
              <div className={`grid gap-2 ${round === 4 ? "grid-cols-2" : "grid-cols-2"}`}>
                {GUESSES[round].map((g) => (
                  <button
                    key={g.value}
                    onClick={() => guess(g.value)}
                    disabled={pending}
                    className="rounded-xl border border-line-strong bg-surface px-3 py-4 text-[16px] font-semibold hover:bg-surface-2 disabled:opacity-45"
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[14px] text-ink-2">Waiting on {first(actor ?? "")}.</p>
          )}
        </div>
      )}

      {/* Pyramid */}
      {state.phase === "pyramid" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-bold text-[16px]">Pyramid</h2>
            <span className="text-[12.5px] text-ink-3">{state.revealed} flipped</span>
          </div>
          <p className="text-[13.5px] text-ink-2">
            Tap any slot — even one already turned over. Row 1 pays 1, the top pays 6.
          </p>
          <div className="flex flex-col-reverse items-center gap-1.5">
            {state.pyramid.map((cards, row) => (
              <div key={row} className="flex gap-1.5">
                {cards.map((card, col) => (
                  <button
                    key={col}
                    onClick={() => run(() => revealSlot(gameId, row, col))}
                    disabled={pending || !inGame}
                    className="rounded-md disabled:opacity-60 focus:outline-none focus-visible:ring-2 ring-accent"
                    aria-label={`Row ${row + 1}, slot ${col + 1}`}
                  >
                    <PlayingCard card={card} size="sm" />
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button
            onClick={() => run(() => finishPyramid(gameId))}
            disabled={pending || !inGame}
            className="rounded-xl border border-line-strong bg-surface px-3 py-3 font-semibold hover:bg-surface-2 disabled:opacity-45"
          >
            Finish pyramid
          </button>
        </div>
      )}

      {/* Tiebreak */}
      {state.phase === "tiebreak" && (
        <div className="flex flex-col gap-2.5">
          <h2 className="font-display font-bold text-[16px]">Tied for most cards left</h2>
          <p className="text-[14px] text-ink-2">{state.tied.map(first).join(" and ")} draw one each. Lowest rides.</p>
          <button
            onClick={() => run(() => tiebreakDraw(gameId))}
            disabled={pending || !inGame}
            className="rounded-xl bg-accent text-accent-ink px-3 py-3 font-semibold disabled:opacity-45"
          >
            Draw
          </button>
        </div>
      )}

      {/* Bus */}
      {state.phase === "bus" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display font-bold text-[16px]">{first(state.rider ?? "")} is riding</h2>
            <span className="font-mono text-[12px] text-ink-3">run {state.runsStarted + 1} · {state.busDraws} cards</span>
          </div>
          <div className="flex gap-1.5 items-center">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="flex items-center gap-1.5">
                <PlayingCard card={state.run[i]?.card ?? null} size="md" />
                {i < 3 && <span className="text-ink-3">→</span>}
              </span>
            ))}
          </div>
          {state.rider === me ? (
            <>
              <p className="text-[14px] text-ink-2">{ROUND_ASK[busStep(state)]}</p>
              <div className="grid grid-cols-2 gap-2">
                {GUESSES[busStep(state)].map((g) => (
                  <button
                    key={g.value}
                    onClick={() => busTap(g.value)}
                    disabled={pending}
                    className="rounded-xl border border-line-strong bg-surface px-3 py-4 text-[16px] font-semibold hover:bg-surface-2 disabled:opacity-45"
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[14px] text-ink-2">Only {first(state.rider ?? "")} taps now.</p>
          )}
        </div>
      )}

      {/* Analysis */}
      {state.phase === "analysis" && <Recap state={state} nameOf={nameOf} me={me} unit={unit} />}

      {/* Log */}
      <details className="rounded-xl border border-line bg-surface">
        <summary className="px-3.5 py-2.5 cursor-pointer text-[13.5px] font-semibold list-none">
          Hand history ({events.length})
        </summary>
        <ol className="border-t border-line px-3.5 py-2 flex flex-col-reverse gap-1 max-h-64 overflow-auto">
          {events.map((e, i) => <li key={i} className="text-[12.5px] text-ink-2">{describe(e, first)}</li>)}
        </ol>
      </details>

      {/* Table controls */}
      <div className="flex gap-2 flex-wrap">
        {state.phase === "analysis" && status === "active" && (
          <button onClick={() => run(() => finishGame(gameId))} disabled={pending}
            className="flex-1 rounded-xl bg-accent text-accent-ink px-3 py-3 font-semibold disabled:opacity-45">
            File the results
          </button>
        )}
        {state.persona !== "neutral" && inGame && status === "active" && (
          <button onClick={() => run(() => setPersona(gameId, "neutral"))} disabled={pending}
            className="rounded-xl border border-line-strong px-3 py-2.5 text-[13.5px] font-semibold hover:bg-surface-2">
            Tone it down
          </button>
        )}
        {status === "active" && state.phase !== "analysis" && inGame && (
          <button onClick={() => run(() => abandonGame(gameId))} disabled={pending}
            className="rounded-xl border border-no-soft text-no px-3 py-2.5 text-[13.5px] font-semibold hover:bg-no-soft">
            End game
          </button>
        )}
      </div>
      <p className="text-[12px] text-ink-3">
        Cards are drawn on the server and written to a log every phone reads, so everyone sees the
        same game and nobody can deal themselves a better one.
      </p>
    </div>
  );
}

function Recap({ state, nameOf, me, unit }: { state: ReturnType<typeof reduceEvents>; nameOf: (id: string) => string; me: string; unit: string }) {
  const { rows, awards } = buildAnalysis(state, nameOf);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display font-bold text-[17px]">How it went</h2>
      <div className="flex flex-col gap-1.5">
        {awards.map((a) => (
          <div key={a.title} className="flex items-baseline gap-2 text-[14px]">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3 w-[108px] shrink-0">{a.title}</span>
            <span><strong>{a.name}</strong> <span className="text-ink-2">— {a.detail}</span></span>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-line overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-surface-2 text-ink-2 text-[11.5px] uppercase tracking-wider">
              <th className="text-left font-semibold px-3 py-2">Player</th>
              <th className="text-right font-semibold px-2 py-2">✓</th>
              <th className="text-right font-semibold px-2 py-2">out</th>
              <th className="text-right font-semibold px-2 py-2">in</th>
              <th className="text-right font-semibold px-3 py-2">left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player} className="border-t border-line">
                <td className="px-3 py-2">{r.player === me ? "You" : nameOf(r.player).split(" ")[0]}{state.rider === r.player ? " 🚌" : ""}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.correct}/4</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.given}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.taken}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.left}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-ink-3">Counted in {unit}s.</p>
    </div>
  );
}

function describe(e: GameEvent, first: (id: string) => string): string {
  switch (e.t) {
    case "created": return `Game on: ${e.order.map(first).join(", ")}.`;
    case "guess": return `R${e.round} ${first(e.player)} said ${e.guess} → ${cardName(e.card)} ${e.correct ? `✓ gives ${e.drinks}` : `✗ takes ${e.drinks}`}`;
    case "pyramid": return `Row ${e.row + 1}: ${cardName(e.card)}${e.matches.length ? ` — ${e.matches.map((m) => first(m.player)).join(", ")} lay down, ${e.each} each` : " — no match"}`;
    case "pyramidDone": return "Pyramid finished.";
    case "tiebreak": return `Tiebreak: ${e.draws.map((d) => `${first(d.player)} ${cardName(d.card)}`).join(", ")}${e.rider ? ` → ${first(e.rider)} rides` : " → tied again"}`;
    case "bus": return `Bus: ${e.guess} → ${cardName(e.card)} ${e.correct ? "✓" : "✗ reset"}${e.cleared ? " — off the bus" : ""}`;
    case "persona": return `Dealer switched to ${e.persona}.`;
    case "note": return `${first(e.by)}: ${e.text}`;
    default: return "";
  }
}
