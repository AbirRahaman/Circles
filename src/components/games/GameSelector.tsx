"use client";

import { useCallback, useState } from "react";
import { createGame } from "@/app/actions/games";
import { SubmitButton } from "@/components/SubmitButton";
import { Field } from "@/components/ui";

type Member = { id: string; name: string };

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
] as const;

export function GameSelector({
  groupId,
  members,
  userId,
  eventId,
}: {
  groupId: string;
  members: Member[];
  userId: string;
  eventId: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([userId]); // current user starts in seat 1
  const [mode, setMode] = useState<"single" | "multi">("multi");
  const game = GAMES.find((g) => g.kind === selected);

  const togglePlayer = useCallback((id: string) => {
    setOrder((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        {GAMES.map((g) => (
          <button
            key={g.kind}
            onClick={() => setSelected((s) => (s === g.kind ? null : g.kind))}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors ${
              selected === g.kind
                ? "border-accent bg-accent-soft"
                : "border-line bg-surface hover:bg-surface-2"
            }`}
          >
            <span className={selected === g.kind ? "text-accent" : "text-ink-2"}>{g.icon}</span>
            <span className="font-semibold text-[14.5px] leading-tight">{g.name}</span>
            <span className="text-[12px] text-ink-2 leading-snug">{g.desc}</span>
            <span className="text-[11px] text-ink-3">{g.min}–{g.max} players</span>
          </button>
        ))}
      </div>

      {game && (
        <form
          action={createGame.bind(null, groupId)}
          className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5"
        >
          <input type="hidden" name="kind" value={game.kind} />
          <input type="hidden" name="mode" value={mode} />
          {eventId && <input type="hidden" name="event_id" value={eventId} />}
          {/* Hidden inputs carry the tap-ordered player IDs */}
          {order.map((id) => (
            <input key={id} type="hidden" name="players" value={id} />
          ))}

          {/* Phone mode */}
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[12.5px] font-semibold text-ink-2 mb-1.5">
              How are you playing?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                  mode === "single"
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface-2 hover:bg-surface-2/80"
                }`}
              >
                <span className="text-[14px] font-semibold">One phone</span>
                <span className="text-[11.5px] text-ink-2 leading-snug">Pass it around the table</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("multi")}
                className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                  mode === "multi"
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface-2 hover:bg-surface-2/80"
                }`}
              >
                <span className="text-[14px] font-semibold">Own phones</span>
                <span className="text-[11.5px] text-ink-2 leading-snug">Everyone plays on theirs</span>
              </button>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[12.5px] font-semibold text-ink-2 mb-1.5">
              Tap in seat order
            </legend>
            {members.map((m) => {
              const seat = order.indexOf(m.id);
              const isIn = seat !== -1;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => togglePlayer(m.id)}
                  className={`flex items-center gap-2.5 text-[14px] rounded-lg px-2.5 py-2 text-left transition-colors ${
                    isIn
                      ? "bg-accent-soft border border-accent"
                      : "bg-surface-2 border border-line hover:bg-surface-2/80"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                    isIn
                      ? "bg-accent text-accent-ink"
                      : "bg-surface border border-line text-ink-3"
                  }`}>
                    {isIn ? seat + 1 : ""}
                  </span>
                  <span className={isIn ? "font-semibold" : ""}>
                    {m.id === userId ? `${m.name} (you)` : m.name}
                  </span>
                </button>
              );
            })}
          </fieldset>

          <div className="flex gap-2.5">
            <span className="flex-1 min-w-0">
              <Field label="Dealer">
                <select name="persona" defaultValue="asshole">
                  <option value="asshole">Roasts everyone</option>
                  <option value="grudge">Holds a grudge</option>
                  <option value="neutral">Plain announcer</option>
                </select>
              </Field>
            </span>
            <span className="flex-1 min-w-0">
              <Field label="Counting">
                <select name="stakes" defaultValue="drinks">
                  <option value="drinks">Drinks</option>
                  <option value="points">Points</option>
                </select>
              </Field>
            </span>
          </div>

          <SubmitButton className="w-full" pendingLabel="Shuffling…">
            Start {game.name}
          </SubmitButton>

          <p className="text-[12px] text-ink-2">
            {order.length < game.min
              ? `Tap at least ${game.min} players to start.`
              : mode === "single"
              ? "One phone — pass it around for each turn."
              : "Everyone plays from their own phone."}
          </p>
        </form>
      )}
    </div>
  );
}
