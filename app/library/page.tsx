"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "../lib/UserContext";
import { useComics } from "../lib/ComicsContext";
import { ComicCard } from "../components/ComicCard";
import { SearchBar } from "../components/SearchBar";
import { GenreFilter } from "../components/GenreFilter";
import { Genre } from "../lib/types";
import { motion } from "framer-motion";

type Tab = 'uploads' | 'continue' | 'favorites' | 'unlocked' | 'discover';

export default function MyLibraryPage() {
  const {
    user,
    loading: userLoading,
    coinBalance,
    profile,
    getUnlockedList,
    isComicFavorited,
  } = useUser();

  const {
    getMyUploadedComics,
    getLikedComics,
    getContinueReading,
    getComicBySlug,
    comics,
    removePublishedComic,
    refreshPublicComics,
    makeComicPublic,
    ingestPublicComic,
  } = useComics();

  const [tab, setTab] = useState<Tab>('uploads');
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwnerOf = (c: any) => {
    if (!user) return false;
    if (c.owner_id) return user.id === c.owner_id;
    return c.id.startsWith('pub-') || c.source === 'user';
  };

  // Discover filters (only active on discover tab)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');

  // Refresh public on mount when signed in (hybrid)
  useEffect(() => {
    if (user?.id) {
      refreshPublicComics();
    }
  }, [user?.id, refreshPublicComics]);

  // One-time welcome toast for brand new Inkforge Accounts
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("inkforge_welcome")) {
      sessionStorage.removeItem("inkforge_welcome");
      const toast = document.createElement("div");
      toast.className = "fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2 text-sm text-white shadow-lg z-[100]";
      toast.textContent = "Welcome to your Inkforge Account!";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3200);
    }
  }, []);

  if (userLoading) {
    return <div className="p-10 text-center text-[var(--text-muted)]">Loading your library...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-3">My Library</h1>
        <p className="text-[var(--text-muted)] mb-6">Sign in to access your full library: uploads, reading progress, favorites, unlocked chapters, and public discovery.</p>
        <Link href="/login" className="btn-primary inline-block rounded-xl px-6 py-2">Sign in / Create account</Link>
      </div>
    );
  }

  const myUploads = getMyUploadedComics();
  const likedComics = getLikedComics();
  const continueItems = getContinueReading();

  // All public (from hybrid merge in context)
  const allPublic = comics.filter((c: any) => (c as any).isPublic);

  // My Uploads: local user + any public owned (source user or ingested)
  const myAllUploads = myUploads; // already includes ingested public via hybrid

  // Unlocked chapters list (from UserContext)
  const unlockedList = getUnlockedList().map(({ slug, chapterNumber }) => {
    const c = getComicBySlug(slug);
    const ch = c?.chapters.find((h) => h.number === chapterNumber);
    return c && ch ? { comic: c, chapter: ch } : null;
  }).filter(Boolean) as Array<{ comic: any; chapter: any }>;

  // Discover: public comics with client-side search / genre / sort
  let discoverComics = allPublic;
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    discoverComics = discoverComics.filter((c: any) =>
      c.title?.toLowerCase().includes(q) ||
      c.author?.toLowerCase().includes(q) ||
      (c.tags || []).some((t: string) => t.toLowerCase().includes(q)) ||
      (c.description || '').toLowerCase().includes(q)
    );
  }
  if (selectedGenres.length > 0) {
    discoverComics = discoverComics.filter((c: any) =>
      (c.genres || []).some((g: Genre) => selectedGenres.includes(g))
    );
  }
  discoverComics = [...discoverComics].sort((a: any, b: any) => {
    if (sortBy === 'newest') {
      return (b.publishedAt || '').localeCompare(a.publishedAt || '');
    }
    // popular proxy: views + premium chapters
    const scoreA = (a.views || 0) + ((a.chapters || []).filter((ch: any) => ch.isPremium).length * 5);
    const scoreB = (b.views || 0) + ((b.chapters || []).filter((ch: any) => ch.isPremium).length * 5);
    return scoreB - scoreA;
  });

  const toggleGenre = (g: Genre) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };
  const clearGenres = () => setSelectedGenres([]);

  // Actions for My Uploads
  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Permanently delete "${title}"?\n\nThis action cannot be undone and will remove it from your library.`)) return;
    removePublishedComic(id);
    setActionError(null);
    // Success toast
    const toast = document.createElement("div");
    toast.className = "fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2 text-sm text-white shadow-lg z-[100]";
    toast.textContent = "Comic deleted successfully.";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
    // Refresh to update My Uploads + Discover lists
    refreshPublicComics();
  };

  const handlePublishToPublic = async (comic: any) => {
    setIsLoading(true);
    setActionError(null);
    try {
      await makeComicPublic(comic.id);
      // refresh to pick up any DB version
      refreshPublicComics();
    } catch (e: any) {
      setActionError(e.message || 'Failed to publish to public. Images may need re-optimization.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (id: string) => {
    // Current creator dashboard supports editing all my uploads
    window.location.href = '/creator';
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[1px] text-[var(--accent)]">Your account</div>
          <h1 className="text-3xl font-semibold tracking-tight">My Library</h1>
          <div className="text-sm text-[var(--text-muted)] mt-1">
            Coins: <span className="font-medium text-amber-400">{coinBalance}</span> • {profile?.display_name || 'Reader'}
          </div>
        </div>
        <Link href="/creator" className="text-sm text-[var(--accent)] hover:underline">Manage uploads →</Link>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-400">{actionError}</div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 text-sm border-b border-[var(--border)] pb-2">
        {([
          { key: 'uploads', label: 'My Uploads' },
          { key: 'continue', label: 'Continue Reading' },
          { key: 'favorites', label: 'Favorites' },
          { key: 'unlocked', label: 'Unlocked' },
          { key: 'discover', label: 'Discover' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-full border text-sm transition ${tab === key ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--bg-card)] text-[var(--text-muted)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* MY UPLOADS */}
      {tab === 'uploads' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-[1px] text-[var(--text-muted)]">Your comics (private + public)</div>
            <div className="text-xs text-[var(--text-muted)]">{myAllUploads.length} total</div>
          </div>
          {myAllUploads.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center border border-[var(--border)]">
              No uploads yet. <Link href="/upload" className="text-[var(--accent)] underline">Upload your first comic</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {myAllUploads.map((c: any) => {
                const owner = isOwnerOf(c);
                return (
                  <div key={c.id} className="group">
                    <ComicCard
                      comic={c}
                      onDelete={owner ? (id) => handleDelete(id, c.title) : undefined}
                    />
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {owner && (
                        <button onClick={() => handleEdit(c.id)} className="px-2 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--bg-card)]">Edit</button>
                      )}
                      {owner && !c.isPublic && (
                        <button
                          onClick={() => handlePublishToPublic(c)}
                          disabled={isLoading}
                          className="px-2 py-0.5 rounded border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-60"
                        >
                          {isLoading ? 'Publishing...' : 'Publish to Public'}
                        </button>
                      )}
                      {c.isPublic && <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">Public</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTINUE READING */}
      {tab === 'continue' && (
        <div>
          <div className="text-xs uppercase tracking-[1px] text-[var(--text-muted)] mb-3">Continue where you left off</div>
          {continueItems.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center border border-[var(--border)] text-[var(--text-muted)]">No in-progress chapters yet. Start reading to track progress.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {continueItems.map(({ comic, chapterNumber, panelIndex }: any) => {
                const pct = Math.round((panelIndex / Math.max(1, comic.chapters.find((ch: any) => ch.number === chapterNumber)?.panels.length || 1)) * 100);
                return (
                  <Link key={`${comic.slug}-${chapterNumber}`} href={`/read/${comic.slug}/${chapterNumber}`} className="card p-3 hover:border-[var(--accent)]/50 transition group">
                    <div className="flex gap-3">
                      <div className="w-14 h-20 flex-shrink-0 rounded overflow-hidden border border-[var(--border)]">
                        <img src={comic.coverUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="font-medium line-clamp-1 group-hover:text-[var(--accent)]">{comic.title}</div>
                        <div className="text-[var(--text-muted)] text-xs">Chapter {chapterNumber}</div>
                        <div className="mt-1 text-[10px] text-amber-400">{pct}% read</div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Continue →</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FAVORITES */}
      {tab === 'favorites' && (
        <div>
          <div className="text-xs uppercase tracking-[1px] text-[var(--text-muted)] mb-3">Your favorited comics</div>
          {likedComics.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center border border-[var(--border)] text-[var(--text-muted)]">No favorites yet. Tap the heart on any card to save.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {likedComics.map((c: any) => <ComicCard key={c.id} comic={c} />)}
            </div>
          )}
        </div>
      )}

      {/* UNLOCKED */}
      {tab === 'unlocked' && (
        <div>
          <div className="text-xs uppercase tracking-[1px] text-[var(--text-muted)] mb-3">Premium chapters you have unlocked</div>
          {unlockedList.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center border border-[var(--border)] text-[var(--text-muted)]">No unlocked premium chapters yet. Unlock chapters in the reader to see them here.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {unlockedList.map(({ comic, chapter }: any, idx: number) => (
                <Link key={idx} href={`/read/${comic.slug}/${chapter.number}`} className="card p-3 hover:border-[var(--accent)]/50 text-sm">
                  <div className="font-medium line-clamp-1">{comic.title}</div>
                  <div className="text-[var(--text-muted)]">Ch. {chapter.number} — {chapter.title}</div>
                  <div className="mt-1 text-[10px] text-emerald-400">Unlocked • {chapter.coinPrice ?? 10} coins</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DISCOVER (public) */}
      {tab === 'discover' && (
        <div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-[1px] text-emerald-400">Public library</div>
              <div className="text-xl font-semibold tracking-tight">Discover public comics</div>
            </div>
            <div className="text-xs text-[var(--text-muted)]">{discoverComics.length} public</div>
          </div>

          {/* Filters (reuse existing components for consistency) */}
          <div className="mb-4 flex flex-col md:flex-row gap-3 items-start">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <div className="flex-1 min-w-[220px]">
              <GenreFilter selected={selectedGenres} onToggle={toggleGenre} onClear={clearGenres} />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-muted)]">Sort:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-[var(--bg-elev)] border border-[var(--border)] rounded px-2 py-1 text-xs">
                <option value="newest">Newest first</option>
                <option value="popular">Most popular</option>
              </select>
            </div>
          </div>

          {discoverComics.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center border border-[var(--border)] text-[var(--text-muted)]">No public comics match your filters yet. Be the first to publish one!</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {discoverComics.map((c: any) => (
                <div key={c.id} className="relative">
                  <ComicCard comic={c} />
                  {c.isPublic && <div className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/90 text-white">Public</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-10 text-xs text-[var(--text-muted)] border-t border-[var(--border)] pt-4">
        Library uses hybrid local + Supabase data. Premium chapters on public comics respect first-chapter-free + coin unlocks via your profile.
      </div>
    </div>
  );
}
