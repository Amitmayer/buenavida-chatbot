"use client";

import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6">
      <p className="text-[16px] font-medium text-ink">{es.crash.title}</p>
      <Button type="button" onClick={() => reset()}>
        {es.crash.retry}
      </Button>
    </main>
  );
}
