"use client";

import React from 'react';

export interface UploadItem {
  key: string;
  done: boolean;
}

interface UploadProgressProps {
  current: number;
  total: number;
  label?: string;
  items?: UploadItem[]; // optional per-file status for "all images" real-time list
  className?: string;
}

export function UploadProgress({ current, total, label, items, className = "" }: UploadProgressProps) {
  const pct = Math.round((current / Math.max(1, total)) * 100);

  return (
    <div className={`glass rounded-xl border border-[var(--border)] p-3 text-sm ${className}`}>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-[var(--accent)]">{label || 'Uploading...'}</span>
        <span className="tabular-nums text-[var(--text-muted)]">{current} / {total} • {pct}%</span>
      </div>

      {/* Overall bar */}
      <div className="h-1.5 bg-[var(--bg-elev)] rounded-full overflow-hidden mb-2">
        <div
          className="h-1.5 bg-[var(--accent)] transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Optional granular list for every image (real-time upload progress for all) */}
      {items && items.length > 0 && (
        <div className="mt-1 max-h-28 overflow-auto text-[10px] space-y-0.5 border-t border-[var(--border)]/60 pt-1.5">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2 text-[var(--text-muted)]">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${it.done ? 'bg-emerald-400' : 'bg-[var(--accent)]/70 animate-pulse'}`} />
              <span className="font-mono truncate flex-1">{it.key}</span>
              <span className={it.done ? 'text-emerald-400' : ''}>{it.done ? 'done' : 'uploading'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-[var(--text-muted)] mt-1">
        Client-side resize + WebP conversion already applied. Uploading to Supabase Storage for public comics.
      </div>
    </div>
  );
}

export default UploadProgress;
