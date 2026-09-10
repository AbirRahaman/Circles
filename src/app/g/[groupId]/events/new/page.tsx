import { requireMembership } from "@/lib/auth";
import { createEvent } from "@/app/actions/events";
import { Card, Field, Note } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

function localValue(daysAhead: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default async function NewEventPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  await requireMembership(groupId);

  return (
    <>
      <h1 className="font-display font-extrabold text-xl px-0.5">Plan something</h1>
      <Card className="p-3.5">
        <form action={createEvent.bind(null, groupId)} className="flex flex-col gap-3.5">
          <Field label="What is it"><input name="title" required maxLength={60} placeholder="Cabin weekend" /></Field>
          <Field label="Where (optional)"><input name="location" maxLength={60} placeholder="Mohonk, NY" /></Field>
          <Field label="Notes (optional)"><textarea name="notes" rows={3} placeholder="Who is driving, what to bring…" /></Field>

          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10.5px] tracking-[0.09em] uppercase text-ink-3">
              Time options — people vote on these
            </span>
            {[0, 1, 2].map((i) => (
              <input key={i} type="datetime-local" name="time" defaultValue={i < 2 ? localValue(3 + i, 19) : ""} />
            ))}
            <span className="text-[12px] text-ink-2">Leave the last one blank if two options is enough. Up to five.</span>
          </div>

          <SubmitButton pendingLabel="Sending…" className="w-full">Send it to the group</SubmitButton>
        </form>
      </Card>
      <Note>
        Nothing auto-resolves. Once people have voted, you or an admin pick the winning
        time by hand and the event flips to RSVPs.
      </Note>
    </>
  );
}
