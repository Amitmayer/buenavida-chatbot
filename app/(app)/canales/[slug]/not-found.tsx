import Link from "next/link";
import { es } from "@/lib/i18n/es";

export default function CanalNotFound() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-start justify-center px-6 py-10">
      <p className="text-[15px] font-semibold text-ink">{es.canales.forbidden}</p>
      <Link href="/canales" prefetch={false} className="mt-3 text-[13px] font-semibold text-pine">
        {es.mensajes.back}
      </Link>
    </div>
  );
}
