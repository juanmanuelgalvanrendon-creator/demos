/* Higuera · service worker de la lista de espera: recibe el aviso "tu mesa está lista" */
const API = "/api/fila/higuera";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let d = { title: "Higuera · Lista de espera", body: "Revisa tu turno en la lista.", url: "/higuera/fila/", tag: "hg" };
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const r = await fetch(API + "/push/msg", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub && sub.endpoint }), cache: "no-store" });
      if (r.ok) d = Object.assign(d, await r.json());
    } catch (e) {}
    await self.registration.showNotification(d.title, {
      body: d.body, tag: d.tag, renotify: true, requireInteraction: true,
      vibrate: [400, 160, 400, 160, 700], icon: "/higuera/img/icon-192.png", badge: "/higuera/img/badge-96.png",
      data: { url: d.url },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/higuera/fila/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if (c.url.includes("/higuera/fila/")) { await c.focus(); try { await c.navigate(url); } catch (e) {} return; }
    await self.clients.openWindow(url);
  })());
});
