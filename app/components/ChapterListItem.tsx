"use client";

import { Chapter } from "../lib/types";
import { Lock, Play } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  chapter: Chapter;
  isUnlocked: boolean;
  onRead: () => void;
  onUnlock?: () => void;
}

export function ChapterListItem({ chapter, isUnlocked, onRead, onUnlock }: Props) {
  const canRead = !chapter.isPremium || isUnlocked;

  return (
    <motion.div
      onClick={canRead ? onRead : undefined}
      whileHover={canRead ? { x: 2 } : undefined}
      whileTap={canRead ? { scale: 0.995 } : undefined}
      className={`flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 transition ${
        canRead ? "cursor-pointer hover:border-[var(--accent)]/40" : "opacity-95"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elev)] text-xs font-mono text-[var(--text-muted)]">
          {chapter.number.toString().padStart(2, "0")}
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--text)]">{chapter.title}</div>
          <div className="text-xs text-[var(--text-muted)]">Chapter {chapter.number}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {chapter.isPremium ? (
          <span className="badge-premium rounded-full px-2.5 py-px text-[10px] font-medium tracking-wide">
            PREMIUM • {chapter.coinPrice ?? 10}
          </span>
        ) : (
          <span className="badge-free rounded-full px-2.5 py-px text-[10px] font-medium tracking-wide">FREE</span>
        )}

        {canRead ? (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onRead();
            }}
            whileTap={{ scale: 0.94 }}
            className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-black transition hover:bg-white"
          >
            <Play className="h-3.5 w-3.5" /> Read
          </motion.button>
        ) : (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onUnlock?.();
            }}
            whileTap={{ scale: 0.94 }}
            className="flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-medium text-black transition hover:bg-amber-400"
          >
            <Lock className="h-3.5 w-3.5" /> Unlock
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
