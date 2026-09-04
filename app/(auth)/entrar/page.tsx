import { LoginScreen } from "./login-screen";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = next?.startsWith("/") && !next.startsWith("//") ? next : "/hoy";
  return <LoginScreen next={dest} />;
}
