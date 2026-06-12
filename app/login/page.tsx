"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "../lib/UserContext";
import { BookOpen, Mail, Lock, Eye, EyeOff, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Inner component that safely uses useSearchParams (must be inside Suspense)
function LoginContent() {
  const router = useRouter();
  const search = useSearchParams();
  const { signInWithPassword, signInWithOAuth, resetPasswordForEmail, loading: authLoading } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Forgot password modal state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotBusy, setForgotBusy] = useState(false);

  const next = search.get("next") || "/library";  // default to library for Inkforge feel

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Real-time style validation on submit
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setBusy(true);
    const res = await signInWithPassword(email.trim(), password);
    setBusy(false);

    if (res?.error) {
      setError(res.error);
      return;
    }

    // Smooth redirect (success flow)
    router.push(next);
  }

  async function handleForgotSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail) {
      setForgotError("Please enter your email address.");
      return;
    }

    setForgotBusy(true);
    const res = await resetPasswordForEmail(trimmedEmail);
    setForgotBusy(false);

    if (res?.error) {
      // User-friendly errors
      const msg = res.error.toLowerCase().includes("not found") || res.error.toLowerCase().includes("no user")
        ? "No account found with that email. Please check the address or create an account."
        : res.error;
      setForgotError(msg);
      return;
    }

    setForgotSuccess("Password reset link sent to your email. Please check your inbox (and spam folder).");
    // Keep email in field for UX, but clear error
    setForgotError(null);
  }

  function openForgotModal() {
    setShowForgot(true);
    setForgotEmail(email); // convenient prefill from login form
    setForgotError(null);
    setForgotSuccess(null);
  }

  function closeForgotModal() {
    setShowForgot(false);
    // Reset internal state when closing
    setForgotBusy(false);
    setForgotError(null);
    setForgotSuccess(null);
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithOAuth("google");
      // Redirect handled by Supabase OAuth + /auth/callback
    } catch (e: any) {
      setError(e?.message || "Google sign-in failed");
    }
  }

  return (
    <>
      <div className="mx-auto max-w-md px-4 py-16">
        {/* Branded Inkforge header matching signup quality */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 shadow-sm">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <div className="text-3xl font-semibold tracking-tight">Sign in to your Inkforge Account</div>
          <div className="mt-2 text-sm text-[var(--text-muted)] max-w-xs mx-auto">
            Access your library, coins, uploads, and public comics.
          </div>
        </div>

        <div className="glass rounded-2xl border border-[var(--border)] p-6 shadow-sm">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Email</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 focus-within:border-[var(--accent)]">
                <Mail size={16} className="text-[var(--text-muted)]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                  placeholder="you@inkforge.app"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--text-muted)]">Password</label>
                <button
                  type="button"
                  onClick={openForgotModal}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 focus-within:border-[var(--accent)]">
                <Lock size={16} className="text-[var(--text-muted)]" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
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
              className="btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {busy ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Secondary Google option - matches signup styling */}
          <div className="my-5 flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <div className="h-px flex-1 bg-[var(--border)]" />
            or continue with Google
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={busy || authLoading}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-2.5 text-sm font-medium hover:bg-[var(--bg-elev)] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            Continue with Google
          </button>

          <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
            Don&apos;t have an Inkforge Account?{" "}
            <Link href="/signup" className="text-[var(--accent)] hover:underline font-medium">
              Create one
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-[var(--text-muted)]">
          Your Inkforge Account keeps your library, progress, and coins in sync.
        </p>
      </div>

      {/* Forgot Password Modal - clean, matches login/signup glass/dark branding */}
      <AnimatePresence>
        {showForgot && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            onClick={closeForgotModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl glass border border-[var(--border)] bg-[var(--bg-elev)] p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-lg font-semibold tracking-tight">Reset your password</div>
                  <div className="text-sm text-[var(--text-muted)]">We'll email you a secure link.</div>
                </div>
                <button onClick={closeForgotModal} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
                  <X size={18} />
                </button>
              </div>

              {forgotSuccess ? (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-400">
                  {forgotSuccess}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={closeForgotModal}
                      className="flex-1 rounded-xl border border-[var(--border)] py-2 text-sm hover:bg-[var(--bg-card)]"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        closeForgotModal();
                      }}
                      className="flex-1 rounded-xl bg-[var(--accent)] py-2 text-sm font-medium text-white hover:brightness-110"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)]">Email address</label>
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 focus-within:border-[var(--accent)]">
                      <Mail size={16} className="text-[var(--text-muted)]" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                        placeholder="you@inkforge.app"
                        disabled={forgotBusy}
                      />
                    </div>
                  </div>

                  {forgotError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                      {forgotError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotBusy || !forgotEmail.trim()}
                    className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {forgotBusy ? "Sending reset link..." : "Send Password Reset Link"}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline"
                    >
                      Cancel and return to login
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Wrapper page with Suspense boundary for useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-md px-4 py-16 text-center text-[var(--text-muted)]">
        Loading login form...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
