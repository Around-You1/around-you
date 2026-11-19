// Around You service worker.
// Goal: the app opens with no signal (never the Chrome "dino"), and the
// Emergency Numbers page works fully offline. The live app stays NETWORK-FIRST
// so deploys are never served stale — only the two static safety pages and the
// app icon are cached, and they refresh quietly in the background when online.

const CACHE = "around-you-v3";
const PRECACHE = ["/emergency.html", "/offline.html", "/app-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Precached safety pages + icon: serve from cache instantly (works offline),
  // and refresh in the background so edits still land next time online.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Page navigations: network-first so the live app is always fresh; if there
  // is no connection, fall back to the cached offline screen instead of the dino.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // Everything else (app JS/CSS/API data): network only — nothing cached, nothing stale.
});

// --- Web Push ---------------------------------------------------------------
self.addEventListener("push", function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  var title = data.title || "Around You";
  var opts = {
    body: data.body || "",
    icon: "/app-icon-512.png",
    badge: "/app-icon-512.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, opts));
  if (navigator.setAppBadge) { try { navigator.setAppBadge(1); } catch (e) {} }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  if (navigator.clearAppBadge) { try { navigator.clearAppBadge(); } catch (e) {} }
  var url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) { list[i].navigate && list[i].navigate(url); return list[i].focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
