"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { joinAdhocGame, startAdhocGame } from "@/app/actions/adhoc-games";

type Player = { guest_token: string; name: string; seat: number | null };

export function AdhocLobby({
  gameId, token, kind, players: initialPlayers, guestToken, isHost, hasJoined, minPlayers,
}: {
  gameId: string;
  token: string;
  kind: string;
  players: Player[];
  guestToken: string;
  isHost: boolean;
  hasJoined: boolean;
  minPlayers: number;
}) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [copied, setCopied] = useState(false);
  const [starting, startTransition] = useTransition();
  const [startError, setStartError] = useState<string | null>(null);

  // Join form
  const joinAction = joinAdhocGame.bind(null, gameId);
  const [joinState, joinFormAction, joinPending] = useActionState(joinAction, null);

  // Realtime: watch for new players joining
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`lobby:${gameId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "adhoc_players", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const p = payload.new as Player;
          setPlayers((prev) => {
            if (prev.some((x) => x.guest_token === p.guest_token)) return prev;
            return [...prev, p];
          });
        })
      .subscribe();

    // Also poll for game status change (host started)
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("adhoc_games").select("status").eq("id", gameId).maybeSingle();
      if (data?.status === "active") {
        window.location.reload();
      }
    }, 3000);

    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [gameId]);

  const copyLink = useCallback(async () => {
    const url = `${window.location.origin}/play/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [token]);

  const handleStart = useCallback(() => {
    setStartError(null);
    startTransition(async () => {
      const res = await startAdhocGame(gameId);
      if (!res.ok) {
        setStartError(res.error);
      } else {
        window.location.reload();
      }
    });
  }, [gameId]);

  const alreadyJoined = hasJoined || joinState?.success;

  return (
    <div className="flex flex-col gap-4">
      {/* Share link */}
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-3">
        <p className="text-[13.5px] text-[var(--ink-2)]">Share this link so others can join:</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={`${typeof window !== "undefined" ? window.location.origin : ""}/play/${token}`}
            className="flex-1 min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-[13.5px] text-[var(--ink)] font-mono"
            onFocus={(e) => e.target.select()}
          />
          <button
            onClick={copyLink}
            className="rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-[13.5px] font-semibold btn-lift shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Players in lobby */}
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--line)] flex items-center justify-between">
          <span className="text-[12.5px] font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            Players ({players.length})
          </span>
          <span className="text-[12px] text-[var(--ink-3)]">
            {players.length < minPlayers ? `Need ${minPlayers - players.length} more` : "Ready"}
          </span>
        </div>
        {players.map((p, i) => (
          <div key={p.guest_token} className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--line)] last:border-b-0">
            <span className="w-7 h-7 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center text-[12px] font-bold shrink-0">
              {p.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-[14.5px] font-medium flex-1">{p.name}</span>
            {p.guest_token === guestToken && (
              <span className="text-[11.5px] text-[var(--ink-3)] font-medium">You</span>
            )}
            {i === 0 && (
              <span className="text-[11px] text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded font-semibold">Host</span>
            )}
          </div>
        ))}
        {players.length === 0 && (
          <div className="px-4 py-6 text-center text-[13.5px] text-[var(--ink-3)]">
            Waiting for players…
          </div>
        )}
      </div>

      {/* Join form — if not yet joined */}
      {!alreadyJoined && (
        <form action={joinFormAction} className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 flex flex-col gap-3">
          <label className="text-[12.5px] font-semibold text-[var(--ink-2)] uppercase tracking-wider">
            Join this game
          </label>
          <input
            name="name"
            type="text"
            required
            maxLength={40}
            placeholder="Your name"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
          />
          {joinState?.error && (
            <p className="text-[13px] text-[var(--no)] bg-[var(--no-soft)] px-3 py-2 rounded-lg">{joinState.error}</p>
          )}
          <button
            type="submit"
            disabled={joinPending}
            className="w-full rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] font-semibold text-[15px] py-3 btn-lift disabled:opacity-45"
          >
            {joinPending ? "Joining…" : "Join"}
          </button>
        </form>
      )}

      {/* Start button — host only */}
      {isHost && alreadyJoined && (
        <div className="flex flex-col gap-2">
          {startError && (
            <p className="text-[13px] text-[var(--no)] bg-[var(--no-soft)] px-3 py-2 rounded-lg">{startError}</p>
          )}
          <button
            onClick={handleStart}
            disabled={starting || players.length < minPlayers}
            className="w-full rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] font-semibold text-[15px] py-3 btn-lift disabled:opacity-45"
          >
            {starting ? "Starting…" : `Start game (${players.length} player${players.length !== 1 ? "s" : ""})`}
          </button>
        </div>
      )}

      {/* Waiting message for non-host joined players */}
      {!isHost && alreadyJoined && (
        <p className="text-center text-[13.5px] text-[var(--ink-2)] py-2">
          You're in! Waiting for the host to start the game…
        </p>
      )}
    </div>
  );
}
