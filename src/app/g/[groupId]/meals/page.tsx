import Link from "next/link";
import { requireMembership, requireFeature } from "@/lib/auth";
import { addMeal, removeMeal, setMealCook } from "@/app/actions/home";
import { Card, Disclosure, Field, Pill, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { fetchMembers } from "@/lib/members";
import { fmtDate, groupToday } from "@/lib/format";
import { addDays, isDateKey, mondayOf, weekdayShort } from "@/lib/week";

export const metadata = { title: "Meals · Circles" };

type Meal = { id: string; day: string; slot: string; title: string; cook_id: string | null; note: string | null };
const SLOTS = ["breakfast", "lunch", "dinner"] as const;
const SLOT_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

export default async function MealsTab({
  params, searchParams,
}: { params: Promise<{ groupId: string }>; searchParams: Promise<{ w?: string }> }) {
  const { groupId } = await params;
  const sp = await searchParams;
  const { supabase, user } = await requireMembership(groupId);
  await requireFeature(groupId, "meals");

  const today = groupToday();
  const thisWeek = mondayOf(today);
  const week = isDateKey(sp.w) ? mondayOf(sp.w) : thisWeek;
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  const [{ data: rows }, members] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("id, day, slot, title, cook_id, note")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .gte("day", days[0])
      .lte("day", days[6]),
    fetchMembers(supabase, groupId),
  ]);

  const names = new Map(members.map((m) => [m.id, m.name.split(" ")[0]]));
  const meals = (rows ?? []) as Meal[];
  const byDay = new Map<string, Meal[]>();
  for (const m of meals) byDay.set(m.day, [...(byDay.get(m.day) ?? []), m]);
  for (const list of byDay.values()) list.sort((a, b) => SLOTS.indexOf(a.slot as never) - SLOTS.indexOf(b.slot as never));

  const mine = meals.filter((m) => m.cook_id === user.id).length;
  const base = `/g/${groupId}/meals`;
  const defaultDay = week === thisWeek ? today : days[0];

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Link href={`${base}?w=${addDays(week, -7)}`} className="px-2.5 py-1.5 rounded-lg text-[13px] font-semibold text-ink-2 hover:bg-surface-2">← Prev</Link>
        <div className="text-center">
          <div className="font-bold text-[15.5px]">Week of {fmtDate(week)}</div>
          {week !== thisWeek && <Link href={base} className="text-[12px] text-accent">Back to this week</Link>}
        </div>
        <Link href={`${base}?w=${addDays(week, 7)}`} className="px-2.5 py-1.5 rounded-lg text-[13px] font-semibold text-ink-2 hover:bg-surface-2">Next →</Link>
      </div>

      <Disclosure label="Plan a meal">
        <form action={addMeal.bind(null, groupId)} className="flex flex-col gap-3">
          <Field label="What">
            <input name="title" required maxLength={80} placeholder="Tacos" />
          </Field>
          <div className="flex gap-2.5">
            <span className="flex-1 min-w-0">
              <Field label="Day">
                <select name="day" defaultValue={defaultDay}>
                  {days.map((d) => <option key={d} value={d}>{weekdayShort(d)} {fmtDate(d)}</option>)}
                </select>
              </Field>
            </span>
            <span className="flex-1 min-w-0">
              <Field label="Meal">
                <select name="slot" defaultValue="dinner">
                  {SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
                </select>
              </Field>
            </span>
          </div>
          <Field label="Who's cooking">
            <select name="cook_id" defaultValue="">
              <option value="">Nobody yet</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.id === user.id ? `${m.name} (you)` : m.name}</option>)}
            </select>
          </Field>
          <Field label="Add to grocery list (optional)">
            <input name="ingredients" maxLength={600} placeholder="tortillas, ground beef, salsa" />
          </Field>
          <Field label="Note (optional)">
            <input name="note" maxLength={200} placeholder="Vegetarian option for Sam" />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Saving…">Add to the plan</SubmitButton>
        </form>
      </Disclosure>

      <section className="flex flex-col gap-2.5">
        <SectionHead
          title="This week's meals"
          right={<span className="text-[12.5px] text-ink-3">{meals.length} planned{mine ? ` · you cook ${mine}` : ""}</span>}
        />
        <Card>
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            const isToday = d === today;
            return (
              <div key={d} className={`flex gap-3 px-3.5 py-3 border-b border-line last:border-b-0 ${d < today ? "opacity-60" : ""}`}>
                <div className="w-12 shrink-0">
                  <div className={`text-[12px] font-semibold uppercase tracking-wider ${isToday ? "text-accent" : "text-ink-3"}`}>{weekdayShort(d)}</div>
                  <div className="font-mono text-[12px] text-ink-2">{fmtDate(d)}</div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  {list.length === 0 && <div className="text-[13.5px] text-ink-3 pt-0.5">Nothing planned</div>}
                  {list.map((m) => (
                    <div key={m.id} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[14.5px] font-medium">
                          <span className="text-[11.5px] font-mono uppercase tracking-wider text-ink-3 mr-1.5">{SLOT_LABEL[m.slot]}</span>
                          {m.title}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {m.cook_id ? (
                            <Pill tone={m.cook_id === user.id ? "accent" : undefined}>
                              {m.cook_id === user.id ? "You're cooking" : `${names.get(m.cook_id) ?? "Someone"} cooks`}
                            </Pill>
                          ) : (
                            <form action={setMealCook.bind(null, groupId, m.id, user.id)}>
                              <button type="submit" className="text-[12.5px] font-semibold text-accent hover:underline">I&rsquo;ll cook</button>
                            </form>
                          )}
                          {m.cook_id === user.id && (
                            <form action={setMealCook.bind(null, groupId, m.id, null)}>
                              <button type="submit" className="text-[12px] text-ink-3 hover:text-ink">Step back</button>
                            </form>
                          )}
                          {m.note && <span className="text-[12.5px] text-ink-2">{m.note}</span>}
                        </div>
                      </div>
                      <form action={removeMeal.bind(null, groupId, m.id)}>
                        <button type="submit" aria-label={`Remove ${m.title}`} className="w-7 h-7 grid place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      </section>
    </>
  );
}
