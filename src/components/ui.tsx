import Link from "next/link";
import { colorFor, initials } from "@/lib/format";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-line rounded-xl shadow-card ${className}`}>{children}</div>
  );
}

export function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-0.5">
      <h2 className="font-display font-bold text-[15.5px]">{title}</h2>
      {right}
    </div>
  );
}

const tones = {
  accent: "bg-accent-soft text-accent",
  go: "bg-go-soft text-go",
  maybe: "bg-maybe-soft text-maybe",
  no: "bg-no-soft text-no",
  plain: "bg-surface-2 text-ink-2",
} as const;

export function Pill({
  children, tone = "plain", dot = false,
}: { children: React.ReactNode; tone?: keyof typeof tones; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap ${tones[tone]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const variants = {
  primary: "bg-accent text-accent-ink border-accent hover:opacity-90",
  ghost: "bg-transparent text-ink border-line-strong hover:bg-surface-2",
  quiet: "bg-surface-2 text-ink border-transparent hover:bg-surface-3",
  danger: "bg-transparent text-no border-no-soft hover:bg-no-soft",
} as const;

type ButtonProps = {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  size?: "sm" | "md";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, variant = "primary", size = "md", className = "", ...rest }: ButtonProps) {
  const pad = size === "sm" ? "px-3 py-1.5 text-[13px] rounded-md" : "px-4 py-2.5 text-sm rounded-lg";
  return (
    <button {...rest} className={`inline-flex items-center justify-center gap-2 font-semibold border transition-colors disabled:opacity-45 ${variants[variant]} ${pad} ${className}`}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", size = "md", className = "" }: {
  href: string; children: React.ReactNode; variant?: keyof typeof variants; size?: "sm" | "md"; className?: string;
}) {
  const pad = size === "sm" ? "px-3 py-1.5 text-[13px] rounded-md" : "px-4 py-2.5 text-sm rounded-lg";
  return (
    <Link href={href} className={`inline-flex items-center justify-center gap-2 font-semibold border transition-colors ${variants[variant]} ${pad} ${className}`}>
      {children}
    </Link>
  );
}

export function Avatar({ id, name, size = 30 }: { id: string; name: string; size?: number }) {
  return (
    <span
      className="rounded-full grid place-items-center text-white font-display font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: colorFor(id) }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function ProgressBar({ pct, tone = "accent" }: { pct: number; tone?: "accent" | "muted" }) {
  return (
    <div className="h-[7px] rounded-full bg-surface-3 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: tone === "accent" ? "var(--accent)" : "var(--line-strong)" }}
      />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="text-center px-5 py-7 border border-dashed border-line-strong rounded-xl bg-surface-2">
      <h3 className="font-display font-bold text-[15px] mb-1">{title}</h3>
      <p className="text-[13px] text-ink-2">{children}</p>
    </div>
  );
}

export function Note({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "warn" }) {
  return (
    <div className={`rounded-md px-3 py-2.5 text-[12.5px] leading-snug border ${
      tone === "warn" ? "bg-maybe-soft text-maybe border-transparent" : "bg-surface-2 text-ink-2 border-line"
    }`}>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] tracking-[0.09em] uppercase text-ink-3">{label}</span>
      {children}
    </label>
  );
}
