"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useComics } from '../../lib/ComicsContext';
import { ArrowLeft, Coins } from 'lucide-react';

export default function CoinHistoryPage() {
  const { coinBalance, getCoinTransactions, isSubscriptionActive } = useComics();
  const [filter, setFilter] = useState<'all' | 'purchase' | 'unlock' | 'subscription' | 'event-free'>('all');

  const txs = getCoinTransactions ? getCoinTransactions() : [];
  const filtered = filter === 'all' ? txs : txs.filter((t: any) => t.type === filter);

  const subActive = isSubscriptionActive ? isSubscriptionActive() : false;

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
            <div className="text-2xl font-semibold tracking-tight">Coin History</div>
            <div className="text-sm text-[var(--text-muted)]">Balance: <span className="font-medium text-[var(--text)] tabular-nums">{coinBalance}</span> {subActive && <span className="ml-2 text-emerald-400">(Subscribed)</span>}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          {(['all', 'purchase', 'unlock', 'subscription', 'event-free'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full border ${filter === f ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--bg-elev)]'}`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center border border-[var(--border)] text-[var(--text-muted)]">
            No transactions yet. Buy coins or unlock chapters to start your history.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tx: any) => (
              <div key={tx.id} className="glass rounded-2xl border border-[var(--border)] p-4 flex items-start justify-between text-sm">
                <div>
                  <div className="font-medium">{tx.description}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5 tabular-nums">{new Date(tx.timestamp).toLocaleString()}</div>
                  {tx.comicSlug && <div className="text-[10px] text-[var(--text-muted)]">Comic: {tx.comicSlug}{tx.chapterNumber ? ` • Ch.${tx.chapterNumber}` : ''}</div>}
                </div>
                <div className={`font-semibold tabular-nums ${tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-[10px] text-[var(--text-muted)]">
          This is a mock transaction log for the demo premium system. All data is local.
        </div>
      </div>
    </div>
  );
}
