"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

/**
 * Custom PWA install banner using the beforeinstallprompt event.
 * - Shows a polished glassmorphic floating banner (matches app styling).
 * - "Install" triggers the native prompt.
 * - Dismiss stores a short-lived session flag (reappears on next full session).
 * - Only appears when the browser deems the app installable.
 *
 * Per DESIGN-v2 + AGENTS: non-intrusive, benefits-focused ("offline reading"), reuses .glass + tokens.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e);

      // Avoid nagging: only show if user hasn't dismissed in this session
      if (!sessionStorage.getItem('inkforge-install-dismissed')) {
        // Small delay so it doesn't fight with first paint / other banners
        setTimeout(() => setVisible(true), 1200);
      }
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);

    // Also listen for successful install to hide
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setVisible(false);

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      // outcome is 'accepted' or 'dismissed' — we don't persist long-term either way
      if (outcome === 'accepted') {
        // Could record an achievement or analytics here in future
      }
    } finally {
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem('inkforge-install-dismissed', 'true');
    } catch {}
  };

  return (
    <AnimatePresence>
      {visible && deferredPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="fixed bottom-3 left-1/2 z-[70] -translate-x-1/2"
        >
          <div className="glass flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]/95 px-4 py-3 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-2 pr-1 text-sm">
              <Download className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-[var(--text)]">
                Install <span className="font-medium">Inkforge Reader</span> for offline chapters &amp; quick access
              </span>
            </div>

            <button
              onClick={handleInstall}
              className="rounded-xl bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:brightness-105 active:scale-[0.985]"
            >
              Install
            </button>

            <button
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className="rounded-xl p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg)] hover:text-[var(--text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
