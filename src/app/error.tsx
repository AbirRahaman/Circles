"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);

  return (
    <div className="shell">
      <main className="flex-1 flex flex-col justify-center gap-4 px-3.5 py-8">
        <div className="bg-surface border border-line rounded-xl shadow-card p-4 flex flex-col gap-3">
          <h1 className="font-display font-bold text-lg">That didn’t work</h1>
          <p className="text-[13.5px] text-ink-2">{error.message || "Something went wrong."}</p>
          <button
            onClick={reset}
            className="px-4 py-2.5 rounded-lg font-semibold text-sm bg-accent text-accent-ink"
          >
            Try again
          </button>
        </div>
      </main>
    </div>
  );
}
