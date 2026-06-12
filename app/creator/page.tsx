"use client";

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Download, Trash2, X, Upload, ArrowLeft, Check, ArrowUp, ArrowDown
} from 'lucide-react';
import { useComics } from '../lib/ComicsContext';
import { Genre, PublishComicInput, Comic, Chapter } from '../lib/types';
import { SmartImage } from '../components/SmartImage';
import {
  MAX_PANELS_PER_CHAPTER,
  filterValidImageFiles,
  processImageFiles,
  checkFileSizeWarnings,
  formatBytes,
} from '../lib/uploadUtils';
import { useUser } from '../lib/UserContext';
import { uploadComicMediaToStorage, prepareMediaForUpload } from '../lib/supabase/storage';
import { getSupabaseBrowserClient } from '../lib/supabase/client';
import DropZone from '../components/DropZone';
import { UploadProgress } from '../components/UploadProgress';
import { publishPublicComic } from '../actions/publish-public';

const ALL_GENRES: Genre[] = [
  "Fantasy", "Romance", "Action", "Mystery", "Sci-Fi",
  "Horror", "Comedy", "Drama", "Thriller", "Slice of Life"
];

type EditDraft = {
  title: string;
  author: string;
  description: string;
  genres: Genre[];
  status: 'ongoing' | 'completed';
  tags: string[];
  unlockAllPrice?: number;
  chapters: Chapter[]; // working copy (with current data: panels + optional thumbnail)
  coverGallery?: string[];
  bannerUrl?: string;
  isPublic?: boolean;
};

