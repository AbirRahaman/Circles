import Link from "next/link";
import { Pill, Avatar } from "./ui";
import { fmtRange, countdown, isUnderway, effectiveEnd } from "@/lib/format";
import type { GroupEvent, Profile } from "@/lib/types";

export type EventCardData = GroupEvent & {
  optionCount: number;
  votedCount: number;
  memberCount: number;
  iVoted: boolean;
  myRsvp?: string;
  going: Profile[];
};

export function EventCard({ groupId, event: e }: { groupId: string; event: EventCardData }) {
  const underway = isUnderway(e.confirmed_time, e.ends_at);
  const finish = effectiveEnd(e.confirmed_time, e.ends_at);
  const over = finish !== null && finish <= Date.now();
  const status =
    e.status === "cancelled" ? <Pill tone="no" dot>Cancelled</Pill>
    : underway ? <Pill tone="accent" dot>Happening now</Pill>
    : e.status === "proposed"
      ? e.optionCount === 0
        ? <Pill tone="maybe" dot>Pending</Pill>
        : e.iVoted ? <Pill tone="accent" dot>Voted</Pill> : <Pill tone="maybe" dot>Needs your vote</Pill>
    : over
      ? e.myRsvp === "going" ? <Pill tone="go" dot>You attended</Pill>
        : e.myRsvp === "not_going" ? <Pill tone="no" dot>Didn&rsquo;t go</Pill>
        : e.myRsvp === "maybe" ? <Pill tone="maybe" dot>Was a maybe</Pill>
        : <Pill dot>Never answered</Pill>
      : e.myRsvp === "going" ? <Pill tone="go" dot>You&rsquo;re in</Pill>
        : e.myRsvp === "not_going" ? <Pill tone="no" dot>Not going</Pill>
        : e.myRsvp === "maybe" ? <Pill tone="maybe" dot>Maybe</Pill>
        : <Pill dot>RSVP open</Pill>;

  const meta =
    e.status === "proposed"
      ? e.optionCount === 0
        ? [e.confirmed_time ? fmtRange(e.confirmed_time, e.ends_at) : "", "not locked in yet"].filter(Boolean).join(" · ")
        : `${e.optionCount} time options · ${e.votedCount} of ${e.memberCount} voted`
      : e.confirmed_time
        ? [fmtRange(e.confirmed_time, e.ends_at), underway ? "" : countdown(e.confirmed_time)]
            .filter(Boolean).join(" · ")
        : "";

  return (
    <Link href={`/g/${groupId}/events/${e.id}`} className="block px-3.5 py-3 border-b border-line last:border-b-0 hover:bg-surface-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[15.5px] truncate">
          {e.kind === "trip" && (
            <span className="mr-1.5 align-[1px] text-[11px] font-bold uppercase tracking-[0.06em] text-accent">Trip</span>
          )}
          {e.title}
        </span>
        {status}
      </div>
      <div className="font-mono text-[12px] text-ink-2 mt-1">{meta}</div>
      {e.location && <div className="text-[12px] text-ink-2 mt-0.5">{e.location}</div>}
      {e.going.length > 0 && (
        <div className="flex mt-2">
          {e.going.slice(0, 6).map((p, i) => (
            <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }} className="ring-2 ring-surface rounded-full">
              <Avatar id={p.id} name={p.name} src={p.avatar_url} size={24} />
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
