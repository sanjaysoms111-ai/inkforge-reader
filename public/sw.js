/**
 * Inkforge Reader Service Worker
 * - Precaches minimal shell
 * - Runtime cache-first for images/panels (enables offline reading)
 * - Supports explicit CACHE_PANELS messages from client (triggered on chapter download/view)
 *
 * Works with unlocked + downloaded chapters because:
 * - Creator-imported comics store data: URLs inline (always available offline via localStorage state)
 * - https panel URLs get cached here on first successful load or explicit notify
 * - Unlock state lives in localStorage (isChapterUnlocked works offline)
 *
 * Strategy tuned for Next.js App Router + external images.
 */

const SHELL_CACHE = 'inkforge-shell-v1';
const PANELS_CACHE = 'inkforge-panels-v1';

// Core shell entries (best effort; Next.js hashed bundles are runtime-cached via fetch fallback)
const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== PANELS_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. Special handling for images / panel assets → cache-first (offline hero)
  // Covers next/image optimized + direct <img> + any comic panel (png/jpg/webp etc)
  if (
    req.destination === 'image' ||
    /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(PANELS_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          // Try network; clone for cache
          const fresh = await fetch(req, { mode: 'cors', credentials: 'omit' });
          if (fresh && fresh.ok) {
            // Only cache same-origin or CORS-successful responses
            cache.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch (err) {
          // Offline or failed: return whatever we have (or let it 404 naturally)
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // 2. Navigation / document requests → network-first, fallback to cached home for SPA offline
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Opportunistically cache the response for this shell entry
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // 3. Default: network with cache fallback for same-origin static assets (js/css)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 4. Cross-origin other: just try network (no special caching to avoid surprises)
  // (images already handled above)
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'CACHE_PANELS' && Array.isArray(data.urls)) {
    event.waitUntil(
      caches.open(PANELS_CACHE).then(async (cache) => {
        const jobs = data.urls
          .filter((u) => typeof u === 'string' && u && !u.startsWith('data:'))
          .map(async (url) => {
            try {
              const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
              if (res && res.ok) {
                await cache.put(url, res.clone());
              }
            } catch {
              // ignore individual failures (CORS, network)
            }
          });
        await Promise.allSettled(jobs);
      })
    );
  }
});
