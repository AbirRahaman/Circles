"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasFeature, type Feature, type GroupType } from "@/lib/groupTypes";

const icons: Record<string, React.ReactNode> = {
  plans: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  money: <><path d="M12 2v20" /><path d="M17 6.5c0-2-2.2-3-5-3s-5 .9-5 3 2 2.7 5 3.3 5 1.3 5 3.4-2.2 3.3-5 3.3-5-1.1-5-3" /></>,
  challenges: <><path d="M4 22V4M4 4h13l-2 4 2 4H4" /></>,
  photos: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M3 17l4.5-4.5a2 2 0 0 1 2.8 0L15 17" /></>,
  groceries: <><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" /><circle cx="10" cy="20.5" r="1.2" /><circle cx="17" cy="20.5" r="1.2" /></>,
  meals: <><path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" /><path d="M17 21V3c-2.2 1.2-3.5 3.6-3.5 7v3H17" /></>,
  chores: <><path d="M9 11l2.5 2.5L16 9" /><rect x="3.5" y="3.5" width="17" height="17" rx="3" /></>,
  mood: <><circle cx="12" cy="12" r="9" /><path d="M9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0" /></>,
};

/** Bottom tabs on a phone, a persistent left rail on a laptop.
 *  Same markup — globals.css switches it at 900px. */
export function TabBar({ groupId, type }: { groupId: string; type: GroupType }) {
  const path = usePathname();
  const base = `/g/${groupId}`;
  const all: { key: string; label: string; href: string; feature?: Feature }[] = [
    { key: "plans", label: "Plans", href: base },
    { key: "groceries", label: "Groceries", href: `${base}/groceries`, feature: "groceries" },
    { key: "meals", label: "Meals", href: `${base}/meals`, feature: "meals" },
    { key: "chores", label: "Chores", href: `${base}/chores`, feature: "chores" },
    { key: "money", label: "Money", href: `${base}/money`, feature: "money" },
    { key: "challenges", label: "Challenges", href: `${base}/challenges`, feature: "challenges" },
    { key: "photos", label: "Photos", href: `${base}/photos`, feature: "photos" },
    { key: "mood", label: "Check-in", href: `${base}/mood`, feature: "checkin" },
  ];
  const tabs = all.filter((t) => !t.feature || hasFeature(type, t.feature));
  // A single tab is just a label; skip the bar on a phone but keep the
  // rail's brand link on a laptop.
  const solo = tabs.length === 1;

  return (
    <nav className={`appnav${solo ? " appnav--solo" : ""}`}>
      <Link href="/groups" className="appnav__brand">Circles</Link>
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
