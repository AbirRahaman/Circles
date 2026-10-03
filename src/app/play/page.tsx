import type { Metadata } from "next";
import { GameCreator } from "./GameCreator";

export const metadata: Metadata = {
  title: "Play a Game · Socius",
  description: "Start a card game and share the link with friends.",
  openGraph: { title: "Play a Game · Socius", description: "Start a card game and share the link with friends." },
};

export default function PlayPage() {
  return (
    <div className="min-h-svh bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto max-w-[468px] px-4 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <svg viewBox="0 0 32 32" width={40} height={40} fill="none" stroke="var(--accent)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="6" width="24" height="20" rx="3" />
            <path d="M16 11v10M11 16h10" />
          </svg>
          <h1 className="font-display font-bold text-[22px]">Play a Game</h1>
          <p className="text-[14px] text-[var(--ink-2)] max-w-[280px]">
            Pick a game, share the link, and play with anyone — no account needed.
          </p>
        </div>

        <GameCreator />

        {/* Footer */}
        <p className="text-center text-[12px] text-[var(--ink-3)]">
          Powered by <a href="/" className="font-semibold text-[var(--accent)] hover:underline">Socius</a>
        </p>
      </div>
    </div>
  );
}
