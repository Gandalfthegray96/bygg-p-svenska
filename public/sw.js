self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Minimal service worker: makes the app installable and receives push notifications.
});

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(d.title || "UK Portservice Avtal", {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: d.tag,
      data: { url: d.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { c.postMessage({ type: "open-url", url }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
