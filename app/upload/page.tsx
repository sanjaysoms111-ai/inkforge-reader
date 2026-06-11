"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Check, X, ArrowLeft
} from 'lucide-react';
import { useComics } from '../lib/ComicsContext';
import { Genre, PublishComicInput } from '../lib/types';
import { SmartImage } from '../components/SmartImage';
import {
  MAX_PANELS_PER_CHAPTER,
  filterValidImageFiles,
  processImageFiles,
  generateThumbnail,
} from '../lib/uploadUtils';

const ALL_GENRES: Genre[] = [
  "Fantasy", "Romance", "Action", "Mystery", "Sci-Fi",
  "Horror", "Comedy", "Drama", "Thriller", "Slice of Life"
];

type ChapterDraft = {
  title: string;
  isPremium: boolean;
  panels: string[]; // data: URLs
  coinPrice?: number;
  thumbnail?: string; // advanced: generated from first panel
};

export default function UploadComicPage() {
  const router = useRouter();
  const {
    publishComic,
    saveUploadDraft,
    loadUploadDraft,
    getUploadDrafts,
    deleteUploadDraft,
    getUploadHistory,
    recordUploadToHistory,
    updateUploadedComic,
  } = useComics();

  // Comic metadata
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'ongoing' | 'completed'>('ongoing');
  const [unlockAllPrice, setUnlockAllPrice] = useState<number | undefined>(undefined);
  const [coverUrl, setCoverUrl] = useState<string>('');

  // Chapters (minimum 1; first is always free)
  const [chapters, setChapters] = useState<ChapterDraft[]>([
    { title: 'Chapter 1', isPremium: false, panels: [] }
  ]);

  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // UX improvements state
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [isDragOverCover, setIsDragOverCover] = useState(false);
  const [dragOverChapter, setDragOverChapter] = useState<number | null>(null);

  // Advanced capabilities state
  const [coverGallery, setCoverGallery] = useState<string[]>([]); // additional optimized covers
  const [bannerUrl, setBannerUrl] = useState<string>(''); // optional banner/hero
  const [draftsList, setDraftsList] = useState<any>(null); // loaded on demand
  const [showDrafts, setShowDrafts] = useState(false);
  const DRAFT_KEY = 'current-upload-draft'; // simple single active draft for auto-save

  // Robust upload preview reader (highest priority per design)
  const [showReaderPreview, setShowReaderPreview] = useState(false);

  // Keyboard + a11y helpers
  const [announce, setAnnounce] = useState(''); // for aria-live polite announcements

  // --- Helpers (shared with Creator Dashboard via uploadUtils) ---
  // See app/lib/uploadUtils.ts for processImageFiles, filterValidImageFiles, compression, validation constants.
  const toggleGenre = (g: Genre) => {
    setSelectedGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  const addTag = () => {
    const newTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0 && !tags.includes(t));
    if (newTags.length > 0) {
      setTags([...tags, ...newTags]);
      setTagsInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  // --- Cover handling (with improved dnd feedback + progress + validation/compress) ---
  const handleCoverFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const file = files[0];
    setProcessingProgress({ current: 0, total: 1, label: 'Processing cover image...' });

    try {
      const [finalUrl] = await processImageFiles([file]);
      setCoverUrl(finalUrl);
      setProcessingProgress({ current: 1, total: 1, label: 'Cover ready' });
      setTimeout(() => setProcessingProgress(null), 600);
    } catch (e: any) {
      setError(e.message || 'Failed to process cover image');
      setProcessingProgress(null);
    }
  };

  const clearCover = () => setCoverUrl('');

  // --- Chapter management ---
  const addChapter = () => {
    setChapters(prev => [
      ...prev,
      {
        title: `Chapter ${prev.length + 1}`,
        isPremium: true,
        panels: [],
        coinPrice: 10
      }
    ]);
  };

  const removeChapter = (index: number) => {
    if (chapters.length <= 1) return;
    // Never remove the "first" if it would leave zero — but allow removing others
    setChapters(prev => prev.filter((_, i) => i !== index));
  };

  const moveChapter = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= chapters.length) return;

    setChapters(prev => {
      const copy = [...prev];
      [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
      return copy;
    });
  };

  const updateChapterTitle = (index: number, newTitle: string) => {
    setChapters(prev => prev.map((ch, i) =>
      i === index ? { ...ch, title: newTitle } : ch
    ));
  };

  const toggleChapterPremium = (index: number) => {
    if (index === 0) return; // first chapter is always free
    setChapters(prev => prev.map((ch, i) => {
      if (i !== index) return ch;
      const nextPremium = !ch.isPremium;
      return {
        ...ch,
        isPremium: nextPremium,
        coinPrice: nextPremium ? (ch.coinPrice ?? 10) : undefined
      };
    }));
  };

  const updateChapterCoinPrice = (index: number, priceStr: string) => {
    if (index === 0) return;
    const price = parseInt(priceStr, 10);
    setChapters(prev => prev.map((ch, i) =>
      i === index ? { ...ch, coinPrice: isNaN(price) ? 10 : Math.max(1, price) } : ch
    ));
  };

  // Reorder panels inside a chapter (used by native HTML5 drag on thumbnails)
  const reorderPanels = (chIndex: number, from: number, to: number) => {
    if (from === to) return;
    setChapters(prev => prev.map((ch, i) => {
      if (i !== chIndex) return ch;
      const panels = [...ch.panels];
      const [moved] = panels.splice(from, 1);
      panels.splice(to, 0, moved);
      return { ...ch, panels };
    }));
  };

  // Panels for a specific chapter (full improved flow: validation, per-file progress, compression, max cap, dnd)
  const handleChapterPanelFiles = async (chIndex: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const currentCount = chapters[chIndex]?.panels.length || 0;
    const { valid: toProcess, skippedCount, wouldExceed } = filterValidImageFiles(files, currentCount);

    if (skippedCount > 0) {
      setError(`Skipped ${skippedCount} file(s) — only JPG/PNG/WEBP supported.`);
    }
    if (toProcess.length === 0) {
      if (wouldExceed || currentCount >= MAX_PANELS_PER_CHAPTER) {
        setError(`Max ${MAX_PANELS_PER_CHAPTER} panels per chapter. No more images added.`);
      }
      return;
    }
    if (wouldExceed) {
      setError(`Max ${MAX_PANELS_PER_CHAPTER} panels per chapter. Only ${toProcess.length} added.`);
    }

    setProcessingProgress({
      current: 0,
      total: toProcess.length,
      label: `Processing ${toProcess.length} panel image(s) for Chapter ${chIndex + 1}...`
    });

    try {
      const newUrls = await processImageFiles(toProcess, (cur, tot) => {
        setProcessingProgress(p => p ? { ...p, current: cur } : null);
      });
      if (newUrls.length > 0) {
        setChapters(prev => prev.map((ch, i) => {
          if (i !== chIndex) return ch;
          const newPanels = [...ch.panels, ...newUrls];
          // Advanced: auto-generate thumbnail from first panel when we gain the first image
          const needsThumb = !ch.thumbnail && newPanels.length > 0;
          if (needsThumb) {
            generateThumbnail(newPanels[0]).then(thumb => {
              setChapters(p => p.map((c, j) => j === chIndex ? { ...c, thumbnail: thumb } : c));
            }).catch(() => {});
          }
          return { ...ch, panels: newPanels };
        }));
      }
    } catch (e: any) {
      setError(e.message || 'Failed to process images');
    } finally {
      setProcessingProgress(null);
    }
  };

  const handleChapterPanelDrop = (chIndex: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverChapter(null);
    handleChapterPanelFiles(chIndex, e.dataTransfer.files);
  };

  const removePanel = (chIndex: number, panelIndex: number) => {
    setChapters(prev => prev.map((ch, i) =>
      i === chIndex
        ? { ...ch, panels: ch.panels.filter((_, p) => p !== panelIndex) }
        : ch
    ));
  };

  const clearChapterPanels = (chIndex: number) => {
    setChapters(prev => prev.map((ch, i) =>
      i === chIndex ? { ...ch, panels: [] } : ch
    ));
  };

  // --- Derived preview comic (for live preview) ---
  const buildPreviewComic = () => {
    const previewChapters = chapters.map((ch, idx) => ({
      id: `preview-ch-${idx}`,
      number: idx + 1,
      title: ch.title.trim() || `Chapter ${idx + 1}`,
      isPremium: idx === 0 ? false : ch.isPremium,
      panels: ch.panels,
      coinPrice: idx === 0 ? undefined : ch.coinPrice,
    }));

    return {
      id: 'preview-upload',
      slug: 'preview',
      title: title.trim() || 'Untitled Comic',
      author: author.trim() || 'You',
      coverUrl: coverUrl || '',
      coverGallery,
      bannerUrl,
      genres: selectedGenres,
      description: description.trim() || 'A comic uploaded in the Reader.',
      chapters: previewChapters,
      views: 0,
      publishedAt: new Date().toISOString().split('T')[0],
      isAIGenerated: true,
      source: 'user' as const,
      status,
      tags,
      unlockAllPrice,
    };
  };

  const previewComic = buildPreviewComic();

  // Collect current form state for drafts (lightweight, without full binary if possible but we keep data: for resume)
  const collectDraftData = useCallback(() => ({
    title,
    author,
    description,
    selectedGenres,
    tags,
    status,
    unlockAllPrice,
    coverUrl,
    coverGallery,
    bannerUrl,
    chapters: chapters.map(c => ({ ...c })), // includes panels + any thumbnail
  }), [title, author, description, selectedGenres, tags, status, unlockAllPrice, coverUrl, coverGallery, bannerUrl, chapters]);

  // Auto-save draft (debounced via effect)
  useEffect(() => {
    const timer = setTimeout(() => {
      const data = collectDraftData();
      if (data.title || data.coverUrl || data.chapters.some(c => c.panels.length)) {
        saveUploadDraft(DRAFT_KEY, data);
        setAnnounce('Draft auto-saved');
        setTimeout(() => setAnnounce(''), 1200);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [collectDraftData, saveUploadDraft]);

  // Load drafts/history on mount (for UI)
  useEffect(() => {
    const drafts = getUploadDrafts();
    setDraftsList(drafts);
    // optionally load last draft into form if empty and exists (user can override)
  }, [getUploadDrafts]);

  // --- Validation & Publish ---
  const canPublish = () => {
    if (!title.trim() || !coverUrl) return false;
    if (chapters.length === 0) return false;
    return chapters.every((ch, idx) => {
      const hasPanels = ch.panels.length > 0;
      // First chapter must be treated as free
      if (idx === 0) return hasPanels;
      return hasPanels;
    });
  };

  const handlePublish = async () => {
    setError(null);
    if (!canPublish()) {
      setError('Please provide a title, cover, and at least one panel in every chapter.');
      return;
    }
    if (processingProgress) return; // still processing images

    try {
      // Attach advanced fields (gallery, banner) + ensure any missing thumbnails (first panel)
      const chaptersForInput = await Promise.all(chapters.map(async (ch, idx) => {
        let thumb = ch.thumbnail;
        if (!thumb && ch.panels.length > 0) {
          try { thumb = await generateThumbnail(ch.panels[0]); } catch {}
        }
        return {
          title: ch.title.trim() || `Chapter ${idx + 1}`,
          isPremium: idx === 0 ? false : ch.isPremium,
          panels: ch.panels,
          coinPrice: idx === 0 ? undefined : ch.coinPrice,
          // thumbnail will be carried on the final Comic via context publish path
        };
      }));

      const input: PublishComicInput = {
        title: title.trim(),
        author: author.trim() || 'You',
        description: description.trim(),
        genres: selectedGenres,
        coverUrl,
        status,
        tags,
        unlockAllPrice: unlockAllPrice && unlockAllPrice > 0 ? unlockAllPrice : undefined,
        chapters: chaptersForInput as any, // thumbnails attached post-publish in context if needed
      };

      const created = publishComic(input);

      // Attach gallery/banner + thumbnails to the created comic via update (advanced fields)
      if (coverGallery.length > 0 || bannerUrl) {
        // generate any missing chapter thumbs on the real comic
        const finalChapters = await Promise.all(created.chapters.map(async (ch) => {
          if (ch.thumbnail || ch.panels.length === 0) return ch;
          try {
            return { ...ch, thumbnail: await generateThumbnail(ch.panels[0]) };
          } catch { return ch; }
        }));
        updateUploadedComic(created.id, {
          coverGallery: coverGallery.length ? coverGallery : undefined,
          bannerUrl: bannerUrl || undefined,
          chapters: finalChapters,
        } as any);
      }

      // Record to upload history + clear active draft
      recordUploadToHistory(created);
      deleteUploadDraft(DRAFT_KEY);

      // Per UX improvement request: after upload automatically surface the new comic
      // (source:'user' + emerald-style badge) in the homepage lists (newest-first grid etc.).
      // User lands directly on discovery so the new card is immediately visible with its badge.
      router.push('/');
    } catch (e: any) {
      setError(e.message || 'Failed to publish comic. Check console for details.');
    }
  };

  // Keyboard shortcuts for upload form (modern, guarded) — placed after canPublish/handlePublish for declaration order
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') {
        e.preventDefault();
        if (canPublish() && !processingProgress) handlePublish();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const data = collectDraftData();
        saveUploadDraft(DRAFT_KEY, data);
        setAnnounce('Draft saved (Ctrl/Cmd+S)');
        setTimeout(() => setAnnounce(''), 1400);
        return;
      }
      if (isInput && !e.metaKey && !e.ctrlKey) return;

      const k = e.key.toLowerCase();
      if (k === 'a') {
        e.preventDefault();
        addChapter();
        setAnnounce('New chapter added. Focus moved to title.');
        setTimeout(() => {
          const inputs = document.querySelectorAll('input[placeholder^="Chapter"]');
          (inputs[inputs.length - 1] as HTMLInputElement)?.focus();
        }, 50);
      } else if (k === 'p') {
        e.preventDefault();
        const lastAdd = document.querySelectorAll('label:has(input[type="file"])');
        (lastAdd[lastAdd.length - 1] as HTMLElement)?.click?.();
        setAnnounce('Opening panel uploader for last chapter');
      } else if (k === 'c') {
        e.preventDefault();
        const coverLabel = document.querySelector('label:has(input[accept*="image"])');
        (coverLabel as HTMLElement)?.click?.();
        setAnnounce('Cover upload focused');
      } else if (k === '?') {
        setAnnounce('Shortcuts: A=add chapter, P=panels, C=cover, Ctrl+Enter=publish, Ctrl+S=save draft, ?=help');
        setTimeout(() => setAnnounce(''), 2200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addChapter, canPublish, collectDraftData, handlePublish, processingProgress, saveUploadDraft]);

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setDescription('');
    setSelectedGenres([]);
    setTagsInput('');
    setTags([]);
    setStatus('ongoing');
    setUnlockAllPrice(undefined);
    setCoverUrl('');
    setChapters([{ title: 'Chapter 1', isPremium: false, panels: [] }]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] mb-2">
              <ArrowLeft size={16} /> Back to discovery
            </Link>
            <span className="mx-2 text-[var(--text-muted)]">•</span>
            <Link href="/creator" className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300">Creator Dashboard (edit / export)</Link>
            <h1 className="text-3xl font-semibold tracking-tight">Upload New Comic</h1>
            <p className="text-[var(--text-muted)] mt-1">
              Create and publish a comic directly in your browser. Images become data URLs (same as Creator App imports).
            </p>
          </div>
          <button
            onClick={resetForm}
            className="text-xs px-3 py-1.5 rounded border border-[var(--border)] hover:bg-[var(--bg-elev)]"
          >
            Reset form
          </button>
        </div>

        {/* Warning about storage */}
        <div className="mb-6 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">
          <strong>Important:</strong> All images are converted to inline <code>data:</code> URLs and saved in localStorage.
          Use reasonably sized images (ideally &lt;300–500 KB each) to avoid hitting browser storage limits.
          First chapter is <strong>always free</strong> for readers.
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Global processing progress (visible for cover or any chapter batch) */}
        {processingProgress && (
          <div className="mb-4 glass rounded-xl border border-[var(--border)] p-3 text-sm">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-[var(--accent)]">{processingProgress.label}</span>
              <span className="tabular-nums text-[var(--text-muted)]">{processingProgress.current} / {processingProgress.total}</span>
            </div>
            <div className="h-1.5 bg-[var(--bg-elev)] rounded-full overflow-hidden">
              <div
                className="h-1.5 bg-[var(--accent)] transition-all duration-150"
                style={{ width: `${Math.round((processingProgress.current / Math.max(1, processingProgress.total)) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">Optimizing (resize + WebP where supported) to keep localStorage usage reasonable.</div>
          </div>
        )}

        {/* Advanced: Drafts / History + aria live for announcements + shortcuts help */}
        <div className="mb-4 flex items-center gap-3 text-xs">
          <button
            onClick={() => {
              const d = getUploadDrafts();
              setDraftsList(d);
              setShowDrafts(!showDrafts);
            }}
            className="px-3 py-1 rounded border border-[var(--border)] hover:bg-[var(--bg-elev)]"
          >
            {showDrafts ? 'Hide' : 'Show'} Drafts & History ({Object.keys(getUploadDrafts()).length})
          </button>
          <span className="text-[var(--text-muted)]">Keyboard: A=add ch • P=panels • C=cover • Ctrl+Enter=publish • Ctrl+S=draft • ?=help</span>
          <div aria-live="polite" className="sr-only">{announce}</div>
        </div>
        {showDrafts && draftsList && (
          <div className="mb-4 p-3 rounded border border-[var(--border)] bg-[var(--bg-elev)]/60 text-xs max-h-40 overflow-auto">
            {Object.keys(draftsList).length === 0 && <div>No drafts yet. Form changes auto-save.</div>}
            {Object.entries(draftsList as any).map(([k, v]: [string, any]) => (
              <div key={k} className="flex items-center justify-between py-0.5 border-b border-[var(--border)]/50 last:border-0">
                <button onClick={() => {
                  const d = loadUploadDraft(k);
                  if (d) {
                    // load into form
                    setTitle(d.title || '');
                    setAuthor(d.author || '');
                    setDescription(d.description || '');
                    setSelectedGenres(d.selectedGenres || []);
                    setTags(d.tags || []);
                    setStatus(d.status || 'ongoing');
                    setUnlockAllPrice(d.unlockAllPrice);
                    setCoverUrl(d.coverUrl || '');
                    setCoverGallery(d.coverGallery || []);
                    setBannerUrl(d.bannerUrl || '');
                    setChapters(d.chapters || [{ title: 'Chapter 1', isPremium: false, panels: [] }]);
                    setAnnounce(`Loaded draft ${d.title || k}`);
                  }
                  setShowDrafts(false);
                }} className="text-left flex-1 hover:underline">{v.title || k} <span className="text-[var(--text-muted)]">({new Date(v.timestamp).toLocaleDateString()})</span></button>
                <button onClick={() => { deleteUploadDraft(k); setDraftsList(getUploadDrafts()); }} className="text-red-400 px-1">×</button>
              </div>
            ))}
            <div className="mt-1 text-[10px] text-[var(--text-muted)]">Drafts auto-save on changes. History of published uploads available via context too.</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* FORM COLUMN */}
          <div className="lg:col-span-7 space-y-6">
            {/* Comic Details */}
            <div className="glass rounded-2xl p-5 border border-[var(--border)]">
              <div className="font-semibold mb-4 flex items-center gap-2">Comic Details</div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Title *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My Awesome Webtoon"
                    className="w-full rounded-xl bg-[var(--bg-elev)] border border-[var(--border)] px-4 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1">Author</label>
                    <input
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Your name or handle"
                      className="w-full rounded-xl bg-[var(--bg-elev)] border border-[var(--border)] px-4 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1">Status</label>
                    <div className="flex gap-2">
                      {(['ongoing', 'completed'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setStatus(s)}
                          className={`px-3 py-1.5 rounded-xl text-sm border transition ${status === s
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'border-[var(--border)] hover:bg-[var(--bg-elev)]'}`}
                        >
                          {s === 'ongoing' ? 'Ongoing' : 'Completed'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Short synopsis or artist notes..."
                    className="w-full rounded-xl bg-[var(--bg-elev)] border border-[var(--border)] px-4 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] resize-y"
                  />
                </div>

                {/* Genres */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1.5">Genres (select any)</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_GENRES.map(g => {
                      const active = selectedGenres.includes(g);
                      return (
                        <button
                          key={g}
                          onClick={() => toggleGenre(g)}
                          className={`text-xs px-3 py-1 rounded-full border transition ${active
                            ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                            : 'border-[var(--border)] hover:bg-[var(--bg-elev)]'}`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Tags (comma separated)</label>
                  <div className="flex gap-2">
                    <input
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      placeholder="dark, revenge, magic"
                      className="flex-1 rounded-xl bg-[var(--bg-elev)] border border-[var(--border)] px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button onClick={addTag} className="btn-ghost px-4">Add</button>
                  </div>
                  {tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)]">
                          {tag}
                          <button onClick={() => removeTag(tag)} className="text-[var(--text-muted)] hover:text-[var(--text)]"><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unlock all price (optional) */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Unlock All Price (coins, optional — default 60)</label>
                  <input
                    type="number"
                    min={1}
                    value={unlockAllPrice ?? ''}
                    onChange={(e) => setUnlockAllPrice(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    placeholder="60"
                    className="w-32 rounded-xl bg-[var(--bg-elev)] border border-[var(--border)] px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Cover Upload */}
            <div className="glass rounded-2xl p-5 border border-[var(--border)]">
              <div className="font-semibold mb-3 flex items-center gap-2">
                <ImageIcon size={16} /> Cover Image *
              </div>

              {!coverUrl ? (
                <label
                  onDrop={(e) => { e.preventDefault(); setIsDragOverCover(false); handleCoverFiles(e.dataTransfer.files); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => setIsDragOverCover(true)}
                  onDragLeave={() => setIsDragOverCover(false)}
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl py-10 cursor-pointer transition ${isDragOverCover ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 bg-[var(--accent)]/5' : 'border-[var(--border)] hover:border-[var(--accent)]/60'}`}
                >
                  <Upload className="mb-3 text-[var(--text-muted)]" />
                  <div className="text-sm">Drag &amp; drop cover or click to choose</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1">JPG / PNG / WEBP • large files auto-compressed (WebP preferred)</div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleCoverFiles(e.target.files)}
                  />
                </label>
              ) : (
                <div className="relative">
                  <SmartImage
                    src={coverUrl}
                    alt="Cover preview"
                    className="w-full max-h-72 object-contain rounded-xl border border-[var(--border)] bg-black/40"
                  />
                  <button
                    onClick={clearCover}
                    className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                    title="Remove cover"
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={() => document.getElementById('cover-replace-input')?.click()}
                    className="absolute bottom-2 right-2 text-xs px-3 py-1 rounded bg-[var(--bg)]/90 border border-[var(--border)] hover:bg-[var(--bg-elev)]"
                  >
                    Change cover
                  </button>
                  <input id="cover-replace-input" type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverFiles(e.target.files)} />
                </div>
              )}

              {/* Advanced: Cover gallery + Banner */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Cover Gallery (optional additional images)</label>
                  <label className="cursor-pointer inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-[var(--border)] hover:bg-[var(--bg-elev)]">
                    <Upload size={14} /> Add to gallery (multi)
                    <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
                      const fs = e.target.files;
                      if (!fs) return;
                      const { valid } = filterValidImageFiles(fs, 0);
                      if (valid.length) {
                        setProcessingProgress({ current: 0, total: valid.length, label: 'Optimizing gallery images...' });
                        const urls = await processImageFiles(valid, (c,t) => setProcessingProgress(p => p ? {...p, current:c} : null));
                        setCoverGallery(prev => [...prev, ...urls]);
                        setProcessingProgress(null);
                      }
                    }} />
                  </label>
                  {coverGallery.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {coverGallery.map((g, gi) => (
                        <div key={gi} className="relative w-12 h-12 rounded overflow-hidden border border-[var(--border)]">
                          <img src={g} className="w-full h-full object-cover" alt="" />
                          <button onClick={() => setCoverGallery(prev => prev.filter((_,i)=>i!==gi))} className="absolute top-0 right-0 bg-black/70 text-white p-0.5"><X size={10}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Banner / Hero image (optional)</label>
                  {!bannerUrl ? (
                    <label className="cursor-pointer inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-[var(--border)] hover:bg-[var(--bg-elev)]">
                      <Upload size={14} /> Upload banner
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
                        const fs = e.target.files;
                        if (!fs?.[0]) return;
                        setProcessingProgress({ current: 0, total: 1, label: 'Optimizing banner...' });
                        const [url] = await processImageFiles([fs[0]]);
                        setBannerUrl(url);
                        setProcessingProgress(null);
                      }} />
                    </label>
                  ) : (
                    <div className="relative">
                      <img src={bannerUrl} className="w-full h-20 object-cover rounded border border-[var(--border)]" alt="banner" />
                      <button onClick={() => setBannerUrl('')} className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded"><X size={12}/></button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chapters */}
            <div className="glass rounded-2xl p-5 border border-[var(--border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold">Chapters</div>
                <button onClick={addChapter} className="flex items-center gap-1.5 text-sm btn-ghost px-3 py-1.5 rounded-xl">
                  <Plus size={16} /> Add chapter
                </button>
              </div>

              <div className="space-y-4">
                <AnimatePresence>
                  {chapters.map((ch, idx) => {
                    const isFirst = idx === 0;
                    const premium = isFirst ? false : ch.isPremium;

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]/60 p-4"
                      >
                        <div className="flex items-start gap-3">
                          {/* Chapter header controls */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Chapter {idx + 1}</span>
                              {isFirst && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">FREE — always unlocked</span>
                              )}
                            </div>

                            <input
                              value={ch.title}
                              onChange={(e) => updateChapterTitle(idx, e.target.value)}
                              placeholder={`Chapter ${idx + 1}`}
                              className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5 text-sm mb-3"
                            />

                            {/* Premium controls (disabled for first chapter) */}
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={premium}
                                  disabled={isFirst}
                                  onChange={() => toggleChapterPremium(idx)}
                                  className="accent-[var(--accent)]"
                                />
                                <span className={isFirst ? 'text-[var(--text-muted)]' : ''}>
                                  Premium chapter
                                </span>
                              </label>

                              {premium && !isFirst && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-[var(--text-muted)]">Price</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={ch.coinPrice ?? 10}
                                    onChange={(e) => updateChapterCoinPrice(idx, e.target.value)}
                                    className="w-20 rounded bg-[var(--bg)] border border-[var(--border)] px-2 py-0.5 text-sm"
                                  />
                                  <span className="text-xs text-[var(--text-muted)]">coins</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Reorder / delete */}
                          <div className="flex flex-col gap-1 pt-1">
                            <button
                              onClick={() => moveChapter(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 rounded hover:bg-[var(--bg)] disabled:opacity-30"
                              title="Move up"
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              onClick={() => moveChapter(idx, 1)}
                              disabled={idx === chapters.length - 1}
                              className="p-1 rounded hover:bg-[var(--bg)] disabled:opacity-30"
                              title="Move down"
                            >
                              <ArrowDown size={15} />
                            </button>
                            <button
                              onClick={() => removeChapter(idx)}
                              disabled={chapters.length <= 1}
                              className="p-1 rounded text-red-400 hover:bg-red-950/40 disabled:opacity-30 mt-1"
                              title="Remove chapter"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Panels dropzone + thumbnails (improved: dnd highlight, reorder via drag, progress, validation) */}
                        <div
                          onDrop={(e) => handleChapterPanelDrop(idx, e)}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                          onDragEnter={() => setDragOverChapter(idx)}
                          onDragLeave={() => setDragOverChapter(null)}
                          className={`mt-3 border border-dashed rounded-xl p-3 min-h-[92px] bg-[var(--bg)]/60 transition-all ${dragOverChapter === idx ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 bg-[var(--accent)]/5' : 'border-[var(--border)]'}`}
                        >
                          <div className="flex items-center justify-between mb-2 text-xs text-[var(--text-muted)]">
                            <span>
                              Panels ({ch.panels.length}{ch.panels.length >= MAX_PANELS_PER_CHAPTER ? ' — MAX' : ''})
                              — drop to add or drag thumbnails to reorder
                            </span>
                            <div className="flex gap-2">
                              <label className="cursor-pointer underline-offset-2 hover:underline">
                                Add panels
                                <input
                                  type="file"
                                  multiple
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => handleChapterPanelFiles(idx, e.target.files)}
                                />
                              </label>
                              {ch.panels.length > 0 && (
                                <button onClick={() => clearChapterPanels(idx)} className="text-red-400 hover:text-red-300">Clear</button>
                              )}
                            </div>
                          </div>

                          {/* Per-chapter processing progress */}
                          {processingProgress && (
                            <div className="mb-2 text-[10px] text-[var(--accent)] flex items-center gap-2">
                              <div className="flex-1 h-1 bg-[var(--bg)] rounded overflow-hidden">
                                <div
                                  className="h-1 bg-[var(--accent)] transition-all"
                                  style={{ width: `${Math.round((processingProgress.current / processingProgress.total) * 100)}%` }}
                                />
                              </div>
                              <span>{processingProgress.label} ({processingProgress.current}/{processingProgress.total})</span>
                            </div>
                          )}

                          {ch.panels.length === 0 ? (
                            <div className="text-center py-3 text-xs text-[var(--text-muted)]">
                              No panels yet. Drag images here or click “Add panels”. Max {MAX_PANELS_PER_CHAPTER}.
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                              {ch.panels.map((p, pIdx) => (
                                <div
                                  key={pIdx}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', pIdx.toString());
                                    e.dataTransfer.effectAllowed = 'move';
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                    if (!isNaN(from) && from !== pIdx) {
                                      reorderPanels(idx, from, pIdx);
                                    }
                                  }}
                                  className="relative group aspect-[3/4] overflow-hidden rounded-lg border border-[var(--border)] bg-black/30 cursor-grab active:cursor-grabbing active:scale-[0.985] transition"
                                  title="Drag to reorder panels"
                                >
                                  <img
                                    src={p}
                                    alt={`Panel ${pIdx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    onClick={() => removePanel(idx, pIdx)}
                                    className="absolute top-1 right-1 hidden group-hover:block rounded bg-black/70 p-0.5 text-white hover:bg-red-600"
                                    title="Remove panel"
                                  >
                                    <X size={12} />
                                  </button>
                                  <div className="absolute bottom-1 left-1 text-[9px] px-1 rounded bg-black/60 text-white/90 tabular-nums">
                                    {pIdx + 1}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {ch.panels.length > 0 && ch.panels.length < MAX_PANELS_PER_CHAPTER && (
                            <div className="mt-1 text-[9px] text-[var(--text-muted)]">Tip: Drag the thumbnails to change reading order.</div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <div className="mt-3 text-[10px] text-[var(--text-muted)]">
                Tip: The very first chapter is always marked free. Readers can start reading immediately.
              </div>
            </div>
          </div>

          {/* PREVIEW + ACTIONS COLUMN */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Preview</div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs px-3 py-1 rounded border border-[var(--border)] hover:bg-[var(--bg-elev)]"
              >
                {showPreview ? 'Hide' : 'Show'} preview
              </button>
            </div>

            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs px-3 py-1 rounded border border-[var(--border)] hover:bg-[var(--bg-elev)]"
              >
                {showPreview ? 'Hide' : 'Show'} form preview
              </button>
              <button
                onClick={() => setShowReaderPreview(!showReaderPreview)}
                disabled={!canPublish()}
                className="text-xs px-3 py-1 rounded border border-[var(--accent)]/70 text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50"
                title="Preview this comic in a reader view before publishing (robust upload flow)"
              >
                {showReaderPreview ? 'Hide' : 'Preview in Reader'}
              </button>
            </div>

            <AnimatePresence>
              {showPreview && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass rounded-2xl p-4 border border-[var(--border)]"
                >
                  {/* Mini comic card style preview */}
                  <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-card)]">
                    {coverUrl ? (
                      <SmartImage src={coverUrl} alt="cover" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="h-40 bg-[var(--bg-elev)] flex items-center justify-center text-[var(--text-muted)] text-sm">No cover yet</div>
                    )}
                    <div className="p-3">
                      <div className="font-medium truncate">{previewComic.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">{previewComic.author} • {previewComic.chapters.length} chapter{previewComic.chapters.length === 1 ? '' : 's'}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {previewComic.genres.slice(0, 3).map(g => (
                          <span key={g} className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)]">{g}</span>
                        ))}
                        {previewComic.source === 'user' && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">Your upload</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Chapter summary */}
                  <div className="mt-3 text-xs">
                    <div className="text-[var(--text-muted)] mb-1.5">Chapters preview</div>
                    <ul className="space-y-1 text-[var(--text)]">
                      {previewComic.chapters.map((ch, i) => (
                        <li key={i} className="flex items-center justify-between rounded px-2 py-1 bg-[var(--bg)]/60 border border-[var(--border)]/60">
                          <span className="truncate">Ch.{ch.number} — {ch.title}</span>
                          <span className={ch.isPremium ? 'text-amber-400' : 'text-emerald-400'}>
                            {ch.isPremium ? `Premium${ch.coinPrice ? ` • ${ch.coinPrice}` : ''}` : 'Free'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Robust upload preview reader (inline simple vertical view using existing SmartImage + draft data). Highest priority for "preview reader" in upload flow. */}
            <AnimatePresence>
              {showReaderPreview && canPublish() && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 glass rounded-2xl border border-[var(--border)] p-3 max-h-[60vh] overflow-auto"
                >
                  <div className="text-xs font-medium mb-2 flex items-center justify-between">
                    <span>Reader Preview (draft — vertical, first chapter free on publish)</span>
                    <button onClick={() => setShowReaderPreview(false)} className="text-[var(--text-muted)]">Close</button>
                  </div>
                  <div className="space-y-2">
                    {previewComic.chapters[0] && previewComic.chapters[0].panels.slice(0, 8).map((url, idx) => ( // limit for perf in preview
                      <div key={idx} className="flex justify-center">
                        <SmartImage 
                          src={url} 
                          alt={`Preview panel ${idx + 1}`} 
                          className="max-w-full w-auto max-h-[70vh] rounded shadow" 
                        />
                      </div>
                    ))}
                    {previewComic.chapters[0] && previewComic.chapters[0].panels.length > 8 && (
                      <div className="text-center text-xs text-[var(--text-muted)]">... (more panels in full reader after publish)</div>
                    )}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-2">This uses the same rendering as the published reader. Publish to save and read full with progress/comments etc.</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="sticky bottom-4 z-10">
              <button
                onClick={handlePublish}
                disabled={!canPublish() || !!processingProgress}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-3 font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.985] transition"
              >
                <Check size={18} />
                {processingProgress ? 'Processing images…' : 'Publish to My Library'}
              </button>
              <div className="text-center mt-2 text-[10px] text-[var(--text-muted)]">
                This will save the comic locally using the same storage as Creator imports.
              </div>
            </div>

            <div className="text-[10px] text-[var(--text-muted)] px-1">
              After publishing you can read it immediately (first chapter free), unlock premium chapters with coins, bookmark, download as ZIP, etc.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
