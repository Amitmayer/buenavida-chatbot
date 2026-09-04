import type { ReactNode } from "react";
import { getSessionProfile } from "@/lib/session";
import { groupChannels, listChannels } from "@/lib/canales";
import { ChannelList } from "@/components/canales/channel-list";
import { MensajesFrame } from "@/components/mensajes/mensajes-frame";
import { es } from "@/lib/i18n/es";

export default async function CanalesLayout({ children }: { children: ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const rows = await listChannels(profile.id);
  const groups = groupChannels(rows);

  return (
    <MensajesFrame
      sidebar={rows.length === 0 ? <p className="px-4 py-6 text-[13px] text-mute">{es.canales.empty}</p> : <ChannelList groups={groups} />}
    >
      {children}
    </MensajesFrame>
  );
}
