self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) return;
  if (event.request.method !== "GET") return;
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Buena Vida OS", body: "" };
  event.waitUntil(
    self.registration.showNotification(data.title || "Buena Vida OS", {
      body: data.body || "",
      icon: "/icon-192.png",
    }),
  );
});
