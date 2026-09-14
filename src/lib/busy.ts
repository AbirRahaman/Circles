import { TZ } from "@/lib/format";

// The client's rpc() returns a thenable builder, not a bare promise.
type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

/** Days each person already has something on, across every group they're in.
 *  Returns days only — the function behind this deliberately can't tell you
 *  what they're busy with, or with whom. */
export async function fetchBusyDays(
  supabase: Rpc, userIds: string[], from: string, to: string
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (userIds.length === 0) return out;

  const { data, error } = await supabase.rpc("busy_days", {
    p_users: userIds, p_from: from, p_to: to, p_tz: TZ,
  });
  if (error) return out;

  for (const row of (data ?? []) as { user_id: string; day: string }[]) {
    if (!out.has(row.user_id)) out.set(row.user_id, new Set());
    out.get(row.user_id)!.add(row.day);
  }
  return out;
}
