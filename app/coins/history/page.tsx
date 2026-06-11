"use client";

import Link from 'next/link';
import { ArrowLeft, Coins } from 'lucide-react';
import { useUser } from '../../lib/UserContext';

export default function CoinHistoryPage() {
  const { coinBalance, user } = useUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-[var(--text-muted)]">Sign in to view your coin balance and history.</p>
        <Link href="/login" className="mt-4 inline-block text-[var(--accent)] underline">Go to login</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      <div className="mx-auto max-w-3xl px-4 pt-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] mb-4">
          <ArrowLeft size={16} /> Back to home
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">Coin Balance</div>
            <div className="text-sm text-[var(--text-muted)]">Current balance: <span className="font-medium text-[var(--text)] tabular-nums">{coinBalance}</span></div>
          </div>
        </div>

        <div className="glass rounded-2xl border border-[var(--border)] p-8 text-center text-[var(--text-muted)]">
          The legacy premium transaction history has been removed as part of the move to Supabase-backed user coins and unlocks.<br />
          Your coin balance is now stored in your profile. New purchase / unlock history will be added in a future step (server actions + tx table).
        </div>

        <div className="mt-6 text-[10px] text-[var(--text-muted)]">
          See <Link href="/library" className="underline">/library</Link> for your personal data. First chapter is always free.
        </div>
      </div>
    </div>
  );
}
