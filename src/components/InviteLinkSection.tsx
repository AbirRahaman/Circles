"use client";

import { useState, useTransition } from "react";
import { createInviteLink, revokeInviteLink } from "@/app/actions/guests";

export function InviteLinkSection({
  groupId,
  eventId,
  existingToken,
  isActive,
  baseUrl,
}: {
  groupId: string;
  eventId: string;
  existingToken: string | null;
  isActive: boolean;
  baseUrl: string;
}) {
  const [token, setToken] = useState(existingToken);
  const [active, setActive] = useState(isActive);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const link = token ? `${baseUrl}/e/${token}` : null;

  function handleCreate() {
    startTransition(async () => {
      const t = await createInviteLink(groupId, eventId);
      setToken(t);
      setActive(true);
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      await revokeInviteLink(groupId, eventId);
      setActive(false);
    });
  }

  function handleCopy() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // No link yet — show the create button
  if (!token) {
    return (
      <button
        onClick={handleCreate}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-line-strong bg-surface text-ink text-[14px] font-semibold hover:bg-surface-2 transition-colors disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
        {pending ? "Creating…" : "Create invite link for guests"}
      </button>
    );
  }

  // Link exists
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-line">
          <span className={`flex-1 min-w-0 truncate text-[13px] font-mono ${active ? "text-ink" : "text-ink-3 line-through"}`}>
            {link}
          </span>
          {active && (
            <button
              onClick={handleCopy}
              className="shrink-0 px-2.5 py-1 rounded-md bg-accent text-accent-ink text-[12px] font-semibold hover:opacity-90 transition-opacity"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
      </div>

      {active ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-ink-2">
            Anyone with this link can view the event and RSVP.
          </span>
          <button
            onClick={handleRevoke}
            disabled={pending}
            className="shrink-0 text-[12.5px] text-ink-3 hover:text-no font-medium disabled:opacity-50"
          >
            {pending ? "Revoking…" : "Revoke"}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-ink-3">Link revoked — no new RSVPs.</span>
          <button
            onClick={handleCreate}
            disabled={pending}
            className="shrink-0 text-[12.5px] text-accent font-medium hover:underline disabled:opacity-50"
          >
            {pending ? "Reactivating…" : "Reactivate"}
          </button>
        </div>
      )}
    </div>
  );
}
