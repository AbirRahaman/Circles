/* One timezone for the whole app.
 *
 * Pages are server components, so date formatting runs on Vercel — where the
 * clock is UTC. Left alone, a 7pm dinner renders as 11pm for everyone. And a
 * <input type="datetime-local"> posts a bare "2026-09-26T19:00" with no zone
 * attached, which the server would read as 19:00 UTC. Both directions have to
 * go through this file.
 *
 * America/New_York rather than "EST" on purpose: it follows daylight saving,
 * so October and January both come out right. */
export const TZ = process.env.NEXT_PUBLIC_GROUP_TIMEZONE || "America/New_York";

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts });

export const fmtDay = (t: string) =>
  fmt({ weekday: "short", month: "short", day: "numeric" }).format(new Date(t));

export const fmtTime = (t: string) =>
  fmt({ hour: "numeric", minute: "2-digit" }).format(new Date(t));

export const fmtFull = (t: string) => `${fmtDay(t)} · ${fmtTime(t)}`;

/** Challenge start/end are plain dates with no time. Noon UTC lands on the
 *  same calendar day in every US zone, so the date never slips backwards. */
export const fmtDate = (d: string) =>
  fmt({ month: "short", day: "numeric" }).format(new Date(`${d}T12:00:00Z`));

export const daysUntil = (t: string) => Math.round((new Date(t).getTime() - Date.now()) / 86_400_000);

export const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString();

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const AV = ["#35507A", "#38548E", "#4C7340", "#8E5C3A", "#7C5478", "#2E6E72", "#8A4B2F", "#5A5F8E"];
export const colorFor = (id: string) =>
  AV[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

export function countdown(t: string) {
  const d = daysUntil(t);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d > 0 && d <= 14) return `in ${d} days`;
  return "";
}

/* ── datetime-local <-> instant ─────────────────────────────────────── */

/** How far TZ sits from UTC at a given instant, in ms (handles DST). */
function offsetAt(instant: number) {
  const d = new Date(instant);
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return local.getTime() - utc.getTime();
}

/** "2026-09-26T19:00" typed by a human in TZ -> the real instant, as ISO.
 *  Returns null for an empty field. */
export function fromInput(value: FormDataEntryValue | null | undefined): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const naive = Date.parse(`${s.length === 16 ? s : s.slice(0, 16)}:00Z`);
  if (Number.isNaN(naive)) return null;
  // Guess with the offset at the naive instant, then correct once — that
  // second pass is what keeps the hour right across a DST boundary.
  let guess = naive - offsetAt(naive);
  guess = naive - offsetAt(guess);
  return new Date(guess).toISOString();
}

/** An instant -> the "YYYY-MM-DDTHH:mm" a datetime-local input expects,
 *  expressed in TZ, so edit forms come back pre-filled with what people see. */
export function toInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** A datetime-local default: now + n days, at a given hour, in TZ. */
export function inputFor(daysAhead: number, hour: number): string {
  const base = new Date(Date.now() + daysAhead * 86_400_000);
  const day = toInput(base.toISOString()).slice(0, 10);
  return `${day}T${String(hour).padStart(2, "0")}:00`;
}

/** Shift an instant forward, for arrival times derived from a drive time. */
export const plusMinutes = (iso: string, mins: number) =>
  new Date(new Date(iso).getTime() + mins * 60_000).toISOString();

/** 45 -> "45 min", 150 -> "2h 30m". */
export function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}
