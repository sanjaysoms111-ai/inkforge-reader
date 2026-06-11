import Link from "next/link";
import { Trash2, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { Comic } from "../lib/types";
import { SmartImage } from "./SmartImage";
import { useComics } from "../lib/ComicsContext";

interface ComicCardProps {
  comic: Comic;
  showAuthor?: boolean;
  onDelete?: (id: string) => void; // optional delete handler (only shown for user's own comics)
}

export function ComicCard({ comic, showAuthor = true, onDelete }: ComicCardProps) {
  const freeChapters = comic.chapters.filter((c) => !c.isPremium).length;
  const total = comic.chapters.length;
  const { isComicLiked, toggleLikeComic, getCreatorAnalytics } = useComics();
  const liked = isComicLiked(comic.slug);

  return (
    <Link href={`/comics/${comic.slug}`} className="group block">
      <motion.div
        className="card overflow-hidden border border-transparent"
        whileHover={{ y: -5, scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
      >
        {/* Cover */}
        <div className="relative">
          <SmartImage
            src={comic.coverUrl}
            alt={comic.title}
            className="comic-cover w-full transition-transform duration-300 group-hover:scale-[1.015]"
            loading="lazy"
          />
          {comic.isAIGenerated && (
            <div className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-rose-400 ring-1 ring-rose-500/30 backdrop-blur-sm">
              AI-ASSISTED
            </div>
          )}

          {/* Small delete button for user's own published/imported comics */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(comic.id);
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white/90 hover:bg-red-600 hover:text-white transition-colors backdrop-blur-sm"
              title="Delete this comic"
            >
              <Trash2 size={13} />
            </button>
          )}

          {/* Subtle gradient overlay for text readability on cover */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        {/* Info */}
        <div className="p-3.5">
          <div className="line-clamp-2 text-[15px] font-semibold leading-tight tracking-[-0.2px] text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
            {comic.title}
          </div>

          {showAuthor && (
            <div className="mt-0.5 text-xs text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors">{comic.author}</div>
          )}

          <div className="mt-2 flex flex-wrap gap-1">
            {comic.genres.slice(0, 2).map((g) => (
              <span key={g} className="genre-pill text-[10px]">
                {g}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>
              {total} {total === 1 ? "chapter" : "chapters"}
            </span>
            <span className="tabular-nums">{Math.floor(comic.views / 1000)}k views</span>
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
            <span className="text-[var(--free)]/90">{freeChapters} free</span>
            {total - freeChapters > 0 && (
              <span className="text-[var(--premium)]/90">• {total - freeChapters} premium</span>
            )}
            {comic.source === 'creator' && (() => {
              const a = getCreatorAnalytics ? getCreatorAnalytics(comic.slug) : null;
              return a ? <span className="text-emerald-400">• {Math.floor((a.views||0)/1000)}k / {a.unlockCount}</span> : null;
            })()}
            {comic.source === 'user' && (
              <span className="text-emerald-400">• Your upload</span>
            )}
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleLikeComic(comic.slug); }}
              className="ml-auto p-0.5"
              title={liked ? "Unlike" : "Like / Favorite this comic"}
            >
              <Heart size={12} className={liked ? "text-red-400 fill-current" : "text-[var(--text-muted)] group-hover:text-red-300"} />
            </button>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
