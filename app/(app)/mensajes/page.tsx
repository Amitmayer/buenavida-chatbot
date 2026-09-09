import { es } from "@/lib/i18n/es";

export default function MensajesPage() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-paper p-10">
      <div className="max-w-[520px] rounded-[22px] border-2 border-ink/10 bg-sheet px-10 py-10 text-center">
        <p className="text-[28px] font-bold text-ink">{es.mensajes.pick}</p>
        <p className="mt-3 text-[18px] leading-relaxed text-ink/70">{es.mensajes.pickHint}</p>
      </div>
    </div>
  );
}
