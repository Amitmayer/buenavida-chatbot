import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export function ConnectPanel({
  configured,
  error,
}: {
  configured: boolean;
  error?: string | null;
}) {
  const hint = !configured
    ? es.correo.setupHint
    : error
      ? es.correo.errors[error as keyof typeof es.correo.errors] ?? es.correo.connectError
      : es.correo.connectHint;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <EmptyState
        title={es.correo.connectTitle}
        hint={hint}
        action={
          configured ? (
            <Button asChild>
              <a href="/api/correo/connect">{es.correo.connect}</a>
            </Button>
          ) : null
        }
      />
    </div>
  );
}
