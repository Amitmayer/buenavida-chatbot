import { MensajesShell } from "@/components/mensajes/mensajes-shell";
import { es } from "@/lib/i18n/es";

export default function MensajesPage() {
  return (
    <MensajesShell>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-[13px] text-ink/45">{es.mensajes.pick}</p>
      </div>
    </MensajesShell>
  );
}
