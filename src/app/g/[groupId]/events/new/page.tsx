import { requireMembership } from "@/lib/auth";
import { createEvent } from "@/app/actions/events";
import { createTrip } from "@/app/actions/trips";
import { createDateSearch } from "@/app/actions/availability";
import { Card, Disclosure, Field, Note } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { inputFor, groupToday } from "@/lib/format";

const plusDays = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export default async function NewEventPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  await requireMembership(groupId);
  const todayKey = groupToday();

  return (
    <>
      <h1 className="text-xl font-bold tracking-[-0.02em] px-0.5">Plan something</h1>

      {/* The common case: you know when it is. */}
      <Card className="p-3.5">
        <form action={createEvent.bind(null, groupId)} className="flex flex-col gap-3.5">
          <Field label="What is it"><input name="title" required maxLength={60} placeholder="Cabin weekend" /></Field>
          <div className="flex gap-2.5">
            <span className="flex-1 min-w-0"><Field label="Starts"><input name="when" type="datetime-local" required defaultValue={inputFor(7, 19)} /></Field></span>
            <span className="flex-1 min-w-0"><Field label="Ends (optional)"><input name="ends" type="datetime-local" /></Field></span>
          </div>
          <Field label="Where (optional)"><input name="location" maxLength={60} placeholder="Mohonk, NY" /></Field>
          <Field label="Notes (optional)"><textarea name="notes" rows={3} placeholder="Who is driving, what to bring…" /></Field>
          <SubmitButton pendingLabel="Adding…" className="w-full">Add to the calendar</SubmitButton>
          <p className="text-[12px] text-ink-2">
            Only set an end for something that runs past one evening — a weekend away, a
            visit. It keeps the plan in Upcoming until it&rsquo;s genuinely over.
          </p>
        </form>
      </Card>

      <Disclosure label="Not sure of the date? Use the scheduling assistant">
        <form action={createDateSearch.bind(null, groupId)} className="flex flex-col gap-3.5">
          <Field label="What is it"><input name="title" required maxLength={60} placeholder="Dinner, sometime soon" /></Field>
          <Field label="Where (optional)"><input name="location" maxLength={60} /></Field>
          <div className="flex gap-2.5">
            <span className="flex-1 min-w-0"><Field label="Looking between"><input name="window_start" type="date" required defaultValue={todayKey} /></Field></span>
            <span className="flex-1 min-w-0"><Field label="and"><input name="window_end" type="date" required defaultValue={plusDays(21)} /></Field></span>
          </div>
          <Field label="Notes (optional)"><textarea name="notes" rows={2} /></Field>
          <SubmitButton pendingLabel="Starting…" className="w-full">Open the scheduling assistant</SubmitButton>
          <p className="text-[12px] text-ink-2">
            Everyone gets a grid of the whole window — people down the side, days across —
            and marks the days they can&rsquo;t do. You can see at a glance who&rsquo;s free
            when, and settle on a day once it&rsquo;s obvious.
          </p>
        </form>
      </Disclosure>

      <Disclosure label="Propose a trip">
        <form action={createTrip.bind(null, groupId)} className="flex flex-col gap-3.5">
          <Field label="What is it"><input name="title" required maxLength={60} placeholder="Cabin weekend" /></Field>
          <Field label="Where"><input name="location" maxLength={60} placeholder="Mohonk, NY" /></Field>
          <div className="flex gap-2.5">
            <span className="flex-1 min-w-0"><Field label="Leaves"><input name="when" type="datetime-local" required defaultValue={inputFor(21, 17)} /></Field></span>
            <span className="flex-1 min-w-0"><Field label="Back"><input name="ends" type="datetime-local" required defaultValue={inputFor(23, 16)} /></Field></span>
          </div>
          <Field label="Rough budget per person (optional)">
            <input name="budget_per_person" type="number" min="0" step="any" placeholder="250" />
          </Field>
          <Field label="The pitch (optional)">
            <textarea name="notes" rows={3} placeholder="Why this, why now, what it'd take…" />
          </Field>
          <SubmitButton pendingLabel="Proposing…" className="w-full">Propose it</SubmitButton>
          <p className="text-[12px] text-ink-2">
            A trip gets a plan of its own — housing, transport, activities, costs — plus
            everything an event has. People say yes by RSVPing.
          </p>
        </form>
      </Disclosure>

      <Note>
        Nothing resolves itself. However you start it, you or an admin settle the time by
        hand and the event flips to RSVPs.
      </Note>
    </>
  );
}
