const BIND_HOSTS = new Set(["0.0.0.0", "::", "[::]"]);

function firstHeader(value: string | null): string | null {
  if (!value) return null;
  const part = value.split(",")[0]?.trim();
  return part || null;
}

function hostnameOf(host: string): string {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(0, end + 1);
  }
  return host.split(":")[0] ?? host;
}

export function publicOrigin(request: Request): string {
  const forwardedHost = firstHeader(request.headers.get("x-forwarded-host"));
  const host = forwardedHost ?? firstHeader(request.headers.get("host"));
  const forwardedProto = firstHeader(request.headers.get("x-forwarded-proto"));
  const proto =
    forwardedProto ??
    (host && (hostnameOf(host) === "localhost" || hostnameOf(host).startsWith("127."))
      ? "http"
      : "https");

  if (host && !BIND_HOSTS.has(hostnameOf(host))) {
    return `${proto}://${host}`;
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) {
    try {
      const url = new URL(configured);
      if (!BIND_HOSTS.has(url.hostname)) return configured;
    } catch {
      // fall through
    }
  }

  const requestUrl = new URL(request.url);
  if (!BIND_HOSTS.has(requestUrl.hostname)) return requestUrl.origin;
  return "https://buenavidaos.com";
}

export function publicUrl(path: string, request: Request): URL {
  const dest = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return new URL(dest, `${publicOrigin(request)}/`);
}
