import { RANK_LABEL, isRed, type Card } from "@/lib/games/ridethebus";

/** Cards are drawn, not loaded: four tiny SVG paths and some CSS. No images,
 *  no sprite sheet, nothing to download. */
const PIPS: Record<string, string> = {
  S: "M12 2.5c2.6 4 7.5 6.2 7.5 10.3a4.3 4.3 0 0 1-6.8 3.5c.2 2 .9 3.4 2 4.7h-5.4c1.1-1.3 1.8-2.7 2-4.7a4.3 4.3 0 0 1-6.8-3.5C4.5 8.7 9.4 6.5 12 2.5z",
  H: "M12 21C6.5 16.8 3.5 13.6 3.5 9.9A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8.5 2.3c0 3.7-3 6.9-8.5 11.1z",
  D: "M12 2.2l7 9.8-7 9.8-7-9.8z",
  C: "M12 2.6a4 4 0 0 1 3.1 6.5 4 4 0 1 1 .7 7.4 8 8 0 0 1-1.5-.2c.2 1.9.9 3.2 2 4.4H7.7c1.1-1.2 1.8-2.5 2-4.4a8 8 0 0 1-1.5.2 4 4 0 1 1 .7-7.4A4 4 0 0 1 12 2.6z",
};

const SIZES = {
  sm: { w: 34, h: 48, rank: 13, pip: 11 },
  md: { w: 46, h: 64, rank: 17, pip: 15 },
  lg: { w: 76, h: 106, rank: 28, pip: 26 },
} as const;

export function PlayingCard({
  card, size = "md", dim = false, label,
}: { card: Card | null; size?: keyof typeof SIZES; dim?: boolean; label?: string }) {
  const s = SIZES[size];

  if (!card) {
    return (
      <span
        aria-label={label ?? "face down"}
        className="inline-block rounded-md border border-line-strong bg-surface-2"
        style={{ width: s.w, height: s.h, backgroundImage: "repeating-linear-gradient(45deg, var(--line) 0 3px, transparent 3px 7px)" }}
      />
    );
  }

  const red = isRed(card);
  return (
    <span
      aria-label={`${RANK_LABEL[card.r]} of ${card.s}`}
      className={`inline-flex flex-col items-center justify-center rounded-md border bg-surface ${dim ? "opacity-40" : ""}`}
      style={{ width: s.w, height: s.h, borderColor: "var(--line-strong)", color: red ? "var(--no)" : "var(--ink)" }}
    >
      <span className="font-bold leading-none tabular-nums" style={{ fontSize: s.rank }}>{RANK_LABEL[card.r]}</span>
      <svg viewBox="0 0 24 24" width={s.pip} height={s.pip} fill="currentColor" aria-hidden="true"><path d={PIPS[card.s]} /></svg>
    </span>
  );
}
