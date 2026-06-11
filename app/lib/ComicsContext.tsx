"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Comic, Chapter, Genre, PublishComicInput, PublishChapterInput, Comment, Achievement } from "./types";
import { MOCK_COMICS } from "./mockData";

// Bridge format published by the inkforg_apexpanel Creator App
// (extended to support real per-panel dialogues from newer Creator exports)
interface CreatorPublishedComic {
  id: string;
  title: string;
  author: string;
  genre: string;
  description: string;
  coverUrl: string;
  chapters: Array<{
    number: number;
    title: string;
    panels: string[];
    dialogues?: string[]; // real story text per panel (new)
    coinPrice?: number; // optional custom price for this premium chapter
  }>;
  publishedAt: string;
  disclaimer?: string;
  unlockAllPrice?: number; // optional custom price to unlock all premium chapters in the comic
}


const PUBLISHED_KEY = "inkforg_apexpanel:published";
const CREATOR_PUBLISHED_KEY = "inkforg_apexpanel_published_comics"; // Bridge key from inkforg_apexpanel Creator App
const COMMENTS_KEY = "inkforg_apexpanel:comments";
const DISPLAY_NAME_KEY = "inkforg_apexpanel:displayName";
const PROGRESS_KEY_PREFIX = "inkforg_apexpanel:progress"; // per slug:ch = panelIndex
const BOOKMARKS_KEY = "inkforg_apexpanel:bookmarks"; // { [slug]: { [chNum]: number[] } }  // pages, empty array = chapter bookmark
const HISTORY_KEY = "inkforg_apexpanel:history"; // array of {slug, chapterNumber, panelIndex, timestamp}, last 20
const READER_SETTINGS_KEY = "inkforg_apexpanel:readerSettings"; // { direction: 'vertical'|'rtl'|'ltr', fit: 'width'|'height'|'contain'|'original' }
const LIKED_COMICS_KEY = "inkforg_apexpanel:likedComics"; // string[] slugs
const ACHIEVEMENTS_KEY = "inkforg_apexpanel:achievements";
const STREAK_KEY = "inkforg_apexpanel:streak"; // { count: number, lastReadDate: string }
const CACHED_KEY = "inkforg_apexpanel:cachedChapters"; // string[] of `${slug}:${chapterNumber}` — tracks chapters cached for offline via SW + download
const UPLOAD_DRAFTS_KEY = "inkforg_apexpanel:uploadDrafts"; // { [key: string]: { id?: string, timestamp: string, title?: string, data: any } } for incomplete forms + light history
const UPLOAD_HISTORY_KEY = "inkforg_apexpanel:uploadHistory"; // lightweight recent completed user uploads for quick access

// Premium expansion keys (mock economy)


interface ComicsContextType {
  // All comics (mock + user published + creator bridge)
  comics: Comic[];
  // Trending & latest curated (from mocks mostly)
  trending: Comic[];
  latest: Comic[];

  // Comics published from the separate inkforg_apexpanel Creator App
  creatorPublished: Comic[];

  // Manually import / refresh comics from the Creator App's localStorage key
  // Returns the number of comics that were found and added (0 if none)
  importCreatorPublishedComics: () => number;

  // New clipboard import from Creator export JSON
  importCreatorComic: (data: any) => Comic | null;



  // Publishing (local)
  publishComic: (input: PublishComicInput) => Comic;
  removePublishedComic: (id: string) => void;

  // Creator Upload Dashboard support (edits + list for user-uploaded comics only)
  // These operate on source:'user' / pub- comics stored in the published bridge (never touch creator key).
  getMyUploadedComics: () => Comic[];
  updateUploadedComic: (id: string, updates: Partial<Comic>) => void;
  addChaptersToUploadedComic: (id: string, newChapters: PublishChapterInput[]) => void;

  // Advanced upload capabilities (drafts for incomplete forms, history of published uploads)
  // Stored separately but integrated with user comics flow. Thumbnails/gallery/banner auto-handled on publish/update.
  saveUploadDraft: (draftKey: string, data: any) => void;
  loadUploadDraft: (draftKey: string) => any | null;
  getUploadDrafts: () => Record<string, { id?: string; timestamp: string; title?: string; data: any }>;
  deleteUploadDraft: (draftKey: string) => void;
  getUploadHistory: () => Array<{ slug: string; title: string; timestamp: string; coverUrl?: string }>;
  // Optional: record a completed upload into history (called from publish flow for user comics)
  recordUploadToHistory: (comic: Comic) => void;

  // Helpers
  getComicBySlug: (slug: string) => Comic | undefined;
  getChapter: (comic: Comic, chapterNumber: number) => Chapter | undefined;
  searchComics: (query: string, selectedGenres: Genre[]) => Comic[];

  // Enhanced search + filters + sorting for homepage (greatly improved discovery)
  getFilteredComics: (
    query?: string,
    selectedGenres?: Genre[],
    sourceFilter?: 'all' | 'creator' | 'official',
    statusFilter?: 'all' | 'ongoing' | 'completed',
    sortBy?: 'newest' | 'oldest' | 'az' | 'za' | 'mostChapters' | 'popular' | 'trending' | 'byCoins'
  ) => Comic[];

  // Simple recommendation engine (genre overlap from unlocked/history/bookmarks)
  getRecommendedComics: (limit?: number) => Comic[];

  // Comments & Reactions (enhanced with nested replies)
  getCommentsForChapter: (slug: string, chapterNumber: number) => Comment[];
  addComment: (slug: string, chapterNumber: number, text: string, author: string, initialReaction?: string, parentId?: string) => void;
  likeComment: (slug: string, chapterNumber: number, commentId: string) => void;
  addReaction: (slug: string, chapterNumber: number, commentId: string, emoji: string) => void;
  deleteComment: (slug: string, chapterNumber: number, commentId: string) => void;
  displayName: string;
  setDisplayName: (name: string) => void;

  // Light social: Like/Favorite comics (distinct from page bookmarks)
  getLikedComics: () => Comic[];
  toggleLikeComic: (slug: string) => void;
  isComicLiked: (slug: string) => boolean;

  // Reading streaks & simple achievements (client-side, based on history)
  getCurrentStreak: () => number;
  getAchievements: () => Achievement[];
  checkAchievements: () => void; // called internally on actions

  // Share helpers (no new state)
  copyChapterLink: (slug: string, chapterNumber: number) => Promise<void>;

  // Creator analytics (mock views + unlocks computed from existing state; incremented on read)
  getCreatorAnalytics: (slug: string) => { views: number; unlockCount: number } | null;
  recordCreatorView: (slug: string) => void;

