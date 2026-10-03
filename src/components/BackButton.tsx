"use client";

import { useRouter } from "next/navigation";

export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        const pathname = window.location.pathname;
        const groupBase = pathname.match(/^\/g\/[^/]+/)?.[0];
        const target = groupBase && pathname !== groupBase ? groupBase : fallback;
        // DEBUG — check browser console
        console.log("[BackButton]", { pathname, groupBase, target, fallback });
        router.push(target);
      }}
      aria-label="Back"
      className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}
