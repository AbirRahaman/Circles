"use client";

import { useState } from "react";
import Link from "next/link";

/* Every date decision is made on the server and handed down already
 * formatted — this component does layout and selection only. Doing date
 * maths here would silently use the viewer's timezone and undo the
 * single-timezone rule the rest of the app follows. */

export type DayCell = {
  key: string;      // YYYY-MM-DD
  day: number;
  inMonth: boolean;
  isToday: boolean;
};

export type CalEvent = {
  id: string;
  groupId: string;
  title: string;
  groupName: string;
  when: string;     // pre-formatted
  location: string | null;
  rsvp: string | null;
  underway: boolean;
};

const dotClass = (e: CalEvent) =>
  e.underway ? "bg-accent"
  : e.rsvp === "going" ? "bg-go"
  : e.rsvp === "not_going" ? "bg-line-strong"
  : e.rsvp === "maybe" ? "bg-maybe"
  : "bg-ink-3";

export function MonthCalendar({
  cells, byDate, initialSelected,
}: {
  cells: DayCell[];
  byDate: Record<string, CalEvent[]>;
  initialSelected: string;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const chosen = byDate[selected] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-px">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3 pb-1">
            {d}
          </span>
        ))}

        {cells.map((c) => {
          const list = byDate[c.key] ?? [];
          const isSelected = c.key === selected;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setSelected(c.key)}
              aria-pressed={isSelected}
              aria-label={`${c.key}, ${list.length} event${list.length === 1 ? "" : "s"}`}
              className={`aspect-square min-h-11 flex flex-col items-center justify-start gap-1 pt-1.5 rounded-lg border transition-colors
                ${isSelected ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2"}
                ${c.inMonth ? "" : "opacity-35"}`}
            >
              <span
                className={`text-[13px] tabular-nums leading-none grid place-items-center w-6 h-6 rounded-full
                  ${c.isToday ? "bg-ink text-bg font-bold" : isSelected ? "text-accent font-semibold" : "text-ink"}`}
              >
                {c.day}
              </span>
              <span className="flex gap-[3px] h-[5px] items-center">
                {list.slice(0, 3).map((e) => (
                  <span key={e.id} className={`w-[5px] h-[5px] rounded-full ${dotClass(e)}`} />
                ))}
                {list.length > 3 && <span className="text-[9px] leading-none text-ink-3">+{list.length - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {chosen.length === 0 ? (
          <p className="text-[13.5px] text-ink-2 px-0.5 py-2">Nothing on this day.</p>
        ) : (
          chosen.map((e) => (
            <Link
              key={e.id}
              href={`/g/${e.groupId}/events/${e.id}`}
              className="bg-surface border border-line rounded-xl shadow-card px-3.5 py-3 hover:bg-surface-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[15px] truncate">{e.title}</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass(e)}`} />
              </div>
              <div className="font-mono text-[12.5px] text-ink-2 mt-1">
                {e.when}{e.location ? ` · ${e.location}` : ""}
              </div>
              <div className="text-[12px] text-ink-3 mt-0.5">{e.groupName}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
