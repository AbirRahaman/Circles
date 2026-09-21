import { requireMembership, requireFeature } from "@/lib/auth";
import { Card, Note, Pill, SectionHead, Avatar, LinkButton } from "@/components/ui";
import { fetchBalances } from "@/lib/splitwise";
import { num } from "@/lib/format";

export default async function MoneyTab({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase, user, isAdmin } = await requireMembership(groupId);
  await requireFeature(groupId, "money");

  // Never select access_token into a page — it stays server-side in lib/splitwise.
  const { data: link } = await supabase
    .from("splitwise_links")
    .select("id, splitwise_group_id, splitwise_group_name, linked_by")
    .eq("group_id", groupId)
    .maybeSingle();

  if (!link) {
    return (
      <>
        <SectionHead title="Splitwise" right={<Pill dot>Not linked</Pill>} />
        <Card className="p-3.5 flex flex-col gap-3">
          <p className="text-[13.5px]">
            Circles never holds money or copies expenses. Link this friend group to its
            existing Splitwise group and balances are read live whenever you open this tab.
          </p>
          {isAdmin ? (
            <LinkButton href={`/api/splitwise/start?group=${groupId}`} className="w-full">
              Link a Splitwise group
            </LinkButton>
          ) : (
            <Note>Only an admin can link Splitwise.</Note>
          )}
        </Card>
        <Note>
          <strong>Needs credentials.</strong> Set SPLITWISE_CLIENT_ID and SPLITWISE_CLIENT_SECRET
          in .env.local, and register {`{origin}`}/api/splitwise/callback as the redirect URI at
          secure.splitwise.com/apps.
        </Note>
      </>
    );
  }

  const balances = await fetchBalances(groupId);

  if ("error" in balances) {
    return (
      <>
        <SectionHead title="Splitwise" right={<Pill tone="maybe" dot>Linked</Pill>} />
        <Note tone="warn">
          Could not reach Splitwise: {balances.error}. Balances will reappear once the
          connection is working — nothing in Circles changed.
        </Note>
      </>
    );
  }

  const mine = balances.rows.find((r) => r.userId === user.id);

  return (
    <>
      <SectionHead title="Splitwise" right={<Pill tone="go" dot>Linked</Pill>} />
      <Card className="p-3.5 flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10.5px] uppercase tracking-widest text-ink-3">Your position</span>
          <span
            className="font-display font-extrabold text-3xl tracking-tight"
            style={{ color: mine && mine.net < 0 ? "var(--no)" : "var(--go)" }}
          >
            {!mine ? "—" : mine.net < 0 ? `You owe $${num(Math.abs(mine.net))}` : mine.net > 0 ? `You are owed $${num(mine.net)}` : "All settled"}
          </span>
          <span className="font-mono text-[12px] text-ink-2">
            Splitwise group “{link.splitwise_group_name ?? link.splitwise_group_id}” · cached 5 min
          </span>
        </div>

        <div>
          {balances.rows.map((r) => (
            <div key={r.userId} className="flex items-center justify-between py-2 border-t border-line">
              <span className="flex items-center gap-2">
                <Avatar id={r.userId} name={r.name} size={24} />
                <span className="text-[13.5px]">{r.name}{r.userId === user.id ? " (you)" : ""}</span>
              </span>
              <span
                className="font-mono text-[13.5px]"
                style={{ color: r.net < 0 ? "var(--no)" : r.net > 0 ? "var(--go)" : "var(--ink-3)" }}
              >
                {r.net === 0 ? "settled" : `${r.net > 0 ? "+" : "−"}$${num(Math.abs(r.net))}`}
              </span>
            </div>
          ))}
        </div>

        <a
          href={`https://secure.splitwise.com/groups/${link.splitwise_group_id}`}
          target="_blank"
          rel="noopener"
          className="w-full text-center px-4 py-2.5 rounded-lg font-semibold text-sm bg-accent text-accent-ink"
        >
          Add an expense in Splitwise
        </a>
      </Card>
      <Note>
        Expenses live in Splitwise. v1 deep-links you there rather than rebuilding their
        expense form; creating expenses through their API is a v2 job.
      </Note>
    </>
  );
}
