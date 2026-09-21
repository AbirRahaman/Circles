import { requireMembership, requireFeature } from "@/lib/auth";
import { addAlbumLink } from "@/app/actions/albums";
import { markNudgeSent } from "@/app/actions/albums";
import { Card, Empty, Field, Note, Pill, SectionHead } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { fmtDay } from "@/lib/format";

export default async function PhotosTab({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase } = await requireMembership(groupId);
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
            return (
              <div key={a.id} className="px-3.5 py-3 border-b border-line last:border-b-0 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{ev?.title ?? "Group album"}</span>
                  {a.reminder_sent_at ? <Pill tone="go" dot>Nudged</Pill> : due ? <Pill tone="maybe" dot>Nudge due</Pill> : null}
                </div>
                <div className="font-mono text-[12px] text-ink-2 truncate">{a.icloud_share_url}</div>
                <div className="text-[12px] text-ink-2">Added {fmtDay(a.created_at)}</div>
                <div className="flex gap-2">
                  <a href={a.icloud_share_url} target="_blank" rel="noopener" className="px-3 py-1.5 text-[13px] font-semibold rounded-md border border-line-strong hover:bg-surface-2">
                    Open in Photos
                  </a>
                  {due && (
                    <form action={markNudgeSent.bind(null, groupId, a.id)}>
                      <SubmitButton size="sm" pendingLabel="Sending…">Send nudge</SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      ) : (
        <Empty title="No albums yet">
          Create the iCloud Shared Album in Photos, then paste its invite link here so
          nobody has to dig for it.
        </Empty>
      )}

      <Card className="p-3.5">
        <form action={addAlbumLink.bind(null, groupId)} className="flex flex-col gap-3">
          <Field label="iCloud album link">
            <input name="url" type="url" required placeholder="https://www.icloud.com/sharedalbum/…" />
          </Field>
          <Field label="Attach to an event (optional)">
            <select name="event_id" defaultValue="">
              <option value="">Just the group</option>
              {(events ?? []).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </Field>
          <SubmitButton className="w-full" pendingLabel="Saving…">Save link</SubmitButton>
        </form>
      </Card>

      <Note>
        Apple publishes no API for Shared Albums, so this is link-and-remind by design:
        Circles keeps the invite URL and sends one nudge after the event. Photos never
        touch our servers.
      </Note>
    </>
  );
}
