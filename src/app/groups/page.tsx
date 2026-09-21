import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { createGroup } from "@/app/actions/groups";
import { Card, Disclosure, Empty, Field, Avatar, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { GroupTypePicker } from "@/components/GroupTypePicker";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Your groups · Circles" };

export default async function GroupsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("memberships")
    .select("role, group_id, friend_groups(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const groups = (rows ?? [])
    .map((r) => ({ role: r.role, group: Array.isArray(r.friend_groups) ? r.friend_groups[0] : r.friend_groups }))
    .filter((g) => g.group);

  return (
    <div className="shell">
      <TopBar
        title="Your groups"
        actions={
          <>
          <Link href="/calendar" aria-label="Calendar" className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
          </Link>
          <Link href="/profile" aria-label="You" className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
          </Link>
          </>
        }
      />
      <main className="flex-1 flex flex-col gap-5 px-3.5 py-4">
        {groups.length === 0 ? (
          <Empty title="Nothing here yet">Follow an invite link, or start a group below.</Empty>
        ) : (
          <section className="flex flex-col gap-2.5">
            <SectionHead
              title="Groups"
              right={<span className="text-[12.5px] text-ink-3">{groups.length}</span>}
            />
            <Card>
              {groups.map(({ group, role }) => (
                <Link
                  key={group!.id}
                  href={`/g/${group!.id}`}
                  className="flex items-center gap-3 px-3.5 py-3 border-b border-line last:border-b-0 hover:bg-surface-2"
                >
                  <Avatar id={group!.id} name={group!.name} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{group!.name}</div>
                    <div className="text-[12.5px] text-ink-2">{role === "admin" ? "You're an admin" : "Member"}</div>
                  </div>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-3 shrink-0">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              ))}
            </Card>
          </section>
        )}

        <Disclosure label="Start another group">
          <form action={createGroup} className="flex flex-col gap-3">
            <Field label="Group name"><input name="name" placeholder="Ski trip crew" maxLength={48} required /></Field>
            <GroupTypePicker />
            <SubmitButton pendingLabel="Creating…" className="w-full">Create the group</SubmitButton>
          </form>
        </Disclosure>
      </main>
    </div>
  );
}
