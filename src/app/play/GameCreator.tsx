"use client";

import { useState } from "react";
import { createAdhocGame } from "@/app/actions/adhoc-games";

const GAMES = [
  {
    kind: "ridethebus",
    name: "Ride the Bus",
    desc: "Four guesses, the pyramid, then somebody rides",
    min: 2,
    max: 10,
    icon: (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="7" cy="15" r="1.2" fill="currentColor" />
        <circle cx="17" cy="15" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    kind: "screwyourneighbor",
    name: "Screw Your Neighbor",
    desc: "Trade your way out of the lowest card",
    min: 3,
    max: 10,
    icon: (
      <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 16l5-5 5 5" />
        <path d="M7 8l5 5 5-5" />
      </svg>
    ),
  },
];

export function GameCreator() {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const game = GAMES.find((g) => g.kind === selected);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        setError(null);
        try {
          await createAdhocGame(formData);
        } catch (e: any) {
          setError(e?.message ?? "Something went wrong.");
          setPending(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      {/* Game tiles */}
      <div className="grid grid-cols-2 gap-2.5">
        {GAMES.map((g) => (
          <button
            key={g.kind}
            type="button"
            onClick={() => setSelected((s) => (s === g.kind ? null : g.kind))}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors ${
              selected === g.kind
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
            }`}
          >
            <span className={selected === g.kind ? "text-[var(--accent)]" : "text-[var(--ink-2)]"}>{g.icon}</span>
            <span className="font-semibold text-[14.5px] leading-tight">{g.name}</span>
            <span className="text-[12px] text-[var(--ink-2)] leading-snug">{g.desc}</span>
            <span className="text-[11px] text-[var(--ink-3)]">{g.min}–{g.max} players</span>
          </button>
        ))}
      </div>

      {/* Setup — shows after selecting */}
      {game && (
        <div className="flex flex-col gap-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4">
          <input type="hidden" name="kind" value={game.kind} />

          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold text-[var(--ink-2)] uppercase tracking-wider">Your name</label>
            <input
              name="name"
              type="text"
              required
              maxLength={40}
              placeholder="Enter your name"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-[var(--ink-2)] uppercase tracking-wider">Dealer</label>
              <select name="persona" defaultValue="asshole"
                className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--accent)]">
                <option value="asshole">Asshole</option>
                <option value="grudge">Grudge</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-[var(--ink-2)] uppercase tracking-wider">Stakes</label>
              <select name="stakes" defaultValue="drinks"
                className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--accent)]">
                <option value="drinks">Drinks</option>
                <option value="points">Points</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-[var(--no)] bg-[var(--no-soft)] px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] font-semibold text-[15px] py-3 hover:opacity-90 disabled:opacity-45 transition-opacity"
          >
            {pending ? "Creating…" : "Create game link"}
          </button>
        </div>
      )}
    </form>
  );
}
