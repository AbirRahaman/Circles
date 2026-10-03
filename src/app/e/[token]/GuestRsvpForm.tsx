"use client";

import { useActionState } from "react";
import { guestRsvp } from "@/app/actions/guests";

const statuses = [
  { value: "going", label: "Going", emoji: "🎉" },
  { value: "maybe", label: "Maybe", emoji: "🤔" },
  { value: "declined", label: "Can't make it", emoji: "😔" },
] as const;

export function GuestRsvpForm({
  inviteToken,
  existing,
}: {
  inviteToken: string;
  existing: { name: string; status: string } | null;
}) {
  const bound = guestRsvp.bind(null, inviteToken);
  const [state, action, pending] = useActionState(bound, null);

  if (state?.success) {
    return (
      <div className="success-msg">
        <span className="success-icon">✓</span>
        <span>You&rsquo;re all set! Your RSVP has been saved.</span>
      </div>
    );
  }

  return (
    <form action={action} className="rsvp-form">
      {/* Status selection */}
      <div className="status-row">
        {statuses.map(({ value, label, emoji }) => (
          <label key={value} className="status-option">
            <input
              type="radio"
              name="status"
              value={value}
              defaultChecked={existing?.status === value}
              required
            />
            <span className="status-btn">
              <span className="status-emoji">{emoji}</span>
              <span className="status-text">{label}</span>
            </span>
          </label>
        ))}
      </div>

      {/* Name */}
      <div className="field">
        <label htmlFor="guest-name" className="field-label">Your name</label>
        <input
          id="guest-name"
          name="name"
          type="text"
          required
          maxLength={60}
          defaultValue={existing?.name ?? ""}
          placeholder="What should we call you?"
          className="field-input"
        />
      </div>

      {/* Contact (optional) */}
      <div className="field">
        <label htmlFor="guest-contact" className="field-label">
          Phone or email <span className="optional">(optional)</span>
        </label>
        <input
          id="guest-contact"
          name="contact"
          type="text"
          maxLength={120}
          placeholder="So the host can reach you"
          className="field-input"
        />
      </div>

      {state?.error && (
        <p className="error-msg">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="submit-btn">
        {pending ? "Saving…" : existing ? "Update RSVP" : "RSVP"}
      </button>

      <style>{`
        .rsvp-form { display: flex; flex-direction: column; gap: 14px; }
        .status-row { display: flex; gap: 8px; }
        .status-option { flex: 1; cursor: pointer; }
        .status-option input { display: none; }
        .status-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          border-radius: 12px;
          border: 2px solid var(--line);
          background: var(--surface-2);
          transition: all 0.15s;
        }
        .status-option input:checked + .status-btn {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .status-emoji { font-size: 24px; }
        .status-text { font-size: 12.5px; font-weight: 600; color: var(--ink); }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-2);
        }
        .optional { font-weight: 400; color: var(--ink-3); }
        .field-input {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--line-strong);
          background: var(--surface);
          color: var(--ink);
          font-size: 15px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }
        .field-input:focus { border-color: var(--accent); }
        .field-input::placeholder { color: var(--ink-3); }
        .submit-btn {
          padding: 12px;
          border-radius: 12px;
          border: none;
          background: var(--accent);
          color: var(--accent-ink);
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .submit-btn:hover { opacity: 0.9; }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .error-msg { font-size: 13.5px; color: var(--no); margin: 0; }
        .success-msg {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 12px;
          background: var(--go-soft);
          color: var(--go);
          font-size: 14.5px;
          font-weight: 600;
        }
        .success-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--go);
          color: white;
          display: grid;
          place-items: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }
      `}</style>
    </form>
  );
}
