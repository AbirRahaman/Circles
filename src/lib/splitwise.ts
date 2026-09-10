import "server-only";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";

/* Tokens are encrypted before they are stored, so a leaked database row is
   not a usable Splitwise credential. TOKEN_ENCRYPTION_KEY is 32 bytes,
   base64: openssl rand -base64 32 */

function key() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  return Buffer.from(raw, "base64");
}

export function encryptToken(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decryptToken(stored: string) {
  const [iv, tag, data] = stored.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export type BalanceRow = { userId: string; name: string; net: number };

/** Live read from Splitwise, cached for five minutes. Splitwise stays the
 *  source of truth — nothing here is written back into our database. */
export async function fetchBalances(
  groupId: string
): Promise<{ rows: BalanceRow[] } | { error: string }> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("splitwise_links")
    .select("splitwise_group_id, access_token")
    .eq("group_id", groupId)
    .maybeSingle();
  if (!link) return { error: "not linked" };

  let token: string;
  try {
    token = decryptToken(link.access_token);
  } catch {
    return { error: "stored token could not be read" };
  }

  const res = await fetch(`https://secure.splitwise.com/api/v3.0/get_group/${link.splitwise_group_id}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) return { error: `Splitwise returned ${res.status}` };

  const body = (await res.json()) as {
    group?: { members?: { id: number; first_name: string; last_name?: string; email?: string; balance?: { amount: string }[] }[] };
  };
  const swMembers = body.group?.members ?? [];

  // Match Splitwise members to Circles profiles by email where we can, so
  // "you" is highlighted correctly; fall back to the Splitwise identity.
  const { data: memberRows } = await supabase
    .from("memberships")
    .select("user_id, profiles(id, name, email_or_phone)")
    .eq("group_id", groupId)
    .eq("status", "active");

  const byEmail = new Map<string, { id: string; name: string }>();
  (memberRows ?? []).forEach((m) => {
    const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as
      | { id: string; name: string; email_or_phone: string | null }
      | null;
    if (p?.email_or_phone) byEmail.set(p.email_or_phone.toLowerCase(), { id: p.id, name: p.name });
  });

  const rows: BalanceRow[] = swMembers.map((m) => {
    const matched = m.email ? byEmail.get(m.email.toLowerCase()) : undefined;
    const net = (m.balance ?? []).reduce((sum, b) => sum + Number(b.amount ?? 0), 0);
    return {
      userId: matched?.id ?? `sw:${m.id}`,
      name: matched?.name ?? [m.first_name, m.last_name].filter(Boolean).join(" "),
      net,
    };
  });

  return { rows };
}
