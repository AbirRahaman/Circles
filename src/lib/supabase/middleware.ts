import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getVerifiedUser } from "./verify";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

const PUBLIC = ["/login", "/auth", "/api", "/privacy", "/terms"];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Prefetches fire several at a time as you scroll. Each one refreshing the
  // session invites a rotation race where one request consumes the refresh
  // token the others are still holding. The real navigation is checked
  // anyway, so prefetches skip it.
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";
  if (isPrefetch) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list: CookieToSet[]) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options as never));
        },
      },
    }
  );

  // No auth cookie at all means signed out, with no need to ask anyone.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

  let user: unknown = null;
  if (hasSession) {
    try {
      user = await getVerifiedUser(supabase);
    } catch {
      // Couldn't reach the auth server. Do NOT bounce someone to the login
      // screen over a blip — let the request through and let the page decide.
      return response;
    }
  }

  if (!user && !PUBLIC.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // an invite link survives the round trip through sign-in
    if (path.startsWith("/join/")) url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}
