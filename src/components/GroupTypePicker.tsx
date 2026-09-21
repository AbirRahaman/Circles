import { GROUP_TYPES, GROUP_TYPE_INFO, type GroupType } from "@/lib/groupTypes";

/** Radio cards for choosing a group type. Plain form inputs, no client JS. */
export function GroupTypePicker({ defaultValue = "friends", name = "type" }: { defaultValue?: GroupType; name?: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[12.5px] font-semibold text-ink-2 mb-1.5">What kind of group</legend>
      {GROUP_TYPES.map((t) => (
        <label
          key={t}
          className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5 cursor-pointer hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
        >
          <input type="radio" name={name} value={t} defaultChecked={t === defaultValue} className="!w-4 h-4 mt-0.5 shrink-0 accent-[var(--accent)]" />
          <span className="min-w-0">
            <span className="block font-semibold text-[14px]">{GROUP_TYPE_INFO[t].label}</span>
            <span className="block text-[12.5px] text-ink-2">{GROUP_TYPE_INFO[t].blurb}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
