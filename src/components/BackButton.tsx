"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BackButton({ fallback }: { fallback: string }) {
  const pathname = usePathname();

  // Navigate up one level in the hierarchy:
  //   /g/abc/events/xyz  → /g/abc   (back to the group)
  //   /g/abc/members     → /g/abc
  //   /g/abc             → /groups  (the fallback)
  const groupBase = pathname.match(/^\/g\/[^/]+/)?.[0];
  const href = groupBase && pathname !== groupBase ? groupBase : fallback;

  return (
    <Link
      href={href}
      aria-label="Back"
      className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  );
}
