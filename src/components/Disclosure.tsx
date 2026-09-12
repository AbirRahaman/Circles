"use client";

import { createContext, useState } from "react";

/** Lets anything inside fold the disclosure shut. Null outside one, so a
 *  form that isn't in a disclosure just ignores it. */
export const DisclosureClose = createContext<(() => void) | null>(null);

/** A form tucked behind its own button. Controlled rather than left to the
 *  browser, because <details> keeps its own open state across a re-render —
 *  so after saving, the panel would otherwise sit there still open. */
export function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <DisclosureClose.Provider value={() => setOpen(false)}>
      <details
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="group bg-surface border border-line rounded-xl shadow-card overflow-hidden"
      >
        <summary className="flex items-center justify-between gap-3 px-3.5 py-3 min-h-11 cursor-pointer list-none font-semibold text-[15px] hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
          {label}
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink-3 transition-transform group-open:rotate-45">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </summary>
        <div className="border-t border-line p-3.5">{children}</div>
      </details>
    </DisclosureClose.Provider>
  );
}
