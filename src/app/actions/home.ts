"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { groupToday } from "@/lib/format";
import { isDateKey, mondayOf } from "@/lib/week";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const splitItems = (raw: string) =>
  raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 30);

async function ctx() {
  const user = await requireUser();
  const supabase = await createClient();
  return { user, supabase };
}

// ── Groceries ─────────────────────────────────────────────────────────

/** Accepts several items at once: "milk, eggs, bread". */
export async function addGroceries(groupId: string, formData: FormData) {
  const names = splitItems(str(formData.get("items")));
  if (!names.length) throw new Error("Type something to add.");
  if (names.some((n) => n.length > 80)) throw new Error("Keep each item under 80 characters.");

  const { user, supabase } = await ctx();
  const { error } = await supabase
    .from("grocery_items")
    .insert(names.map((name) => ({ group_id: groupId, name, added_by: user.id })));
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/groceries`);
}

export async function toggleGrocery(groupId: string, itemId: string, checked: boolean) {
  const { user, supabase } = await ctx();
  const { error } = await supabase
    .from("grocery_items")
    .update(checked ? { checked_by: user.id, checked_at: new Date().toISOString() } : { checked_by: null, checked_at: null })
    .eq("id", itemId)
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/groceries`);
}

export async function removeGrocery(groupId: string, itemId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("grocery_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/groceries`);
}

export async function clearBought(groupId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("grocery_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .not("checked_at", "is", null);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/groceries`);
}

// ── Meals ─────────────────────────────────────────────────────────────

export async function addMeal(groupId: string, formData: FormData) {
  const day = str(formData.get("day"));
  const slot = str(formData.get("slot")) || "dinner";
  const title = str(formData.get("title"));
  const cook = str(formData.get("cook_id"));
  const note = str(formData.get("note"));
  const ingredients = splitItems(str(formData.get("ingredients")));

  if (!isDateKey(day)) throw new Error("Pick a day.");
  if (!["breakfast", "lunch", "dinner"].includes(slot)) throw new Error("Pick a meal.");
  if (!title) throw new Error("What's for the meal?");

  const { user, supabase } = await ctx();
  const { error } = await supabase.from("meal_plans").insert({
    group_id: groupId, day, slot, title,
    cook_id: cook || null,
    note: note || null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  // Optional: drop what the meal needs straight onto the grocery list.
  if (ingredients.length) {
    const { error: gErr } = await supabase
      .from("grocery_items")
      .insert(ingredients.map((name) => ({ group_id: groupId, name: name.slice(0, 80), added_by: user.id })));
    if (gErr) throw new Error(gErr.message);
    revalidatePath(`/g/${groupId}/groceries`);
  }

  revalidatePath(`/g/${groupId}/meals`);
}

export async function setMealCook(groupId: string, mealId: string, cookId: string | null) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("meal_plans")
    .update({ cook_id: cookId })
    .eq("id", mealId)
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/meals`);
}

export async function removeMeal(groupId: string, mealId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("meal_plans")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", mealId)
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/meals`);
}

// ── Chores ────────────────────────────────────────────────────────────

export async function addChore(groupId: string, formData: FormData) {
  const title = str(formData.get("title"));
  const who = formData.getAll("who").map(String).filter(Boolean);
  const first = str(formData.get("first"));

  if (!title) throw new Error("Name the chore.");
  if (title.length > 60) throw new Error("Keep the name under 60 characters.");
  if (!who.length) throw new Error("Pick at least one person for the rotation.");

  // Start the rotation with whoever was chosen to go first.
  const i = who.indexOf(first);
  const rotation = i > 0 ? [...who.slice(i), ...who.slice(0, i)] : who;

  const { user, supabase } = await ctx();
  const { error } = await supabase.from("chores").insert({
    group_id: groupId,
    title,
    rotation,
    start_week: mondayOf(groupToday()),
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/chores`);
}

export async function removeChore(groupId: string, choreId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("chores")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", choreId)
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/chores`);
}

export async function markChoreDone(groupId: string, choreId: string, weekStart: string) {
  if (!isDateKey(weekStart)) throw new Error("Bad week.");
  const { user, supabase } = await ctx();
  const { error } = await supabase
    .from("chore_completions")
    .insert({ chore_id: choreId, week_start: weekStart, done_by: user.id });
  // Someone else ticked it first; that's fine.
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath(`/g/${groupId}/chores`);
}

export async function undoChoreDone(groupId: string, completionId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("chore_completions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", completionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/g/${groupId}/chores`);
}
