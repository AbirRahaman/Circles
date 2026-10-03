"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlayingCard } from "./PlayingCard";
import { cardName, RANK_LABEL } from "@/lib/games/ridethebus";
import {
  reduceEvents, actorFor, traderIndex, targetIndex, findLoser, buildAnalysis,
  type SYNEvent, type State,
} from "@/lib/games/screwyourneighbor";
import { synDealerLine, synRevealLine } from "@/lib/games/syndealer";
import {
  synKeep, synTrade, synDealerKeepAction, synDealerSwapAction,
  synNextRound, synEndGame, setPersona, abandonGame,
} from "@/app/actions/games";

type Result = { ok: true } | { ok: false; error: string };
type SYNActionOverrides = {
  synKeep?: (gameId: string) => Promise<Result>;
  synTrade?: (gameId: string) => Promise<Result>;
  synDealerKeepAction?: (gameId: string) => Promise<Result>;
  synDealerSwapAction?: (gameId: string) => Promise<Result>;
  synNextRound?: (gameId: string) => Promise<Result>;
  synEndGame?: (gameId: string) => Promise<Result>;
  setPersona?: (gameId: string, persona: string) => Promise<Result>;
  abandonGame?: (gameId: string) => Promise<Result>;
};

type Player = { id: string; name: string; avatar_url: string | null };
type Row = { seq: number; payload: SYNEvent };

