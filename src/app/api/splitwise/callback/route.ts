import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/splitwise";

/** Step 2: exchange the code, let the admin's Splitwise groups be listed, and
 *  store the link. The token is encrypted before it touches the database. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const groupId = request.nextUrl.searchParams.get("state");
  const origin = request.nextUrl.origin;
  if (!code || !groupId) return NextResponse.redirect(`${origin}/`);

  const tokenRes = await fetch("https://secure.splitwise.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: process.env.SPLITWISE_CLIENT_ID,
      client_secret: process.env.SPLITWISE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/splitwise/callback`,
    }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(`${origin}/g/${groupId}/money?error=oauth`);

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Pick the first Splitwise group for now; a group picker is the next step.
  const groupsRes = await fetch("https://secure.splitwise.com/api/v3.0/get_groups", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const groups = (await groupsRes.json()) as { groups?: { id: number; name: string }[] };
  const first = (groups.groups ?? []).find((g) => g.id !== 0);
  if (!first) return NextResponse.redirect(`${origin}/g/${groupId}/money?error=nogroups`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // RLS: this insert only lands if the signed-in user is an admin of the group.
  await supabase.from("splitwise_links").insert({
    group_id: groupId,
    splitwise_group_id: String(first.id),
    splitwise_group_name: first.name,
    linked_by: user.id,
    access_token: encryptToken(access_token),
  });

  return NextResponse.redirect(`${origin}/g/${groupId}/money`);
}
