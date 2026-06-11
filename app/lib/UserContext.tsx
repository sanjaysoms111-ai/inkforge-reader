"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase/client";

interface Profile {
  id: string;
  display_name: string | null;
  coin_balance: number;
}

interface UserContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  // Auth
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithOAuth: (provider: "google" | "github") => Promise<void>;
  signOut: () => Promise<void>;
  // Profile / coins (server-backed)
  refreshProfile: () => Promise<void>;
  coinBalance: number;
  // Unlocks + favorites (will be server-backed; initial in-memory + LS fallback)
  isChapterUnlocked: (slug: string, chapterNumber: number) => boolean;
  unlockChapter: (slug: string, chapterNumber: number, cost: number) => Promise<{ success: boolean; newBalance?: number; error?: string }>;
  // Favorites (synced to server when possible)
  isComicFavorited: (slug: string) => boolean;
  toggleFavorite: (slug: string) => Promise<void>;
  // Unlocked list for library tab (keys from local + server)
  getUnlockedList: () => Array<{ slug: string; chapterNumber: number }>;
  // Display name convenience (prefers profile)
  displayName: string;
  setDisplayName: (name: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const UNLOCKS_LS_KEY = "inkforg_apexpanel:user_unlocks"; // fallback while offline / pre-schema
const FAVORITES_LS_KEY = "inkforg_apexpanel:likedComics"; // reuse existing key for migration path

export function UserProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Local fallbacks for unlocks/favorites (synced on login, used offline)
  const [unlocks, setUnlocks] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<string[]>([]);

  const coinBalance = profile?.coin_balance ?? 0;
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Reader";

  // Load initial session + subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(data.session);
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        await loadProfileAndLocal(data.session.user.id);
      } else {
        // Anonymous: still load any local fallbacks so reader etc. feel familiar
        loadLocalFallbacks();
      }
      setLoading(false);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      const newUser = newSession?.user ?? null;
      setUser(newUser);

      if (newUser) {
        await loadProfileAndLocal(newUser.id);
      } else {
        setProfile(null);
        loadLocalFallbacks();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function loadProfileAndLocal(userId: string) {
    // Try server profile (will be empty until SQL schema is applied — graceful fallback)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, coin_balance")
        .eq("id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        // Table may not exist yet — use local starter profile
        console.warn("[UserContext] profiles table not ready or RLS issue, using local fallback", error.message);
      }

      if (data) {
        setProfile(data as Profile);
      } else {
        // Ensure a profile row exists (starter coins). If table missing this will no-op until schema.
        const starterName = localStorage.getItem("inkforg_apexpanel:displayName") || null;
        const { data: inserted } = await supabase
          .from("profiles")
          .insert({ id: userId, display_name: starterName, coin_balance: 50 })
          .select()
          .single();

        if (inserted) setProfile(inserted as Profile);
        else setProfile({ id: userId, display_name: starterName, coin_balance: 50 });
      }
    } catch (e) {
      // Full offline or no table: local starter
      setProfile({
        id: userId,
        display_name: localStorage.getItem("inkforg_apexpanel:displayName") || null,
        coin_balance: 50,
      });
    }

    // Load unlocks + favorites (server first, then merge LS)
    loadServerUnlocksAndFavs(userId).catch(() => {
      loadLocalFallbacks();
    });
  }

  async function loadServerUnlocksAndFavs(userId: string) {
    // Unlocks (chapter_id based or slug+num; we use slug+num for simplicity until chapters table stable)
    // For now we store a simple map in memory + LS; later we can join.
    try {
      // Placeholder: when schema + unlocks table ready we would query here.
      // Until then fall back + keep local.
    } catch {}

    loadLocalFallbacks();
  }

  function loadLocalFallbacks() {
    try {
      const savedUnlocks = localStorage.getItem(UNLOCKS_LS_KEY);
      if (savedUnlocks) setUnlocks(JSON.parse(savedUnlocks));
    } catch {}
    try {
      const savedFavs = localStorage.getItem(FAVORITES_LS_KEY);
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
    } catch {}
  }

  // Persist local fallbacks (used until full server unlock/progress wiring)
  useEffect(() => {
    try { localStorage.setItem(UNLOCKS_LS_KEY, JSON.stringify(unlocks)); } catch {}
  }, [unlocks]);

  useEffect(() => {
    try { localStorage.setItem(FAVORITES_LS_KEY, JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, coin_balance")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data as Profile);
    } catch {
      /* ignore until schema */
    }
  }, [user, supabase]);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split("@")[0] },
      },
    });
    if (error) return { error: error.message };
    // Profile row will be created on first login via loadProfileAndLocal or DB trigger.
    return {};
  }, [supabase]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, [supabase]);

  const signInWithOAuth = useCallback(async (provider: "google" | "github") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUnlocks({});
    setFavorites([]);
  }, [supabase]);

  const setDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!user) {
      // Anonymous fallback (existing behavior)
      localStorage.setItem("inkforg_apexpanel:displayName", trimmed);
      return;
    }
    setProfile((prev) => (prev ? { ...prev, display_name: trimmed } : prev));
    try {
      await supabase.from("profiles").update({ display_name: trimmed }).eq("id", user.id);
    } catch {
      /* table may not exist yet */
    }
  }, [user, supabase]);

  // === Premium / unlock (re-introduced; full server action wiring in later steps) ===
  const getUnlockKey = (slug: string, chapterNumber: number) => `${slug}:${chapterNumber}`;

  const isChapterUnlocked = useCallback((slug: string, chapterNumber: number): boolean => {
    // First chapter is always free (invariant)
    if (chapterNumber === 1) return true;
    const key = getUnlockKey(slug, chapterNumber);
    return !!unlocks[key];
  }, [unlocks]);

  const unlockChapter = useCallback(async (slug: string, chapterNumber: number, cost: number): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
    if (chapterNumber === 1) return { success: true }; // free
    const key = getUnlockKey(slug, chapterNumber);
    if (unlocks[key]) return { success: true };

    const currentBalance = profile?.coin_balance ?? 0;
    if (currentBalance < cost) {
      return { success: false, error: "Not enough coins" };
    }

    // Optimistic local
    const nextBalance = currentBalance - cost;
    setUnlocks((prev) => ({ ...prev, [key]: true }));
    if (profile) {
      setProfile({ ...profile, coin_balance: nextBalance });
    }

    // TODO (next phases): call server action / rpc spend_coins_and_unlock.
    // For now also persist a local marker (will be replaced by server truth on refresh).
    try {
      // If profile row exists, best-effort decrement (will be authoritative later via actions)
      if (user) {
        await supabase
          .from("profiles")
          .update({ coin_balance: nextBalance })
          .eq("id", user.id);
      }
    } catch {}

    return { success: true, newBalance: nextBalance };
  }, [unlocks, profile, user, supabase]);

  // Favorites (reuse likedComics key for now; later full table)
  const isComicFavorited = useCallback((slug: string) => favorites.includes(slug), [favorites]);

  const toggleFavorite = useCallback(async (slug: string) => {
    setFavorites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      return next;
    });
    // Best effort server sync (table may not exist)
    if (user) {
      try {
        if (favorites.includes(slug)) {
          await supabase.from("favorites").delete().eq("user_id", user.id).eq("slug", slug);
        } else {
          await supabase.from("favorites").insert({ user_id: user.id, slug });
        }
      } catch {}
    }
  }, [favorites, user, supabase]);

  const getUnlockedList = useCallback(() => {
    return Object.keys(unlocks).map((key) => {
      const [slug, chStr] = key.split(':');
      return { slug, chapterNumber: parseInt(chStr, 10) || 0 };
    });
  }, [unlocks]);

  const value: UserContextType = {
    user,
    session,
    profile,
    loading,
    signUp,
    signInWithPassword,
    signInWithOAuth,
    signOut,
    refreshProfile,
    coinBalance,
    isChapterUnlocked,
    unlockChapter,
    isComicFavorited,
    toggleFavorite,
    getUnlockedList,
    displayName,
    setDisplayName,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used inside UserProvider");
  }
  return ctx;
}