export function ScrewYourNeighbor({
  gameId, groupId, players, initialRows, me, status,
  eventsTable = "game_events", actionOverrides,
}: {
  gameId: string; groupId: string; players: Player[]; initialRows: Row[];
  me: string; status: string;
  eventsTable?: string; actionOverrides?: SYNActionOverrides;
}) {
  const _synKeep = actionOverrides?.synKeep ?? synKeep;
  const _synTrade = actionOverrides?.synTrade ?? synTrade;
  const _synDealerKeepAction = actionOverrides?.synDealerKeepAction ?? synDealerKeepAction;
  const _synDealerSwapAction = actionOverrides?.synDealerSwapAction ?? synDealerSwapAction;
  const _synNextRound = actionOverrides?.synNextRound ?? synNextRound;
  const _synEndGame = actionOverrides?.synEndGame ?? synEndGame;
  const _setPersona = actionOverrides?.setPersona ?? setPersona;
  const _abandonGame = actionOverrides?.abandonGame ?? abandonGame;

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (status !== "active") return;
    const supabase = createClient();
    const channel = supabase
      .channel(`game:${gameId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: eventsTable, filter: `game_id=eq.${gameId}` },
        (payload) => {
          const r = payload.new as { seq: number; payload: SYNEvent };
          merge([{ seq: r.seq, payload: r.payload }]);
        })
      .subscribe();

    const poll = setInterval(async () => {
      if (document.hidden) return;
      const { data } = await supabase
        .from(eventsTable).select("seq, payload").eq("game_id", gameId)
        .gt("seq", lastSeq.current).order("seq");
      if (data?.length) merge(data as Row[]);
    }, 9000);

    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [gameId, status, merge]);

  const events = useMemo(() => rows.map((r) => r.payload), [rows]);
  const state = useMemo(() => reduceEvents(events), [events]);
  const nameOf = useCallback((id: string) => players.find((p) => p.id === id)?.name ?? "Someone", [players]);
  const first = (id: string) => nameOf(id).split(" ")[0];

  const last = events.at(-1) ?? null;
  const dealerLine = synDealerLine(state, last, events.length, first);
  const actor = actorFor(state);
  const myTurn = actor === me;
  const inGame = state.order.includes(me);
  const unit = state.stakes === "drinks" ? "drink" : "point";
  const dealerName = first(state.order[state.dealer] ?? "");

  const run = useCallback((fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Dealer */}
      <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-ink-3 mb-1">Dealer</div>
        <p className="text-[15px] leading-snug">{dealerLine}</p>
      </div>

      {error && (
        <p className="text-[13.5px] text-no border border-no-soft bg-no-soft rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Reveal announcement */}
      {state.phase === "reveal" && (
        <div className="rounded-xl border-2 border-accent bg-accent-soft px-3.5 py-3">
          <p className="text-[15px] font-semibold">{synRevealLine(state, events.length, first)}</p>
          <p className="text-[13px] text-ink-2 mt-1">
            {state.loser ? `${first(state.loser)} takes 1 ${unit}.` : ""}
          </p>
        </div>
      )}

      {/* Players & cards */}
      <div className="flex flex-col gap-2">
        {state.order.map((p, i) => {
          const card = state.cards[p];
          const isDealer = i === state.dealer;
          const hasKing = state.kings.includes(p);
          const isActor = actor === p;
          const isLoser = state.phase === "reveal" && state.loser === p;
          const showCard = p === me || hasKing || state.phase === "reveal" || state.phase === "done";

          return (
            <div
              key={p}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                isLoser ? "border-no bg-no-soft" :
                isActor ? "border-accent bg-accent-soft" :
                "border-line bg-surface"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold truncate">
                    {p === me ? "You" : first(p)}
                  </span>
                  {isDealer && (
                    <span className="text-[10.5px] font-mono uppercase tracking-wider text-ink-3 bg-surface-2 px-1.5 py-0.5 rounded">
                      Dealer
                    </span>
                  )}
                  {hasKing && (
                    <span className="text-[10.5px] font-mono uppercase tracking-wider text-go bg-go-soft px-1.5 py-0.5 rounded">
                      King
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-ink-3">
                  {state.scores[p] ?? 0} lost
                </div>
              </div>
              <PlayingCard card={showCard ? card ?? null : null} size="sm" />
            </div>
          );
        })}
      </div>

      {/* Trading phase — your turn */}
      {state.phase === "trading" && myTurn && (
        <div className="flex flex-col gap-2.5">
          <h2 className="font-display font-bold text-[16px]">Your turn</h2>
          {state.kings.includes(me) ? (
            <p className="text-[14px] text-ink-2">You have a King — you're locked in.</p>
          ) : (
            <>
              <p className="text-[14px] text-ink-2">
                Keep your card or trade with {first(state.order[targetIndex(state)])}.
                {state.kings.includes(state.order[targetIndex(state)]) &&
                  " (They have a King — trade will be blocked.)"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => run(() => _synKeep(gameId))}
                  disabled={pending}
                  className="rounded-xl border border-line-strong bg-surface px-3 py-4 text-[16px] font-semibold hover:bg-surface-2 disabled:opacity-45"
                >
                  Keep
                </button>
                <button
                  onClick={() => run(() => _synTrade(gameId))}
                  disabled={pending}
                  className="rounded-xl border border-line-strong bg-surface px-3 py-4 text-[16px] font-semibold hover:bg-surface-2 disabled:opacity-45"
                >
                  Trade
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Trading phase — waiting */}
      {state.phase === "trading" && !myTurn && (
        <p className="text-[14px] text-ink-2">
          Waiting on {first(actor ?? "")}.
        </p>
      )}

      {/* Dealer's turn */}
      {state.phase === "dealer" && (
        <div className="flex flex-col gap-2.5">
          <h2 className="font-display font-bold text-[16px]">{dealerName}'s call</h2>
          {state.order[state.dealer] === me ? (
            <>
              <p className="text-[14px] text-ink-2">Keep your card or draw from the deck.</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => run(() => _synDealerKeepAction(gameId))}
                  disabled={pending}
                  className="rounded-xl border border-line-strong bg-surface px-3 py-4 text-[16px] font-semibold hover:bg-surface-2 disabled:opacity-45"
                >
                  Keep
                </button>
                <button
                  onClick={() => run(() => _synDealerSwapAction(gameId))}
                  disabled={pending}
                  className="rounded-xl border border-line-strong bg-surface px-3 py-4 text-[16px] font-semibold hover:bg-surface-2 disabled:opacity-45"
                >
                  Draw
                </button>
              </div>
            </>
          ) : (
            <p className="text-[14px] text-ink-2">Waiting on {dealerName} (dealer).</p>
          )}
        </div>
      )}

      {/* Reveal — next round / end */}
      {state.phase === "reveal" && status === "active" && inGame && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => run(() => _synNextRound(gameId))}
            disabled={pending}
            className="rounded-xl bg-accent text-accent-ink px-3 py-3 font-semibold disabled:opacity-45"
          >
            Next round
          </button>
          <button
            onClick={() => run(() => _synEndGame(gameId))}
            disabled={pending}
            className="rounded-xl border border-line-strong bg-surface px-3 py-3 font-semibold hover:bg-surface-2 disabled:opacity-45"
          >
            End game
          </button>
        </div>
      )}

      {/* Done — recap */}
      {state.phase === "done" && <SYNRecap state={state} nameOf={nameOf} me={me} unit={unit} />}

      {/* History */}
      {state.roundHistory.length > 0 && (
        <details className="rounded-xl border border-line bg-surface">
          <summary className="px-3.5 py-2.5 cursor-pointer text-[13.5px] font-semibold list-none">
            Round history ({state.roundHistory.length})
          </summary>
          <ol className="border-t border-line px-3.5 py-2 flex flex-col gap-1 max-h-64 overflow-auto">
            {state.roundHistory.map((h) => (
              <li key={h.round} className="text-[12.5px] text-ink-2">
                Round {h.round}: {first(h.loser)} lost
              </li>
            ))}
          </ol>
        </details>
      )}

      {/* Log */}
      <details className="rounded-xl border border-line bg-surface">
        <summary className="px-3.5 py-2.5 cursor-pointer text-[13.5px] font-semibold list-none">
          Event log ({events.length})
        </summary>
        <ol className="border-t border-line px-3.5 py-2 flex flex-col-reverse gap-1 max-h-64 overflow-auto">
          {events.map((e, i) => (
            <li key={i} className="text-[12.5px] text-ink-2">{describeSYN(e, first)}</li>
          ))}
        </ol>
      </details>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        {state.persona !== "neutral" && inGame && status === "active" && (
          <button onClick={() => run(() => _setPersona(gameId, "neutral"))} disabled={pending}
            className="rounded-xl border border-line-strong px-3 py-2.5 text-[13.5px] font-semibold hover:bg-surface-2">
            Tone it down
          </button>
        )}
        {status === "active" && state.phase !== "done" && inGame && (
          <button onClick={() => run(() => _abandonGame(gameId))} disabled={pending}
            className="rounded-xl border border-no-soft text-no px-3 py-2.5 text-[13.5px] font-semibold hover:bg-no-soft">
            End game
          </button>
        )}
      </div>

      <p className="text-[12px] text-ink-3">
        Cards are dealt on the server. Everyone sees the same game log.
        Ace is low, King is high. Lowest card after trading loses the round.
      </p>
    </div>
  );
}

function SYNRecap({
  state, nameOf, me, unit,
}: { state: State; nameOf: (id: string) => string; me: string; unit: string }) {
  const { rows, awards } = buildAnalysis(state, nameOf);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display font-bold text-[17px]">How it went</h2>
      {awards.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {awards.map((a) => (
            <div key={a.title} className="flex items-baseline gap-2 text-[14px]">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3 w-[108px] shrink-0">
                {a.title}
              </span>
              <span>
                <strong>{a.name}</strong>{" "}
                <span className="text-ink-2">— {a.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-line overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-surface-2 text-ink-2 text-[11.5px] uppercase tracking-wider">
              <th className="text-left font-semibold px-3 py-2">Player</th>
              <th className="text-right font-semibold px-2 py-2">Rounds</th>
              <th className="text-right font-semibold px-3 py-2">Lost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player} className="border-t border-line">
                <td className="px-3 py-2">
                  {r.player === me ? "You" : nameOf(r.player).split(" ")[0]}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{r.roundsPlayed}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.roundsLost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-ink-3">Counted in {unit}s.</p>
    </div>
  );
}

function describeSYN(e: SYNEvent, first: (id: string) => string): string {
  switch (e.t) {
    case "created": return `Game on: ${e.order.map(first).join(", ")}.`;
    case "dealt": return `Round ${e.round} dealt. Dealer: ${first(e.cards[Object.keys(e.cards)[0]] ? Object.keys(e.cards)[0] : "")}.`;
    case "keep": return `${first(e.player)} keeps.`;
    case "trade": return `${first(e.player)} trades with ${first(e.target)}.`;
    case "blocked": return `${first(e.player)} tried to trade — ${first(e.target)}'s King blocks.`;
    case "dealerKeep": return "Dealer keeps.";
    case "dealerSwap": return `Dealer draws ${cardName(e.drawn)}.`;
    case "nextRound": return `Round ${e.round - 1}: ${first(e.loser)} lost.`;
    case "endGame": return `${first(e.by)} ended the game.`;
    case "persona": return `Dealer switched to ${e.persona}.`;
    case "note": return `${first(e.by)}: ${e.text}`;
    default: return "";
  }
}
