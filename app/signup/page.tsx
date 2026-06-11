"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "../lib/UserContext";
import { BookOpen, Mail, Lock, User as UserIcon } from "lucide-react";

// Inner component (for future-proofing and consistent Suspense pattern)
function SignupContent() {
  const router = useRouter();
  const { signUp, signInWithOAuth, loading: authLoading } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setBusy(true);

    const res = await signUp(email.trim(), password, displayName.trim() || undefined);
    setBusy(false);

    if (res?.error) {
      setError(res.error);
      return;
    }

    // Supabase may require email confirmation depending on project settings.
    setSuccessMsg("Account created. Check your email for a confirmation link (if required), then sign in.");
    // Optional auto-redirect after short delay for projects without confirm required
    setTimeout(() => router.push("/login"), 1400);
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithOAuth("google");
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
          <div className="text-2xl font-semibold tracking-tight">Create your account</div>
          <div className="text-sm text-[var(--text-muted)]">Join to publish publicly, earn &amp; spend coins, and share your library.</div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-[var(--border)] p-6">
        {successMsg ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            {successMsg}
            <div className="mt-3">
              <Link href="/login" className="underline">Go to login →</Link>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-muted)]">Display name (optional)</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 focus-within:border-[var(--accent)]">
                  <UserIcon size={16} className="text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                    placeholder="Alex Reader"
                  />
                </div>
              </div>

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
                <label className="text-xs text-[var(--text-muted)]">Password (min 6 chars)</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 focus-within:border-[var(--accent)]">
                  <Lock size={16} className="text-[var(--text-muted)]" />
                  <input
                    type="password"
                    required
                    minLength={6}
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
                {busy ? "Creating account..." : "Create account"}
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
              Sign up with Google
            </button>

            <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
              Already have an account?{" "}
              <Link href="/login" className="text-[var(--accent)] hover:underline">
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-[10px] text-[var(--text-muted)]">
        You will receive 50 starter coins. First chapter of every comic is always free.
      </p>
    </div>
  );
}

// Wrapper with Suspense boundary (for consistent pattern with login and to satisfy build requirements for client pages)
export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-md px-4 py-16 text-center text-[var(--text-muted)]">
        Loading signup form...
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
