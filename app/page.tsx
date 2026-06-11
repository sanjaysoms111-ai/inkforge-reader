"use client";

import { useState, useEffect } from "react";
import { ComicCard } from "./components/ComicCard";
import { GenreFilter } from "./components/GenreFilter";
import { SearchBar } from "./components/SearchBar";
import { useComics } from "./lib/ComicsContext";
import { Genre } from "./lib/types";
import type { Comic } from "./lib/types";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Upload } from "lucide-react";

export default function HomePage() {
  const { trending, latest, removePublishedComic, getFilteredComics, resetToDemo, getContinueReading, getRecommendedComics, getCurrentStreak, getAchievements, getLikedComics, previewCreatorImport, validateAndImportCreatorComic, importCreatorPublishedComics, importCreatorComic, getMyUploadedComics } = useComics();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'creator' | 'official'>("all");
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'completed'>("all");
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az' | 'za' | 'mostChapters' | 'popular' | 'trending' | 'byCoins'>("newest");

  // Creator import preview/validation flow
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Debounced search for robust input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const filtered = getFilteredComics(debouncedSearch, selectedGenres, sourceFilter, statusFilter, sortBy);



  // Recommendations for "For You"
  const recommended = getRecommendedComics(8);

  const continueReading = getContinueReading();

  const handleDeleteComic = (id: string) => {
    // Find the comic title for a better confirmation message
    const allComics = [...trending, ...latest, ...filtered];
    const comic = allComics.find((c) => c.id === id);
    const title = comic?.title || 'this comic';

    if (confirm(`Permanently delete "${title}"?\n\nThis cannot be undone.`)) {
      removePublishedComic(id);
    }
  };

  const toggleGenre = (genre: Genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const clearGenres = () => setSelectedGenres([]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedGenres([]);
    setSourceFilter("all");
    setStatusFilter("all");
    setSortBy("newest");
  };



  return (
    <div>
      {/* HERO — glass + theme aware */}
      <div className="border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto max-w-7xl px-4 pb-14 pt-16 sm:px-6 sm:pb-20 sm:pt-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium text-[var(--accent)]">
              NOW IN PUBLIC BETA
            </div>
            <h1 className="mt-4 text-balance text-5xl font-semibold tracking-tighter sm:text-6xl">
              Discover &amp; Read<br />Beautiful AI Webtoons
            </h1>
            <p className="mt-4 max-w-lg text-lg text-[var(--text-muted)]">
              inkforg_apexpanel Reader is the home for stunning AI-assisted webtoons and manhwa.
              Read for free or unlock premium chapters with coins.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#browse"
                className="btn-primary inline-flex items-center justify-center rounded-xl px-6 py-2.5 text-sm font-semibold"
              >
                Start Browsing
              </a>
            </div>

            <div className="mt-6 text-xs text-[var(--text-muted)]">
              Some comics on inkforg_apexpanel are AI-generated. Always check the creator&apos;s note.
            </div>
          </div>
        </div>
      </div>

      {/* CONTINUE READING BANNER */}
      {continueReading.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-400" />
            <div className="text-xs font-semibold uppercase tracking-[1px] text-amber-400">Continue Reading</div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            {continueReading.map(({ comic, chapterNumber, panelIndex }) => (
              <Link
                key={`${comic.slug}-${chapterNumber}`}
                href={`/read/${comic.slug}/${chapterNumber}`}
                className="snap-start min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 hover:border-[var(--accent)]/50 transition group"
              >
                <div className="flex gap-3">
                  <div className="w-12 h-16 rounded overflow-hidden border border-[var(--border)] flex-shrink-0">
                    <img src={comic.coverUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm line-clamp-1 group-hover:text-[var(--accent)]">{comic.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">Chapter {chapterNumber} • ~{Math.round((panelIndex / Math.max(1, comic.chapters.find(c => c.number === chapterNumber)?.panels.length || 1)) * 100)}%</div>
                    <div className="mt-1 text-[10px] text-amber-400">Continue →</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* FOR YOU - simple recs based on history/unlocked/genre overlap */}
      {recommended.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[1px] text-emerald-400">Personalized</div>
              <h2 className="text-2xl font-semibold tracking-tight">For You</h2>
            </div>
            <Link href="#browse" className="hidden text-sm text-[var(--accent)] hover:underline md:block">Browse more →</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
            {recommended.map((comic) => (
              <div key={comic.id} className="snap-start min-w-[160px] sm:min-w-[180px]">
                <ComicCard 
                  comic={comic} 
                  onDelete={(comic.id.startsWith('pub-') || comic.source === 'creator' || comic.source === 'user') ? handleDeleteComic : undefined} 
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Light social: Streak + Achievements + Likes count (visible on home) */}
      <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6 text-xs text-[var(--text-muted)] flex gap-4">
        <span>🔥 Streak: {getCurrentStreak ? getCurrentStreak() : 0} days</span>
        <span>🏆 Achievements: {getAchievements ? getAchievements().length : 0}</span>
        <span>❤️ Liked: {getLikedComics ? getLikedComics().length : 0}</span>
      </div>

      {/* UNIFIED "MY LIBRARY" (highest priority from DESIGN-my-library-upload.md) */}
      {/* Combines Uploaded (user-created via /upload or /creator), Unlocked (premium flow), Favorites/Liked, In-Progress (from history/continue) */}
      {/* Uses existing context selectors only — no new state. Reuses ComicCard + filters. Simple client tabs. */}
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6" id="my-library">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[1px] text-[var(--accent)]">Your Collection</div>
            <h2 className="text-2xl font-semibold tracking-tight">My Library</h2>
          </div>
          <Link href="/creator" className="hidden text-sm text-[var(--accent)] hover:underline md:block">Manage uploads &amp; drafts →</Link>
        </div>

        {/* My Library note — full dedicated /library page coming with Supabase */}
        <div className="mx-auto max-w-7xl px-4 pt-2 pb-4 sm:px-6 text-xs text-[var(--text-muted)]">
          Sign in for the full personal Library (uploaded + favorites + progress) and public comics discovery. Creator uploads and local data remain available.
        </div>
      </div>

      {/* TRENDING THIS WEEK - enhanced as horizontal carousel */}
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[1px] text-rose-500">Trending</div>
            <h2 className="text-2xl font-semibold tracking-tight">Trending This Week</h2>
          </div>
          <Link href="#browse" className="hidden text-sm text-rose-400 hover:text-rose-300 md:block">
            See all →
          </Link>
        </div>

        {/* Simple carousel: horizontal scroll + snap (framer optional for drag) */}
        <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin">
          {trending.slice(0, 10).map((comic) => (
            <div key={comic.id} className="snap-start min-w-[140px] sm:min-w-[160px] md:min-w-[180px]">
              <ComicCard 
                comic={comic} 
                onDelete={(comic.id.startsWith('pub-') || comic.source === 'creator' || comic.source === 'user') ? handleDeleteComic : undefined} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* LATEST RELEASES */}
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[1px] text-zinc-500">Fresh off the press</div>
            <h2 className="text-2xl font-semibold tracking-tight">Latest Releases</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {latest.slice(0, 6).map((comic) => (
            <ComicCard 
              key={comic.id} 
              comic={comic} 
              onDelete={(comic.id.startsWith('pub-') || comic.source === 'creator' || comic.source === 'user') ? handleDeleteComic : undefined} 
            />
          ))}
        </div>
      </div>

      {/* BROWSE / FILTERS */}
      <div id="browse" className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[1px] text-zinc-500">Explore</div>
            <h2 className="text-2xl font-semibold tracking-tight">Discover Comics</h2>
          </div>

          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Enhanced Filters Row */}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Genre Filter */}
            <div className="flex-1 min-w-[200px]">
              <GenreFilter
                selected={selectedGenres}
                onToggle={toggleGenre}
                onClear={clearGenres}
              />
            </div>

            {/* Source Filter (glass pills) */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[var(--text-muted)] mr-1">Source:</span>
              {(['all', 'creator', 'official'] as const).map((s) => (
                <motion.button
                  key={s}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSourceFilter(s)}
                  className={`px-3 py-1 rounded-full border text-xs transition ${
                    sourceFilter === s 
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]' 
                      : 'border-[var(--border)] hover:bg-[var(--bg-card)] text-[var(--text-muted)]'
                  }`}
                >
                  {s === 'all' ? 'All' : s === 'creator' ? 'Creator Published' : 'Official'}
                </motion.button>
              ))}
            </div>

            {/* Status Filter (new) */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[var(--text-muted)] mr-1">Status:</span>
              {(['all', 'ongoing', 'completed'] as const).map((s) => (
                <motion.button
                  key={s}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full border text-xs transition ${
                    statusFilter === s 
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]' 
                      : 'border-[var(--border)] hover:bg-[var(--bg-card)] text-[var(--text-muted)]'
                  }`}
                >
                  {s === 'all' ? 'Any' : s}
                </motion.button>
              ))}
            </div>

            {/* Sort (expanded) */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-muted)]">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[var(--bg-elev)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="az">A–Z</option>
                <option value="za">Z–A</option>
                <option value="mostChapters">Most Chapters</option>
                <option value="popular">Popular</option>
                <option value="trending">Trending</option>
                <option value="byCoins">By Coins (engagement)</option>
              </select>
            </div>
          </div>

          {/* Active filters info + clear + reset demo */}
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            {(debouncedSearch || selectedGenres.length > 0 || sourceFilter !== 'all' || statusFilter !== 'all') && (
              <>
                <span>
                  {filtered.length} results
                  { (debouncedSearch || selectedGenres.length > 0 || sourceFilter !== 'all' || statusFilter !== 'all') && ` • ${(debouncedSearch ? 1 : 0) + selectedGenres.length + (sourceFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)} filters active` }
                </span>
                <button 
                  onClick={clearAllFilters}
                  className="text-[var(--accent)] hover:underline"
                >
                  Clear all filters
                </button>
                <span className="text-[var(--border)]">•</span>
              </>
            )}
            <button
              onClick={() => {
                if (confirm("Reset all data?\n\nThis will clear your published comics, creator imports, unlocks, and comments, then reload.")) {
                  resetToDemo();
                }
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text)] underline-offset-2 hover:underline"
              title="Clear published comics, imports, unlocks and comments"
            >
              Reset data
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-zinc-400">
            No comics found. Try clearing your filters.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((comic) => (
              <ComicCard 
                key={comic.id} 
                comic={comic} 
                onDelete={(comic.id.startsWith('pub-') || comic.source === 'creator' || comic.source === 'user') ? handleDeleteComic : undefined} 
              />
            ))}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-[var(--border)] glass p-4 text-xs text-[var(--text-muted)]">
          <strong className="text-[var(--accent)]">Tip:</strong> Click any card to view details, chapters, and start reading. 
          Premium chapters can be unlocked with coins (demo).
        </div>

        {/* Strengthened Creator Bridge: Preview + Validation import flow */}
        <div className="mt-6 border border-[var(--border)] rounded-2xl p-4 bg-[var(--bg-card)]/60">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2">Creator Bridge Tools (preview & validate before import)</div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => {
              const count = importCreatorPublishedComics ? importCreatorPublishedComics() : 0;
              alert(count ? `${count} creator items (re)loaded` : 'No new creator items');
            }} className="text-xs px-3 py-1 rounded border border-[var(--border)] hover:bg-[var(--bg-elev)]">Reload from localStorage</button>

            <button onClick={() => {
              const raw = prompt('Paste Creator export JSON here for preview:');
              if (!raw) return;
              try {
                const data = JSON.parse(raw);
                const p = previewCreatorImport ? previewCreatorImport(data) : {valid:false, errors:['no preview'], preview:null};
                setImportPreview(p.preview);
                setImportErrors(p.errors);
              } catch (e) { setImportErrors(['Invalid JSON']); setImportPreview(null); }
            }} className="text-xs px-3 py-1 rounded border border-[var(--border)] hover:bg-[var(--bg-elev)]">Paste & Preview JSON</button>

            {importPreview && (
              <button onClick={() => {
                const ok = validateAndImportCreatorComic ? validateAndImportCreatorComic(importPreview) : null;
                if (ok) { setImportPreview(null); setImportErrors([]); alert('Imported successfully'); }
                else alert('Import failed validation');
              }} className="text-xs px-3 py-1 rounded bg-emerald-600 text-white">Confirm & Import Previewed</button>
            )}
          </div>

          {importPreview && (
            <div className="text-xs p-2 border border-emerald-900/40 bg-emerald-950/30 rounded">
              <strong>Preview:</strong> {importPreview.title} by {importPreview.author} • {importPreview.chaptersCount} chapters
              {importPreview.hasCustomPrices && ' • custom prices detected'}
            </div>
          )}
          {importErrors.length > 0 && <div className="text-red-400 text-xs mt-1">Validation: {importErrors.join('; ')}</div>}

          {/* Direct Upload entry point (new /upload page) */}
          <div className="mt-3 pt-3 border-t border-[var(--border)]/60 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-[var(--text-muted)]">Or create comics with your own images directly in the browser:</span>
            <Link
              href="/upload"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)]/70 px-3 py-1 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition"
            >
              <Upload size={14} /> Upload comic (images → data URLs)
            </Link>
            <span className="text-[var(--text-muted)]">— first chapter is always free.</span>
          </div>

          {/* Creator Upload Dashboard entry (new /creator) */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-[var(--text-muted)]">Manage, edit, bulk-add chapters, or export your uploads:</span>
            <Link
              href="/creator"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/70 px-3 py-1 text-emerald-400 hover:bg-emerald-500/10 transition"
            >
              Open Creator Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
