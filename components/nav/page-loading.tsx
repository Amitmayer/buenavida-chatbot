import { es } from "@/lib/i18n/es";

export function PageLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-7" aria-busy="true" aria-live="polite">
      <span className="sr-only">{es.nav.loading}</span>
      <div className="h-28 animate-pulse rounded-lg bg-wash" />
      <div className="h-14 animate-pulse rounded-md bg-wash" />
      <div className="h-14 animate-pulse rounded-md bg-wash" />
      <div className="h-14 animate-pulse rounded-md bg-wash" />
    </div>
  );
}
