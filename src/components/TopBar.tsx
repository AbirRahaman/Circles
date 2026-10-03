import { BackButton } from "./BackButton";

export function TopBar({ title, sub, back, actions }: {
  title: string; sub?: string; back?: string; actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2.5 px-3.5 py-3 min-h-14 border-b border-line bg-bg">
      {back && <BackButton fallback={back} />}
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-[17px] tracking-[-0.015em] leading-tight truncate">{title}</h1>
        {sub && <span className="block text-[12.5px] text-ink-2">{sub}</span>}
      </div>
      {actions}
    </header>
  );
}
