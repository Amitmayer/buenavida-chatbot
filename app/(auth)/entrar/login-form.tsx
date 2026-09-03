"use client";

import { useActionState } from "react";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInAction, null);

  return (
    <form action={action} className="mt-5 space-y-2.5">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[11px] font-semibold text-ink/55">
          {es.auth.email}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[11px] font-semibold text-ink/55">
          {es.auth.password}
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      {state?.ok === false ? (
        <p className="text-[12.5px] text-overdue">{es.auth.error}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="h-12 w-full text-[14px]">
        {es.auth.submit}
      </Button>
      <p className="text-[12px] leading-relaxed text-mute">{es.auth.hint}</p>
    </form>
  );
}
