import { es } from "@/lib/i18n/es";
import { LoginForm } from "./login-form";

const LOGO =
  "https://buenavida.coffee/cdn/shop/files/Buena_Vida_Logo_4d308f3b-91f9-4cd8-8293-5ee218e7fa08.png?v=1785126762";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = next?.startsWith("/") && !next.startsWith("//") ? next : "/hoy";
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 py-14">
      <div className="mb-8 flex items-end gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt={es.appName} className="h-[72px] w-auto" />
        <span className="pb-1 font-mono text-[13px] tracking-[0.14em] text-[#E07A3D]">OS</span>
      </div>
      <div className="w-full max-w-[390px] rounded-lg border border-line bg-sheet p-6">
        <h1 className="text-[19px] font-semibold tracking-tight text-ink">{es.auth.title}</h1>
        <LoginForm next={dest} />
      </div>
      <p className="mt-8 font-mono text-[10.5px] text-ink/35">{es.auth.footer}</p>
    </main>
  );
}
