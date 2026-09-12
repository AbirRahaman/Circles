import { CardSkeleton, Skeleton } from "@/components/ui";

/* Sits inside the group shell, so the header and tabs stay put and only the
 * content area swaps — which is what makes a tab tap feel instant. */
export default function Loading() {
  return (
    <>
      <Skeleton w="34%" h={13} />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
    </>
  );
}
