"use client";

import { useState } from "react";

/* People down the side, days across the top, scroll sideways through the
 * window. Your own row is the only one you can touch; toggling is local and
 * one Save writes the lot, so marking five days isn't five round trips.
 *
 * Every label is computed on the server — doing date maths here would use
 * the viewer's timezone and break the app's single-timezone rule. */

export type GridDay = { key: string; dayNum: string; weekday: string };
export type GridPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
  color: string;
  initials: string;
  busy: string[];
  answered: boolean;
};

export function AvailabilityGrid({
  days, people, meId, action,
}: {
  days: GridDay[];
  people: GridPerson[];
  meId: string;
  action: (formData: FormData) => void;
  }) {
  const me = people.find((p) => p.id === meId);
  const [mine, setMine] = useState<Set<string>>(new Set(me?.busy ?? []));
  const [dirty, setDirty] = useState(false);

  const toggle = (day: string) => {
    setMine((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
    setDirty(true);
  };

  const busyOn = (p: GridPerson, day: string) =>
    p.id === meId ? mine.has(day) : p.busy.includes(day);

  const answered = people.filter((p) => (p.id === meId ? true : p.answered));
  const freeCount = (day: string) => answered.filter((p) => !busyOn(p, day)).length;
  const bestFree = days.length ? Math.max(...days.map((d) => freeCount(d.key))) : 0;

  return (
    <form action={action} className="flex flex-col gap-3">
      {[...mine].map((d) => <input key={d} type="hidden" name="unavailable" value={d} />)}

      <div className="-mx-3.5 overflow-x-auto">
        <div className="inline-flex min-w-full px-3.5">
          {/* names column, pinned */}
          <div className="sticky left-0 z-10 bg-bg pr-2 flex flex-col">
            <div className="h-11 flex items-end pb-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-3">Free</span>
            </div>
            {people.map((p) => (
              <div key={p.id} className="h-9 flex items-center gap-1.5 pr-2">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" width={20} height={20} referrerPolicy="no-referrer" className="w-5 h-5 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold text-white shrink-0" style={{ background: p.color }}>
                    {p.initials}
                  </span>
                )}
                <span className={`text-[12.5px] truncate max-w-[86px] ${p.id === meId ? "font-semibold" : ""} ${p.answered || p.id === meId ? "" : "text-ink-3"}`}>
                  {p.id === meId ? "You" : p.name}
                </span>
              </div>
            ))}
          </div>

          {/* one column per day */}
          <div className="flex">
            {days.map((d) => {
              const free = freeCount(d.key);
              const clear = free === answered.length && answered.length > 0;
              return (
                <div key={d.key} className="flex flex-col w-[38px] shrink-0">
                  <div className={`h-11 flex flex-col items-center justify-end pb-1 rounded-t-md ${clear ? "bg-go-soft" : ""}`}>
                    <span className="text-[9px] uppercase text-ink-3 leading-none">{d.weekday}</span>
                    <span className="text-[12.5px] font-semibold tabular-nums leading-tight">{d.dayNum}</span>
                    <span className={`text-[10px] tabular-nums leading-none ${clear ? "text-go font-bold" : free === bestFree ? "text-ink" : "text-ink-3"}`}>
                      {free}
                    </span>
                  </div>

                  {people.map((p) => {
                    const busy = busyOn(p, d.key);
                    const unknown = !p.answered && p.id !== meId;
                    const base = "h-9 mx-[1px] mb-[1px] rounded-[3px] border";
                    const look = unknown
                      ? "bg-surface-2 border-line"
                      : busy
                        ? "bg-no border-no"
                        : "bg-go-soft border-go-soft";
                    if (p.id !== meId) return <div key={p.id} className={`${base} ${look}`} />;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggle(d.key)}
                        aria-pressed={busy}
                        aria-label={`${d.weekday} ${d.dayNum}: ${busy ? "busy" : "free"}`}
                        className={`${base} ${look} hover:opacity-80 ring-offset-1 focus-visible:ring-2 focus-visible:ring-accent`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
          <span className="w-3 h-3 rounded-[3px] bg-go-soft border border-go-soft" /> free
          <span className="w-3 h-3 rounded-[3px] bg-no border border-no ml-2" /> busy
          <span className="w-3 h-3 rounded-[3px] bg-surface-2 border border-line ml-2" /> no answer
        </span>
      </div>

      <p className="text-[12.5px] text-ink-2">
        Tap your own row to mark the days you can&rsquo;t do. Everything else counts as free.
      </p>

      <button
        type="submit"
        className={`inline-flex items-center justify-center gap-2 font-semibold border px-4 min-h-11 text-[15px] rounded-lg w-full transition-colors ${
          dirty ? "bg-accent text-accent-ink border-accent" : "bg-surface-2 text-ink-2 border-transparent"
        }`}
      >
        {dirty ? "Save my availability" : me?.answered ? "Saved" : "Save my availability"}
      </button>
    </form>
  );
}