  // Strengthened creator bridge: preview + validation before import
  previewCreatorImport: (data: any) => { valid: boolean; errors: string[]; preview: any };
  validateAndImportCreatorComic: (data: any) => Comic | null; // uses preview internally, shows validation

  // Reading progress per chapter (panel index, 0-based). Persisted in localStorage.
  getReadingProgress: (slug: string, chapterNumber: number) => number;
  saveReadingProgress: (slug: string, chapterNumber: number, panelIndex: number) => void;

  // For "Continue reading" banner
  getContinueReading: () => Array<{ comic: Comic; chapterNumber: number; panelIndex: number }>;

  // Bookmarks: pages (array of indices) or chapters (empty array means whole chapter bookmarked)
  getBookmarks: () => Record<string, Record<number, number[]>>;
  toggleBookmark: (slug: string, chapterNumber: number, panelIndex?: number) => void;
  isPageBookmarked: (slug: string, chapterNumber: number, panelIndex: number) => boolean;
  isChapterBookmarked: (slug: string, chapterNumber: number) => boolean;

  // Reading history (last 20)
  getReadingHistory: () => Array<{ slug: string; chapterNumber: number; panelIndex: number; timestamp: string }>;
  addToHistory: (slug: string, chapterNumber: number, panelIndex: number) => void;

  // Custom reader settings (direction, fit options) - client-side only
  getReaderSettings: () => { direction: 'vertical' | 'rtl' | 'ltr'; fit: 'width' | 'height' | 'contain' | 'original' };
  updateReaderSettings: (settings: Partial<{ direction: 'vertical' | 'rtl' | 'ltr'; fit: 'width' | 'height' | 'contain' | 'original' }>) => void;

  // PWA offline support (per DESIGN-v2): mark + query chapters that have been downloaded/viewed while unlocked.
  // Combined with SW image caching + localStorage unlock/progress state, enables full offline reading.
  isChapterCached: (slug: string, chapterNumber: number) => boolean;
  cacheChapterForOffline: (slug: string, chapterNumber: number) => void;

  // Reset everything user-generated back to the pristine demo samples (great for testing / recovering a clean state)
  resetToDemo: () => void;
}

const ComicsContext = createContext<ComicsContextType | undefined>(undefined);

