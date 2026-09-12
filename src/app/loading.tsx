import { CardSkeleton, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="shell">
      <header className="sticky top-0 z-20 flex items-center gap-2.5 px-3.5 py-3 min-h-14 border-b border-line bg-bg">
        <Skeleton w="42%" h={17} />
      </header>
      <main className="flex-1 flex flex-col gap-5 px-3.5 py-4">
        <CardSkeleton lines={2} />
        <CardSkeleton lines={4} />
      </main>
    </div>
  );
}
