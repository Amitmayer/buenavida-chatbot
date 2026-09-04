"use client";

import { useEffect, useRef, useState } from "react";
import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/client";
import { captureError } from "@/lib/sentry";

const DELAY = {
  place: 80,
  buena: 720,
  vida: 1180,
  os: 1580,
  specialty: 1880,
  email: 2520,
  password: 3080,
  assigned: 3080,
  submit: 3720,
  hint: 4280,
} as const;

export function LoginScreen({ next }: { next: string }) {
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = "#17281d";
    return () => {
      document.body.style.background = previous;
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => {
        emailRef.current?.focus();
      },
      reduce ? 0 : DELAY.email + 400,
    );
    return () => window.clearTimeout(timer);
  }, []);

  async function onSubmit(formData: FormData) {
    setError(false);
    setPending(true);
    try {
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
      if (signError) {
        setError(true);
        setPending(false);
        return;
      }
      window.location.assign(next);
    } catch (err) {
      captureError(err, { where: "LoginScreen.submit" });
      setError(true);
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center bg-[#17281d] px-6 text-[#f6f3ea]">
      <h1 className="sr-only">{es.auth.title}</h1>
      <div className="flex w-full max-w-[520px] flex-1 flex-col items-center pt-[12vh] md:max-w-[680px]">
        <div className="inline-grid grid-cols-[auto_auto] items-start gap-x-2.5">
          <p
            className="login-fade text-[40px] font-semibold uppercase leading-none tracking-[0.08em] md:text-[48px]"
            style={{ animationDelay: `${DELAY.buena}ms` }}
          >
            {es.auth.buena}
          </p>
          <p
            className="login-fade pt-1 font-mono text-[11px] font-medium tracking-[0.18em] text-[#af6338]"
            style={{ animationDelay: `${DELAY.os}ms` }}
          >
            {es.auth.os}
          </p>
          <p
            className="login-fade mt-2 text-[40px] font-semibold uppercase leading-none tracking-[0.08em] md:text-[48px]"
            style={{ animationDelay: `${DELAY.vida}ms` }}
          >
            {es.auth.vida}
          </p>
          <p
            className="login-fade mt-2 self-center text-[8.5px] font-medium uppercase leading-[1.25] tracking-[0.22em]"
            style={{ animationDelay: `${DELAY.specialty}ms` }}
          >
            {es.auth.specialty}
            <br />
            {es.auth.coffee}
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(new FormData(event.currentTarget));
          }}
          className="mt-14 w-full md:mt-16"
        >
          <label
            className="login-fade block"
            htmlFor="email"
            style={{ animationDelay: `${DELAY.email}ms` }}
          >
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-[#f6f3ea]/45">
              {es.auth.email}
            </span>
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="h-16 w-full rounded-[10px] border border-white/[0.08] bg-[#26362c] px-4 text-[16px] text-[#f6f3ea] caret-[#af6338] outline-none md:h-20 focus-visible:border-[#af6338]"
            />
          </label>
          <label
            className="login-fade mt-5 block"
            htmlFor="password"
            style={{ animationDelay: `${DELAY.password}ms` }}
          >
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-[#f6f3ea]/45">
              {es.auth.password}
            </span>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-16 w-full rounded-[10px] border border-white/[0.08] bg-[#26362c] px-4 text-[16px] text-[#f6f3ea] caret-[#af6338] outline-none md:h-20 focus-visible:border-[#af6338]"
            />
          </label>
          {error ? <p className="mt-3 text-[12.5px] text-[#e07a3d]">{es.auth.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="login-fade mt-10 h-14 w-full rounded-[10px] bg-[#f6f3ea] text-[16px] font-semibold text-[#17281d] disabled:opacity-50 md:h-16 md:mt-12"
            style={{ animationDelay: `${DELAY.submit}ms` }}
          >
            {es.auth.submit}
          </button>
          <p
            className="login-fade mt-4 text-center text-[12.5px] leading-relaxed text-[#f6f3ea]/55"
            style={{ animationDelay: `${DELAY.hint}ms` }}
          >
            {es.auth.hint}
          </p>
        </form>
      </div>

      <footer className="flex flex-col items-center gap-1.5 pb-[max(28px,env(safe-area-inset-bottom))] pt-8 text-center">
        <p
          className="login-fade text-[13px] text-[#f6f3ea]/70"
          style={{ animationDelay: `${DELAY.assigned}ms` }}
        >
          {es.auth.assigned}
        </p>
        <p
          className="login-fade font-mono text-[10px] uppercase tracking-[0.22em] text-[#f6f3ea]/40"
          style={{ animationDelay: `${DELAY.place}ms` }}
        >
          {es.auth.footer}
        </p>
      </footer>
    </main>
  );
}
