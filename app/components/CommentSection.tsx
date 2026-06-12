"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useComics } from "@/app/lib/ComicsContext";
import { useUser } from "@/app/lib/UserContext";
import { CommentItem } from "./CommentItem";

type SortMode = "top" | "newest" | "oldest";

interface CommentSectionProps {
  slug: string;
  chapterNumber: number;
}

const EMOJI_QUICK = ["❤️", "👍", "😂", "🔥"];

export function CommentSection({ slug, chapterNumber }: CommentSectionProps) {
  const {
    getCommentsForChapter,
    addComment,
    loadPublicCommentsForChapter,
  } = useComics();
  const { user, displayName } = useUser();

  const [sort, setSort] = useState<SortMode>("top");
  const [newText, setNewText] = useState("");
  const [posting, setPosting] = useState(false);

  const rawComments = getCommentsForChapter(slug, chapterNumber);

  // Load from Supabase when this is a public comic (runs on mount + when slug/ch changes)
  useEffect(() => {
    // We call unconditionally; the loader is a no-op for non-public or no user.
    // The context decides via comic.isPublic inside loadPublicCommentsForChapter.
    loadPublicCommentsForChapter?.(slug, chapterNumber);
  }, [slug, chapterNumber, loadPublicCommentsForChapter]);

  // Client-side sort (Top weights emoji reactions heavily as requested)
  const sorted = useMemo(() => {
    const getScore = (c: any) => {
      const r = c.reactions || {};
      const reactionSum = Object.values(r).reduce((sum: number, n: any) => sum + (Number(n) || 0), 0);
      return (c.likes || 0) + reactionSum;
    };

    const arr = [...rawComments];

    if (sort === "newest") {
      return arr.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    if (sort === "oldest") {
      return arr.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }
    // Top: highest engagement first (emoji reactions give strong boost), tie-break by recency
    return arr.sort((a, b) => {
      const sa = getScore(a);
      const sb = getScore(b);
      if (sb !== sa) return sb - sa;
      return b.timestamp.localeCompare(a.timestamp);
    });
  }, [rawComments, sort]);

  const roots = sorted.filter((c) => !c.parentId);
  const total = rawComments.length;

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text || !user) return;

    setPosting(true);
    try {
      addComment(slug, chapterNumber, text, displayName || "Reader");
      setNewText("");
      // For public the context already fired the server action + optimistic.
      // Re-load from server shortly to reconcile real ids / timestamps if desired.
      setTimeout(() => {
        loadPublicCommentsForChapter?.(slug, chapterNumber);
      }, 400);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mt-8 border-t border-[var(--border)] pt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <MessageCircle size={18} /> Comments
          <span className="text-xs font-normal text-[var(--text-muted)]">({total})</span>
        </div>

        {/* Sort controls - Top emphasizes comments with lots of emoji reactions */}
        <div className="flex rounded-xl border border-[var(--border)] overflow-hidden text-xs">
          {(["top", "newest", "oldest"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setSort(m)}
              className={`px-3 py-1.5 transition ${sort === m ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium" : "hover:bg-[var(--bg-elev)] text-[var(--text-muted)]"}`}
            >
              {m === "top" ? "Top" : m === "newest" ? "Newest" : "Oldest"}
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      {user ? (
        <form onSubmit={handlePost} className="mb-5">
          <div className="glass rounded-2xl border border-[var(--border)] p-3">
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Share your thoughts on this chapter..."
              rows={2}
              className="w-full resize-y min-h-[52px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/60"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex gap-1 text-lg opacity-70">
                {EMOJI_QUICK.map((em) => (
                  <span key={em} className="cursor-default select-none">{em}</span>
                ))}
              </div>
              <button
                type="submit"
                disabled={!newText.trim() || posting}
                className="btn-primary px-5 py-1.5 text-sm disabled:opacity-60"
              >
                {posting ? "Posting..." : "Post comment"}
              </button>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-[var(--text-muted)]">
            Comments are public for this chapter. Be kind.
          </div>
        </form>
      ) : (
        <div className="mb-5 text-sm glass border border-[var(--border)] rounded-xl p-4 text-center text-[var(--text-muted)]">
          Sign in to join the discussion.
        </div>
      )}

      {/* List */}
      {roots.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm border border-dashed border-[var(--border)] rounded-2xl">
          No comments yet. Be the first to say something!
        </div>
      ) : (
        <div className="space-y-3">
          {roots.map((root) => (
            <CommentItem
              key={root.id}
              comment={root}
              allComments={sorted}
              slug={slug}
              chapterNumber={chapterNumber}
              level={0}
            />
          ))}
        </div>
      )}

      <div className="mt-3 text-[10px] text-center text-[var(--text-muted)]/70">
        Top sort boosts comments with the most emoji reactions + likes.
      </div>
    </div>
  );
}