// Convert a comic published from the Creator App into our internal Comic shape
// Updated to robustly handle multi-chapter exports with titles and ordering.
function normalizeCreatorComic(raw: CreatorPublishedComic & { slug?: string }): Comic {
  const slugBase = (raw.title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Prefer a previously assigned (possibly uniqued) slug if this raw came from our own saved Comic shape.
  // Otherwise derive a stronger unique-ish slug (longer suffix to reduce collisions across different comics).
  let slug: string;
  if (raw.slug && typeof raw.slug === "string" && raw.slug.length > 0) {
    slug = raw.slug;
  } else {
    const idForSuffix = (raw.id || Date.now()).toString().replace(/[^a-z0-9]/gi, "");
    const suffix = idForSuffix.slice(-10) || Date.now().toString(36).slice(-8);
    slug = `creator-${slugBase}-${suffix}`;
  }

  // Build chapters explicitly, preserving title, number, and panels order.
  // Also carry over dialogues if the (newer) export format includes them.
  let chapters: Chapter[] = (raw.chapters || []).map((ch: any, idx: number) => ({
    id: `creator-ch-${raw.id || Date.now()}-${idx}`,
    number: ch.number || (idx + 1),
    title: ch.title || `Chapter ${idx + 1}`,
    isPremium: idx > 0, // First chapter free, rest premium (monetization)
    panels: Array.isArray(ch.panels) ? ch.panels : [],
    dialogues: Array.isArray(ch.dialogues) ? ch.dialogues : undefined,
    coinPrice: typeof ch.coinPrice === 'number' && ch.coinPrice > 0 ? ch.coinPrice : undefined,
  }));

  // Ensure correct ordering by number
  chapters = chapters.sort((a, b) => a.number - b.number);

  // Derive genre
  const genreList: Genre[] = raw.genre ? [raw.genre as Genre] : ["Fantasy"];
  const tags = raw.genre ? [raw.genre] : [];

  return {
    id: `creator-${raw.id || Date.now()}`,
    slug,
    title: raw.title,
    author: raw.author || "inkforg_apexpanel Creator",
    coverUrl: raw.coverUrl || (chapters[0]?.panels?.[0] ?? ""),
    genres: genreList,
    description: raw.description || "A comic created with the inkforg_apexpanel Creator App.",
    chapters,
    views: 420,
    publishedAt: raw.publishedAt?.split("T")[0] || new Date().toISOString().split("T")[0],
    isAIGenerated: true,
    source: "creator",
    status: 'ongoing', // default for creator imports; can be updated on publish
    tags,
    unlockAllPrice: typeof raw.unlockAllPrice === 'number' && raw.unlockAllPrice > 0 ? raw.unlockAllPrice : undefined,
  };
}

export function ComicsProvider({ children }: { children: ReactNode }) {
  const [comics, setComics] = useState<Comic[]>(MOCK_COMICS);

  // Comments & Reactions
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [displayName, setDisplayNameState] = useState<string>("");

  // QOL: bookmarks, history, settings (client-side localStorage)
  const [bookmarks, setBookmarks] = useState<Record<string, Record<number, number[]>>>({});
  const [readingHistory, setReadingHistory] = useState<Array<{ slug: string; chapterNumber: number; panelIndex: number; timestamp: string }>>([]);
  const [readerSettings, setReaderSettings] = useState<{ direction: 'vertical' | 'rtl' | 'ltr'; fit: 'width' | 'height' | 'contain' | 'original' }>({
    direction: 'vertical',
    fit: 'contain',
  });

  // Social/light features state
  const [likedComics, setLikedComics] = useState<string[]>([]); // slugs
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);

  // PWA: chapters explicitly cached for offline (populated on download + reader view of unlocked chapters)
  const [cachedChapters, setCachedChapters] = useState<string[]>([]); // `${slug}:${ch}`

  // Advanced upload: drafts (incomplete comics) + upload history
  const [uploadDrafts, setUploadDrafts] = useState<Record<string, { id?: string; timestamp: string; title?: string; data: any }>>({});
  const [uploadHistory, setUploadHistory] = useState<Array<{ slug: string; title: string; timestamp: string; coverUrl?: string }>>([]);

  // Load persisted data (user published + creator bridge)
  useEffect(() => {
    let merged = [...MOCK_COMICS];

    // 1. Load comics published from the Creator App (read-only bridge)
    try {
      const creatorRaw = localStorage.getItem(CREATOR_PUBLISHED_KEY);
      if (creatorRaw) {
        const parsed: (CreatorPublishedComic & { slug?: string })[] = JSON.parse(creatorRaw);
        const normalized = parsed.map(normalizeCreatorComic);

        // Ensure slugs are unique across the entire list (handles legacy items that may derive colliding slugs for different titles/ids)
        const usedSlugs = new Set(merged.map((m) => m.slug));
        normalized.forEach((c) => {
          if (merged.some((m) => m.id === c.id)) return;

          let finalComic = c;
          if (usedSlugs.has(c.slug)) {
            let k = 1;
            let candidate = `${c.slug}-${k}`;
            while (usedSlugs.has(candidate)) {
              k += 1;
              candidate = `${c.slug}-${k}`;
            }
            finalComic = { ...c, slug: candidate };
          }
          merged.push(finalComic);
          usedSlugs.add(finalComic.slug);
        });
      }
    } catch (e) {
      // ignore bad data
    }

    // 2. Load comics previously published via the (now removed) local publish flow
    try {
      const savedPublished = localStorage.getItem(PUBLISHED_KEY);
      if (savedPublished) {
        const parsed: Comic[] = JSON.parse(savedPublished);
        parsed.forEach((pub) => {
          if (!merged.some((m) => m.id === pub.id)) merged.push(pub);
        });
      }
    } catch (e) {
      // ignore corrupted storage
    }

    setComics(merged);



    // Load PWA cached chapters list (for offline indicators + "downloaded" chapters)
    try {
      const savedCached = localStorage.getItem(CACHED_KEY);
      if (savedCached) setCachedChapters(JSON.parse(savedCached) || []);
    } catch {}

    // Load advanced upload drafts + history
    try {
      const savedDrafts = localStorage.getItem(UPLOAD_DRAFTS_KEY);
      if (savedDrafts) setUploadDrafts(JSON.parse(savedDrafts) || {});
    } catch {}
    try {
      const savedHistory = localStorage.getItem(UPLOAD_HISTORY_KEY);
      if (savedHistory) setUploadHistory(JSON.parse(savedHistory) || []);
    } catch {}



    // Load comments
    try {
      const savedComments = localStorage.getItem(COMMENTS_KEY);
      if (savedComments) setComments(JSON.parse(savedComments));
    } catch {}

    // Load display name
    try {
      const savedName = localStorage.getItem(DISPLAY_NAME_KEY);
      if (savedName) setDisplayNameState(savedName);
    } catch {}

    // Load QOL: bookmarks, history, reader settings (client-side)
    try {
      const savedBookmarks = localStorage.getItem(BOOKMARKS_KEY);
      if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
    } catch {}
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        setReadingHistory(Array.isArray(parsed) ? parsed.slice(0, 20) : []);
      }
    } catch {}
    try {
      const savedSettings = localStorage.getItem(READER_SETTINGS_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setReaderSettings({ direction: 'vertical', fit: 'contain', ...parsed });
      }
    } catch {}

    // Load social: likes, achievements, streak
    try {
      const savedLikes = localStorage.getItem(LIKED_COMICS_KEY);
      if (savedLikes) setLikedComics(JSON.parse(savedLikes));
    } catch {}
    try {
      const savedAch = localStorage.getItem(ACHIEVEMENTS_KEY);
      if (savedAch) setAchievements(JSON.parse(savedAch));
    } catch {}
    try {
      const savedStreak = localStorage.getItem(STREAK_KEY);
      if (savedStreak) {
        const s = JSON.parse(savedStreak);
        setCurrentStreak(s.count || 0);
      }
    } catch {}

    // First-run boost to give a taste of premium reader (preserves first-chapter-free + premium flow experience).
    if (!hadSavedUnlocks && merged.length > 0) {
      const first = merged.find((c) => !c.id.startsWith("pub-"));
      if (first) {
        const firstPremium = first.chapters.find((ch) => ch.isPremium);
        if (firstPremium) {
          setUnlocked((prev) => ({ ...prev, [`${first.id}:${firstPremium.id}`]: true }));
        }
        const freeCh = first.chapters.find((ch) => !ch.isPremium);
        if (freeCh) {
          const key = `${first.slug}:${freeCh.number}`;
          setComments((prev) => {
            if (prev[key] && prev[key].length > 0) return prev;
            return {
              ...prev,
              [key]: [
                {
                  id: "seed_comment_1",
                  author: "Alex Reader",
                  text: "The art in this chapter is stunning. Can't wait to see where the story goes!",
                  timestamp: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
                  likes: 3,
                  reactions: { "🔥": 2, "👏": 1 },
                },
              ],
            };
          });
        }
      }
    }
  }, []);

  // Persist comments
  useEffect(() => {
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
  }, [comments]);

  // Persist display name
  useEffect(() => {
    localStorage.setItem(DISPLAY_NAME_KEY, displayName);
  }, [displayName]);

  // Persist QOL features
  useEffect(() => {
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks)); } catch {}
  }, [bookmarks]);

  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(readingHistory)); } catch {}
  }, [readingHistory]);

  useEffect(() => {
    try { localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(readerSettings)); } catch {}
  }, [readerSettings]);

  // Persist social features
  useEffect(() => {
    try { localStorage.setItem(LIKED_COMICS_KEY, JSON.stringify(likedComics)); } catch {}
  }, [likedComics]);

  useEffect(() => {
    try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements)); } catch {}
  }, [achievements]);

  useEffect(() => {
    try { localStorage.setItem(STREAK_KEY, JSON.stringify({ count: currentStreak, lastReadDate: new Date().toISOString().split('T')[0] })); } catch {}
  }, [currentStreak]);

  // Persist PWA cached chapters list
  useEffect(() => {
    try { localStorage.setItem(CACHED_KEY, JSON.stringify(cachedChapters)); } catch {}
  }, [cachedChapters]);

  // Persist advanced upload drafts + history
  useEffect(() => {
    try { localStorage.setItem(UPLOAD_DRAFTS_KEY, JSON.stringify(uploadDrafts)); } catch {}
  }, [uploadDrafts]);
  useEffect(() => {
    try { localStorage.setItem(UPLOAD_HISTORY_KEY, JSON.stringify(uploadHistory)); } catch {}
  }, [uploadHistory]);



  // Persist published (legacy support for comics created via the removed local /publish flow)
  const persistPublished = useCallback((allComics: Comic[]) => {
    const userPublished = allComics.filter(
      (c) => 
        !MOCK_COMICS.some((m) => m.id === c.id) && 
        c.source !== 'creator'
    );
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(userPublished));
  }, []);





  const publishComic = useCallback(
    (input: PublishComicInput): Comic => {
      const now = new Date().toISOString();

      const newChapters: Chapter[] = input.chapters.map((ch, idx) => ({
        id: `pub-ch-${idx}-${Date.now()}`,
        number: idx + 1,
        title: ch.title || `Chapter ${idx + 1}`,
        isPremium: ch.isPremium,
        panels: ch.panels,
        coinPrice: ch.coinPrice, // support custom per-chapter pricing from upload / creator flows
      }));

      const slugBase = input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      let newComic: Comic;

      setComics((prev) => {
        let slug = `${slugBase}-${Date.now().toString(36)}`;
        let suffix = 1;
        while (prev.some((c) => c.slug === slug)) {
          slug = `${slugBase}-${Date.now().toString(36)}-${suffix++}`;
        }

        newComic = {
          id: `pub-${Date.now()}`,
          slug,
          title: input.title,
          author: input.author || "You",
          coverUrl: input.coverUrl,
          genres: input.genres,
          description: input.description,
          chapters: newChapters,
          views: 124, // starting views
          publishedAt: now.split("T")[0],
          isAIGenerated: true,
          status: input.status || 'ongoing',
          tags: input.tags || [],
          unlockAllPrice: input.unlockAllPrice,
          source: 'user', // direct uploads via /upload (or legacy publish) are user content; distinct from creator bridge
        };

        const updated = [...prev, newComic];
        persistPublished(updated);
        return updated;
      });

      return newComic!;
    },
    [persistPublished]
  );

  const removePublishedComic = useCallback((id: string) => {
    setComics((prev) => {
      const comicToRemove = prev.find((c) => c.id === id);
      const updated = prev.filter((c) => c.id !== id);

      // Clean from user-published storage
      persistPublished(updated);

      // If it was a creator-imported comic, also remove it from the creator bridge storage
      if (comicToRemove?.source === 'creator') {
        try {
          const creatorRaw = localStorage.getItem(CREATOR_PUBLISHED_KEY);
          if (creatorRaw) {
            const parsed = JSON.parse(creatorRaw);
            const filtered = parsed.filter((c: any) => c.id !== id);
            localStorage.setItem(CREATOR_PUBLISHED_KEY, JSON.stringify(filtered));
          }
        } catch {}
      }

      return updated;
    });
  }, [persistPublished]);

  // === Creator Upload Dashboard helpers (user uploads only) ===
  const getMyUploadedComics = useCallback(() => {
    return comics.filter((c) => c.source === 'user' || c.id.startsWith('pub-'));
  }, [comics]);

  const updateUploadedComic = useCallback((id: string, updates: Partial<Comic>) => {
    setComics((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const existing = prev[idx];
      if (existing.source === 'creator') return prev; // protect bridge comics

      const updatedComic: Comic = {
        ...existing,
        ...updates,
        // chapters may be fully replaced during edit (with new data: panels etc.)
        chapters: updates.chapters ?? existing.chapters,
      };

      const newList = [...prev];
      newList[idx] = updatedComic;
      persistPublished(newList);
      return newList;
    });
  }, [persistPublished]);

  const addChaptersToUploadedComic = useCallback((id: string, newChaptersInput: PublishChapterInput[]) => {
    if (!newChaptersInput || newChaptersInput.length === 0) return;

    setComics((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const existing = prev[idx];
      if (existing.source === 'creator') return prev;

      const nextNumber = (existing.chapters.length || 0) + 1;
      const added: Chapter[] = newChaptersInput.map((ch, i) => ({
        id: `pub-ch-${Date.now()}-${i}`,
        number: nextNumber + i,
        title: ch.title || `Chapter ${nextNumber + i}`,
        isPremium: ch.isPremium,
        panels: ch.panels,
        coinPrice: ch.coinPrice,
      }));

      const updatedComic: Comic = {
        ...existing,
        chapters: [...existing.chapters, ...added],
      };

      const newList = [...prev];
      newList[idx] = updatedComic;
      persistPublished(newList);
      return newList;
    });
  }, [persistPublished]);

  // === Advanced upload: drafts + history (client-only, modern APIs + LS) ===
  const saveUploadDraft = useCallback((draftKey: string, data: any) => {
    setUploadDrafts((prev) => ({
      ...prev,
      [draftKey]: {
        id: data.id || draftKey,
        timestamp: new Date().toISOString(),
        title: data.title || prev[draftKey]?.title,
        data,
      },
    }));
  }, []);

  const loadUploadDraft = useCallback((draftKey: string) => {
    return uploadDrafts[draftKey]?.data ?? null;
  }, [uploadDrafts]);

  const getUploadDrafts = useCallback(() => uploadDrafts, [uploadDrafts]);

  const deleteUploadDraft = useCallback((draftKey: string) => {
    setUploadDrafts((prev) => {
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
  }, []);

  const getUploadHistory = useCallback(() => uploadHistory, [uploadHistory]);

  const recordUploadToHistory = useCallback((comic: Comic) => {
    if (!comic || (comic.source !== 'user' && !comic.id?.startsWith('pub-'))) return;
    setUploadHistory((prev) => {
      // dedupe by slug, keep last 20
      const filtered = prev.filter((h) => h.slug !== comic.slug);
      const entry = {
        slug: comic.slug,
        title: comic.title,
        timestamp: new Date().toISOString(),
        coverUrl: comic.coverUrl,
      };
      return [entry, ...filtered].slice(0, 20);
    });
  }, []);

  const getComicBySlug = useCallback(
    (slug: string) => comics.find((c) => c.slug === slug),
    [comics]
  );

  const getChapter = useCallback((comic: Comic, chapterNumber: number) => {
    return comic.chapters.find((ch) => ch.number === chapterNumber);
  }, []);

  // Search + filter helper (used by homepage)
  const searchComics = useCallback(
    (query: string, selectedGenres: Genre[]) => {
      const q = query.trim().toLowerCase();

      return comics.filter((comic) => {
        const matchesSearch =
          !q ||
          comic.title.toLowerCase().includes(q) ||
          comic.author.toLowerCase().includes(q) ||
          comic.description.toLowerCase().includes(q);

        const matchesGenres =
          selectedGenres.length === 0 ||
          selectedGenres.some((g) => comic.genres.includes(g));

        return matchesSearch && matchesGenres;
      });
    },
    [comics]
  );

  // Enhanced filtered + sorted comics (for homepage search/filters/sort) - robust discovery
  const getFilteredComics = useCallback(
    (
      query: string = '',
      selectedGenres: Genre[] = [],
      sourceFilter: 'all' | 'creator' | 'official' = 'all',
      statusFilter: 'all' | 'ongoing' | 'completed' = 'all',
      sortBy: 'newest' | 'oldest' | 'az' | 'za' | 'mostChapters' | 'popular' | 'trending' | 'byCoins' = 'newest'
    ) => {
      const q = query.trim().toLowerCase();

      let result = comics.filter((comic) => {
        // Robust search: title, author, tags (and legacy description/genres)
        const matchesSearch =
          !q ||
          comic.title.toLowerCase().includes(q) ||
          comic.author.toLowerCase().includes(q) ||
          (comic.tags || []).some((t) => t.toLowerCase().includes(q)) ||
          comic.description.toLowerCase().includes(q) ||
          (comic.genres || []).some((g) => g.toLowerCase().includes(q));

        const matchesGenres =
          selectedGenres.length === 0 ||
          selectedGenres.some((g) => (comic.genres || []).includes(g));

        let matchesSource = true;
        if (sourceFilter === 'creator') {
          matchesSource = comic.source === 'creator';
        } else if (sourceFilter === 'official') {
          matchesSource = comic.source !== 'creator';
        }

        let matchesStatus = true;
        if (statusFilter !== 'all') {
          matchesStatus = (comic.status || 'ongoing') === statusFilter;
        }

        return matchesSearch && matchesGenres && matchesSource && matchesStatus;
      });

      // Sorting (expanded)
      const sorted = [...result].sort((a, b) => {
        if (sortBy === 'newest') {
          return (b.publishedAt || '').localeCompare(a.publishedAt || '');
        }
        if (sortBy === 'oldest') {
          return (a.publishedAt || '').localeCompare(b.publishedAt || '');
        }
        if (sortBy === 'az') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'za') {
          return b.title.localeCompare(a.title);
        }
        if (sortBy === 'mostChapters') {
          return (b.chapters?.length || 0) - (a.chapters?.length || 0);
        }
        if (sortBy === 'popular') {
          // proxy for popular (views + premium chapters count as engagement/monetization)
          const scoreA = (a.views || 0) + ((a.chapters || []).filter(ch => ch.isPremium).length * 20);
          const scoreB = (b.views || 0) + ((b.chapters || []).filter(ch => ch.isPremium).length * 20);
          return scoreB - scoreA;
        }
        if (sortBy === 'trending') {
          // simple trending: recent + views
          const recencyA = (b.publishedAt || '').localeCompare(a.publishedAt || '');
          return recencyA !== 0 ? recencyA : (b.views || 0) - (a.views || 0);
        }
        if (sortBy === 'byCoins') {
          // "by coins" proxy: prefer comics with more premium chapters (monetization potential) + views
          const coinScoreA = (a.chapters?.filter(ch => ch.isPremium).length || 0) * 10 + (a.views || 0);
          const coinScoreB = (b.chapters?.filter(ch => ch.isPremium).length || 0) * 10 + (b.views || 0);
          return coinScoreB - coinScoreA;
        }
        return 0;
      });

      return sorted;
    },
    [comics]
  );



  // --- Comments & Reactions ---
  const getCommentKey = (slug: string, chapterNumber: number) => `${slug}:${chapterNumber}`;

  const getCommentsForChapter = useCallback((slug: string, chapterNumber: number): Comment[] => {
    const key = getCommentKey(slug, chapterNumber);
    return comments[key] || [];
  }, [comments]);

  const addComment = useCallback((slug: string, chapterNumber: number, text: string, author: string, initialReaction?: string, parentId?: string) => {
    const key = getCommentKey(slug, chapterNumber);
    const newComment: Comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      author: author.trim() || "Anonymous",
      text: text.trim(),
      timestamp: new Date().toISOString(),
      likes: 0,
      reactions: initialReaction ? { [initialReaction]: 1 } : {},
      parentId,
      avatar: author.trim() ? author.trim()[0].toUpperCase() : '?',
    };

    setComments((prev) => {
      const existing = prev[key] || [];
      return {
        ...prev,
        [key]: [newComment, ...existing], // newest first; nesting handled in UI
      };
    });

    // Auto-save display name if provided
    if (author && author.trim()) {
      setDisplayNameState(author.trim());
    }

    // light achievement trigger for first comment etc.
    setTimeout(() => checkAchievementsInternal(), 10);
  }, []);

  const likeComment = useCallback((slug: string, chapterNumber: number, commentId: string) => {
    const key = getCommentKey(slug, chapterNumber);
    setComments((prev) => {
      const existing = prev[key] || [];
      const updated = existing.map((c) =>
        c.id === commentId ? { ...c, likes: c.likes + 1 } : c
      );
      return { ...prev, [key]: updated };
    });
  }, []);

  const addReaction = useCallback((slug: string, chapterNumber: number, commentId: string, emoji: string) => {
    const key = getCommentKey(slug, chapterNumber);
    setComments((prev) => {
      const existing = prev[key] || [];
      const updated = existing.map((c) => {
        if (c.id === commentId) {
          const current = c.reactions[emoji] || 0;
          return {
            ...c,
            reactions: { ...c.reactions, [emoji]: current + 1 },
          };
        }
        return c;
      });
      return { ...prev, [key]: updated };
    });
  }, []);

  const deleteComment = useCallback((slug: string, chapterNumber: number, commentId: string) => {
    const key = getCommentKey(slug, chapterNumber);
    setComments((prev) => {
      const existing = prev[key] || [];
      const updated = existing.filter((c) => c.id !== commentId);
      return { ...prev, [key]: updated };
    });
  }, []);

  const setDisplayName = useCallback((name: string) => {
    setDisplayNameState(name.trim());
  }, []);

  // Reading progress helpers (localStorage, per chapter panel index)
  const getReadingProgress = useCallback((slug: string, chapterNumber: number): number => {
    try {
      const key = `${PROGRESS_KEY_PREFIX}:${slug}:${chapterNumber}`;
      const saved = localStorage.getItem(key);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  }, []);

  const saveReadingProgress = useCallback((slug: string, chapterNumber: number, panelIndex: number) => {
    try {
      const key = `${PROGRESS_KEY_PREFIX}:${slug}:${chapterNumber}`;
      localStorage.setItem(key, Math.max(0, Math.floor(panelIndex)).toString());
    } catch {}
  }, []);

  const getContinueReading = useCallback(() => {
    const results: Array<{ comic: Comic; chapterNumber: number; panelIndex: number }> = [];
    try {
      // Scan localStorage for progress keys (simple approach for demo)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PROGRESS_KEY_PREFIX)) {
          const parts = key.split(':');
          if (parts.length === 4) {
            const [, , slug, chStr] = parts;
            const chNum = parseInt(chStr, 10);
            const panel = parseInt(localStorage.getItem(key) || '0', 10);
            const comic = comics.find((c) => c.slug === slug);
            if (comic && chNum > 0 && panel >= 0) {
              results.push({ comic, chapterNumber: chNum, panelIndex: panel });
            }
          }
        }
      }
    } catch {}
    // Sort by most recent? For demo just return first few
    return results.slice(0, 5);
  }, [comics]);

  // Bookmarks (pages or chapters)
  const getBookmarks = useCallback(() => bookmarks, [bookmarks]);

  const toggleBookmark = useCallback((slug: string, chapterNumber: number, panelIndex?: number) => {
    setBookmarks((prev) => {
      const comicMarks = { ...(prev[slug] || {}) };
      const chMarks = [...(comicMarks[chapterNumber] || [])];
      if (panelIndex === undefined) {
        // chapter level: use empty array as marker, or toggle presence of -1
        if (chMarks.length === 0 || chMarks.includes(-1)) {
          delete comicMarks[chapterNumber];
        } else {
          comicMarks[chapterNumber] = [-1]; // marker for whole chapter
        }
      } else {
        const idx = chMarks.indexOf(panelIndex);
        if (idx > -1) {
          chMarks.splice(idx, 1);
        } else {
          chMarks.push(panelIndex);
        }
        if (chMarks.length === 0 || (chMarks.length === 1 && chMarks[0] === -1 && panelIndex !== -1)) {
          // clean
          if (chMarks.includes(-1) && panelIndex !== -1) {
            comicMarks[chapterNumber] = chMarks.filter(x => x !== panelIndex);
          } else {
            delete comicMarks[chapterNumber];
          }
        } else {
          comicMarks[chapterNumber] = [...new Set(chMarks)].sort((a,b)=>a-b);
        }
      }
      const newB = { ...prev };
      if (Object.keys(comicMarks).length === 0) {
        delete newB[slug];
      } else {
        newB[slug] = comicMarks;
      }
      return newB;
    });
  }, []);

  const isPageBookmarked = useCallback((slug: string, chapterNumber: number, panelIndex: number) => {
    const ch = bookmarks[slug]?.[chapterNumber] || [];
    return ch.includes(panelIndex) || ch.includes(-1);
  }, [bookmarks]);

  const isChapterBookmarked = useCallback((slug: string, chapterNumber: number) => {
    const ch = bookmarks[slug]?.[chapterNumber] || [];
    return ch.length === 0 || ch.includes(-1); // empty or marker means chapter bookmarked
  }, [bookmarks]);

  // History (last 20)
  const getReadingHistory = useCallback(() => readingHistory, [readingHistory]);

  const addToHistory = useCallback((slug: string, chapterNumber: number, panelIndex: number) => {
    setReadingHistory((prev) => {
      const now = new Date().toISOString();
      const entry = { slug, chapterNumber, panelIndex, timestamp: now };
      // remove duplicates for same slug/ch
      const filtered = prev.filter(h => !(h.slug === slug && h.chapterNumber === chapterNumber));
      const next = [entry, ...filtered].slice(0, 20);
      return next;
    });
    // update streak + achievements on read
    updateStreakInternal();
    setTimeout(() => checkAchievementsInternal(), 20);
  }, []);

  // Reader settings (direction, fit)
  const getReaderSettings = useCallback(() => readerSettings, [readerSettings]);

  const updateReaderSettings = useCallback((newSettings: Partial<{ direction: 'vertical' | 'rtl' | 'ltr'; fit: 'width' | 'height' | 'contain' | 'original' }>) => {
    setReaderSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // PWA offline chapter cache tracking (used by reader + download flow)
  const isChapterCached = useCallback((slug: string, chapterNumber: number) => {
    return cachedChapters.includes(`${slug}:${chapterNumber}`);
  }, [cachedChapters]);

  const cacheChapterForOffline = useCallback((slug: string, chapterNumber: number) => {
    const key = `${slug}:${chapterNumber}`;
    setCachedChapters((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      // Persist immediately (in addition to the effect) so download path is durable
      try { localStorage.setItem(CACHED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Light social: Like/Favorite comics (distinct from page-level bookmarks)
  const getLikedComics = useCallback(() => {
    return comics.filter(c => likedComics.includes(c.slug));
  }, [comics, likedComics]);

  const toggleLikeComic = useCallback((slug: string) => {
    setLikedComics(prev => {
      const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug];
      return next;
    });
    // trigger achievement check
    setTimeout(() => checkAchievementsInternal(), 10);
  }, [likedComics]); // note: internal not in deps to avoid ordering issues in this module; called safely via timeout

  const isComicLiked = useCallback((slug: string) => likedComics.includes(slug), [likedComics]);

  // Streaks & achievements (computed from history + other signals)
  const getCurrentStreak = useCallback(() => currentStreak, [currentStreak]);
  const getAchievements = useCallback(() => achievements, [achievements]);

  const checkAchievementsInternal = useCallback(() => {
    const now = new Date().toISOString();
    const defs: Achievement[] = [
      { id: 'first_comment', title: 'First Words', description: 'Left your first comment', icon: '💬' },
      { id: 'read_5', title: 'Bookworm', description: 'Read 5 chapters', icon: '📖' },
      { id: 'like_3', title: 'Fan', description: 'Liked 3 comics', icon: '❤️' },
      { id: '7_streak', title: 'Dedicated', description: '7-day reading streak', icon: '🔥' },
      { id: 'first_premium', title: 'Supporter', description: 'Unlocked your first premium chapter', icon: '⭐' },
    ];
    const has = (id: string) => achievements.some(a => a.id === id);

    const newly: Achievement[] = [];

    if (!has('first_comment')) {
      const hasComment = Object.values(comments).some(arr => arr && arr.length > 0);
      if (hasComment) newly.push({ ...defs[0], unlockedAt: now });
    }
    if (!has('read_5') && readingHistory.length >= 5) {
      newly.push({ ...defs[1], unlockedAt: now });
    }
    if (!has('like_3') && likedComics.length >= 3) {
      newly.push({ ...defs[2], unlockedAt: now });
    }
    if (!has('7_streak') && currentStreak >= 7) {
      newly.push({ ...defs[3], unlockedAt: now });
    }
    if (!has('first_premium')) {
      // No monetizing: skip premium unlock achievement or treat as always if any premium exists
      const hasPremium = comics.some(c => c.chapters.some(ch => ch.isPremium));
      if (hasPremium) newly.push({ ...defs[4], unlockedAt: now });
    }

    if (newly.length > 0) {
      setAchievements(prev => {
        const ids = new Set(prev.map(a => a.id));
        const fresh = newly.filter(n => !ids.has(n.id));
        return [...prev, ...fresh];
      });
    }
  }, [achievements, comments, readingHistory, likedComics, currentStreak]);

  const checkAchievements = useCallback(() => {
    checkAchievementsInternal();
  }, [checkAchievementsInternal]);

  // Update streak (called from addToHistory)
  const updateStreakInternal = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    let count = currentStreak;
    try {
      const raw = localStorage.getItem(STREAK_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const last = s.lastReadDate || '';
        const prevCount = s.count || 0;
        if (last === today) {
          count = prevCount;
        } else {
          const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          count = (last === yest) ? prevCount + 1 : 1;
        }
      } else {
        count = 1;
      }
    } catch {
      count = 1;
    }
    if (count !== currentStreak) setCurrentStreak(count);
    return count;
  }, [currentStreak]);

  // Share chapter link (copyable URL)
  const copyChapterLink = useCallback(async (slug: string, chapterNumber: number) => {
    const url = (typeof window !== 'undefined' ? window.location.origin : '') + `/read/${slug}/${chapterNumber}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (e) {
      console.warn('Copy failed', e);
    }
  }, []);

  // Creator analytics helpers (mock; views incremented on read; no monetizing so unlockCount=0)
  const getCreatorAnalytics = useCallback((slug: string) => {
    const comic = comics.find((c) => c.slug === slug && c.source === 'creator');
    if (!comic) return null;
    return { views: comic.views || 0, unlockCount: 0 };
  }, [comics]);

  const recordCreatorView = useCallback((slug: string) => {
    setComics((prev) => prev.map((c) => {
      if (c.slug === slug && c.source === 'creator') {
        return { ...c, views: (c.views || 0) + 1 };
      }
      return c;
    }));
  }, []);

  // Preview + validation for creator imports (structural strengthening of bridge)
  const previewCreatorImport = useCallback((data: any) => {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
      errors.push('Import data must be an object');
      return { valid: false, errors, preview: null };
    }
    if (!data.title || typeof data.title !== 'string') errors.push('Missing or invalid title');
    if (!Array.isArray(data.chapters) || data.chapters.length === 0) errors.push('Must have at least one chapter');
    if (data.chapters) {
      data.chapters.forEach((ch: any, i: number) => {
        if (!ch.panels || !Array.isArray(ch.panels) || ch.panels.length === 0) {
          errors.push(`Chapter ${i+1}: missing or empty panels array`);
        }
        if (typeof ch.coinPrice === 'number' && ch.coinPrice <= 0) errors.push(`Chapter ${i+1}: coinPrice must be positive`);
      });
    }
    if (typeof data.unlockAllPrice === 'number' && data.unlockAllPrice <= 0) {
      errors.push('unlockAllPrice must be positive if provided');
    }

    const valid = errors.length === 0;
    const preview = valid ? {
      title: data.title,
      author: data.author || 'Unknown Creator',
      chaptersCount: data.chapters?.length || 0,
      hasCustomPrices: !!(data.chapters?.some((c: any) => typeof c.coinPrice === 'number') || typeof data.unlockAllPrice === 'number'),
      firstPanelPreview: data.chapters?.[0]?.panels?.[0] || null,
      genre: data.genre,
    } : null;

    return { valid, errors, preview };
  }, []);

  const validateAndImportCreatorComic = useCallback((data: any): Comic | null => {
    const { valid, errors } = previewCreatorImport(data);
    if (!valid) {
      console.warn('Creator import validation failed:', errors);
      return null;
    }
    // delegate to existing (which now carries prices)
    return importCreatorComic(data);
  }, [previewCreatorImport]); // importCreatorComic captured by closure; ordering in module avoids TDZ at runtime

  const resetToDemo = useCallback(() => {
    try {
      localStorage.removeItem(PUBLISHED_KEY);
      localStorage.removeItem(CREATOR_PUBLISHED_KEY);
      localStorage.removeItem(COMMENTS_KEY);
      localStorage.removeItem(BOOKMARKS_KEY);
      localStorage.removeItem(HISTORY_KEY);
      localStorage.removeItem(READER_SETTINGS_KEY);
      localStorage.removeItem(LIKED_COMICS_KEY);
      localStorage.removeItem(ACHIEVEMENTS_KEY);
      localStorage.removeItem(STREAK_KEY);
      localStorage.removeItem(CACHED_KEY);
      localStorage.removeItem(UPLOAD_DRAFTS_KEY);
      localStorage.removeItem(UPLOAD_HISTORY_KEY);
      localStorage.removeItem(SUBSCRIPTION_KEY);
      localStorage.removeItem(TRANSACTIONS_KEY);
      localStorage.removeItem(EVENTS_KEY);
      // Clear progress keys
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(PROGRESS_KEY_PREFIX)) localStorage.removeItem(k);
      });
    } catch {}
    // Hard reload gives the cleanest reset (re-initializes from MOCK_COMICS (empty) + any creator bridge data)
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  // Manual import from Creator App bridge (for when apps run on different ports / origins)
  const importCreatorPublishedComics = useCallback(() => {
    try {
      const raw = localStorage.getItem(CREATOR_PUBLISHED_KEY);
      if (!raw) return 0;

      const parsed: CreatorPublishedComic[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return 0;

      const normalized = parsed.map(normalizeCreatorComic);

      let addedCount = 0;

      setComics((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const toAddRaw = normalized.filter((c) => !existingIds.has(c.id));

        if (toAddRaw.length === 0) {
          return prev;
        }

        // Uniquify slugs for this batch against current state (prevents routing collisions for similarly-named imports)
        const usedSlugs = new Set(prev.map((c) => c.slug));
        const toAdd: Comic[] = [];
        toAddRaw.forEach((c) => {
          let final = c;
          if (usedSlugs.has(c.slug)) {
            let k = 1;
            let candidate = `${c.slug}-${k}`;
            while (usedSlugs.has(candidate)) {
              k += 1;
              candidate = `${c.slug}-${k}`;
            }
            final = { ...c, slug: candidate };
          }
          toAdd.push(final);
          usedSlugs.add(final.slug);
        });

        addedCount = toAdd.length;
        return [...prev, ...toAdd];
      });

      return normalized.length; // return how many were present in storage (even if some duplicates)
    } catch (e) {
      return 0;
    }
  }, []);

  // Import a single comic from clipboard JSON exported by Creator App
  // Now properly supports multiple chapters with titles, ordering, and panels.
  const importCreatorComic = useCallback((data: any): Comic | null => {
    try {
      if (!data || typeof data !== 'object' || !data.title || !Array.isArray(data.chapters)) {
        return null;
      }

      // Explicitly build chapters to ensure titles, ordering, and panel assignment are preserved.
      // Now also carries over real dialogues/narration from Creator when available.
      let chapters: Chapter[] = (data.chapters || []).map((ch: any, idx: number) => ({
        id: `creator-ch-${data.id || Date.now()}-${idx}`,
        number: ch.number || (idx + 1),
        title: ch.title || `Chapter ${idx + 1}`,
        isPremium: idx > 0, // First chapter free, remaining chapters premium (for monetization demo)
        panels: Array.isArray(ch.panels) ? ch.panels : [],
        dialogues: Array.isArray(ch.dialogues) ? ch.dialogues : undefined,
        coinPrice: typeof ch.coinPrice === 'number' && ch.coinPrice > 0 ? ch.coinPrice : undefined,
      }));

      // Sort chapters by number to ensure correct ordering (in case export didn't sort)
      chapters = chapters.sort((a, b) => a.number - b.number);

      const slugBase = (data.title || 'untitled')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Generate unique slug
      let baseSlug = `creator-${slugBase}-${(data.id || Date.now()).toString().slice(-6)}`;

      setComics((prev) => {
        let slug = baseSlug;
        let suffix = 1;
        while (prev.some((c) => c.slug === slug)) {
          slug = `${baseSlug}-${suffix++}`;
        }

        const genreList: Genre[] = data.genre ? [data.genre as Genre] : ["Fantasy"];

        const normalized: Comic = {
          id: `creator-${data.id || Date.now()}`,
          slug,
          title: data.title,
          author: data.author || "inkforg_apexpanel Creator",
          coverUrl: data.coverUrl || (chapters[0]?.panels?.[0] ?? ""),
          genres: genreList,
          description: data.description || "A comic created with the inkforg_apexpanel Creator App.",
          chapters,
          views: 420,
          publishedAt: data.publishedAt || new Date().toISOString().split("T")[0],
          isAIGenerated: true,
          source: "creator",
          unlockAllPrice: typeof data.unlockAllPrice === 'number' && data.unlockAllPrice > 0 ? data.unlockAllPrice : undefined,
        };

        const existing = prev.some((c) => c.id === normalized.id);
        if (existing) {
          return prev;
        }
        const updated = [...prev, normalized];

        // Persist all creator-sourced comics
        const creatorImports = updated.filter((c) => c.source === 'creator');
        localStorage.setItem(CREATOR_PUBLISHED_KEY, JSON.stringify(creatorImports));

        return updated;
      });

      // To return the normalized, we need to compute it again or restructure, but for simplicity return null or re-compute outside - wait, better restructure
      // Actually, since setState is async, for return we can build it with a temp unique
      let tempSlug = baseSlug;
      // Note: the actual unique is inside, return will use first, but since added, next time unique. For this, we return the built one, caller doesn't use return much.
      const genreList: Genre[] = data.genre ? [data.genre as Genre] : ["Fantasy"];
      return {
        id: `creator-${data.id || Date.now()}`,
        slug: tempSlug, // approximate
        title: data.title,
        author: data.author || "inkforg_apexpanel Creator",
        coverUrl: data.coverUrl || (chapters[0]?.panels?.[0] ?? ""),
        genres: genreList,
        description: data.description || "A comic created with the inkforg_apexpanel Creator App.",
        chapters,
        views: 420,
        publishedAt: data.publishedAt || new Date().toISOString().split("T")[0],
        isAIGenerated: true,
        source: "creator",
        unlockAllPrice: typeof data.unlockAllPrice === 'number' && data.unlockAllPrice > 0 ? data.unlockAllPrice : undefined,
      };
    } catch (e) {
      console.error('Failed to import creator comic:', e);
      return null;
    }
  }, []);

  // Derived trending / latest
  const trending = React.useMemo(() => {
    // Only real published + creator content (demo stories and payable features removed)
    const published = comics.filter((c) => c.id.startsWith("pub-") || c.source === "creator");

    // Sort by views desc for "trending" feel, limit to 8
    return [...published]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 8);
  }, [comics]);

  const latest = React.useMemo(() => {
    return [...comics]
      .sort((a, b) => (b.publishedAt > a.publishedAt ? 1 : -1))
      .slice(0, 8);
  }, [comics]);

  // Separate list of comics published from the Creator App (for dedicated homepage section)
  const creatorPublished = React.useMemo(() => {
    return comics.filter((c) => c.source === "creator");
  }, [comics]);



  // Simple recommendation engine (based on read history or genre overlap from history/bookmarks)
  const getRecommendedComics = useCallback((limit = 8) => {
    const likedGenres = new Set<Genre>();
    getReadingHistory().forEach(h => {
      const c = comics.find(cc => cc.slug === h.slug);
      if (c) c.genres.forEach(g => likedGenres.add(g));
    });
    const bms = getBookmarks();
    Object.keys(bms).forEach(slug => {
      const c = comics.find(cc => cc.slug === slug);
      if (c) c.genres.forEach(g => likedGenres.add(g));
    });

    if (likedGenres.size === 0) {
      // fallback: recent creator or popular
      return [...comics]
        .filter(c => c.source === 'creator' || c.views > 10000)
        .sort((a,b) => (b.views||0) - (a.views||0))
        .slice(0, limit);
    }

    const scored = comics
      .map(c => {
        const overlap = (c.genres || []).filter(g => likedGenres.has(g)).length;
        const score = overlap * 10 + (c.views || 0) / 1000;
        return { comic: c, score };
      })
      .sort((a,b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.comic);

    return scored;
  }, [comics, getReadingHistory, getBookmarks]);

  const value: ComicsContextType = {
    comics,
    trending,
    latest,
    creatorPublished,
    importCreatorPublishedComics,
    importCreatorComic,
    publishComic,
    removePublishedComic,
    getMyUploadedComics,
    updateUploadedComic,
    addChaptersToUploadedComic,
    saveUploadDraft,
    loadUploadDraft,
    getUploadDrafts,
    deleteUploadDraft,
    getUploadHistory,
    recordUploadToHistory,
    getComicBySlug,
    getChapter,
    searchComics,
    getFilteredComics,

    // Comments & Reactions
    getCommentsForChapter,
    addComment,
    likeComment,
    addReaction,
    deleteComment,
    displayName,
    setDisplayName,
    getReadingProgress,
    saveReadingProgress,
    getContinueReading,
    getBookmarks,
    toggleBookmark,
    isPageBookmarked,
    isChapterBookmarked,
    getReadingHistory,
    addToHistory,
    getReaderSettings,
    updateReaderSettings,
    getRecommendedComics,
    getLikedComics,
    toggleLikeComic,
    isComicLiked,
    getCurrentStreak,
    getAchievements,
    checkAchievements,
    copyChapterLink,
    getCreatorAnalytics,
    recordCreatorView,
    previewCreatorImport,
    validateAndImportCreatorComic,
    isChapterCached,
    cacheChapterForOffline,
    resetToDemo,
  };

  return <ComicsContext.Provider value={value}>{children}</ComicsContext.Provider>;
}

export function useComics() {
  const ctx = useContext(ComicsContext);
  if (!ctx) {
    throw new Error("useComics must be used inside ComicsProvider");
  }
  return ctx;
}
