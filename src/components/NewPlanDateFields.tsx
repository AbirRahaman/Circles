"use client";

import { useState } from "react";
import { Field } from "@/components/ui";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Build the month options starting from the current month, 12 months out. */
function monthOptions() {
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    opts.push({ value, label });
  }
  return opts;
}

export function NewPlanDateFields({
  trips,
  startDefault,
}: {
  trips: boolean;
  startDefault: string;
}) {
  const [settled, setSettled] = useState("yes");
  const [kind, setKind] = useState("outing");
  const [dateHint, setDateHint] = useState<"specific" | "month" | "none">("month");

  const isProposal = settled === "no";
  const isTrip = kind === "trip";

  return (
    <>
      <div className="flex gap-2.5">
        {trips ? (
          <span className="flex-1 min-w-0">
            <Field label="Kind">
              <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="outing">An outing</option>
                <option value="trip">A trip</option>
              </select>
            </Field>
          </span>
        ) : (
          <input type="hidden" name="kind" value="outing" />
        )}
        <span className="flex-1 min-w-0">
          <Field label="Is it settled?">
            <select name="settled" value={settled} onChange={(e) => setSettled(e.target.value)}>
              <option value="yes">Locked in</option>
              <option value="no">Still being decided</option>
            </select>
          </Field>
        </span>
      </div>

      {isProposal && (
        <Field label="Date idea">
          <select value={dateHint} onChange={(e) => setDateHint(e.target.value as typeof dateHint)}>
            <option value="specific">Suggest specific dates</option>
            <option value="month">Suggest a month</option>
            <option value="none">No idea yet</option>
          </select>
        </Field>
      )}

      {/* Specific dates — required for locked-in, optional hint for proposals */}
      {(!isProposal || dateHint === "specific") && (
        <div className={`grid gap-2.5 ${isTrip || !isProposal ? "grid-cols-1 sm:grid-cols-2" : ""}`}>
          <Field label={isProposal ? "Suggested start" : "Starts"}>
            <input
              name="when"
              type="datetime-local"
              required={!isProposal}
              defaultValue={startDefault}
            />
          </Field>
          {/* Only show ends for trips, or for locked-in events */}
          {(isTrip || !isProposal) && (
            <Field label={isTrip ? "Ends" : "Ends (optional)"}>
              <input
                name="ends"
                type="datetime-local"
                required={isTrip && !isProposal}
              />
            </Field>
          )}
        </div>
      )}

      {/* Month suggestion */}
      {isProposal && dateHint === "month" && (
        <Field label="Sometime in">
          <select name="suggest_month" defaultValue={monthOptions()[1]?.value}>
            {monthOptions().map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>
      )}

      {/* No dates at all — just a hidden marker so the server knows */}
      {isProposal && dateHint === "none" && (
        <p className="text-[12.5px] text-ink-2 px-0.5">
          No worries — the scheduling assistant will help the group find a time.
        </p>
      )}
    </>
  );
}
