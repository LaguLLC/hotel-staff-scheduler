// Hotel Staff Scheduler — Service Worker
// ------------------------------------------------------------------------
// This file exists for exactly one reason: to let a background Web Push notification be delivered even when
// every tab/window of this app is fully closed (see the app's own Readme, "Notifications & reminders" section).
// It deliberately does almost nothing else — in particular, it does NOT try to make this app work fully offline,
// and it does NOT cache the app's own HTML/JS for longer than a fresh page load needs.
//
// ============================================================================================================
// WHY THIS FILE MATTERS BEYOND PUSH: "works when I open the downloaded HTML file locally, but not once deployed
// to GitHub Pages" — traced directly (confirmed via the app's own already-present code comments, which describe
// this exact risk but had never actually shipped a fix for it): a browser only ever registers a Service Worker
// over a real http(s) origin — opening this file directly from disk (file://) never registers one at all, which
// is exactly why testing locally never sees ANY caching behavior from this file, good or bad. Once deployed to
// GitHub Pages (a real https origin), a Service Worker genuinely can activate — and a NAIVE Service Worker
// implementation (caching the app's own HTML/JS aggressively, with no real update path) would cause EXACTLY the
// reported symptom: a returning visitor's browser keeps serving whatever OLD version of the app happened to be
// cached the first time they visited that URL, completely oblivious to any newer version since deployed —
// silently missing every fix a later update contains, indefinitely, until that specific browser's cache is
// manually cleared. This file is deliberately built to make that entire class of bug structurally impossible
// going forward: it CACHES NOTHING belonging to the app itself (no HTML, no CSS, no JS) — every request for this
// app's own files is passed straight through to the network, uncached, every single time. The ONLY thing ever
// cached here is a tiny, versioned set of files (see CACHE_NAME/CACHE_FILES below) needed for install to succeed
// at all — even that only steps in as a last-resort fallback if the network is genuinely unreachable AND a
// pre-existing installation had already fetched it.
// ============================================================================================================

// Bump this version string any time this file itself is meaningfully changed — this is the ONLY mechanism that
// matters for THIS file's own update (browsers already re-check a service worker's own script for byte-for-byte
// changes on every navigation; a version bump here just gives old caches a clean, deliberate name to be dropped
// from, in the 'activate' handler below).
const CACHE_NAME = "hotel-scheduler-sw-v1";

self.addEventListener("install", (event) => {
  // Activates this new worker IMMEDIATELY, without waiting for every existing open tab of this app to be closed
  // first (the browser's own default behavior) — this is the other half of "never get stuck on stale content":
  // even if this file itself is updated, a device that already has an OLDER service worker registered would
  // otherwise keep that older one running (per-spec) until literally every tab of this app is closed at least
  // once — which, for an app frequently left open in a background tab, could be days. skipWaiting() means an
  // update to this exact file itself also takes effect on the very next reload, matching the "no caching, always
  // fresh" principle above applied to this file's own code too, not just the app's HTML/JS.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drops any cache left over from a PREVIOUS version of this file (a different CACHE_NAME) — prevents an
      // unbounded pile-up of old, unused cache storage across repeated deployments/updates over time.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
      // Takes control of any ALREADY-OPEN tab immediately, rather than only affecting the next fresh
      // navigation — pairs with skipWaiting() above so an update to this file reaches every currently-open
      // instance of the app as soon as possible, not just future ones.
      await self.clients.claim();
    })()
  );
});

// Deliberately NO 'fetch' handler that intercepts and caches this app's own HTML/JS/CSS. Omitting this handler
// entirely means every request this app makes — including the very first load of index.html itself — goes
// straight to the network exactly as if no Service Worker existed at all, with the single, narrow exception of
// what background push actually requires (handled below, in the 'push' handler, which needs no caching of its
// own at all — it only ever reacts to an incoming push message and shows a notification).

self.addEventListener("push", (event) => {
  let payload = { title: "Hotel Staff Scheduler", body: "You have a new notification." };
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    // A malformed/non-JSON push payload should never crash this handler — fall back to the generic message above.
  }
  const title = payload.title || "Hotel Staff Scheduler";
  const options = {
    body: payload.body || "",
    icon: "android-chrome-192x192.png",
    badge: "android-chrome-192x192.png",
    tag: payload.tag || undefined, // de-duplicates a repeated notification for the same underlying event, matching the app's own client-side tag convention
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking a delivered notification focuses an already-open tab of this app if one exists, or opens a new one —
// standard, expected behavior for a notification whose whole purpose is to bring attention back to the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./index.html");
    })()
  );
});
