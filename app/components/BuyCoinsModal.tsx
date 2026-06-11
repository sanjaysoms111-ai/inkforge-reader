"use client";

import { useState } from "react";
import { X, Coins, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useComics } from "../lib/ComicsContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PACKAGES = [
  { coins: 50, price: "₹29", popular: false, note: "Starter" },
  { coins: 100, price: "₹49", popular: false, note: "Starter pack" },
  { coins: 250, price: "₹99", popular: false, note: "+25 bonus" },
  { coins: 500, price: "₹199", popular: true, note: "Most popular" },
  { coins: 1200, price: "₹399", popular: false, note: "Best value +200 bonus" },
];

export function BuyCoinsModal({ open, onClose }: Props) {
  const { addCoins, coinBalance, buySubscription, isSubscriptionActive, activateLimitedEvent } = useComics();
  const [processing, setProcessing] = useState<number | null>(null);
  const subActive = isSubscriptionActive ? isSubscriptionActive() : false;

  if (!open) return null;

  const handlePurchase = (coins: number) => {
    setProcessing(coins);

    // Optimistic: add immediately for snappy feel, then "process"
    // (in real would be after payment confirmation)
    addCoins(coins);

    setTimeout(() => {
      setProcessing(null);
      onClose();

      const toast = document.createElement("div");
      toast.className =
        "fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2 text-sm text-white shadow-lg z-[100]";
      toast.textContent = "Coins added successfully!";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2200);
    }, 450);
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" 
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.99 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="glass w-full max-w-md rounded-3xl p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-tight">Buy Coins</div>
                <div className="text-xs text-[var(--text-muted)]">Balance: <span className="tabular-nums font-medium text-[var(--text)]">{coinBalance}</span></div>
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text)] transition">
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-[var(--bg-card)]/70 border border-[var(--border)] px-4 py-3 text-[11px] leading-snug text-[var(--text-muted)]">
            Coins are used to unlock premium chapters. Image generation credits are handled separately by the AI provider.
          </div>

          {/* Subscription (mock 30-day unlimited) */}
          <div className="mt-4">
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-2">SUBSCRIPTION</div>
            <button
              disabled={processing !== null || subActive}
              onClick={() => {
                setProcessing(-1); // special for sub
                buySubscription(30);
                setTimeout(() => {
                  setProcessing(null);
                  onClose();
                  const toast = document.createElement("div");
                  toast.className = "fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2 text-sm text-white shadow-lg z-[100]";
                  toast.textContent = "30-day pass activated! Unlimited unlocks.";
                  document.body.appendChild(toast);
                  setTimeout(() => toast.remove(), 2200);
                }, 450);
              }}
              className="w-full rounded-2xl border border-[var(--accent)]/70 bg-[var(--accent)]/5 px-4 py-3 text-left hover:bg-[var(--accent)]/10 disabled:opacity-60 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">30-Day Unlimited Pass</div>
                  <div className="text-[10px] text-[var(--text-muted)]">All premium chapters free • Renews manually</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">₹299</div>
                  {subActive && <div className="text-[10px] text-emerald-400">ACTIVE</div>}
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                if (activateLimitedEvent) activateLimitedEvent(3);
                const toast = document.createElement("div");
                toast.className = "fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-5 py-2 text-sm text-white shadow-lg z-[100]";
                toast.textContent = "Limited free event activated for 3 days!";
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
              }}
              className="mt-2 w-full text-xs rounded border border-blue-500/50 px-3 py-1 text-blue-400 hover:bg-blue-500/10"
            >
              Claim Limited-Time Free Chapters (3 days demo)
            </button>
          </div>

          {/* Pack cards */}
          <div className="mt-5 grid grid-cols-1 gap-3">
            {PACKAGES.map((pkg) => {
              const isProcessingThis = processing === pkg.coins;
              const isBest = pkg.popular;
              return (
                <motion.button
                  key={pkg.coins}
                  disabled={processing !== null}
                  onClick={() => handlePurchase(pkg.coins)}
                  whileTap={{ scale: 0.985 }}
                  className={`group flex items-center justify-between rounded-2xl border px-4 py-4 text-left transition-all disabled:opacity-60 ${
                    isBest
                      ? "border-[var(--accent)]/70 bg-[var(--accent)]/5 hover:border-[var(--accent)] hover:bg-[var(--accent)]/10"
                      : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isBest ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-amber-500/10 text-amber-400'}`}>
                      <Coins className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="font-semibold tabular-nums text-lg tracking-tight">{pkg.coins} <span className="text-sm font-normal text-[var(--text-muted)]">coins</span></div>
                      <div className="text-[10px] text-[var(--text-muted)] -mt-0.5">{pkg.note}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold text-lg tabular-nums">{pkg.price}</div>
                    {isBest && <div className="text-[10px] font-semibold tracking-wide text-[var(--accent)]">BEST VALUE</div>}
                    <div className="mt-1">
                      {isProcessingThis ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                          <Loader2 className="h-3 w-3 animate-spin" /> Processing…
                        </span>
                      ) : (
                        <span className={`text-[11px] rounded px-2 py-0.5 ${isBest ? 'bg-white text-black font-medium' : 'text-[var(--text-muted)] group-hover:text-[var(--text)]'}`}>
                          Purchase
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-5 text-center text-[10px] text-[var(--text-muted)]">
            Instant (demo). 10 coins unlock one premium chapter. <a href="/coins/history" className="underline hover:text-[var(--text)]">View full history →</a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
