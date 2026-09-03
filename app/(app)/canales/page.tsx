import { getSessionProfile } from "@/lib/session";
import { groupChannels, listChannels } from "@/lib/canales";
import { ChannelList } from "@/components/canales/channel-list";
import { es } from "@/lib/i18n/es";

export default async function CanalesPage() {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const rows = await listChannels(profile.id);
  const groups = groupChannels(rows);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-full md:w-[260px] md:shrink-0 md:border-r md:border-ink/10">
        <ChannelList groups={groups} />
      </div>
      <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
        <p className="max-w-sm px-6 text-center text-[13px] text-mute">
          {rows.length === 0 ? es.canales.empty : es.canales.pick}
        </p>
      </div>
    </div>
  );
}
