/* Our Album service worker: lets the installed app open with no signal. Keep this file next to album.html. */
const V = "album-v1";
const FIREBASE = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(c => Promise.all(FIREBASE.map(u =>
    fetch(new Request(u, { mode: "no-cors" })).then(r => c.put(u, r)).catch(() => {})))));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);

  /* the page itself: always try the network first so updates show up, fall back to the saved copy */
  if (r.mode === "navigate") {
    const key = u.origin + u.pathname;
    e.respondWith(
      fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(key, copy)); } return res; })
        .catch(() => caches.match(key).then(m => m || caches.match(u.origin + u.pathname.replace(/[^\/]*$/, "")) ))
    );
    return;
  }

  /* app files and the Firebase scripts: serve the saved copy instantly, refresh it in the background */
  const mine = u.origin === location.origin;
  const fb = u.hostname === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/");
  if (mine || fb) {
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
