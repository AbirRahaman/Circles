import Link from "next/link";
import { Card } from "@/components/ui";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Terms · Circles" };

export default function TermsPage() {
  return (
    <div className="shell">
      <TopBar title="Terms of service" sub="Last updated 10 September 2026" />
      <main className="flex-1 flex flex-col gap-4 px-3.5 py-4">
        <Card className="p-4 flex flex-col gap-4 text-[14px] leading-relaxed">
          <p>
            Circles is a personal project offered free of charge for coordinating plans within
            private friend groups. Using it means accepting the terms below.
          </p>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">Your account</h2>
            <p className="text-ink-2">
              You sign in with an existing account from another provider. Keep that account
              secure — anyone with access to it can act as you here. You are responsible for
              what is posted from your account.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">Groups and invites</h2>
            <p className="text-ink-2">
              Anyone holding a group&rsquo;s invite link can join that group and see its
              contents, so share links only with people you intend to include. Group admins
              can remove members and rotate an invite link at any time.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">Acceptable use</h2>
            <p className="text-ink-2">
              Do not use Circles to harass anyone, to share unlawful content, or to attempt to
              reach data belonging to groups you are not a member of. Accounts doing so may be
              removed without notice.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">No warranty</h2>
            <p className="text-ink-2">
              The service is provided as-is, with no guarantee of availability, and it may
              change or stop working at any time. Keep your own copy of anything you would
              mind losing. Circles is a display layer for plans and balances — it is not a
              system of record for money owed, and it moves no money.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">Ending it</h2>
            <p className="text-ink-2">
              You may leave any group or request account deletion at any time by emailing the
              address below.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">Contact</h2>
            <p className="text-ink-2">abirr1358@gmail.com</p>
          </section>
        </Card>

        <Link href="/login" className="text-[13.5px] text-accent px-0.5">Back to sign in</Link>
      </main>
    </div>
  );
}
