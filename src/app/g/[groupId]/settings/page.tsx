import { requireMembership } from "@/lib/auth";
import { renameGroup, leaveGroup } from "@/app/actions/groups";
import { Card, Field, Note, Avatar, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { fmtDay } from "@/lib/format";

export default async function SettingsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase, isAdmin } = await requireMembership(groupId);
  const { data: group } = await supabase.from("friend_groups").select("*").eq("id", groupId).single();

  return (
    <>
      <Card className="p-3.5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar id={groupId} name={group!.name} size={40} />
          <div>
            <div className="font-bold text-[16px]">{group!.name}</div>
            <div className="font-mono text-[12px] text-ink-2">created {fmtDay(group!.created_at)}</div>
          </div>
        </div>
        {isAdmin && (
          <form action={renameGroup.bind(null, groupId)} className="flex flex-col gap-2.5">
            <Field label="Rename group"><input name="name" defaultValue={group!.name} maxLength={48} required /></Field>
            <SubmitButton size="sm" variant="ghost" pendingLabel="Saving…">Save name</SubmitButton>
          </form>
        )}
        <LinkButton href={`/g/${groupId}/members`} variant="ghost" className="w-full">People and invites</LinkButton>
      </Card>

      <Card className="p-3.5 flex flex-col gap-2">
        <h2 className="font-display font-bold text-[15.5px]">Who can do what</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13.5px]">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-3 pt-0.5">Admins</dt>
          <dd>Rename or delete the group, remove members, promote members, link Splitwise.</dd>
          <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-3 pt-0.5">Everyone</dt>
          <dd>Invite people, create and edit events, vote and RSVP, add album links, start challenges and log progress.</dd>
        </dl>
        <Note>
          These rules are enforced by row-level security in Postgres, not by the screens —
          hiding a button and blocking a write are separate things, and both are in place.
        </Note>
      </Card>

      <form action={leaveGroup.bind(null, groupId)}>
        <SubmitButton variant="danger" className="w-full" pendingLabel="Leaving…">Leave this group</SubmitButton>
      </form>
    </>
  );
}
