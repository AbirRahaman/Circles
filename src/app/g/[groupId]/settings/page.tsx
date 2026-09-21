import { requireMembership, getGroup } from "@/lib/auth";
import { GROUP_TYPE_INFO, hasFeature } from "@/lib/groupTypes";
import { GroupTypePicker } from "@/components/GroupTypePicker";
import { renameGroup, leaveGroup, setBehaviorEnabled, setGroupType } from "@/app/actions/groups";
import { Card, Field, Note, Avatar, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { fmtDay } from "@/lib/format";

export default async function SettingsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { isAdmin } = await requireMembership(groupId);
  const group = await getGroup(groupId);

  return (
    <>
      <Card className="p-3.5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar id={groupId} name={group.name} size={40} />
          <div>
            <div className="font-bold text-[16px]">{group.name}</div>
            <div className="font-mono text-[12px] text-ink-2">created {fmtDay(group.created_at)}</div>
          </div>
        </div>
        {isAdmin && (
          <form action={renameGroup.bind(null, groupId)} className="flex flex-col gap-2.5">
            <Field label="Rename group"><input name="name" defaultValue={group.name} maxLength={48} required /></Field>
            <SubmitButton size="sm" variant="ghost" pendingLabel="Saving…">Save name</SubmitButton>
          </form>
        )}
        <LinkButton href={`/g/${groupId}/members`} variant="ghost" className="w-full">People and invites</LinkButton>
      </Card>

      <Card className="p-3.5 flex flex-col gap-2.5">
        <h2 className="font-display font-bold text-[15.5px]">Group type</h2>
        {isAdmin ? (
          <form action={setGroupType.bind(null, groupId)} className="flex flex-col gap-2.5">
            <GroupTypePicker defaultValue={group.type} />
            <SubmitButton size="sm" variant="ghost" pendingLabel="Saving…">Save type</SubmitButton>
            <Note>
              Switching only shows or hides tabs. Nothing is deleted, so switching back brings
              everything back.
            </Note>
          </form>
        ) : (
          <div>
            <div className="font-semibold text-[14px]">{GROUP_TYPE_INFO[group.type].label}</div>
            <div className="text-[13px] text-ink-2">{GROUP_TYPE_INFO[group.type].blurb}</div>
          </div>
        )}
      </Card>

      {hasFeature(group.type, "behavior") && (
        <Card className="p-3.5 flex flex-col gap-2.5">
          <h2 className="font-display font-bold text-[15.5px]">Features</h2>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-[14px]">Behavior ratings</div>
              <div className="text-[13px] text-ink-2">
                Lets event hosts rate how everyone showed up, from L to W.
              </div>
            </div>
            <span className={`shrink-0 text-[12px] font-mono uppercase tracking-wider ${group.behavior_enabled ? "text-go" : "text-ink-3"}`}>
              {group.behavior_enabled ? "On" : "Off"}
            </span>
          </div>
          {isAdmin ? (
            <form action={setBehaviorEnabled.bind(null, groupId, !group.behavior_enabled)}>
              <SubmitButton size="sm" variant="ghost" className="w-full" pendingLabel="Saving…">
                {group.behavior_enabled ? "Turn off" : "Turn on"}
              </SubmitButton>
            </form>
          ) : (
            <Note>Only admins can change this.</Note>
          )}
        </Card>
      )}

      <Card className="p-3.5 flex flex-col gap-2">
        <h2 className="font-display font-bold text-[15.5px]">Who can do what</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13.5px]">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-3 pt-0.5">Admins</dt>
          <dd>Rename or delete the group, remove members, promote members, link Splitwise, turn optional features on or off.</dd>
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
