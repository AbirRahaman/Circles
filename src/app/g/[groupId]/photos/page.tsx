import { requireMembership, requireFeature } from "@/lib/auth";
import { addAlbumLink, removeAlbumLink, markNudgeSent } from "@/app/actions/albums";
import { Card, Empty, Field, Note, Pill, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { fmtDay } from "@/lib/format";

export default async function PhotosTab({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase, user } = await requireMembership(groupId);
  await requireFeature(groupId, "photos");

  const [{ data: albums }, { data: events }] = await Promise.all([
    supabase.from("album_links").select("*, events(title, confirmed_time)").eq("group_id", groupId).order("created_at", { ascending: false }),
    supabase.from("events").select("id, title").eq("group_id", groupId).neq("status", "cancelled"),
  ]);

  return (
    <>
      <SectionHead title="Shared albums" />
      {albums?.length ? (
        <Card>
          {albums.map((a) => {
            const ev = Array.isArray(a.events) ? a.events[0] : a.events;
            const due = !a.reminder_sent_at && ev?.confirmed_time &&
              Date.now() - new Date(ev.confirmed_time).getTime() > 24 * 3600_000;
            const provLabel = a.provider === "google" ? "Google Photos" : "Apple Photos";
            const displayName = a.name || ev?.title || "Group album";
            return (
              <div key={a.id} className="px-3.5 py-3 border-b border-line last:border-b-0 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[16px] shrink-0" aria-hidden>{a.provider === "google" ? "🟢" : "🍎"}</span>
                    <span className="font-semibold truncate">{displayName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.reminder_sent_at ? <Pill tone="go" dot>Nudged</Pill> : due ? <Pill tone="maybe" dot>Nudge due</Pill> : null}
                  </div>
                </div>
                <div className="text-[12px] text-ink-3">{provLabel} · Added {fmtDay(a.created_at)}</div>
                <div className="flex gap-2">
                  <a href={a.icloud_share_url} target="_blank" rel="noopener" className="px-3 py-1.5 text-[13px] font-semibold rounded-md border border-line-strong hover:bg-surface-2">
                    Open album
                  </a>
                  {due && (
                    <form action={markNudgeSent.bind(null, groupId, a.id)}>
                      <SubmitButton size="sm" pendingLabel="Sending…">Send nudge</SubmitButton>
                    </form>
                  )}
                  {a.created_by === user.id && (
                    <form action={removeAlbumLink.bind(null, groupId, a.id)}>
                      <SubmitButton size="sm" variant="quiet" pendingLabel="Removing…">Remove</SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      ) : (
        <Empty title="No albums yet">
          Link a shared album from Apple Photos or Google Photos so nobody has to
          dig for it.
        </Empty>
      )}

      <SectionHead title="Add album" />
      <Card className="p-3.5">
        <form action={addAlbumLink.bind(null, groupId)} className="flex flex-col gap-3">
          <Field label="Provider">
            <select name="provider" defaultValue="apple">
              <option value="apple">Apple Photos</option>
              <option value="google">Google Photos</option>
            </select>
          </Field>
          <Field label="Album name">
            <input name="name" type="text" placeholder="Beach trip 2026" />
          </Field>
          <Field label="Album link">
            <input name="url" type="url" required placeholder="https://…" />
          </Field>
          <Field label="Attach to an event (optional)">
            <select name="event_id" defaultValue="">
              <option value="">Just the group</option>
              {(events ?? []).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </Field>
          <SubmitButton className="w-full" pendingLabel="Saving…">Save album</SubmitButton>
        </form>
      </Card>

      <Note>
        Circles stores the link and album name — your photos stay in Apple or Google.
        No photos touch our servers.
      </Note>
    </>
  );
}
