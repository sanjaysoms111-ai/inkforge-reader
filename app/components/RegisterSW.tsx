"use client";

import { useEffect } from 'react';
import { registerServiceWorker } from '../lib/pwa';

/**
 * Client component that registers the service worker once on mount.
 * Placed in root layout so it runs for the whole app.
 * Non-blocking and safe (no-op on unsupported browsers).
 */
export function RegisterSW() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
