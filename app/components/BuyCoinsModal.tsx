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
  // Deprecated: old premium BuyCoins flow removed. Coins now managed via Supabase UserContext.
  // This component is kept as a no-op stub to avoid import breaks during transition.
  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="glass max-w-md w-full rounded-2xl border border-[var(--border)] p-6 text-center" onClick={e => e.stopPropagation()}>
          <div className="text-lg font-semibold mb-2">Coins</div>
          <p className="text-sm text-[var(--text-muted)]">The legacy coin purchase UI has been removed. Coin balance is now managed through your Supabase profile (see Navbar / Library). Mock top-ups can be added via future server actions.</p>
          <button onClick={onClose} className="mt-4 btn-primary rounded-xl px-4 py-1.5 text-sm">Close</button>
        </div>
      </div>
    </AnimatePresence>
  );
}
