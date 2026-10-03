"use client";

import { useRouter } from "next/navigation";

export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        // Read the actual browser URL at click time — usePathname() inside
        // a layout client component can return stale values for child routes.
        const pathname = window.location.pathname;
        const groupBase = pathname.match(/^\/g\/[^/]+/)?.[0];
        if (groupBase && pathname !== groupBase) {
          router.push(groupBase);
        } else {
          router.push(fallback);
        }
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
