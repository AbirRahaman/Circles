import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { updateProfile, signOut } from "@/app/actions/profile";
import { Card, Field, Avatar, Note, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { TopBar } from "@/components/TopBar";
import { fmtDay } from "@/lib/format";

export const metadata = { title: "You · Circles" };

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email_or_phone, avatar_url, created_at")
    .eq("id", user.id)
    .single();

  const provider = user.app_metadata?.provider ?? "email";
  const providerName = provider === "google" ? "Google" : provider === "apple" ? "Apple" : "Email link";

  const { count: groupCount } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  return (
    <div className="shell">
      <TopBar title="You" back="/groups" />
      <main className="flex-1 flex flex-col gap-5 px-3.5 py-4">
        <Card className="p-3.5 flex items-center gap-3">
          <Avatar id={user.id} name={profile?.name ?? "?"} src={profile?.avatar_url} size={52} />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[17px] tracking-[-0.015em] truncate">{profile?.name}</span>
            <span className="text-[13px] text-ink-2 truncate">{profile?.email_or_phone}</span>
            <span className="text-[12.5px] text-ink-3">
              {groupCount ?? 0} group{groupCount === 1 ? "" : "s"} · joined {profile?.created_at ? fmtDay(profile.created_at) : "—"}
            </span>
          </div>
        </Card>

        <section className="flex flex-col gap-2.5">
          <SectionHead title="Your details" />
          <Card className="p-3.5">
            <form action={updateProfile} className="flex flex-col gap-3.5">
              <Field label="Name">
                <input name="name" required maxLength={40} defaultValue={profile?.name ?? ""} />
              </Field>
              <Field label="Picture link">
                <input name="avatar_url" type="url" placeholder="https://…" defaultValue={profile?.avatar_url ?? ""} />
              </Field>
              <SubmitButton className="w-full" pendingLabel="Saving…">Save</SubmitButton>
              <p className="text-[12px] text-ink-2">
                This is the name and face everyone in your groups sees. Clearing the picture
                link falls back to your initials.
              </p>
            </form>
          </Card>
        </section>

        <section className="flex flex-col gap-2.5">
          <SectionHead title="Sign-in" />
          <Card className="p-3.5 flex flex-col gap-2.5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13.5px]">
              <dt className="text-ink-3">Method</dt>
              <dd>{providerName}</dd>
              <dt className="text-ink-3">Address</dt>
              <dd className="truncate">{user.email}</dd>
            </dl>
            <Note>
              Your email address comes from {providerName} and can&rsquo;t be changed here.
              Circles never sees or stores a password.
            </Note>
            <form action={signOut}>
              <SubmitButton variant="ghost" className="w-full" pendingLabel="Signing out…">Sign out</SubmitButton>
            </form>
          </Card>
        </section>

        <div className="flex flex-col gap-2 px-0.5">
          <Link href="/calendar" className="text-[13px] text-accent">Your calendar and sync settings</Link>
          <Link href="/privacy" className="text-[13px] text-accent">What Circles stores about you</Link>
        </div>
      </main>
    </div>
  );
}
