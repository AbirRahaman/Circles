import { requireMembership } from "@/lib/auth";
import { createEvent } from "@/app/actions/events";
import { Card, Disclosure, Field, Note } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { inputFor } from "@/lib/format";

export default async function NewEventPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  await requireMembership(groupId);

  return (
    <>
      <h1 className="text-xl font-bold tracking-[-0.02em] px-0.5">Plan something</h1>

      {/* The common case: you know when it is. */}
      <Card className="p-3.5">
        <form action={createEvent.bind(null, groupId)} className="flex flex-col gap-3.5">
          <Field label="What is it"><input name="title" required maxLength={60} placeholder="Cabin weekend" /></Field>
          <Field label="When"><input name="when" type="datetime-local" required defaultValue={inputFor(7, 19)} /></Field>
          <Field label="Where (optional)"><input name="location" maxLength={60} placeholder="Mohonk, NY" /></Field>
          <Field label="Notes (optional)"><textarea name="notes" rows={3} placeholder="Who is driving, what to bring…" /></Field>
          <SubmitButton pendingLabel="Adding…" className="w-full">Add to the calendar</SubmitButton>
        </form>
      </Card>

      {/* Still available when the date is the thing in dispute. */}
      <Disclosure label="Not sure of the date? Put it to a vote">
        <form action={createEvent.bind(null, groupId)} className="flex flex-col gap-3.5">
          <Field label="What is it"><input name="title" required maxLength={60} placeholder="Cabin weekend" /></Field>
          <Field label="Where (optional)"><input name="location" maxLength={60} placeholder="Mohonk, NY" /></Field>
          <Field label="Notes (optional)"><textarea name="notes" rows={2} placeholder="Who is driving, what to bring…" /></Field>
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-3">Times to choose between</span>
            {[0, 1, 2].map((i) => (
              <input key={i} type="datetime-local" name="time" defaultValue={i < 2 ? inputFor(7 + i * 7, 19) : ""} />
            ))}
            <span className="text-[12px] text-ink-2">Leave the last blank if two is enough. Up to five.</span>
          </div>
          <SubmitButton pendingLabel="Sending…" className="w-full">Send the poll</SubmitButton>
        </form>
      </Disclosure>

      <Note>
        A poll never resolves itself. Once people have answered, you or an admin pick the
        winning time by hand and the event flips to RSVPs.
      </Note>
    </>
  );
}
