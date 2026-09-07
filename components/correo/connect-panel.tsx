import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { gmailRedirectUri } from "@/lib/email/gmail";

export function ConnectPanel({
  configured,
  error,
}: {
  configured: boolean;
  error?: string | null;
}) {
  const hint = !configured
    ? es.correo.setupHint.replace("{uri}", gmailRedirectUri())
    : error
      ? es.correo.errors[error as keyof typeof es.correo.errors] ?? es.correo.connectError
      : es.correo.connectHint;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <EmptyState
        title={es.correo.connectTitle}
        hint={hint}
        action={
          <Button asChild>
            <a href="/api/correo/connect">{es.correo.connect}</a>
          </Button>
        }
      />
    </div>
  );
}
