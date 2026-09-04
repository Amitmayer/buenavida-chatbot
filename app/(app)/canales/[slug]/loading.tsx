import { es } from "@/lib/i18n/es";

export default function CanalLoading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <p className="text-[13px] text-ink/40">{es.nav.loading}</p>
    </div>
  );
}
