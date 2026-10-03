import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { GuestRsvpForm } from "./GuestRsvpForm";
import type { Metadata } from "next";

type InviteData = {
  event: {
    id: string;
    title: string;
    status: string;
    confirmed_time: string | null;
    ends_at: string | null;
    location: string | null;
    notes: string | null;
  };
  invite_link: { id: string; event_id: string; active: boolean };
  host_name: string;
  member_rsvps: { name: string; status: string }[];
  guest_rsvps: { id: string; name: string; status: string; guest_token: string }[];
};

async function getInviteData(token: string): Promise<InviteData | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  const { data } = await supabase.rpc("get_event_by_invite_token", {
    invite_token: token,
  });

  return data as InviteData | null;
}

export async function generateMetadata({
  params,
}: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await getInviteData(token);
  if (!data) return { title: "Socius — Event" };
  return {
    title: `${data.event.title} — Socius`,
    description: `You're invited! RSVP to ${data.event.title} on Socius.`,
    openGraph: {
      title: `${data.event.title} — Socius`,
      description: `You're invited! RSVP to ${data.event.title} on Socius.`,
    },
  };
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtRange(start: string, end: string | null) {
  if (!end) return `${fmtDate(start)} · ${fmtTime(start)}`;
  const sameDay =
    new Date(start).toDateString() === new Date(end).toDateString();
  if (sameDay) return `${fmtDate(start)} · ${fmtTime(start)} – ${fmtTime(end)}`;
  return `${fmtDate(start)} ${fmtTime(start)} – ${fmtDate(end)} ${fmtTime(end)}`;
}

export default async function GuestEventPage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getInviteData(token);
  if (!data) notFound();

  const { event, host_name, member_rsvps, guest_rsvps } = data;

  // Check if this guest already RSVP'd
  const cookieStore = await cookies();
  const guestToken = cookieStore.get("socius_guest")?.value;
  const myRsvp = guestToken
    ? guest_rsvps.find((r) => r.guest_token === guestToken)
    : null;

  // Build the guest list
  const allGoing = [
    ...member_rsvps.filter((r) => r.status === "going").map((r) => ({ name: r.name, guest: false })),
    ...guest_rsvps.filter((r) => r.status === "going").map((r) => ({ name: r.name, guest: true })),
  ];
  const allMaybe = [
    ...member_rsvps.filter((r) => r.status === "maybe").map((r) => ({ name: r.name, guest: false })),
    ...guest_rsvps.filter((r) => r.status === "maybe").map((r) => ({ name: r.name, guest: true })),
  ];
  const allDeclined = [
    ...member_rsvps.filter((r) => r.status === "not_going" || r.status === "declined").map((r) => ({ name: r.name, guest: false })),
    ...guest_rsvps.filter((r) => r.status === "declined").map((r) => ({ name: r.name, guest: true })),
  ];

  return (
    <div className="guest-page">
      <div className="guest-shell">
        {/* Logo */}
        <div className="logo">Socius</div>

        {/* Event Card */}
        <div className="event-card">
          <div className="event-label">You&rsquo;re invited</div>
          <h1 className="event-title">{event.title}</h1>

          {event.confirmed_time && (
            <div className="detail-row">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <span>{fmtRange(event.confirmed_time, event.ends_at)}</span>
            </div>
          )}

          {event.location && (
            <div className="detail-row">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
              <span>{event.location}</span>
            </div>
          )}

          <div className="detail-row">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <span>Hosted by {host_name}</span>
          </div>

          {event.notes && <p className="event-notes">{event.notes}</p>}
        </div>

        {/* RSVP Section */}
        <div className="section-card">
          <h2 className="section-title">
            {myRsvp ? "Update your RSVP" : "RSVP"}
          </h2>
          <GuestRsvpForm
            inviteToken={token}
            existing={myRsvp ? { name: myRsvp.name, status: myRsvp.status } : null}
          />
        </div>

        {/* Guest List */}
        {(allGoing.length > 0 || allMaybe.length > 0) && (
          <div className="section-card">
            <h2 className="section-title">Who&rsquo;s coming</h2>

            {allGoing.length > 0 && (
              <div className="rsvp-group">
                <div className="rsvp-label rsvp-going">Going · {allGoing.length}</div>
                <div className="rsvp-names">
                  {allGoing.map((p, i) => (
                    <span key={i} className="name-chip">{p.name}</span>
                  ))}
                </div>
              </div>
            )}

            {allMaybe.length > 0 && (
              <div className="rsvp-group">
                <div className="rsvp-label rsvp-maybe">Maybe · {allMaybe.length}</div>
                <div className="rsvp-names">
                  {allMaybe.map((p, i) => (
                    <span key={i} className="name-chip">{p.name}</span>
                  ))}
                </div>
              </div>
            )}

            {allDeclined.length > 0 && (
              <div className="rsvp-group">
                <div className="rsvp-label rsvp-declined">Can&rsquo;t make it · {allDeclined.length}</div>
                <div className="rsvp-names">
                  {allDeclined.map((p, i) => (
                    <span key={i} className="name-chip">{p.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="footer">
          Powered by <strong>Socius</strong> — where plans make it out the group chat.
        </p>
      </div>

      <style>{`
        .guest-page {
          min-height: 100svh;
          display: flex;
          justify-content: center;
          padding: 24px 16px 48px;
        }
        .guest-shell {
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .logo {
          font-family: var(--font-display), serif;
          font-size: 22px;
          font-weight: 700;
          color: var(--accent);
          letter-spacing: -0.02em;
        }
        .event-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: var(--shadow);
        }
        .event-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--accent);
        }
        .event-title {
          font-family: var(--font-display), serif;
          font-size: 28px;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--ink);
          margin: 0;
        }
        .detail-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 14.5px;
          color: var(--ink-2);
        }
        .detail-row svg { color: var(--ink-3); flex-shrink: 0; margin-top: 1px; }
        .event-notes {
          font-size: 14px;
          color: var(--ink-2);
          line-height: 1.5;
          margin: 4px 0 0;
        }
        .section-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: var(--shadow);
        }
        .section-title {
          font-size: 12.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ink-2);
          margin: 0;
        }
        .rsvp-group { display: flex; flex-direction: column; gap: 8px; }
        .rsvp-label {
          font-size: 13px;
          font-weight: 600;
        }
        .rsvp-going { color: var(--go); }
        .rsvp-maybe { color: var(--maybe); }
        .rsvp-declined { color: var(--ink-3); }
        .rsvp-names { display: flex; flex-wrap: wrap; gap: 6px; }
        .name-chip {
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 8px;
          background: var(--surface-2);
          font-size: 13px;
          font-weight: 500;
          color: var(--ink);
        }
        .footer {
          text-align: center;
          font-size: 12.5px;
          color: var(--ink-3);
          padding-top: 8px;
        }
        .footer strong { color: var(--accent); font-weight: 600; }
      `}</style>
    </div>
  );
}
