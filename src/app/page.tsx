import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { createGroup } from "./actions/groups";
import { Card, Empty, Note, Field, Avatar } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { TopBar } from "@/components/TopBar";

export default async function GroupSwitcher() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("memberships")
    .select("id, role, group_id, friend_groups(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const groups = (rows ?? [])
    .map((r) => ({ role: r.role, group: Array.isArray(r.friend_groups) ? r.friend_groups[0] : r.friend_groups }))
    .filter((g) => g.group);

  return (
    <div className="shell">
      <TopBar
        title="Circles"
        sub="your groups"
        actions={
          <Link href="/profile" aria-label="You" className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
          </Link>
        }
      />
      <main className="flex-1 flex flex-col gap-4 px-3.5 py-4">
        {groups.length === 0 ? (
          <Empty title="No groups yet">
            Start one and share the invite link, or follow a link a friend already sent you.
          </Empty>
        ) : (
          <Card>
            {groups.map(({ group, role }) => (
              <Link key={group!.id} href={`/g/${group!.id}`} className="flex items-center gap-3 px-3.5 py-3 border-b border-line last:border-b-0 hover:bg-surface-2">
                <Avatar id={group!.id} name={group!.name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{group!.name}</div>
                  <div className="text-[12px] text-ink-2">{role === "admin" ? "You are an admin" : "Member"}</div>
                </div>
              </Link>
            ))}
          </Card>
        )}

        <Card className="p-3.5">
          <form action={createGroup} className="flex flex-col gap-3">
            <Field label="Start a new group">
              <input name="name" placeholder="Cabin Crew" maxLength={48} required />
            </Field>
            <SubmitButton pendingLabel="Creating…" className="w-full">Create group</SubmitButton>
          </form>
        </Card>

        <Note>
          <strong>Joining a group</strong> happens through an invite link — an admin or any
          member sends you one from the group’s People screen.
        </Note>
      </main>
    </div>
  );
}
