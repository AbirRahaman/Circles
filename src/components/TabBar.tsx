"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icons: Record<string, React.ReactNode> = {
  plans: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  money: <><path d="M12 2v20" /><path d="M17 6.5c0-2-2.2-3-5-3s-5 .9-5 3 2 2.7 5 3.3 5 1.3 5 3.4-2.2 3.3-5 3.3-5-1.1-5-3" /></>,
  challenges: <><path d="M4 22V4M4 4h13l-2 4 2 4H4" /></>,
  photos: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M3 17l4.5-4.5a2 2 0 0 1 2.8 0L15 17" /></>,
};

/** Bottom tabs on a phone, a persistent left rail on a laptop.
 *  Same markup — globals.css switches it at 900px. */
export function TabBar({ groupId }: { groupId: string }) {
  const path = usePathname();
  const base = `/g/${groupId}`;
  const tabs = [
    { key: "plans", label: "Plans", href: base },
    { key: "money", label: "Money", href: `${base}/money` },
    { key: "challenges", label: "Challenges", href: `${base}/challenges` },
    { key: "photos", label: "Photos", href: `${base}/photos` },
  ];

  return (
    <nav className="appnav">
      <span className="appnav__brand">Circles</span>
      {tabs.map((t) => {
        const active = t.href === base
          ? path === base || path.startsWith(`${base}/events`)
          : path.startsWith(t.href);
        return (
          <Link key={t.key} href={t.href} aria-current={active ? "page" : undefined} className="appnav__item">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {icons[t.key]}
            </svg>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
