export const fmtDay = (t: string) =>
  new Date(t).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export const fmtTime = (t: string) =>
  new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const fmtFull = (t: string) => `${fmtDay(t)} · ${fmtTime(t)}`;

export const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const daysUntil = (t: string) => Math.round((new Date(t).getTime() - Date.now()) / 86_400_000);

export const num = (n: number) => (Math.round(n * 100) / 100).toLocaleString();

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const AV = ["#8A2F63", "#2F6E8A", "#1E7A58", "#A3415A", "#6B4BA8", "#A96C12", "#3F7A2E", "#8A4B2F"];
export const colorFor = (id: string) =>
  AV[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

export function countdown(t: string) {
  const d = daysUntil(t);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d > 0 && d <= 14) return `in ${d} days`;
  return "";
}
