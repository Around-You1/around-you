// Minimal service worker. A registered SW with a fetch handler is what makes
// Chrome treat the site as installable and fire the "Install app" prompt.
// It deliberately does NOT cache anything, so deploys are never served stale.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
