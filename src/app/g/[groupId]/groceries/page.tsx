import { requireMembership, requireFeature } from "@/lib/auth";
import { addGroceries, toggleGrocery, removeGrocery, clearBought } from "@/app/actions/home";
import { Card, Empty, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { fetchMembers } from "@/lib/members";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Groceries · Circles" };

type Item = {
  id: string; name: string; qty: string | null; added_by: string;
  created_at: string; checked_by: string | null; checked_at: string | null;
};

export default async function GroceriesTab({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase } = await requireMembership(groupId);
  await requireFeature(groupId, "groceries");

  const [{ data: rows }, members] = await Promise.all([
    supabase
      .from("grocery_items")
      .select("id, name, qty, added_by, created_at, checked_by, checked_at")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("created_at"),
    fetchMembers(supabase, groupId),
  ]);

  const names = new Map(members.map((m) => [m.id, m.name.split(" ")[0]]));
  const items = (rows ?? []) as Item[];
  const toBuy = items.filter((i) => !i.checked_at);
  const bought = items
    .filter((i) => i.checked_at)
    .sort((a, b) => b.checked_at!.localeCompare(a.checked_at!));

  const row = (i: Item) => {
    const done = !!i.checked_at;
    return (
      <div key={i.id} className="flex items-center gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0">
        <form action={toggleGrocery.bind(null, groupId, i.id, !done)}>
          <button
            type="submit"
            aria-label={done ? `Put ${i.name} back on the list` : `Mark ${i.name} bought`}
            className={`w-6 h-6 grid place-items-center rounded-md border ${done ? "bg-accent border-accent text-accent-ink" : "border-line-strong hover:bg-surface-2"}`}
          >
            {done && (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            )}
          </button>
        </form>
        <div className="flex-1 min-w-0">
          <div className={`text-[15px] ${done ? "line-through text-ink-3" : "font-medium"}`}>
            {i.name}{i.qty ? <span className="text-ink-2 font-normal"> · {i.qty}</span> : null}
          </div>
          <div className="text-[12px] text-ink-3">
            {done
              ? <>got it: {names.get(i.checked_by ?? "") ?? "someone"} · {timeAgo(i.checked_at!)}</>
              : <>added by {names.get(i.added_by) ?? "someone"} · {timeAgo(i.created_at)}</>}
          </div>
        </div>
        <form action={removeGrocery.bind(null, groupId, i.id)}>
          <button type="submit" aria-label={`Remove ${i.name}`} className="w-7 h-7 grid place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </form>
      </div>
    );
  };

  return (
    <>
      <Card className="p-3">
        <form action={addGroceries.bind(null, groupId)} className="flex gap-2">
          <input name="items" placeholder="Add items: milk, eggs, bread" maxLength={600} required autoComplete="off" />
          <SubmitButton size="sm" pendingLabel="Adding…" className="shrink-0">Add</SubmitButton>
        </form>
      </Card>

      <section className="flex flex-col gap-2.5">
        <SectionHead title="To buy" right={<span className="text-[12.5px] text-ink-3 tabular">{toBuy.length}</span>} />
        {toBuy.length ? <Card>{toBuy.map(row)}</Card> : (
          <Empty title="List is empty">Add things as you run out. Separate several with commas.</Empty>
        )}
      </section>

      {bought.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHead
            title="Bought"
            right={
              <form action={clearBought.bind(null, groupId)}>
                <SubmitButton size="sm" variant="quiet" pendingLabel="Clearing…">Clear</SubmitButton>
              </form>
            }
          />
          <Card>{bought.map(row)}</Card>
        </section>
      )}
    </>
  );
}
