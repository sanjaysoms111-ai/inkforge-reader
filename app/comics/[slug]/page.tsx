"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Eye, Trash2, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { Suspense } from "react";
import { useComics } from "../../lib/ComicsContext";
import { useUser } from "../../lib/UserContext";
import { ChapterListItem } from "../../components/ChapterListItem";
import { SmartImage } from "../../components/SmartImage";
import { ChapterListSkeleton } from "../../components/Skeleton";
import { useState, useEffect } from "react";

export default function ComicDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { getComicBySlug, removePublishedComic, getCreatorAnalytics, recordCreatorView, shareLink } = useComics();

  const comic = getComicBySlug(params.slug);

  useEffect(() => {
    if (comic?.source === 'creator' && recordCreatorView) {
      recordCreatorView(comic.slug);
    }
  }, [comic?.slug]);

  if (!comic) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="text-6xl mb-4 opacity-70">📕</div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Comic not found</h1>
        <p className="text-[var(--text-muted)] mb-6 max-w-md mx-auto">
          The comic you&apos;re looking for doesn&apos;t exist or may have been removed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm text-[var(--accent)] hover:bg-[var(--bg-card)] transition"
        >
          <ArrowLeft size={16} /> Back to Discover
        </Link>
      </div>
    );
  }

  const firstFree = comic.chapters.find((c) => !c.isPremium) || comic.chapters[0];

  // Allow deleting legacy user-published (via removed /publish) and imported creator comics
  // (these live in the user's local storage)
  const canDelete = comic.id.startsWith('pub-') || comic.source === 'creator';

  const { isChapterUnlocked: userIsChapterUnlocked } = useUser ? useUser() : { isChapterUnlocked: () => true } as any;

  const handleReadChapter = (chapterNumber: number) => {
    router.push(`/read/${comic.slug}/${chapterNumber}`);
  };

  const totalChapters = comic.chapters.length;
  const freeCount = comic.chapters.filter((c) => !c.isPremium).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Discover
      </Link>

      <div className="grid gap-8 md:grid-cols-12">
        {/* Cover */}
        <div className="md:col-span-5 lg:col-span-4">
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="sticky top-20 overflow-hidden rounded-2xl border border-[var(--border)] shadow-xl"
          >
            <SmartImage
              src={comic.coverUrl}
              alt={comic.title}
              className="w-full object-cover"
              priority
            />
          </motion.div>
        </div>

        {/* Meta */}
        <div className="md:col-span-7 lg:col-span-8">
          <div className="flex flex-wrap gap-2">
            {comic.genres.map((g) => (
              <span key={g} className="genre-pill">{g}</span>
            ))}
            {comic.isAIGenerated && (
              <span className="rounded-full bg-rose-600/10 px-3 py-px text-xs text-rose-400 ring-1 ring-rose-500/40">AI-ASSISTED</span>
            )}
            {comic.source === 'creator' && (() => {
              const a = getCreatorAnalytics ? getCreatorAnalytics(comic.slug) : null;
              return a ? <span className="text-[10px] text-emerald-400">• {Math.floor((a.views||0)/1000)}k views • {a.unlockCount} unlocks</span> : null;
            })()}
          </div>

          <h1 className="mt-3 text-4xl font-semibold tracking-tighter">{comic.title}</h1>
          <p className="mt-1 text-xl text-zinc-400">by {comic.author}</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> {totalChapters} chapters
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> {Math.floor(comic.views / 1000)}k views
            </div>
            <div>Updated {comic.publishedAt}</div>
          </div>

          <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-zinc-300">
            {comic.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <motion.button
              onClick={() => handleReadChapter(firstFree.number)}
              whileTap={{ scale: 0.985 }}
              className="btn-primary flex items-center justify-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold shadow-sm hover:shadow-md transition-all"
            >
              <BookOpen className="h-4 w-4" /> Start Reading
            </motion.button>

            <motion.button
              onClick={() => shareLink(comic.slug)}
              whileTap={{ scale: 0.985 }}
              className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm border border-[var(--border)] hover:bg-[var(--bg-elev)]"
              title="Share this comic"
            >
              <Share2 size={16} /> Share
            </motion.button>

            {/* All content freely readable (monetizing features removed). isPremium shown for display only. */}

            {/* Delete button for user's own published comics or imported creator comics */}
            {canDelete && (
              <motion.button
                onClick={() => {
                  if (confirm(`Permanently delete "${comic.title}"?\n\nThis cannot be undone and will remove it from your library.`)) {
                    removePublishedComic(comic.id);

                    // Non-blocking toast feedback (consistent with other messages in the app)
                    const toast = document.createElement("div");
                    toast.className =
                      "fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-5 py-2 text-sm text-white shadow-lg z-[100]";
                    toast.textContent = "Comic deleted successfully.";
                    document.body.appendChild(toast);

                    setTimeout(() => {
                      toast.remove();
                      router.push("/");
                    }, 900);
                  }
                }}
                whileTap={{ scale: 0.985 }}
                className="btn-ghost flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm text-red-400 hover:bg-red-500/10 border border-red-500/30 hover:text-red-300"
                title="Delete this comic from your library"
              >
                <Trash2 size={16} /> Delete Comic
              </motion.button>
            )}
          </div>

          <div className="mt-3 text-xs text-emerald-500/80">
            {freeCount} Free • {totalChapters - freeCount} Premium
          </div>

          <div className="mt-2 text-[10px] text-zinc-500">
            Use coins to unlock premium chapters (10 coins each). Unlock all for 60 coins. Subscription or limited events = free unlocks. Image generation is handled separately in the Creator app.
          </div>

          {/* Disclaimer */}
          <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
            Some comics on inkforg_apexpanel are AI-generated. Always check the creator&apos;s note.
          </div>

          {comic.source === 'creator' && (
            <div className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/40 p-3 text-xs text-emerald-300">
              This comic was created using AI on inkforg_apexpanel.
            </div>
          )}

          {comic.isPublic && (
            <div className="mt-4 text-[10px] text-center text-amber-400/70">
              By uploading, you confirm all content is original and does not infringe any copyrights. Violations may lead to content removal and account suspension.
            </div>
          )}
        </div>
      </div>

      {/* Chapters */}
      <div className="mt-12">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold tracking-tight">Chapters</h2>
          <span className="text-xs text-[var(--text-muted)]">{totalChapters} {totalChapters === 1 ? "chapter" : "chapters"}</span>
        </div>

        <Suspense fallback={<ChapterListSkeleton count={Math.min(8, totalChapters)} />}>
          <div className="space-y-1.5">
            {comic.chapters.map((chapter) => (
              <ChapterListItem
                key={chapter.id}
                chapter={chapter}
                isUnlocked={userIsChapterUnlocked(comic.slug, chapter.number) || chapter.number === 1 || !chapter.isPremium}
                onRead={() => handleReadChapter(chapter.number)}
                onUnlock={() => { /* handled in reader or via UserContext spend */ }}
              />
            ))}
          </div>
        </Suspense>
      </div>


    </div>
  );
}
