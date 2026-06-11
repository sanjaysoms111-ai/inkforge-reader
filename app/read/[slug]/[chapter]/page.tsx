"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, Play, Pause, ZoomIn, ZoomOut, Maximize2, List, Sun, X, Download, Bookmark, History, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import JSZip from 'jszip';
import { useComics } from "../../../lib/ComicsContext";
import { AdPlaceholder } from "../../../components/AdPlaceholder";
import { SmartImage } from "../../../components/SmartImage";
import type { Comment } from "../../../lib/types";
import { useOnlineStatus, notifySWToCachePanels } from "../../../lib/pwa";

export default function ReaderPage() {
  const params = useParams<{ slug: string; chapter: string }>();
  const router = useRouter();
  const {
    getComicBySlug,
    getCommentsForChapter,
    addComment,
    likeComment,
    addReaction,
    deleteComment,
    displayName,
    setDisplayName,
    getReadingProgress,
    saveReadingProgress,
    getBookmarks,
    toggleBookmark,
    isPageBookmarked,
    isChapterBookmarked,
    getReadingHistory,
    addToHistory,
    getReaderSettings,
    updateReaderSettings,
    getLikedComics,
    toggleLikeComic,
    isComicLiked,
    getCurrentStreak,
    getAchievements,
    checkAchievements,
    copyChapterLink,
    recordCreatorView,
    getCreatorAnalytics,
    isChapterCached,
    cacheChapterForOffline,
  } = useComics();

  // Comments UI state (enhanced for replies)
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [showAllComments, setShowAllComments] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null); // for nested replies
  const [showShareToast, setShowShareToast] = useState(false);

  // Touch swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const swipeRef = useRef<HTMLDivElement>(null);
  const minSwipeDistance = 65;

  // === Upgraded Reader Features ===
  const [readingMode, setReadingMode] = useState<'vertical' | 'paged'>('vertical');
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(3);
  const autoScrollRef = useRef<number | null>(null);

  const [zoom, setZoom] = useState(1.0);
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);

  const [isChapterDrawerOpen, setIsChapterDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // PWA offline status (reactive). Used for banner + gating some offline-friendly features.
  const isOnline = useOnlineStatus();

  // Data
  const chapterNum = parseInt(params.chapter, 10);
  const comic = getComicBySlug(params.slug);
  const chapter = comic?.chapters.find((c) => c.number === chapterNum);
  const chapterIndex = comic ? comic.chapters.findIndex((c) => c.number === chapterNum) : -1;

  if (!comic || !chapter) {
    return <div className="py-20 text-center text-[var(--text-muted)]">Comic or chapter not found. <Link href="/" className="text-[var(--accent)]">Go home</Link></div>;
  }

  const initialProgress = getReadingProgress(comic.slug, chapter.number);
  const [lastReadPanel, setLastReadPanel] = useState(initialProgress);

  const panelsContainerRef = useRef<HTMLDivElement>(null);

  // Monetizing removed: all chapters freely readable.
  // isPremium kept for display-only "PREMIUM" badge.
  const isPremium = chapter.isPremium;
  const isUnlocked = true; // always readable now

  // No custom prices/costs (monetizing removed)

  const prevChapter = comic.chapters[chapterIndex - 1];
  const nextChapter = comic.chapters[chapterIndex + 1];

  const chapterComments = getCommentsForChapter(comic.slug, chapter.number);
  const sortedComments = [...chapterComments].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const displayedComments = showAllComments ? sortedComments : sortedComments.slice(0, 3);

  const goToChapter = (num: number) => {
    // save before leaving
    if (readingMode === 'paged') saveReadingProgress(comic.slug, chapter.number, currentPage);
    router.push(`/read/${comic.slug}/${num}`);
  };

  // unlock removed (monetizing removed)

  // Auto scroll
  const toggleAutoScroll = () => {
    if (readingMode !== 'vertical') return;
    setIsAutoScrolling(!isAutoScrolling);
  };

  useEffect(() => {
    if (!isAutoScrolling || readingMode !== 'vertical') {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
      return;
    }
    const step = () => {
      const c = panelsContainerRef.current || document.documentElement;
      c.scrollBy(0, autoSpeed * 2.2);
      autoScrollRef.current = requestAnimationFrame(step);
    };
    autoScrollRef.current = requestAnimationFrame(step);
    return () => { if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current); };
  }, [isAutoScrolling, autoSpeed, readingMode]);

  // Progress
  const saveProgress = (idx: number) => {
    setLastReadPanel(idx);
    setTimeout(() => saveReadingProgress(comic.slug, chapter.number, idx), 200);
  };

  useEffect(() => {
    if (lastReadPanel > 0 && lastReadPanel < chapter.panels.length) {
      if (readingMode === 'vertical') {
        setTimeout(() => (panelsContainerRef.current || window).scrollTo?.(0, lastReadPanel * 520), 90);
      } else {
        setCurrentPage(lastReadPanel);
      }
    }
  }, [lastReadPanel, readingMode, chapter.panels.length]);

  // PWA: when viewing an unlocked chapter, warm the offline cache (SW + context flag).
  // data: URLs are already in the comic object (localStorage). https panels get cached via SW fetch interception + explicit notify.
  useEffect(() => {
    if (isUnlocked) {
      cacheChapterForOffline(comic.slug, chapter.number);
      // Only notify real URLs (data: are inlined and always work offline)
      const httpPanels = chapter.panels.filter((p) => !p.startsWith('data:'));
      if (httpPanels.length > 0) {
        notifySWToCachePanels(httpPanels);
      }
    }
  }, [isUnlocked, comic.slug, chapter.number]); // panels are stable per chapter mount

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowdown' || k === ' ') {
        e.preventDefault();
        if (readingMode === 'vertical') (panelsContainerRef.current || window).scrollBy(0, 320);
        else if (currentPage < chapter.panels.length - 1) setCurrentPage(p => p + 1);
      } else if (k === 'arrowup') {
        if (readingMode === 'vertical') (panelsContainerRef.current || window).scrollBy(0, -320);
        else if (currentPage > 0) setCurrentPage(p => p - 1);
      } else if (k === 'arrowleft' && prevChapter) goToChapter(prevChapter.number);
      else if (k === 'arrowright' && nextChapter) goToChapter(nextChapter.number);
      else if (k === '+' || k === '=') setZoom(z => Math.min(3, z + 0.12));
      else if (k === '-') setZoom(z => Math.max(0.5, z - 0.12));
      else if (k === 'f') {
        const el = panelsContainerRef.current || document.documentElement;
        document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.();
      } else if (k === 'a') toggleAutoScroll();
      else if (k === 'c') setIsChapterDrawerOpen(o => !o);
      else if (k === 'b') { setZoom(1); setBrightness(1); setContrast(1); }
      else if (k === 'escape') { setIsChapterDrawerOpen(false); setIsAutoScrolling(false); }
      else if (k === 'v') setReadingMode(m => m === 'vertical' ? 'paged' : 'vertical');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readingMode, currentPage, prevChapter, nextChapter, chapter.panels.length]);

  // Paged progress
  useEffect(() => { if (readingMode === 'paged') saveProgress(currentPage); }, [currentPage, readingMode]);

  // Record creator view for analytics (mock, client-side)
  useEffect(() => {
    if (comic?.source === 'creator' && recordCreatorView) {
      recordCreatorView(comic.slug);
    }
  }, [comic?.slug]);

  // Virtualization (vertical)
  const PANEL_EST_HEIGHT = 520;
  const OVERSCAN = 2;
  const [panelScrollTop, setPanelScrollTop] = useState(0);
  const totalPanels = chapter.panels.length;
  const startIdx = Math.max(0, Math.floor(panelScrollTop / PANEL_EST_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil((typeof window !== 'undefined' ? window.innerHeight : 900) / PANEL_EST_HEIGHT) + OVERSCAN * 2;
  const endIdx = Math.min(totalPanels, startIdx + visibleCount);

  const handlePanelsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setPanelScrollTop(e.currentTarget.scrollTop);
    if (readingMode === 'vertical') {
      const approx = Math.floor(e.currentTarget.scrollTop / PANEL_EST_HEIGHT);
      if (approx !== lastReadPanel) saveProgress(approx);
    }
  };

  // Zoom / pinch helpers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.max(0.5, Math.min(3, z + (e.deltaY < 0 ? 0.1 : -0.1))));
    }
  };
  const lastPinch = useRef(0);
  const handlePinch = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastPinch.current) setZoom(z => Math.max(0.5, Math.min(3, z * (d / lastPinch.current))));
      lastPinch.current = d;
    } else lastPinch.current = 0;
  };

  // Touch chapter nav (respect lock)
  const onTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX); };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) { setTouchStart(null); setTouchEnd(null); return; }
    const dist = touchStart - touchEnd;
    if (Math.abs(dist) > minSwipeDistance) {
      if (dist > 0 && nextChapter) goToChapter(nextChapter.number);
      else if (dist < 0 && prevChapter) goToChapter(prevChapter.number);
    }
    setTouchStart(null); setTouchEnd(null);
  };

  const getRelativeTime = (ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
    return `${Math.floor(diff/1440)}d ago`;
  };

  // Thumbnails for nav (first panel of sibling)
  const prevThumb = prevChapter ? prevChapter.panels[0] : null;
  const nextThumb = nextChapter ? nextChapter.panels[0] : null;

  // Download current chapter as zip (all chapters freely downloadable, monetizing removed)
  const downloadChapter = async () => {
    if (!chapter) return;
    const zip = new JSZip();
    const folderName = `${comic.slug}-ch${chapter.number}`;
    const folder = zip.folder(folderName);
    if (!folder) return;

    for (let i = 0; i < chapter.panels.length; i++) {
      const url = chapter.panels[i];
      try {
        let blob: Blob;
        if (url.startsWith('data:')) {
          const res = await fetch(url);
          blob = await res.blob();
        } else {
          const res = await fetch(url, { mode: 'cors' as RequestMode });
          blob = await res.blob();
        }
        const ext = (blob.type.includes('png') || url.includes('png')) ? 'png' : 'jpg';
        folder.file(`panel-${String(i + 1).padStart(3, '0')}.${ext}`, blob);
      } catch (e) {
        console.warn('Failed to add panel to zip', e);
      }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `${folderName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    // PWA: mark this chapter cached in context (for indicators) + notify SW to store the panel URLs
    // so the chapter remains fully readable when offline (works alongside the data: URLs already in localStorage).
    cacheChapterForOffline(comic.slug, chapter.number);
    notifySWToCachePanels(chapter.panels);
  };

  // Render panels (virtualized in vertical, single in paged)
  const renderPanels = () => {
    const filterStyle = { filter: `brightness(${brightness}) contrast(${contrast})` };

    if (readingMode === 'paged') {
      const idx = Math.min(currentPage, chapter.panels.length - 1);
      return (
        <div className="flex justify-center items-center min-h-[60vh]" style={filterStyle}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center top' }}>
            <SmartImage src={chapter.panels[idx]} alt={`Panel ${idx+1}`} className="max-h-[82vh] w-auto rounded-lg shadow" />
          </div>
        </div>
      );
    }

    // Vertical virtual (respect direction and fit from settings)
    let panelsToRender = chapter.panels.slice(startIdx, endIdx);
    if (getReaderSettings().direction === 'rtl') {
      panelsToRender = [...panelsToRender].reverse();
    }
    const rs = getReaderSettings();
    const fitClass = rs.fit === 'width' ? 'w-full h-auto' : rs.fit === 'height' ? 'h-full w-auto' : rs.fit === 'original' ? '' : 'max-w-full max-h-full';
    return (
      <div ref={panelsContainerRef} onScroll={handlePanelsScroll} onWheel={handleWheel} onTouchMove={handlePinch} className="space-y-1">
        {startIdx > 0 && <div style={{ height: startIdx * PANEL_EST_HEIGHT }} aria-hidden />}
        {panelsToRender.map((url, li) => {
          const gi = rs.direction === 'rtl' ? (startIdx + (panelsToRender.length - 1 - li)) : (startIdx + li);
          return (
            <div key={gi} className="mb-1" style={filterStyle}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                <SmartImage src={url} alt={`Panel ${gi+1}`} className={`panel ${fitClass}`} loading={gi < 2 ? "eager" : "lazy"} />
              </div>
            </div>
          );
        })}
        {endIdx < totalPanels && <div style={{ height: (totalPanels - endIdx) * PANEL_EST_HEIGHT }} aria-hidden />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b border-[var(--border)] glass bg-[var(--glass-bg)]">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Link href={`/comics/${comic.slug}`} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
              <ArrowLeft size={16} /> {comic.title}
            </Link>
            <div className="hidden sm:block h-4 w-px bg-[var(--border)]" />
            <div className="text-sm font-medium truncate">Ch. {chapter.number} — {chapter.title}</div>
          </div>

          <div className="flex items-center gap-1.5 text-sm">
            <div className="hidden md:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
              <Coins className="h-3.5 w-3.5 text-amber-400" /> {coinBalance}
            </div>

            {/* Like/Favorite this comic (light social) */}
            <button
              onClick={() => { toggleLikeComic(comic.slug); checkAchievements(); }}
              className="btn-ghost p-1.5 rounded flex items-center gap-1"
              title={isComicLiked(comic.slug) ? "Unlike comic" : "Like / Favorite this comic"}
            >
              <span className={isComicLiked(comic.slug) ? "text-red-400" : ""}>❤️</span>
              <span className="hidden sm:inline text-[10px]">{isComicLiked(comic.slug) ? "Liked" : "Like"}</span>
            </button>

            {/* Share chapter link (copyable) */}
            <button
              onClick={async () => {
                await copyChapterLink(comic.slug, chapter.number);
                setShowShareToast(true);
                setTimeout(() => setShowShareToast(false), 1800);
              }}
              className="btn-ghost p-1.5 rounded"
              title="Copy chapter link"
            >
              🔗 <span className="hidden sm:inline text-[10px]">Share</span>
            </button>

            {/* Streak indicator (light achievement) */}
            {getCurrentStreak() > 0 && (
              <div className="hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30" title="Current reading streak">
                🔥 {getCurrentStreak()}
              </div>
            )}

            {/* Mode toggle */}
            <button onClick={() => setReadingMode(m => m === 'vertical' ? 'paged' : 'vertical')} className="btn-ghost px-2 py-1 text-xs rounded" title="Toggle Vertical / Paged">
              {readingMode === 'vertical' ? 'Paged' : 'Vertical'}
            </button>

            {/* Auto scroll controls (vertical) */}
            {readingMode === 'vertical' && (
              <div className="flex items-center gap-1.5">
                <button onClick={toggleAutoScroll} className="btn-ghost p-1.5 rounded" title="Auto-scroll (A)">
                  {isAutoScrolling ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <input type="range" min="1" max="10" step="0.5" value={autoSpeed} onChange={e => setAutoSpeed(parseFloat(e.target.value))} className="w-20 accent-[var(--accent)]" title="Auto-scroll speed" />
              </div>
            )}

            {/* Zoom */}
            <div className="flex items-center gap-0.5">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.15))} className="btn-ghost p-1 rounded" title="Zoom out"><ZoomOut size={15} /></button>
              <span className="tabular-nums text-[10px] w-8 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.15))} className="btn-ghost p-1 rounded" title="Zoom in"><ZoomIn size={15} /></button>
            </div>

            {/* QOL: Download (unlocked only), Bookmark, History, Settings */}
            <button onClick={downloadChapter} className="btn-ghost p-1.5 rounded" title="Download chapter as ZIP (offline)">
              <Download size={15} />
            </button>
            <button onClick={() => toggleBookmark(comic.slug, chapter.number, readingMode === 'paged' ? currentPage : lastReadPanel)} className="btn-ghost p-1.5 rounded" title="Bookmark current page/chapter">
              <Bookmark size={15} className={isPageBookmarked(comic.slug, chapter.number, readingMode === 'paged' ? currentPage : lastReadPanel) || isChapterBookmarked(comic.slug, chapter.number) ? 'fill-current text-amber-400' : ''} />
            </button>
            <button onClick={() => setIsHistoryOpen(true)} className="btn-ghost p-1.5 rounded" title="Reading history (last 20)">
              <History size={15} />
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="btn-ghost p-1.5 rounded" title="Reader settings (direction, fit)">
              <Settings size={15} />
            </button>

            {/* Filters */}
            <details className="relative">
              <summary className="btn-ghost list-none cursor-pointer px-2 py-1 text-xs rounded flex items-center gap-1" title="Brightness / Contrast (B resets)"><Sun size={14} /> Filters</summary>
              <div className="absolute right-0 mt-1 w-48 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 text-xs z-50">
                <div>Brightness <input type="range" min="0.4" max="1.8" step="0.05" value={brightness} onChange={e=>setBrightness(parseFloat(e.target.value))} className="w-full accent-[var(--accent)]" /></div>
                <div className="mt-1">Contrast <input type="range" min="0.5" max="1.8" step="0.05" value={contrast} onChange={e=>setContrast(parseFloat(e.target.value))} className="w-full accent-[var(--accent)]" /></div>
                <button onClick={() => {setBrightness(1);setContrast(1);setZoom(1);}} className="mt-2 text-[10px] underline">Reset</button>
              </div>
            </details>

            <button onClick={() => { const el = panelsContainerRef.current || document.documentElement; document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.(); }} className="btn-ghost p-1.5 rounded" title="Fullscreen (F)"><Maximize2 size={15} /></button>

            <button onClick={() => setIsChapterDrawerOpen(true)} className="btn-ghost p-1.5 rounded flex items-center gap-1" title="Chapters (C)"><List size={15} /> <span className="hidden sm:inline text-xs">Chapters</span></button>

            <button onClick={() => { setShowComments(true); document.getElementById('comments-section')?.scrollIntoView({behavior:'smooth'}); }} className="btn-ghost px-2 py-1 text-xs rounded">💬 {chapterComments.length}</button>

            {prevChapter && (
              <button onClick={() => goToChapter(prevChapter.number)} className="btn-ghost flex items-center gap-1 px-2 py-1 text-xs rounded" title={`Previous: ${prevChapter.title}`}>
                {prevThumb && <SmartImage src={prevThumb} alt="" className="w-6 h-6 rounded object-cover hidden sm:block" />} <ChevronLeft size={14} /> Prev
              </button>
            )}
            {nextChapter && (
              <button onClick={() => goToChapter(nextChapter.number)} className="btn-ghost flex items-center gap-1 px-2 py-1 text-xs rounded" title={`Next: ${nextChapter.title}`}>
                Next <ChevronRight size={14} /> {nextThumb && <SmartImage src={nextThumb} alt="" className="w-6 h-6 rounded object-cover hidden sm:block" />}
              </button>
            )}
          </div>
        </div>

        {/* PWA offline status (slim, contextual). Shows when offline or when this unlocked chapter is cached for offline use. */}
        {(!isOnline || isChapterCached(comic.slug, chapter.number)) && (
          <div className="border-t border-[var(--border)] bg-[var(--bg-elev)]/80 px-4 py-1 text-center text-[10px] text-[var(--text-muted)]">
            {!isOnline ? (
              <span className="text-amber-400">You are offline — showing cached content for this chapter (unlocked chapters + downloaded panels work offline)</span>
            ) : (
              <span className="text-emerald-400">Ready for offline reading</span>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="pt-4">
        <div className="reader-container mx-auto max-w-[860px] px-3">
          {/* Header */}
          <div className="mb-4 text-center">
            <div className="text-[10px] tracking-[2px] text-[var(--accent)]/70">CHAPTER {chapter.number}</div>
            <h1 className="text-2xl font-semibold tracking-tight">{chapter.title}</h1>
            <div className="text-xs text-[var(--text-muted)]">by {comic.author}</div>
            {comic.source === 'creator' && (() => {
              const a = getCreatorAnalytics ? getCreatorAnalytics(comic.slug) : null;
              return <div className="mt-1 inline text-[10px] px-2 py-px rounded bg-emerald-950 text-emerald-300 border border-emerald-900/60">
                AI on inkforg_apexpanel {a ? `• ${Math.floor((a.views||0)/1000)}k views • ${a.unlockCount} unlocks` : ''}
              </div>;
            })()}
          </div>

          {/* Reader Area */}
          {isUnlocked ? (
            <div
              ref={swipeRef}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onScroll={handlePanelsScroll}
              onWheel={handleWheel}
              className="min-h-[60vh] pb-8"
            >
              {/* Mode specific content */}
              {readingMode === 'vertical' ? (
                <>
                  {startIdx > 0 && <div style={{height: startIdx * PANEL_EST_HEIGHT}} aria-hidden />}
                  {chapter.panels.slice(startIdx, endIdx).map((url, li) => {
                    const gi = startIdx + li;
                    return (
                      <div key={gi} className="mb-px" style={{filter: `brightness(${brightness}) contrast(${contrast})`, transform: `scale(${zoom})`, transformOrigin:'top center'}}>
                        <SmartImage src={url} alt={`Panel ${gi+1}`} className="panel w-full rounded" loading={gi<2?"eager":"lazy"} />
                      </div>
                    );
                  })}
                  {endIdx < totalPanels && <div style={{height: (totalPanels-endIdx)*PANEL_EST_HEIGHT}} aria-hidden />}
                </>
              ) : (
                // Paged single panel view
                <div className="flex justify-center py-4" style={{filter: `brightness(${brightness}) contrast(${contrast})`}}>
                  <div style={{transform: `scale(${zoom})`, transformOrigin: 'center'}}>
                    <SmartImage src={chapter.panels[Math.min(currentPage, chapter.panels.length-1)]} alt={`Page ${currentPage+1}`} className="max-h-[78vh] w-auto rounded shadow-xl" />
                  </div>
                </div>
              )}

              {/* Auto-scroll hint / paged controls */}
              {readingMode === 'paged' && (
                <div className="flex justify-center gap-4 mt-4">
                  <button disabled={currentPage===0} onClick={() => setCurrentPage(p=>Math.max(0,p-1))} className="btn-ghost px-4 py-1">← Prev Panel</button>
                  <span className="text-xs self-center text-[var(--text-muted)]">{currentPage+1} / {chapter.panels.length}</span>
                  <button disabled={currentPage >= chapter.panels.length-1} onClick={() => setCurrentPage(p=>Math.min(chapter.panels.length-1, p+1))} className="btn-ghost px-4 py-1">Next Panel →</button>
                </div>
              )}

              <AdPlaceholder />

              {/* End nav */}
              <div className="mt-6 flex flex-col items-center gap-2 border-t border-[var(--border)] pt-6">
                <div className="text-sm text-[var(--text-muted)]">End of Chapter {chapter.number}</div>
                <div className="flex gap-2">
                  {prevChapter && <button onClick={() => goToChapter(prevChapter.number)} className="btn-ghost px-4 py-1.5">← Previous Chapter</button>}
                  {nextChapter && <button onClick={() => goToChapter(nextChapter.number)} className="btn-primary px-5 py-1.5">Next Chapter →</button>}
                </div>
              </div>

              {/* Enhanced Comments UI: nested replies, likes, avatars, timestamps */}
              <div id="comments-section" className="mt-8 pt-4 border-t border-[var(--border)]">
                <button onClick={() => setShowComments(!showComments)} className="w-full text-left text-lg font-semibold flex justify-between group">
                  Comments ({chapterComments.length}) 
                  <span className="group-hover:scale-110 transition">{showComments ? '−' : '+'}</span>
                </button>

                {showComments && (
                  <div className="mt-4 space-y-4">
                    {/* Display name + post form (with reply support) */}
                    <div className="p-3 bg-[var(--bg-card)]/70 rounded-xl border border-[var(--border)] text-sm">
                      {displayName ? (
                        <div className="flex items-center gap-2 mb-2">
                          <span>Commenting as: <strong>{displayName}</strong></span>
                          <button onClick={() => { setEditingDisplayName(true); setTempDisplayName(displayName); }} className="text-xs text-[var(--accent)] hover:underline">Edit</button>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <div className="text-[var(--text-muted)] text-xs mb-1">Enter your display name</div>
                          <div className="flex gap-2">
                            <input value={tempDisplayName} onChange={e=>setTempDisplayName(e.target.value)} placeholder="Your name" className="flex-1 bg-[var(--bg-elev)] border border-[var(--border)] rounded px-2 py-1 text-sm" onKeyDown={e=>{ if(e.key==='Enter' && tempDisplayName.trim()){ setDisplayName(tempDisplayName.trim()); setTempDisplayName(''); } }} />
                            <button onClick={()=>{ if(tempDisplayName.trim()) setDisplayName(tempDisplayName.trim()); setTempDisplayName(''); }} className="px-3 py-1 bg-[var(--accent)] text-white rounded text-sm">Save</button>
                          </div>
                        </div>
                      )}
                      {editingDisplayName && (
                        <div className="mt-1 flex gap-2">
                          <input value={tempDisplayName} onChange={e=>setTempDisplayName(e.target.value)} className="flex-1 bg-[var(--bg-elev)] border border-[var(--border)] rounded px-2 py-1 text-sm" />
                          <button onClick={()=>{ if(tempDisplayName.trim()) setDisplayName(tempDisplayName.trim()); setEditingDisplayName(false); setTempDisplayName(''); }} className="px-2 py-1 bg-[var(--accent)] text-white rounded text-sm">Save</button>
                          <button onClick={()=>{setEditingDisplayName(false); setTempDisplayName('');}} className="px-2 py-1 border border-[var(--border)] rounded text-sm">Cancel</button>
                        </div>
                      )}

                      {/* Post new comment or reply */}
                      {displayName && (
                        <div className="mt-2">
                          {replyingToId && <div className="text-[10px] text-[var(--text-muted)] mb-1">Replying to comment...</div>}
                          <div className="flex gap-2">
                            <textarea value={newCommentText} onChange={e=>setNewCommentText(e.target.value)} placeholder={replyingToId ? "Write a reply..." : "Share your thoughts..."} className="flex-1 bg-[var(--bg-elev)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm min-h-[48px]" />
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                {["❤️","😂","😮","👏","🔥"].map(em => (
                                  <button key={em} onClick={()=>setSelectedEmoji(selectedEmoji===em ? null : em)} className={`text-lg px-1 rounded ${selectedEmoji===em ? 'bg-[var(--accent)]/20' : ''}`}>{em}</button>
                                ))}
                              </div>
                              <button
                                onClick={() => {
                                  if (!newCommentText.trim()) return;
                                  addComment(comic.slug, chapter.number, newCommentText, displayName, selectedEmoji || undefined, replyingToId || undefined);
                                  setNewCommentText("");
                                  setSelectedEmoji(null);
                                  setReplyingToId(null);
                                  // toast
                                  const t = document.createElement('div');
                                  t.className = "fixed bottom-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1 rounded-full text-sm z-[100]";
                                  t.textContent = replyingToId ? "Reply posted!" : "Comment posted!";
                                  document.body.appendChild(t);
                                  setTimeout(()=>t.remove(), 1600);
                                }}
                                disabled={!newCommentText.trim()}
                                className="self-end px-4 py-1.5 bg-[var(--accent)] text-white text-sm rounded-xl disabled:opacity-50"
                              >
                                {replyingToId ? "Reply" : "Post"}
                              </button>
                            </div>
                          </div>
                          {replyingToId && <button onClick={()=>setReplyingToId(null)} className="text-[10px] text-[var(--text-muted)] mt-1">Cancel reply</button>}
                        </div>
                      )}
                    </div>

                    {/* Comments list with nesting support, avatars, likes, timestamps */}
                    {(() => {
                      const all = getCommentsForChapter(comic.slug, chapter.number) || [];
                      const topLevel = all.filter(c => !c.parentId);
                      const byParent = all.reduce((acc, c) => {
                        if (c.parentId) {
                          if (!acc[c.parentId]) acc[c.parentId] = [];
                          acc[c.parentId].push(c);
                        }
                        return acc;
                      }, {} as Record<string, Comment[]>);

                      const renderComment = (c: Comment, level = 0) => (
                        <div key={c.id} className={`bg-[var(--bg-card)]/60 border border-[var(--border)] rounded-2xl p-3 text-sm ${level > 0 ? 'ml-6 mt-2 border-l-2 border-[var(--accent)]/40' : ''}`}>
                          <div className="flex items-start gap-2">
                            {/* Simple avatar */}
                            <div className="w-7 h-7 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--accent)] flex-shrink-0" title={c.author}>
                              {c.avatar || c.author[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[var(--text)]">{c.author}</span>
                                <span className="text-[10px] text-[var(--text-muted)]">{getRelativeTime(c.timestamp)}</span>
                              </div>
                              <div className="text-[var(--text)] mt-0.5 leading-snug">{c.text}</div>

                              {/* Reactions + likes */}
                              <div className="flex flex-wrap gap-2 mt-2">
                                <button onClick={() => likeComment(comic.slug, chapter.number, c.id)} className="text-xs flex items-center gap-0.5 hover:text-[var(--accent)] transition">
                                  ❤️ {c.likes || 0}
                                </button>
                                {Object.entries(c.reactions || {}).map(([em, cnt]) => (
                                  <button key={em} onClick={() => addReaction(comic.slug, chapter.number, c.id, em)} className="text-xs bg-[var(--bg-elev)] px-1.5 py-0.5 rounded-full hover:bg-[var(--bg-card)]">
                                    {em} {cnt}
                                  </button>
                                ))}
                                {/* Quick add reaction */}
                                {["😮","👏","🔥"].filter(em => !(c.reactions||{})[em]).slice(0,1).map(em => (
                                  <button key={em} onClick={() => addReaction(comic.slug, chapter.number, c.id, em)} className="text-xs opacity-70 hover:opacity-100">+{em}</button>
                                ))}
                              </div>

                              <div className="mt-1 flex gap-3 text-[10px]">
                                <button onClick={() => setReplyingToId(c.id)} className="text-[var(--accent)] hover:underline">Reply</button>
                                {c.author === displayName && (
                                  <button onClick={() => { if(confirm('Delete this comment?')) deleteComment(comic.slug, chapter.number, c.id); }} className="text-red-400 hover:text-red-500">Delete</button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Nested replies */}
                          {(byParent[c.id] || []).map(r => renderComment(r, level + 1))}
                        </div>
                      );

                      return topLevel.length === 0 ? (
                        <div className="text-center py-6 text-[var(--text-muted)] text-sm border border-[var(--border)] rounded-2xl bg-[var(--bg-card)]/40">
                          Be the first to comment on this chapter!
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {topLevel.map(c => renderComment(c))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-10 text-center text-[10px] text-[var(--text-muted)]">Some comics on inkforg_apexpanel are AI-generated. Always check the creator&apos;s note.</div>
        </div>
      </div>

      {/* Bottom chapter switcher */}
      <div className="mx-auto mt-8 max-w-3xl px-4">
        <div className="flex gap-1 overflow-x-auto pb-2 snap-x">
          {comic.chapters.map((ch) => {
            const active = ch.number === chapterNum;
            return (
              <button
                key={ch.id}
                onClick={() => goToChapter(ch.number)}
                className={`chapter-pill snap-start px-2.5 py-0.5 text-[10px] font-mono border rounded ${active ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--bg-card)]'}`}
              >
                {String(ch.number).padStart(2,'0')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chapter Drawer */}
      <AnimatePresence>
        {isChapterDrawerOpen && (
          <div className="fixed inset-0 z-[60] flex" onClick={() => setIsChapterDrawerOpen(false)}>
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="ml-auto w-full max-w-sm bg-[var(--bg-elev)] border-l border-[var(--border)] h-full overflow-auto p-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between mb-3">
                <div className="font-semibold">Chapters — {comic.title}</div>
                <button onClick={() => setIsChapterDrawerOpen(false)}><X /></button>
              </div>
              <div className="space-y-1 text-sm">
                {comic.chapters.map((ch, i) => {
                  const unlocked = isChapterUnlocked(comic.id, ch.id) || !ch.isPremium;
                  const active = ch.number === chapterNum;
                  return (
                    <button key={i} onClick={() => { if (unlocked) { goToChapter(ch.number); setIsChapterDrawerOpen(false); } }} disabled={!unlocked} className={`w-full text-left px-3 py-2 rounded flex justify-between ${active ? 'bg-[var(--accent)]/10' : ''} ${!unlocked ? 'opacity-60' : 'hover:bg-[var(--bg-card)]'}`}>
                      <span>Ch. {ch.number} — {ch.title}</span>
                      <span className="text-[10px]">{ch.isPremium ? (unlocked ? '✓' : `🔒 ${ch.coinPrice ?? 10}`) : 'FREE'}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 text-[10px] text-[var(--text-muted)]">Tap a chapter to jump. Premium chapters require unlock.</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setIsHistoryOpen(false)}>
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0}} className="glass w-full max-w-md rounded-2xl p-6" onClick={e=>e.stopPropagation()}>
              <div className="flex justify-between mb-4">
                <div className="font-semibold flex items-center gap-2"><History size={16}/> Reading History (last 20)</div>
                <button onClick={() => setIsHistoryOpen(false)}><X/></button>
              </div>
              <div className="max-h-80 overflow-auto space-y-2 text-sm">
                {getReadingHistory().length === 0 && <div className="text-[var(--text-muted)]">No history yet.</div>}
                {getReadingHistory().map((h, i) => (
                  <Link key={i} href={`/read/${h.slug}/${h.chapterNumber}`} onClick={() => setIsHistoryOpen(false)} className="block p-2 rounded hover:bg-[var(--bg-card)] border border-[var(--border)]">
                    {h.slug} Ch.{h.chapterNumber} (panel ~{h.panelIndex}) — {new Date(h.timestamp).toLocaleDateString()}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal for direction and fit */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setIsSettingsOpen(false)}>
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="glass w-full max-w-xs rounded-2xl p-6" onClick={e=>e.stopPropagation()}>
              <div className="flex justify-between mb-4">
                <div className="font-semibold">Reader Settings</div>
                <button onClick={() => setIsSettingsOpen(false)}><X/></button>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="mb-1 text-[var(--text-muted)]">Reading Direction</div>
                  <select value={getReaderSettings().direction} onChange={e => updateReaderSettings({ direction: e.target.value as any })} className="w-full bg-[var(--bg-elev)] border border-[var(--border)] rounded px-2 py-1">
                    <option value="vertical">Vertical (default webtoon)</option>
                    <option value="rtl">Right-to-Left (manga style)</option>
                    <option value="ltr">Left-to-Right</option>
                  </select>
                </div>
                <div>
                  <div className="mb-1 text-[var(--text-muted)]">Fit Mode</div>
                  <select value={getReaderSettings().fit} onChange={e => updateReaderSettings({ fit: e.target.value as any })} className="w-full bg-[var(--bg-elev)] border border-[var(--border)] rounded px-2 py-1">
                    <option value="contain">Contain (fit screen)</option>
                    <option value="width">Fit Width</option>
                    <option value="height">Fit Height</option>
                    <option value="original">Original Size</option>
                  </select>
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">Settings persist in localStorage and affect panel display + order for direction.</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share toast */}
      {showShareToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-sm shadow z-[100]">
          Link copied! Share it with friends.
        </div>
      )}

      <BuyCoinsModal open={showBuy} onClose={() => setShowBuy(false)} />
    </div>
  );
}
