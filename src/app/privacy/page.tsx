import Link from "next/link";
import { Card } from "@/components/ui";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Privacy · Circles" };

export default function PrivacyPage() {
  return (
    <div className="shell">
      <TopBar title="Privacy" sub="Last updated 10 September 2026" />
      <main className="flex-1 flex flex-col gap-4 px-3.5 py-4">
        <Card className="p-4 flex flex-col gap-4 text-[14px] leading-relaxed">
          <p>
            Circles is a small app for coordinating plans inside a private friend group.
            This page describes exactly what it stores and who can see it.
          </p>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">What is collected</h2>
            <p className="text-ink-2">
              Your name and email address, taken from the account you sign in with. Nothing
              else about you is requested, and no password is ever stored — sign-in is handled
              by your provider.
            </p>
            <p className="text-ink-2">
              Alongside that: the groups you belong to, the events, RSVPs and votes you create
              or respond to, challenge entries you log, and any shared album links you paste in.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">Who can see it</h2>
            <p className="text-ink-2">
              Only people who are active members of the same group. This is enforced by the
              database itself rather than by the screens: every query is checked against your
              membership before any row is returned. Someone who signs in without an invite
              sees nothing but an empty groups list.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">Photos</h2>
            <p className="text-ink-2">
              Circles never receives your photos. When someone shares an album, only the link
              is stored — the photos stay wherever the album lives, under that service&rsquo;s
              own privacy terms.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">Splitwise</h2>
            <p className="text-ink-2">
              Only if a group admin chooses to connect it. Balances are read live from
              Splitwise and shown to you; they are not copied into this app&rsquo;s database.
              The access token is encrypted before being stored. No money moves through
              Circles.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">What is not done</h2>
            <p className="text-ink-2">
              Your data is not sold, rented or shared with advertisers. There is no
              advertising, no third-party analytics and no tracking across other sites.
            </p>
          </section>

          <section className="flex flex-col gap-1.5">
            <h2 className="font-semibold text-[15px]">Leaving and deletion</h2>
            <p className="text-ink-2">
              Leaving a group ends your access to it, but your past votes and entries stay
              attributed so the group&rsquo;s history stays readable. To have your account and
              its records removed entirely, email the address below and it will be deleted.
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