export default function CreatorDashboard() {
  const {
    getMyUploadedComics,
    updateUploadedComic,
    addChaptersToUploadedComic,
    removePublishedComic,
    getComicBySlug,
    ingestPublicComic,
  } = useComics();

  const { user } = useUser();

  const myComics = getMyUploadedComics();

  const isOwnerOf = (comic: any) => {
    if (!user) return false;
    if (comic.owner_id) return user.id === comic.owner_id;
    // legacy local
    return comic.source === 'user' || comic.id.startsWith('pub-');
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Open editor for a comic (deep copy chapters for safe editing)
  const openEditor = (comic: Comic) => {
    setEditingId(comic.id);
    setEditDraft({
      title: comic.title,
      author: comic.author,
      description: comic.description,
      genres: [...(comic.genres || [])],
      status: comic.status || 'ongoing',
      tags: [...(comic.tags || [])],
      unlockAllPrice: comic.unlockAllPrice,
      chapters: comic.chapters.map(ch => ({ ...ch, panels: [...ch.panels] })), // deep enough for our needs
      coverGallery: comic.coverGallery ? [...comic.coverGallery] : [],
      bannerUrl: comic.bannerUrl || '',
      isPublic: (comic as any).isPublic || false,
    });
    setError(null);
    setSuccess(null);
  };

  const closeEditor = () => {
    setEditingId(null);
    setEditDraft(null);
    setProcessingProgress(null);
    setError(null);
  };

  // Metadata helpers
  const updateDraftMeta = (patch: Partial<EditDraft>) => {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, ...patch });
  };

  const toggleGenre = (g: Genre) => {
    if (!editDraft) return;
    const next = editDraft.genres.includes(g)
      ? editDraft.genres.filter(x => x !== g)
      : [...editDraft.genres, g];
    updateDraftMeta({ genres: next });
  };

  // Chapter editing (existing)
  const updateChapterTitle = (chIdx: number, title: string) => {
    if (!editDraft) return;
    const chapters = [...editDraft.chapters];
    chapters[chIdx] = { ...chapters[chIdx], title };
    updateDraftMeta({ chapters });
  };

  const toggleChapterPremium = (chIdx: number) => {
    if (!editDraft || chIdx === 0) return; // first always free
    const chapters = [...editDraft.chapters];
    const ch = chapters[chIdx];
    const nextPremium = !ch.isPremium;
    chapters[chIdx] = {
      ...ch,
      isPremium: nextPremium,
      coinPrice: nextPremium ? (ch.coinPrice ?? 10) : undefined,
    };
    updateDraftMeta({ chapters });
  };

  const updateChapterPrice = (chIdx: number, price: number) => {
    if (!editDraft || chIdx === 0) return;
    const chapters = [...editDraft.chapters];
    chapters[chIdx] = { ...chapters[chIdx], coinPrice: Math.max(1, price) };
    updateDraftMeta({ chapters });
  };

  const removeChapter = (chIdx: number) => {
    if (!editDraft || editDraft.chapters.length <= 1) return;
    const chapters = editDraft.chapters.filter((_, i) => i !== chIdx);
    // Renumber
    const renumbered = chapters.map((ch, i) => ({ ...ch, number: i + 1 }));
    updateDraftMeta({ chapters: renumbered });
  };

  const moveChapter = (chIdx: number, dir: -1 | 1) => {
    if (!editDraft) return;
    const newIdx = chIdx + dir;
    if (newIdx < 0 || newIdx >= editDraft.chapters.length) return;
    const chapters = [...editDraft.chapters];
    [chapters[chIdx], chapters[newIdx]] = [chapters[newIdx], chapters[chIdx]];
    const renumbered = chapters.map((ch, i) => ({ ...ch, number: i + 1 }));
    updateDraftMeta({ chapters: renumbered });
  };

  // Panel management for an existing chapter in the draft
  const removePanelFromChapter = (chIdx: number, pIdx: number) => {
    if (!editDraft) return;
    const chapters = [...editDraft.chapters];
    const ch = chapters[chIdx];
    chapters[chIdx] = { ...ch, panels: ch.panels.filter((_, i) => i !== pIdx) };
    updateDraftMeta({ chapters });
  };

  const addPanelsToExistingChapter = async (chIdx: number, files: FileList | null) => {
    if (!editDraft || !files || files.length === 0) return;
    setError(null);

    const { oversized } = checkFileSizeWarnings(files);
    if (oversized.length) {
      setError(`File too large (${formatBytes(oversized[0].size)}). Max supported ${formatBytes(5 * 1024 * 1024)}.`);
      return;
    }

    const currentCount = editDraft.chapters[chIdx]?.panels.length || 0;
    const { valid: toProcess, skippedCount, wouldExceed } = filterValidImageFiles(files, currentCount);

    if (skippedCount > 0) setError(`Skipped ${skippedCount} non-image file(s).`);
    if (toProcess.length === 0) {
      if (wouldExceed) setError(`Chapter at max ${MAX_PANELS_PER_CHAPTER} panels.`);
      return;
    }

    setProcessingProgress({ current: 0, total: toProcess.length, label: `Adding panels to chapter ${chIdx + 1}...` });

    try {
      const newUrls = await processImageFiles(toProcess, (cur) => {
        setProcessingProgress(p => p ? { ...p, current: cur } : null);
      });

      const chapters = [...editDraft.chapters];
      const ch = chapters[chIdx];
      chapters[chIdx] = { ...ch, panels: [...ch.panels, ...newUrls] };
      updateDraftMeta({ chapters });
    } catch (e: any) {
      setError(e.message || 'Failed to add panels');
    } finally {
      setProcessingProgress(null);
    }
  };

  // Bulk: Add a completely new chapter (with its own panels) to the draft
  // This supports "bulk chapter upload" by letting the user add multiple new chapters sequentially.
  const [bulkNewChapterTitle, setBulkNewChapterTitle] = useState('');
  const [bulkNewChapterFiles, setBulkNewChapterFiles] = useState<File[]>([]);

  const addBulkNewChapter = async () => {
    if (!editDraft) return;
    if (!bulkNewChapterTitle.trim() && bulkNewChapterFiles.length === 0) return;

    const currentCount = editDraft.chapters.length;
    const { valid: toProcess } = filterValidImageFiles(bulkNewChapterFiles as any, 0); // new ch starts at 0

    if (bulkNewChapterFiles.length > 0 && toProcess.length === 0) {
      setError('No valid images for the new chapter.');
      return;
    }

    setProcessingProgress({ current: 0, total: Math.max(1, toProcess.length), label: 'Preparing new chapter...' });

    let panels: string[] = [];
    if (toProcess.length > 0) {
      try {
        panels = await processImageFiles(toProcess, (cur, tot) => {
          setProcessingProgress(p => p ? { ...p, current: cur, total: tot } : null);
        });
      } catch (e: any) {
        setError(e.message || 'Failed to process images for new chapter');
        setProcessingProgress(null);
        return;
      }
    }

    const newCh: Chapter = {
      id: `pub-ch-${Date.now()}`,
      number: currentCount + 1,
      title: bulkNewChapterTitle.trim() || `Chapter ${currentCount + 1}`,
      isPremium: true,
      panels,
      coinPrice: 10,
    };

    const chapters = [...editDraft.chapters, newCh];
    updateDraftMeta({ chapters });

    // reset bulk adder
    setBulkNewChapterTitle('');
    setBulkNewChapterFiles([]);
    setProcessingProgress(null);
  };

  // Save the edit (full replace of the comic data for this user upload)
  const saveEdit = async () => {
    if (!editingId || !editDraft) return;
    setError(null);
    setProcessingProgress(null);

    // Enforce first-chapter-free invariant on save
    const chaptersForSave: Chapter[] = editDraft.chapters.map((ch, idx) => ({
      ...ch,
      number: idx + 1,
      isPremium: idx === 0 ? false : ch.isPremium,
      coinPrice: idx === 0 ? undefined : ch.coinPrice,
    }));

    try {
      if (editDraft.isPublic && user) {
        // Public migration path: upload (any remaining data:) + secure server action insert
        setProcessingProgress({ current: 0, total: 1, label: 'Uploading to cloud for public...' });

        const media = prepareMediaForUpload(
          '', // cover: reuse existing https or first panel if needed; Storage handles only data:
          chaptersForSave.map((c, i) => ({ number: i + 1, panels: c.panels }))
        );

        const comicSlug = (editDraft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "comic") + "-pubedit-" + Date.now().toString(36);
        const urlMap = media.length > 0
          ? await uploadComicMediaToStorage(user.id, comicSlug, media, (u, t) => setProcessingProgress({ current: u, total: t, label: `Uploading assets (${u}/${t})` }))
          : {};

        const origComic = myComics.find(c => c.id === editingId);
        const finalCover = (origComic?.coverUrl && !origComic.coverUrl.startsWith('data:')) ? origComic.coverUrl : (chaptersForSave[0]?.panels?.[0] || '');

        setProcessingProgress({ current: 1, total: 1, label: 'Saving public comic...' });

        console.log('[creator] calling publishPublicComic with editDraft.isPublic=', editDraft.isPublic);
        const inserted = await publishPublicComic({
          slug: comicSlug,
          title: editDraft.title.trim(),
          author: editDraft.author.trim() || "You",
          description: editDraft.description.trim(),
          coverUrl: finalCover,
          genres: editDraft.genres,
          tags: editDraft.tags,
          status: editDraft.status,
          unlockAllPrice: editDraft.unlockAllPrice,
          isPublic: editDraft.isPublic ?? true,
          chapters: chaptersForSave.map((ch, i) => ({
            number: i + 1,
            title: ch.title,
            isPremium: ch.isPremium,
            coinPrice: ch.coinPrice,
            panels: ch.panels.map((p, pi) => urlMap[`ch${i + 1}-p${pi}`] || p),
          })),
        });

        const normalized: Comic = {
          id: (inserted as any).id || comicSlug,
          slug: (inserted as any).slug || comicSlug,
          title: editDraft.title.trim(),
          author: editDraft.author.trim() || "You",
          coverUrl: finalCover,
          genres: editDraft.genres,
          description: editDraft.description.trim(),
          chapters: chaptersForSave.map((ch, i) => ({ ...ch, panels: ch.panels.map((p, pi) => urlMap[`ch${i + 1}-p${pi}`] || p) })),
          views: 0,
          publishedAt: new Date().toISOString().split("T")[0],
          isAIGenerated: true,
          source: "user",
          status: editDraft.status,
          tags: editDraft.tags,
          unlockAllPrice: editDraft.unlockAllPrice,
          isPublic: true,
          owner_id: user?.id,
        };
        ingestPublicComic(normalized);

        setProcessingProgress(null);
        setSuccess("Published publicly (cloud). Visible in Library + Discover.");
        setTimeout(() => { closeEditor(); setSuccess(null); }, 1100);
        return;
      }

      // Normal local private save
      updateUploadedComic(editingId, {
        title: editDraft.title.trim(),
        author: editDraft.author.trim() || 'You',
        description: editDraft.description.trim(),
        genres: editDraft.genres,
        status: editDraft.status,
        tags: editDraft.tags,
        unlockAllPrice: editDraft.unlockAllPrice,
        chapters: chaptersForSave,
        coverGallery: editDraft.coverGallery && editDraft.coverGallery.length ? editDraft.coverGallery : undefined,
        bannerUrl: editDraft.bannerUrl || undefined,
        // @ts-ignore carry flag for display
        isPublic: editDraft.isPublic || false,
      } as any);

      setSuccess('Changes saved. The comic is updated everywhere (lists, reader, etc.).');
      setTimeout(() => {
        closeEditor();
        setSuccess(null);
      }, 1200);
    } catch (e: any) {
      setError(e.message || 'Failed to save changes');
      setProcessingProgress(null);
    }
  };

  // Export current (or edited) comic as inkforg_apexpanel-compatible JSON
  const exportComic = (comic: Comic) => {
    const exportData = {
      id: comic.id,
      title: comic.title,
      author: comic.author,
      genre: comic.genres?.[0] || '',
      description: comic.description,
      coverUrl: comic.coverUrl,
      chapters: comic.chapters.map((ch) => ({
        number: ch.number,
        title: ch.title,
        panels: ch.panels,
        coinPrice: ch.coinPrice,
      })),
      publishedAt: comic.publishedAt,
      unlockAllPrice: comic.unlockAllPrice,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${comic.slug || comic.id}-creator-export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSuccess('Exported. You can paste this JSON into the Creator Bridge Tools on the homepage or share with inkforg_apexpanel.');
    setTimeout(() => setSuccess(null), 2500);
  };

  // Delete (reuses existing) - strict owner only via UI, with confirm + toast
  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Permanently delete "${title}"?\n\nThis action cannot be undone and will remove it from your library.`)) return;
    removePublishedComic(id);
    // Success toast
    const toast = document.createElement("div");
    toast.className = "fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2 text-sm text-white shadow-lg z-[100]";
    toast.textContent = "Comic deleted successfully.";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] mb-1">
              <ArrowLeft size={16} /> Back to discovery
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight">Creator Upload Dashboard</h1>
            <p className="text-[var(--text-muted)]">Manage comics you created locally with the upload tool. All data stays in your browser.</p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--accent)]/70 px-4 py-2 text-sm hover:bg-[var(--accent)]/10"
          >
            <Plus size={16} /> New Upload
          </Link>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-400">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-400">{success}</div>}

        {/* My Uploads List */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium">My Uploaded Comics ({myComics.length})</div>
          <div className="text-xs text-[var(--text-muted)]">Source: local uploads (editable). Creator imports are managed in the bridge tools on the homepage.</div>
        </div>

        {myComics.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center border border-[var(--border)]">
            <p className="text-[var(--text-muted)]">No local uploads yet.</p>
            <Link href="/upload" className="mt-4 inline-block text-[var(--accent)] hover:underline">Create your first comic →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myComics.map((comic) => (
              <div key={comic.id} className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
                <div className="relative h-40 bg-[var(--bg-elev)]">
                  <SmartImage src={comic.coverUrl} alt={comic.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    {isOwnerOf(comic) && (
                      <>
                        <button
                          onClick={() => openEditor(comic)}
                          className="p-1.5 rounded bg-black/70 text-white hover:bg-[var(--accent)]"
                          title="Edit this comic"
                        >
                          <Edit2 size={14} />
                        </button>
                        {! (comic as any).isPublic && user && (
                          <button
                            onClick={async () => {
                              // Quick "make public" from list (uploads current data: + inserts)
                              if (!confirm(`Publish "${comic.title}" publicly? This will upload images to cloud and make it visible to other logged-in users.`)) return;
                              // Reuse the open + immediate save public path by forcing the flag
                              const draft = { ...comic, isPublic: true } as any;
                              setEditingId(comic.id);
                              setEditDraft({
                                title: comic.title,
                                author: comic.author,
                                description: comic.description,
                                genres: [...(comic.genres || [])],
                                status: comic.status || 'ongoing',
                                tags: [...(comic.tags || [])],
                                unlockAllPrice: comic.unlockAllPrice,
                                chapters: comic.chapters.map(ch => ({ ...ch, panels: [...ch.panels] })),
                                coverGallery: (comic as any).coverGallery || [],
                                bannerUrl: (comic as any).bannerUrl || '',
                                isPublic: true,
                              });
                              // Trigger save immediately (the saveEdit now handles the public branch)
                              // Small delay so state settles
                              setTimeout(() => { saveEdit(); }, 50);
                            }}
                            className="p-1.5 rounded bg-emerald-600/80 text-white hover:bg-emerald-600 text-[10px]"
                            title="Publish publicly (upload + share)"
                          >
                            Pub
                          </button>
                        )}
                        <button
                          onClick={() => exportComic(comic)}
                          className="p-1.5 rounded bg-black/70 text-white hover:bg-emerald-600"
                          title="Export as JSON (for inkforg_apexpanel)"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(comic.id, comic.title)}
                          className="p-1.5 rounded bg-black/70 text-white hover:bg-red-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  <div className="font-semibold line-clamp-1">{comic.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">{comic.author} • {comic.chapters.length} chapters</div>
                  <div className="mt-1 flex gap-2 text-[10px]">
                    <span className="genre-pill">{comic.status || 'ongoing'}</span>
                    <span className="text-[var(--text-muted)]">{comic.chapters.filter(c => !c.isPremium).length} free</span>
                    {comic.source === 'user' && <span className="text-emerald-400">• Your upload</span>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {isOwnerOf(comic) && (
                      <button onClick={() => openEditor(comic)} className="text-xs flex-1 rounded border border-[var(--border)] py-1 hover:bg-[var(--bg-elev)]">Edit</button>
                    )}
                    <button onClick={() => exportComic(comic)} className="text-xs flex-1 rounded border border-[var(--border)] py-1 hover:bg-[var(--bg-elev)]">Export JSON</button>
                    {isOwnerOf(comic) && (
                      <button 
                        onClick={() => {
                          // Publish toggle for user-created comics (persisted via updateUploadedComic; affects "My" visibility emphasis and can be used by filters)
                          // Use a custom flag to avoid clashing with status enum (ongoing/completed)
                          const currentlyPublished = !(comic as any).isDraft;
                          updateUploadedComic(comic.id, { isDraft: !currentlyPublished } as any);
                          // In real use this could drive a isPublished flag or main list filtering
                        }} 
                        className="text-xs px-2 rounded border border-[var(--border)] hover:bg-[var(--bg-elev)]"
                        title="Toggle whether this appears as 'published' in discovery / My Library emphasis (user comics only)"
                      >
                        {(comic as any).isDraft ? 'Publish' : 'Unpublish'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Modal */}
        <AnimatePresence>
          {editingId && editDraft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
                className="w-full max-w-4xl max-h-[92vh] overflow-auto rounded-3xl glass border border-[var(--border)] bg-[var(--bg-elev)] p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-[var(--text-muted)]">Editing</div>
                    <div className="text-xl font-semibold">{editDraft.title || 'Untitled'}</div>
                  </div>
                  <button onClick={closeEditor} className="p-2"><X /></button>
                </div>

                {/* Metadata Editor */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs block mb-1 text-[var(--text-muted)]">Title</label>
                    <input value={editDraft.title} onChange={e => updateDraftMeta({ title: e.target.value })} className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-3 py-2" />
                  </div>
                  <div>
                    <label className="text-xs block mb-1 text-[var(--text-muted)]">Author</label>
                    <input value={editDraft.author} onChange={e => updateDraftMeta({ author: e.target.value })} className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-3 py-2" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs block mb-1 text-[var(--text-muted)]">Description</label>
                    <textarea value={editDraft.description} onChange={e => updateDraftMeta({ description: e.target.value })} rows={2} className="w-full rounded-xl bg-[var(--bg)] border border-[var(--border)] px-3 py-2" />
                  </div>

                  <div>
                    <label className="text-xs block mb-1.5 text-[var(--text-muted)]">Status</label>
                    <div className="flex gap-2">
                      {(['ongoing', 'completed'] as const).map(s => (
                        <button key={s} onClick={() => updateDraftMeta({ status: s })} className={`px-3 py-1 rounded text-sm border ${editDraft.status === s ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)]'}`}>{s}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs block mb-1 text-[var(--text-muted)]">Unlock All Price (optional)</label>
                    <input type="number" value={editDraft.unlockAllPrice ?? ''} onChange={e => updateDraftMeta({ unlockAllPrice: e.target.value ? parseInt(e.target.value) : undefined })} className="w-32 rounded bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5" />
                  </div>

                  {/* Visibility toggle for public/private (same semantics as /upload) */}
                  <div>
                    <label className="text-xs block mb-1 text-[var(--text-muted)]">Visibility</label>
                    <div className="flex gap-2 text-xs">
                      <button type="button" onClick={() => updateDraftMeta({ isPublic: false })} className={`px-2 py-0.5 rounded border ${!editDraft.isPublic ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)]'}`}>Private</button>
                      <button type="button" onClick={() => updateDraftMeta({ isPublic: true })} disabled={!user} className={`px-2 py-0.5 rounded border ${editDraft.isPublic ? 'border-emerald-500 bg-emerald-500/10' : 'border-[var(--border)]'}`}>Public</button>
                    </div>
                    {editDraft.isPublic && !user && <div className="text-[10px] text-red-400">Sign in to make public.</div>}
                  </div>

                  {/* Advanced: gallery/banner quick support in edit */}
                  <div className="md:col-span-2 text-xs text-[var(--text-muted)]">
                    Gallery images: {editDraft.coverGallery?.length || 0} • Banner: {editDraft.bannerUrl ? 'set' : 'none'}
                    <button onClick={() => updateDraftMeta({ coverGallery: [], bannerUrl: '' })} className="ml-2 underline">clear advanced images</button>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs block mb-1.5 text-[var(--text-muted)]">Genres</label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_GENRES.map(g => (
                        <button key={g} onClick={() => toggleGenre(g)} className={`text-xs px-3 py-1 rounded-full border ${editDraft.genres.includes(g) ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)]'}`}>{g}</button>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs block mb-1 text-[var(--text-muted)]">Tags (comma or enter)</label>
                    <input
                      value={editDraft.tags.join(', ')}
                      onChange={e => updateDraftMeta({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                      className="w-full rounded bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5 text-sm"
                      placeholder="dark, magic, revenge"
                    />
                  </div>
                </div>

                {/* Chapters Editor */}
                <div className="mb-4">
                  <div className="font-semibold mb-2">Chapters (first is always free)</div>

                  <div className="space-y-3 mb-4">
                    {editDraft.chapters.map((ch, idx) => {
                      const isFirst = idx === 0;
                      const premium = isFirst ? false : ch.isPremium;
                      return (
                        <div
                          key={idx}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('text/chidx', String(idx)); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const from = parseInt(e.dataTransfer.getData('text/chidx'), 10);
                            if (!isNaN(from) && from !== idx && editDraft) {
                              const chapters = [...editDraft.chapters];
                              const [m] = chapters.splice(from, 1);
                              chapters.splice(idx, 0, m);
                              updateDraftMeta({ chapters: chapters.map((c, i) => ({ ...c, number: i + 1 })) });
                            }
                          }}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/60 p-3 cursor-grab active:cursor-grabbing"
                          title="Drag to reorder chapters"
                        >
                          <div className="flex gap-3 items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-[var(--text-muted)]">Ch. {ch.number}</span>
                                {isFirst && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">FREE</span>}
                              </div>
                              <input value={ch.title} onChange={e => updateChapterTitle(idx, e.target.value)} className="w-full rounded bg-[var(--bg-elev)] border border-[var(--border)] px-2 py-1 text-sm mb-2" />

                              <div className="flex flex-wrap items-center gap-3 text-sm">
                                <label className="flex items-center gap-2">
                                  <input type="checkbox" checked={premium} disabled={isFirst} onChange={() => toggleChapterPremium(idx)} className="accent-[var(--accent)]" />
                                  <span>Premium</span>
                                </label>
                                {premium && !isFirst && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span>Price</span>
                                    <input type="number" value={ch.coinPrice ?? 10} onChange={e => updateChapterPrice(idx, parseInt(e.target.value) || 10)} className="w-20 rounded bg-[var(--bg)] border px-2 py-0.5" />
                                    <span>coins</span>
                                  </div>
                                )}
                              </div>

                              {/* Current panels for this ch */}
                              <div className="mt-2">
                                <div className="text-[10px] text-[var(--text-muted)] mb-1">Panels ({ch.panels.length}) — drag not supported here; use add/remove</div>
                                {ch.panels.length > 0 && (
                                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                                    {ch.panels.map((p, pIdx) => (
                                      <div key={pIdx} className="relative aspect-[3/4] rounded overflow-hidden border border-[var(--border)] bg-black/30">
                                        <img src={p} alt="" className="w-full h-full object-cover" />
                                        <button onClick={() => removePanelFromChapter(idx, pIdx)} className="absolute top-0.5 right-0.5 bg-black/70 rounded p-0.5 text-white"><X size={10} /></button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2">
                                  <DropZone
                                    onFiles={(fs) => addPanelsToExistingChapter(idx, fs as any)}
                                    compact
                                    label="+ Add panels (drag or click)"
                                    sublabel=""
                                    className="py-3 border-[var(--border)]/70"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 pt-6">
                              <button onClick={() => moveChapter(idx, -1)} disabled={idx === 0} className="p-1 disabled:opacity-30"><ArrowUp size={14} /></button>
                              <button onClick={() => moveChapter(idx, 1)} disabled={idx === editDraft.chapters.length - 1} className="p-1 disabled:opacity-30"><ArrowDown size={14} /></button>
                              <button onClick={() => removeChapter(idx)} disabled={editDraft.chapters.length <= 1} className="p-1 text-red-400 mt-2 disabled:opacity-30"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bulk New Chapter Adder (supports "bulk chapter upload") */}
                  <div className="rounded-2xl border border-dashed border-[var(--border)] p-3">
                    <div className="text-sm font-medium mb-2">Add New Chapter (bulk panels supported — repeat for multiple chapters)</div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        value={bulkNewChapterTitle}
                        onChange={e => setBulkNewChapterTitle(e.target.value)}
                        placeholder="New chapter title"
                        className="flex-1 rounded bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5 text-sm"
                      />
                      <label className="cursor-pointer inline-flex items-center gap-2 rounded border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--bg-elev)]">
                        <Upload size={14} /> Choose panels (multi)
                        <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setBulkNewChapterFiles(Array.from(e.target.files || []))} />
                      </label>
                      <button onClick={addBulkNewChapter} disabled={!bulkNewChapterTitle.trim() && bulkNewChapterFiles.length === 0} className="rounded bg-[var(--accent)] text-white px-4 text-sm disabled:opacity-60">Add Chapter</button>
                    </div>
                    {bulkNewChapterFiles.length > 0 && <div className="text-xs mt-1 text-[var(--text-muted)]">{bulkNewChapterFiles.length} images ready for new chapter.</div>}
                    {processingProgress && <UploadProgress current={processingProgress.current} total={processingProgress.total} label={processingProgress.label} className="mt-2" />}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button onClick={closeEditor} className="px-4 py-2 rounded border border-[var(--border)]">Cancel</button>
                  <button onClick={saveEdit} className="px-5 py-2 rounded bg-[var(--accent)] text-white flex items-center gap-2"><Check size={16} /> Save Changes</button>
                </div>

                <div className="mt-3 text-[10px] text-[var(--text-muted)]">First chapter is forced free on save. All changes are saved locally and appear immediately in discovery/reader.</div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="mt-8 text-xs text-[var(--text-muted)]">
          Tip: Edits here only affect comics you created via the Upload tool. Creator App imports are managed separately via the paste tool on the homepage. Exported JSON is compatible with the existing import flow.
        </div>
      </div>
    </div>
  );
}
