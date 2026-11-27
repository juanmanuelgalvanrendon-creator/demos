/* Higuera · service worker: avisos de la lista de espera y promociones del Club */
const API = self.location.pathname.startsWith("/higuera-demo/") ? "/api/fila/higuera-demo" : "/api/fila/higuera";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    const base = API.endsWith("-demo") ? "/higuera-demo/" : "/higuera/";
    let d = { title: "Higuera", body: "Tienes un aviso nuevo. Toca para verlo.", url: base, tag: "hg" };
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(API + "/push/msg", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub && sub.endpoint }), cache: "no-store", signal: ctl.signal });
      clearTimeout(to);
      if (r.ok) { const j = await r.json(); if (j && j.title) d = Object.assign(d, j); }
    } catch (e) {}
    const opts = {
      body: d.body, tag: d.tag || "hg", renotify: true, requireInteraction: true, timestamp: Date.now(),
      vibrate: [400, 160, 400, 160, 700], icon: "/higuera/img/icon-192.png", badge: "/higuera/img/badge-96.png",
      data: { url: d.url || base },
    };
    try { await self.registration.showNotification(d.title, opts); }
    catch (e) { await self.registration.showNotification(d.title, { body: d.body, data: { url: d.url || base } }); }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || (API.endsWith("-demo") ? "/higuera-demo/" : "/higuera/");
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // reusar una ventana abierta de la misma sección (lista de espera o club)
    const sec = new URL(url, self.location.origin).pathname.split("/").slice(0, 3).join("/");
    for (const c of all) if (new URL(c.url).pathname.startsWith(sec)) { await c.focus(); try { await c.navigate(url); } catch (e) {} return; }
    await self.clients.openWindow(url);
  })());
});
