import { headers } from "next/headers";
import { requireMembership } from "@/lib/auth";
import { setMemberRole, removeMember, rotateInvite } from "@/app/actions/groups";
import { Card, Avatar, Note, Pill, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { fmtDay } from "@/lib/format";

export default async function MembersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase, user, isAdmin } = await requireMembership(groupId);

  const { data: rows } = await supabase
    .from("memberships")
    .select("id, user_id, role, status, joined_at, left_at, profiles(id, name, avatar_url)")
    .eq("group_id", groupId);

  const { data: invite } = await supabase
    .from("invites")
    .select("token")
    .eq("group_id", groupId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${h.get("host")}`;
  const inviteUrl = invite ? `${origin}/join/${invite.token}` : null;

  const people = (rows ?? []).map((r) => ({
    ...r,
    profile: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { id: string; name: string; avatar_url: string | null } | null,
  }));
  const active = people.filter((p) => p.status === "active");
  const past = people.filter((p) => p.status === "left");

  return (
    <>
      <Card className="p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-[15.5px]">Invite link</h2>
          <Pill tone="accent">{isAdmin ? "Admin" : "Member"}</Pill>
        </div>
        {inviteUrl ? (
          <code className="font-mono text-[12px] break-all bg-surface-2 rounded-md px-2.5 py-2">{inviteUrl}</code>
        ) : (
          <p className="text-[13px] text-ink-2">No active invite link.</p>
        )}
        <p className="text-[12px] text-ink-2">Anyone with this link joins as a member. Any member can share it.</p>
        {isAdmin && (
          <form action={rotateInvite.bind(null, groupId)}>
            <SubmitButton size="sm" variant="quiet" pendingLabel="Rotating…">Rotate link</SubmitButton>
          </form>
        )}
      </Card>

      <SectionHead title="In the group" right={<span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">{active.length}</span>} />
      <Card>
        {active.map((m) => (
          <div key={m.id} className="flex items-center gap-2.5 px-3.5 py-3 border-b border-line last:border-b-0">
            <Avatar id={m.user_id} name={m.profile?.name ?? "?"} src={m.profile?.avatar_url} size={34} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {m.profile?.name}{m.user_id === user.id && <span className="text-[12px] text-ink-2 font-normal"> you</span>}
              </div>
              <div className="font-mono text-[12px] text-ink-2">
                {m.role === "admin" ? "Admin" : "Member"} · joined {m.joined_at ? fmtDay(m.joined_at) : "—"}
              </div>
            </div>
            {isAdmin && m.user_id !== user.id && (
              <div className="flex gap-1.5">
                <form action={setMemberRole.bind(null, groupId, m.user_id, m.role === "admin" ? "member" : "admin")}>
                  <SubmitButton size="sm" variant="quiet">{m.role === "admin" ? "Demote" : "Make admin"}</SubmitButton>
                </form>
                <form action={removeMember.bind(null, groupId, m.user_id)}>
                  <SubmitButton size="sm" variant="danger">Remove</SubmitButton>
                </form>
              </div>
            )}
          </div>
        ))}
      </Card>

      {past.length > 0 && (
        <>
          <SectionHead title="Past members" right={<span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">history kept</span>} />
          <Card>
            {past.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 px-3.5 py-3 border-b border-line last:border-b-0 opacity-70">
                <Avatar id={m.user_id} name={m.profile?.name ?? "?"} src={m.profile?.avatar_url} size={34} />
                <div className="flex-1">
                  <div className="font-semibold">{m.profile?.name}</div>
                  <div className="font-mono text-[12px] text-ink-2">left {m.left_at ? fmtDay(m.left_at) : "—"}</div>
                </div>
              </div>
            ))}
          </Card>
          <Note>
            Membership rows are never deleted, so old votes, RSVPs and challenge entries keep
            their names. Rejoining creates a new row rather than reviving the old one.
          </Note>
        </>
      )}
    </>
  );
}
