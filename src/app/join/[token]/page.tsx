import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { acceptInvite } from "@/app/actions/groups";
import { Card, Note } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { TopBar } from "@/components/TopBar";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await requireUser();
  const supabase = await createClient();

  // The invite row itself is behind RLS, so a non-member cannot preview the
  // group here — accepting is what reveals it.
  const { data: invite } = await supabase
    .from("invites")
    .select("id, group_id, friend_groups(name)")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();

  const groupName = invite
    ? (Array.isArray(invite.friend_groups) ? invite.friend_groups[0]?.name : (invite.friend_groups as { name: string } | null)?.name)
    : null;

  return (
    <div className="shell">
      <TopBar title="Invitation" />
      <main className="flex-1 flex flex-col justify-center gap-4 px-3.5 py-8">
        <Card className="p-4 flex flex-col gap-3">
          <h1 className="font-display font-extrabold text-xl">
            {groupName ? `Join ${groupName}` : "Join this group"}
          </h1>
          <p className="text-[13.5px] text-ink-2">
            You will show up in the group’s member list and can vote on plans, RSVP, log
            challenge progress and see balances.
          </p>
          <form action={acceptInvite.bind(null, token)}>
            <SubmitButton pendingLabel="Joining…" className="w-full">Join the group</SubmitButton>
          </form>
        </Card>
        <Note>Invite links can be rotated by an admin, which turns off every older link.</Note>
      </main>
    </div>
  );
}
