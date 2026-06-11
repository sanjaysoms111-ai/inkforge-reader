"use client";

import { useState, useEffect } from 'react';

/**
 * PWA utilities for Inkforge Reader.
 * - Service worker registration
 * - Online/offline status hook (reactive)
 * - Notify SW to pre-cache specific panel URLs (for unlocked/downloaded chapters)
 *
 * All client-side. Integrates with Cache API in public/sw.js.
 * No new dependencies.
 */

export const PANELS_CACHE_NAME = 'inkforge-panels-v1';
export const SHELL_CACHE_NAME = 'inkforge-shell-v1';

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  // Register on load. Safe in dev; in production enables true offline.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Optional: listen for updates
        registration.onupdatefound = () => {
          const installing = registration.installing;
          if (installing) {
            installing.onstatechange = () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available; could surface a toast in future.
                // For now, next reload will pick it up.
              }
            };
          }
        };
      })
      .catch((err) => {
        // Non-fatal in dev or restricted envs
        if (process.env.NODE_ENV === 'development') {
          console.debug('[PWA] SW registration skipped/failed (dev):', err);
        }
      });
  });
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}

// Tell the active SW to fetch + store the given panel URLs into the panels cache.
// Safe no-op if no controller (SW not ready or unsupported).
export function notifySWToCachePanels(panelUrls: string[]): void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return;

  const urls = panelUrls.filter((u) => typeof u === 'string' && u.length > 0 && !u.startsWith('data:'));
  if (urls.length === 0) return;

  try {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_PANELS',
      urls,
    });
  } catch {
    // ignore
  }
}

// Optional helper: directly populate Cache API from client (used as fallback / extra).
// The SW fetch handler will also populate on normal loads.
export async function cachePanelsDirectly(panelUrls: string[]): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  const urls = panelUrls.filter((u) => typeof u === 'string' && u.length > 0 && !u.startsWith('data:'));
  if (urls.length === 0) return;

  try {
    const cache = await caches.open(PANELS_CACHE_NAME);
    await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
          if (res && res.ok) {
            await cache.put(url, res.clone());
          }
        } catch {
          // network/CORS issue — ignore for offline path
        }
      })
    );
  } catch {
    // ignore
  }
}
