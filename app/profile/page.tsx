"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "../lib/UserContext";
import { useComics } from "../lib/ComicsContext";
import { 
  User, Mail, Coins, Calendar, BookOpen, Heart, LogOut, Save, Edit2, Library 
} from "lucide-react";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const router = useRouter();
  const { 
    user, 
    profile, 
    setDisplayName, 
    signOut, 
    coinBalance, 
    refreshProfile, 
    loading: userLoading 
  } = useUser();

  const { getMyUploadedComics, getLikedComics } = useComics();

  const [isEditingName, setIsEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaveSuccess, setNameSaveSuccess] = useState(false);

  // Compute stats from context (hybrid: local + Supabase public owned)
  const myComics = getMyUploadedComics();
  const totalComics = myComics.length;
  const totalChapters = myComics.reduce((sum, comic) => sum + (comic.chapters?.length || 0), 0);
  const favoritesCount = getLikedComics().length;

  const joinDate = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString(undefined, { 
        year: 'numeric', month: 'long', day: 'numeric' 
      })
    : user?.created_at 
      ? new Date(user.created_at).toLocaleDateString(undefined, { 
          year: 'numeric', month: 'long', day: 'numeric' 
        })
      : "Unknown";

  if (userLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-[var(--text-muted)]">
        Loading your Inkforge Account...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-muted)] mb-4">Please sign in to view your profile.</p>
          <Link href="/login" className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const handleStartEditName = () => {
    setNewDisplayName(profile?.display_name || "");
    setIsEditingName(true);
    setNameSaveSuccess(false);
  };

  const handleSaveName = async () => {
    const trimmed = newDisplayName.trim();
    if (!trimmed) return;

    setSavingName(true);
    try {
      await setDisplayName(trimmed);
      setNameSaveSuccess(true);
      setTimeout(() => setNameSaveSuccess(false), 2000);
    } catch (e) {
      // setDisplayName handles best effort
    } finally {
      setSavingName(false);
      setIsEditingName(false);
      // Refresh to pick up any server change
      refreshProfile();
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setNewDisplayName("");
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] py-12 px-4">
      <div className="mx-auto max-w-3xl">
        {/* Header - branded like signup/login */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-600 shadow-sm">
            <User className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">Your Inkforge Account</h1>
          <p className="mt-2 text-[var(--text-muted)] max-w-md mx-auto">
            Manage your profile, view your activity, and control your Inkforge presence.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          {/* Account Information */}
          <div className="md:col-span-3 glass rounded-2xl border border-[var(--border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <User size={18} /> Account Information
              </h2>
              {nameSaveSuccess && (
                <span className="text-xs text-emerald-400">Saved!</span>
              )}
            </div>

            <div className="space-y-5 text-sm">
              {/* Display Name (editable) */}
              <div>
                <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-1">Display Name</div>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="Your display name"
                      disabled={savingName}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName || !newDisplayName.trim()}
                      className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-1 disabled:opacity-60"
                    >
                      <Save size={14} /> {savingName ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={savingName}
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--bg-card)]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-base">
                      {profile?.display_name || "Not set"}
                    </span>
                    <button
                      onClick={handleStartEditName}
                      className="text-[var(--accent)] hover:underline flex items-center gap-1 text-xs"
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-1">Email</div>
                <div className="font-medium flex items-center gap-2">
                  <Mail size={15} className="text-[var(--text-muted)]" /> {user.email}
                </div>
              </div>

              {/* Coins */}
              <div>
                <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-1">Coins Balance</div>
                <div className="font-semibold text-amber-400 flex items-center gap-2 text-lg">
                  <Coins size={18} /> {coinBalance}
                </div>
              </div>

              {/* Join Date */}
              <div>
                <div className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-1">Member Since</div>
                <div className="font-medium flex items-center gap-2">
                  <Calendar size={15} className="text-[var(--text-muted)]" /> {joinDate}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="md:col-span-2 glass rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BookOpen size={18} /> Your Activity
            </h2>

            <div className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-[var(--border)] pb-3">
                <div className="text-[var(--text-muted)]">Comics Uploaded</div>
                <div className="text-3xl font-semibold tabular-nums">{totalComics}</div>
              </div>
              <div className="flex items-baseline justify-between border-b border-[var(--border)] pb-3">
                <div className="text-[var(--text-muted)]">Chapters Published</div>
                <div className="text-3xl font-semibold tabular-nums">{totalChapters}</div>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-[var(--text-muted)] flex items-center gap-1.5">
                  <Heart size={15} className="text-red-400" /> Favorites
                </div>
                <div className="text-3xl font-semibold tabular-nums">{favoritesCount}</div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
              Stats combine your local uploads and Supabase-synced public comics you own.
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div className="mt-6 glass rounded-2xl border border-[var(--border)] p-6">
          <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link 
              href="/library" 
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm hover:bg-[var(--bg-card)] transition"
            >
              <Library size={16} /> My Library
            </Link>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-5 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Your data (uploads, progress, favorites) is safely stored in Supabase when signed in.
          </p>
        </div>

        <div className="mt-8 text-center text-[10px] text-[var(--text-muted)]">
          This is your personal Inkforge Account dashboard. More settings (avatar, notifications, transaction history) coming soon.
        </div>
      </div>
    </div>
  );
}
