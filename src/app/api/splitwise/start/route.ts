import { NextResponse, type NextRequest } from "next/server";

/** Step 1 of Splitwise OAuth. Needs SPLITWISE_CLIENT_ID and a redirect URI
 *  registered at https://secure.splitwise.com/apps. */
export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get("group");
  const clientId = process.env.SPLITWISE_CLIENT_ID;
  if (!clientId || !groupId) {
    return NextResponse.json({ error: "Splitwise credentials are not configured." }, { status: 400 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/splitwise/callback`;
  const url = new URL("https://secure.splitwise.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", groupId); // TODO: sign this before production

  return NextResponse.redirect(url.toString());
}
