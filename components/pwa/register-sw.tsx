"use client";

import { useEffect } from "react";

export function RegisterSw() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      return;
    }
    void navigator.serviceWorker.register("/sw.js");
  }, []);
  return null;
}
