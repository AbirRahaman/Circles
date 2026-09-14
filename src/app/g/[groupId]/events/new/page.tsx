import { requireMembership } from "@/lib/auth";
import { createPlan } from "@/app/actions/events";
import { Card, Field, Note } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { inputFor } from "@/lib/format";

export default async function NewPlanPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  await requireMembership(groupId);

  return (
    <>
      <h1 className="text-xl font-bold tracking-[-0.02em] px-0.5">Plan something</h1>

      <Card className="p-3.5">
        <form action={createPlan.bind(null, groupId)} className="flex flex-col gap-3.5">
          <Field label="What is it">
            <input name="title" required maxLength={60} placeholder="Cabin weekend" />
          </Field>

          <div className="flex gap-2.5">
            <span className="flex-1 min-w-0">
              <Field label="Kind">
                <select name="kind" defaultValue="outing">
                  <option value="outing">An outing</option>
                  <option value="trip">A trip</option>
                </select>
              </Field>
            </span>
            <span className="flex-1 min-w-0">
              <Field label="Is it settled?">
                <select name="settled" defaultValue="yes">
                  <option value="yes">Locked in</option>
                  <option value="no">Still being decided</option>
                </select>
              </Field>
            </span>
          </div>

          <div className="flex gap-2.5">
            <span className="flex-1 min-w-0">
              <Field label="Starts"><input name="when" type="datetime-local" required defaultValue={inputFor(7, 19)} /></Field>
            </span>
            <span className="flex-1 min-w-0">
              <Field label="Ends"><input name="ends" type="datetime-local" /></Field>
            </span>
          </div>

          <Field label="Where (optional)">
            <input name="location" maxLength={60} placeholder="Mohonk, NY" />
          </Field>

          <Field label="Notes (optional)">
            <textarea name="notes" rows={3} placeholder="Who's driving, what to bring, why now…" />
          </Field>

          <Field label="Budget per person — trips only (optional)">
            <input name="budget_per_person" type="number" min="0" step="any" placeholder="250" />
          </Field>

          <SubmitButton pendingLabel="Saving…" className="w-full">Add it</SubmitButton>
        </form>
      </Card>

      <Note>
        <strong>Locked in</strong> means it&rsquo;s decided and you&rsquo;re recording it — people
        RSVP straight away. <strong>Still being decided</strong> opens the scheduling assistant on
        the plan itself, so everyone can mark the days they can&rsquo;t do before anyone commits.
        Either way you can switch it later.
      </Note>

      <Note>
        An end date is optional for an outing and required for a trip — that&rsquo;s the
        difference between the two, along with a trip getting its own plan for housing,
        transport and costs.
      </Note>
    </>
  );
}
