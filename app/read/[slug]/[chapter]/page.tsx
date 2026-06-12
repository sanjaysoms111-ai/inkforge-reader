"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, List, X, Share2, Eye } from "lucide-react";
import { useComics } from "../../../lib/ComicsContext";
import { useUser } from "../../../lib/UserContext";
import { SmartImage } from "../../../components/SmartImage";
import { CommentSection } from "../../../components/CommentSection";

export default function ReaderPage() {
  const params = useParams<{ slug: string; chapter: string }>();
  const router = useRouter();
  const { getComicBySlug, shareLink, recordChapterView } = useComics();
  const { user, isChapterUnlocked: userIsChapterUnlocked, coinBalance } = useUser();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const comic = getComicBySlug(params.slug);
  const chNum = parseInt(params.chapter, 10) || 1;
  const chapter = comic?.chapters.find(c => c.number === chNum) || comic?.chapters[0];

  const isUnlocked = userIsChapterUnlocked(comic?.slug || "", chNum) || chNum === 1 || !chapter?.isPremium;

  // === Accurate view counting (scroll-to-bottom of LAST panel only, once per user per chapter) ===
  const panels = chapter?.panels || [];
  const lastPanelRef = useRef<HTMLDivElement | null>(null);
  const hasRecordedRef = useRef(false);
  const sessionStorageKey = comic && chapter ? `inkforge:viewed:${comic.slug}:${chNum}` : "";

  useEffect(() => {
    // Only count for authenticated users. Anonymous opens never increment.
    // Guard ensures "once per browser session/tab" even if effect re-runs.
    if (!user || !comic || !chapter || panels.length === 0) return;
    if (hasRecordedRef.current) return;

    // Restore guard if we already recorded in this tab/session (e.g. quick nav)
    if (sessionStorageKey && sessionStorage.getItem(sessionStorageKey) === "1") {
      hasRecordedRef.current = true;
      return;
    }

    const target = lastPanelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !hasRecordedRef.current) {
          hasRecordedRef.current = true;
          if (sessionStorageKey) {
            try { sessionStorage.setItem(sessionStorageKey, "1"); } catch {}
          }
          console.log("[Reader] Last panel visible — recording chapter view (once-per-user-per-chapter)", comic.slug, "ch", chNum);
          // Fire via context (optimistic +1 for UI + server action for durable accurate count with dedup)
          recordChapterView?.(comic.slug, chNum).catch((e) => console.warn("[Reader] recordChapterView failed (non-fatal)", e));
          observer.disconnect();
        }
      },
      {
        threshold: 0.85, // require most of the last panel to be in view (good proxy for "scrolled to bottom")
        rootMargin: "0px 0px -8% 0px", // trigger a bit before absolute bottom of viewport
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [user?.id, comic?.slug, chNum, panels.length, recordChapterView]);

  if (!comic || !chapter) {
    return <div className="p-10 text-center">Not found. <Link href="/" className="underline">Home</Link></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="sticky top-0 z-50 border-b border-[var(--border)] glass px-4 py-2 flex items-center justify-between text-sm">
        <Link href={`/comics/${comic.slug}`} className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft size={16} /> {comic.title}
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[10px]">Ch.{chNum} {chapter.isPremium ? "PREMIUM" : ""}</span>
          <button
            onClick={() => shareLink(comic.slug)}
            className="btn-ghost p-1 rounded flex items-center gap-1 text-xs border border-[var(--accent)]/50 hover:bg-[var(--accent)]/10 text-[var(--accent)]"
            title="Share this comic"
          >
            <Share2 size={15} /> <span className="hidden sm:inline">Share</span>
          </button>
          <button onClick={() => setDrawerOpen(true)} className="btn-ghost p-1 rounded" title="Chapters"><List size={15} /></button>
          <Link href="/" className="text-xs px-2">Close</Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-6">
        <div className="text-center mb-4">
          <div className="text-xs tracking-widest text-[var(--accent)]/70">CHAPTER {chNum}</div>
          <div className="text-2xl font-semibold">{chapter.title}</div>
          <div className="text-xs text-[var(--text-muted)]">by {comic.author} • Balance: {coinBalance}</div>
          {/* Total views (comic-level cached count; updated live via optimistic + server when you reach bottom of this chapter) */}
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]/80">
            <Eye size={12} /> {(comic.views || 0).toLocaleString()} views
          </div>
        </div>

        {/* Public + Storage + Gating banner (new implementation) */}
        <div className="mb-4 p-3 rounded border border-emerald-500/30 bg-emerald-950/10 text-xs">
          Public comics + Supabase Storage upload supported. Panels served as https. First chapter always free. Premium gating via UserContext (first chapter free).
        </div>

        {/* Actual panel rendering for public (https) and private (data:) comics via SmartImage */}
        <div className="max-w-[720px] mx-auto">
          {panels.length > 0 ? (
            panels.map((panelUrl: string, idx: number) => {
              const isLast = idx === panels.length - 1;
              return (
                <div
                  key={idx}
                  ref={isLast ? lastPanelRef : undefined}
                  className="mb-3 flex justify-center"
                >
                  <SmartImage
                    src={panelUrl}
                    alt={`Panel ${idx + 1} of Ch.${chNum}`}
                    className="max-w-full w-auto max-h-[82vh] rounded-lg shadow border border-[var(--border)]"
                    loading="lazy"
                  />
                </div>
              );
            })
          ) : (
            <div className="text-center text-[var(--text-muted)] p-8 border border-[var(--border)] rounded">
              No panels found for this chapter.
            </div>
          )}
        </div>

        <div className="mt-3 text-[10px] text-[var(--text-muted)] text-center">Current chapter unlocked: {isUnlocked ? "YES" : "LOCKED (use drawer or coins)"}</div>

        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => router.push(`/read/${comic.slug}/${chNum-1}`)} disabled={!comic.chapters.find(c=>c.number===chNum-1)} className="btn-ghost px-4 py-1">Prev</button>
          <button onClick={() => router.push(`/read/${comic.slug}/${chNum+1}`)} disabled={!comic.chapters.find(c=>c.number===chNum+1)} className="btn-primary px-4 py-1">Next</button>
        </div>

        {/* Advanced Comment System — threaded replies, likes, multi-emoji reactions, Top/Newest/Oldest sort.
            For public (Supabase) comics the list is loaded from DB on open and mutations go through server actions + optimistic in ComicsContext.
            Private comics keep using the original localStorage-backed comments (hybrid invariant preserved).
            Emoji reactions heavily influence "Top" ranking. */}
        <CommentSection slug={comic.slug} chapterNumber={chNum} />

        {comic.isPublic && (
          <div className="mt-4 text-[10px] text-center text-amber-400/70">
            By uploading, you confirm all content is original and does not infringe any copyrights. Violations may lead to content removal and account suspension.
          </div>
        )}
      </div>

      {/* Minimal chapter drawer with gating */}
      {drawerOpen && (
        <div className="fixed inset-0 z-70 bg-black/60" onClick={() => setDrawerOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-80 bg-[var(--bg-elev)] border-l border-[var(--border)] p-4 overflow-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <div className="font-semibold">Chapters</div>
              <button onClick={() => setDrawerOpen(false)}><X /></button>
            </div>
            {comic.chapters.map(ch => {
              const unlocked = userIsChapterUnlocked(comic.slug, ch.number) || ch.number === 1 || !ch.isPremium;
              return (
                <button key={ch.id} disabled={!unlocked} onClick={() => { if (unlocked) { router.push(`/read/${comic.slug}/${ch.number}`); setDrawerOpen(false); } }} className={`block w-full text-left py-1 px-2 mb-1 rounded text-sm ${ch.number===chNum ? 'bg-[var(--accent)]/10' : ''} ${!unlocked ? 'opacity-50' : 'hover:bg-[var(--bg-card)]'}`}>
                  Ch.{ch.number} {ch.title} {ch.isPremium ? (unlocked ? '✓' : '🔒') : 'FREE'}
                </button>
              );
            })}
            <div className="mt-3 text-[10px] text-[var(--text-muted)]">Premium requires unlock (coins from UserContext). First is free.</div>
          </div>
        </div>
      )}
    </div>
  );
}
