// Hotel Staff Scheduler — service worker
// ---------------------------------------------------------------------------
// Two jobs: (1) makes the app installable as a real app icon on a phone/desktop (required for iOS Safari to
// ever support background push at all — see the app's own Readme), and (2) receives a real push notification
// and displays it even while the app itself is fully closed.
//
// SKIP_WAITING behavior: by default, a browser keeps an OLD service worker active until every open tab of the
// app is fully closed, even after a new version has been deployed — so a returning visitor could keep seeing a
// stale, cached version of the app for a long time without realizing it. This service worker instead activates
// a new version IMMEDIATELY (via skipWaiting()) and takes control of any already-open tab right away (via
// clients.claim()), so a deployed update reaches every visitor on their very next reload.

const CACHE_NAME = "hotel-scheduler-v2"; // bump this string on every real deploy so old cached files are dropped

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// A deliberately MINIMAL fetch handler: this app already keeps its own real data in localStorage/Supabase, not
// in a service-worker cache, so this does not attempt any offline-page caching strategy — it exists only so the
// browser recognizes this as a genuine, installable PWA.
self.addEventListener("fetch", (event) => {
  // Intentionally not calling event.respondWith() — falls through to default browser network handling.
});

// Receives a real Web Push message from the server-side attendance-reminders function and displays it as a
// genuine system notification, even while the app itself is fully closed.
self.addEventListener("push", (event) => {
  let payload = { title: "Hotel Staff Scheduler", body: "You have a new notification." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // Matches this repo's own actual icon filename (android-chrome-192x192.png), not a generic "icon-192.png"
      // that may not exist under that exact name.
      icon: "android-chrome-192x192.png",
      badge: "android-chrome-192x192.png",
      tag: payload.tag || undefined,
    })
  );
});

// Clicking a notification focuses an already-open tab if one exists, or opens a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })()
  );
});
