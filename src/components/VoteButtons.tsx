import { castVote } from "@/app/actions/events";
import type { VoteResponse } from "@/lib/types";

const glyphs: Record<VoteResponse, React.ReactNode> = {
  yes: <path d="M20 6L9 17l-5-5" />,
  maybe: <><path d="M12 17h.01" /><path d="M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.1-1.3 2" /></>,
  no: <path d="M18 6L6 18M6 6l12 12" />,
};

const on: Record<VoteResponse, string> = {
  yes: "bg-go border-go text-white",
  maybe: "bg-maybe border-maybe text-white",
  no: "bg-no border-no text-white",
};

/** Three server-action forms. Tapping your current answer clears it. */
export function VoteButtons({ groupId, eventId, optionId, mine }: {
  groupId: string; eventId: string; optionId: string; mine?: VoteResponse;
}) {
  return (
    <div className="flex gap-1.5">
      {(["yes", "maybe", "no"] as VoteResponse[]).map((v) => (
        <form key={v} action={castVote.bind(null, groupId, eventId, optionId, v)}>
          <button
            type="submit"
            aria-label={v}
            aria-pressed={mine === v}
            className={`w-9 h-8 rounded-md border grid place-items-center ${mine === v ? on[v] : "bg-surface border-line-strong text-ink-3 hover:text-ink hover:bg-surface-2"}`}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {glyphs[v]}
            </svg>
          </button>
        </form>
      ))}
    </div>
  );
}
