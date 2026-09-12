import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { createGroup } from "./actions/groups";
import { Card, Field, Note } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { TopBar } from "@/components/TopBar";

/* Nobody wants a lobby. One group means go straight in; several means pick
 * one; none means you have not been invited anywhere yet, and that is the
 * only case where starting a group is the main event. */
export default async function Home() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("memberships")
    .select("group_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  const groups = rows ?? [];
  if (groups.length === 1) redirect(`/g/${groups[0].group_id}`);
  if (groups.length > 1) redirect("/groups");

  return (
    <div className="shell">
      <TopBar
        title="Circles"
        actions={
          <Link href="/profile" aria-label="You" className="w-8 h-8 grid place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
          </Link>
        }
      />
      <main className="flex-1 flex flex-col justify-center gap-5 px-3.5 py-6">
        <div className="flex flex-col gap-2 px-0.5">
          <h1 className="text-2xl font-bold tracking-[-0.025em]">You&rsquo;re not in a group yet</h1>
          <p className="text-[14px] text-ink-2 leading-relaxed">
            Circles is private by invitation. Groups don&rsquo;t appear in search and can&rsquo;t be
            browsed — someone already inside sends you a link, and following it puts you in.
          </p>
        </div>

        <Note>
          <strong>Waiting on a link?</strong> Ask whoever set the group up to send it again from
          their People screen. Opening it while signed in as {user.email} adds you straight away.
        </Note>

        <Card className="p-3.5">
          <form action={createGroup} className="flex flex-col gap-3">
            <Field label="Or start one of your own">
              <input name="name" placeholder="Cabin Crew" maxLength={48} required />
            </Field>
            <SubmitButton pendingLabel="Creating…" className="w-full">Create the group</SubmitButton>
            <p className="text-[12px] text-ink-2">
              You&rsquo;ll be its admin, and you get an invite link to share straight away.
            </p>
          </form>
        </Card>
      </main>
    </div>
  );
}
