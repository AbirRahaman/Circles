import Link from "next/link";
import { requireMembership } from "@/lib/auth";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";

export default async function GroupLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase } = await requireMembership(groupId);

  const { data: group } = await supabase.from("friend_groups").select("name").eq("id", groupId).single();
  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("status", "active");

  return (
    <div className="shell shell--app">
      <TopBar
        title={group?.name ?? "Group"}
        sub={`${count ?? 0} member${count === 1 ? "" : "s"}`}
        back="/"
        actions={
          <div className="flex gap-1">
            <Link href={`/g/${groupId}/members`} aria-label="People" className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" /><circle cx="9" cy="7" r="3.5" /><path d="M17.5 4.2a3.5 3.5 0 0 1 0 6.6" /></svg>
            </Link>
            <Link href={`/g/${groupId}/settings`} aria-label="Settings" className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h8M16 18h4" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="14" cy="18" r="2" /></svg>
            </Link>
          </div>
        }
      />
      <main className="flex-1 flex flex-col gap-4 px-3.5 py-4">{children}</main>
      <TabBar groupId={groupId} />
    </div>
  );
}
