"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { SmartImage } from './SmartImage';

export interface PreviewChapter {
  number: number;
  title: string;
  panels: string[];
  isPremium?: boolean;
}

interface PreviewReaderModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  author: string;
  chapters: PreviewChapter[];
  onPublish?: () => void;
  isPublishing?: boolean;
}

export function PreviewReaderModal({
  open,
  onClose,
  title,
  author,
  chapters,
  onPublish,
  isPublishing,
}: PreviewReaderModalProps) {
  const [activeCh, setActiveCh] = useState(0);

  if (!open) return null;

  const ch = chapters[activeCh] || chapters[0];
  const panels = ch?.panels || [];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-2 sm:p-6" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.12 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[980px] max-h-[94vh] overflow-hidden rounded-3xl glass border border-[var(--border)] bg-[var(--bg-elev)] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-[1px] text-[var(--text-muted)]">PREVIEW READER — DRAFT</div>
            <div className="font-semibold text-lg tracking-tight">{title || 'Untitled'} <span className="text-[var(--text-muted)] text-sm">by {author || 'You'}</span></div>
          </div>
          <div className="flex items-center gap-2">
            {onPublish && (
              <button
                onClick={onPublish}
                disabled={isPublishing}
                className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 flex items-center gap-1.5"
              >
                {isPublishing ? 'Publishing…' : 'Looks good — Publish'}
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded hover:bg-[var(--bg)] text-[var(--text-muted)]" aria-label="Close preview">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Chapter switcher (reorderable feel but read-only here) */}
        {chapters.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border)]/70 bg-[var(--bg)]/40 px-3 py-2 text-sm">
            {chapters.map((c, i) => (
              <button
                key={i}
                onClick={() => setActiveCh(i)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs border transition ${i === activeCh
                  ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                  : 'border-[var(--border)] hover:bg-[var(--bg-elev)]'}`}
              >
                Ch.{c.number} — {c.title}
                {c.isPremium ? <span className="ml-1 text-amber-400">• PREM</span> : <span className="ml-1 text-emerald-400">• FREE</span>}
              </button>
            ))}
          </div>
        )}

        {/* Vertical reader simulation (matches real /read vertical experience) */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[var(--bg)]/60" style={{ scrollbarWidth: 'thin' }}>
          <div className="mx-auto max-w-[720px]">
            <div className="mb-3 text-center text-xs text-[var(--text-muted)]">
              Chapter {ch?.number} — {ch?.title} {ch?.isPremium ? '(Premium on publish)' : '(Free — always unlocked)'}
            </div>

            {panels.length === 0 && (
              <div className="py-12 text-center text-[var(--text-muted)] text-sm border border-dashed border-[var(--border)] rounded-2xl">
                No panels in this chapter yet. Add images in the form to preview.
              </div>
            )}

            <div className="space-y-3">
              {panels.map((url, idx) => (
                <div key={idx} className="flex justify-center">
                  <SmartImage
                    src={url}
                    alt={`Panel ${idx + 1}`}
                    className="max-w-full w-auto rounded-xl shadow border border-[var(--border)] bg-black/40"
                  />
                </div>
              ))}
            </div>

            {panels.length > 0 && (
              <div className="mt-6 text-center text-[10px] text-[var(--text-muted)]">
                End of chapter preview. This is how it will appear in the live vertical reader (first chapter always free).
              </div>
            )}
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs">
          <div className="text-[var(--text-muted)]">
            {chapters.length} chapter{chapters.length === 1 ? '' : 's'} • {panels.length} panels in view
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveCh(Math.max(0, activeCh - 1))}
              disabled={activeCh === 0}
              className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev ch
            </button>
            <button
              onClick={() => setActiveCh(Math.min(chapters.length - 1, activeCh + 1))}
              disabled={activeCh === chapters.length - 1}
              className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-3 py-1 disabled:opacity-40"
            >
              Next ch <ChevronRight size={14} />
            </button>
            <button onClick={onClose} className="rounded border border-[var(--border)] px-3 py-1">Close preview</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default PreviewReaderModal;
