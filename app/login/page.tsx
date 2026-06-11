"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "../lib/UserContext";
import { motion } from "framer-motion";
import { BookOpen, Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { signInWithPassword, signInWithOAuth, loading: authLoading } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = search.get("next") || "/";

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.push(next);
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithOAuth("google");
      // Redirect happens via Supabase + our /auth/callback
    } catch (e: any) {
      setError(e?.message || "Google sign-in failed");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-2xl font-semibold tracking-tight">Welcome back</div>
          <div className="text-sm text-[var(--text-muted)]">Sign in to access your library, coins, and public comics.</div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-[var(--border)] p-6">
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="text-xs text-[var(--text-muted)]">Email</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 focus-within:border-[var(--accent)]">
              <Mail size={16} className="text-[var(--text-muted)]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--text-muted)]">Password</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 focus-within:border-[var(--accent)]">
              <Lock size={16} className="text-[var(--text-muted)]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || authLoading}
            className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <div className="h-px flex-1 bg-[var(--border)]" />
          or
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <button
          onClick={handleGoogle}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-2.5 text-sm font-medium hover:bg-[var(--bg-elev)] transition flex items-center justify-center gap-2"
        >
          Continue with Google
        </button>

        <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[var(--accent)] hover:underline">
            Create one
          </Link>
        </div>

        <div className="mt-3 text-[10px] text-center text-[var(--text-muted)]">
          Public comics and your personal library, unlocks, and progress are synced via Supabase.
        </div>
      </div>

      <p className="mt-6 text-center text-[10px] text-[var(--text-muted)]">
        By signing in you agree to the demo terms. Configure OAuth providers in your Supabase dashboard.
      </p>
    </div>
  );
}
