"use client";

import { useState } from "react";
import { es } from "@/lib/i18n/es";

export function PushOptIn() {
  const [label, setLabel] = useState<string>(es.push.enable);

  async function enable() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setLabel(es.push.denied);
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    setLabel(es.push.enabled);
  }

  return (
    <button
      type="button"
      onClick={() => void enable()}
      className="text-left text-[12px] font-medium text-gold/80 hover:text-cream"
    >
      {label}
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
