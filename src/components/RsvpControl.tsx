import { setRsvp } from "@/app/actions/events";
import type { RsvpResponse } from "@/lib/types";

const options: [RsvpResponse, string][] = [
  ["going", "Going"],
  ["maybe", "Maybe"],
  ["not_going", "Can’t make it"],
];

export function RsvpControl({ groupId, eventId, mine }: {
  groupId: string; eventId: string; mine?: RsvpResponse;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-surface-2">
      {options.map(([value, label]) => (
        <form key={value} action={setRsvp.bind(null, groupId, eventId, value)} className="flex-1">
          <button
            type="submit"
            aria-pressed={mine === value}
            className={`w-full py-1.5 rounded-md text-[13px] font-semibold ${mine === value ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"}`}
          >
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}
