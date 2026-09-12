/* getUser() answers "who is this" and "could I reach the auth server" with
 * the same shape: a null user. Treating those identically logs people out
 * over a dropped packet, so this separates them.
 *
 *   user  — verified, signed in
 *   null  — verified, signed out
 *   throw — could not tell; the caller decides how to fail */

export type AuthUser = {
  id: string;
  email?: string;
  app_metadata?: { provider?: string; [k: string]: unknown };
  user_metadata?: Record<string, unknown>;
};

type AuthLike = { auth: { getUser: () => Promise<{ data: { user: unknown }; error: unknown }> } };

const RETRYABLE = (error: { name?: string; status?: number } | null) => {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  // No status means it never reached the server; 5xx means the server tripped.
  return error.status === undefined || error.status >= 500;
};

export async function getVerifiedUser(supabase: AuthLike) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.auth.getUser();
    const err = error as { name?: string; status?: number } | null;

    if (!err) return (data?.user ?? null) as AuthUser | null;
    if (!RETRYABLE(err)) return null; // a real 401/403 — genuinely signed out

    if (attempt === 0) await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("auth_unreachable");
}
