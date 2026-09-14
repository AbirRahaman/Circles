/* Minimal iCalendar writer. Hand-rolled rather than pulled in: the spec's
 * fussy parts are escaping, CRLF line endings and 75-octet folding, and
 * getting those three right is the whole job. */

const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold at 75 octets, continuation lines starting with a single space.
 *  Counted in bytes, not characters, or an accented name breaks the line. */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    const limit = out.length === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);
    // don't split a multi-byte character
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((out.length ? " " : "") + bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return out.join("\r\n");
}

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export type IcsEvent = {
  uid: string;
  start: string;
  end?: string | null;
  title: string;
  location?: string | null;
  description?: string | null;
  cancelled?: boolean;
  updatedAt?: string | null;
};

export function buildIcs(calendarName: string, events: IcsEvent[]) {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Circles//Group Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calendarName)}`,
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const e of events) {
    // An event with no stated end gets two hours, so it isn't drawn as a
    // zero-length sliver in a week view.
    const end = e.end ?? new Date(new Date(e.start).getTime() + 2 * 3_600_000).toISOString();
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(e.updatedAt ?? new Date().toISOString())}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(e.title)}`
    );
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    lines.push(`STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
