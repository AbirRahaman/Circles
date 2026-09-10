import Link from "next/link";

export function TopBar({ title, sub, back, actions }: {
  title: string; sub?: string; back?: string; actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2.5 px-3.5 py-3 min-h-14 border-b border-line bg-bg/90 backdrop-blur">
      {back && (
        <Link href={back} aria-label="Back" className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="font-display font-bold text-[17px] leading-tight truncate">{title}</h1>
        {sub && <span className="block font-mono text-[10.5px] tracking-[0.08em] uppercase text-ink-3">{sub}</span>}
      </div>
      {actions}
    </header>
  );
}
