"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "../lib/UserContext";
import { BookOpen, Mail, Lock, User as UserIcon } from "lucide-react";

// Strong password rules for real-time feedback
const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "Contains an uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "Contains a lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { id: "number", label: "Contains a number (0-9)", test: (p: string) => /\d/.test(p) },
  { id: "special", label: "Contains a special character (!@#$%^&*)", test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

function getPasswordStrength(pw: string) {
  return PASSWORD_RULES.filter((rule) => rule.test(pw)).length;
}

// Inner component (for future-proofing and consistent Suspense pattern)
function SignupContent() {
  const router = useRouter();
  const { signUp, signInWithOAuth, loading: authLoading } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordStrength = getPasswordStrength(password);
  const allRulesMet = PASSWORD_RULES.every((rule) => rule.test(password));
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!allRulesMet) {
      setError("Please meet all password requirements below.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);

    const res = await signUp(email.trim(), password, displayName.trim() || undefined);
    setBusy(false);

    if (res?.error) {
      setError(res.error);
      return;
    }

    // Always show success screen (no auto-login per updated flow).
    // Use the specific friendly message when confirmation is required.
    const confirmationMessage = "Account created successfully! Please check your email (including spam folder) and click the confirmation link to activate your Inkforge Account.";
    const welcomeMessage = "Inkforge Account created successfully! Welcome!";

    setSuccessMsg(res.needsConfirmation ? confirmationMessage : welcomeMessage);
    // Do not set sessionStorage or auto-redirect to /library (per email confirmation requirements)
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
      {/* Prominent Inkforge Account branding */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 shadow-sm">
          <BookOpen className="h-7 w-7 text-white" />
        </div>
        <div className="text-3xl font-semibold tracking-tight">Create your Inkforge Account</div>
        <div className="mt-2 text-sm text-[var(--text-muted)] max-w-xs mx-auto">
          Join the Inkforge community. Publish comics, earn coins, and build your personal library.
        </div>
      </div>

      <div className="glass rounded-2xl border border-[var(--border)] p-6 shadow-sm">
        {successMsg ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
            <div className="text-lg font-semibold text-emerald-400 mb-1">{successMsg}</div>
            <div className="mt-4">
              <Link 
                href="/login" 
                className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-white hover:brightness-110 transition"
              >
                Go to Login →
              </Link>
            </div>
            <div className="mt-3 text-xs text-[var(--text-muted)]">
              You can sign in after confirming your email (if required).
            </div>
          </div>
        ) : (
          <>
            {/* Email / Password form - PRIMARY and prominent */}
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">Display Name</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 focus-within:border-[var(--accent)]">
                  <UserIcon size={16} className="text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                    placeholder="Alex Reader"
                    required
                  />
                </div>
              </div>

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
                <label className="text-xs font-medium text-[var(--text-muted)]">Password</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 focus-within:border-[var(--accent)]">
                  <Lock size={16} className="text-[var(--text-muted)]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                  />
                </div>

                {/* Real-time password requirements feedback */}
                {password.length > 0 && (
                  <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/60 p-3 text-xs">
                    <div className="mb-1.5 font-medium text-[var(--text-muted)]">Password must include:</div>
                    <div className="space-y-1">
                      {PASSWORD_RULES.map((rule) => {
                        const met = rule.test(password);
                        return (
                          <div key={rule.id} className={`flex items-center gap-2 ${met ? "text-emerald-400" : "text-[var(--text-muted)]"}`}>
                            <span className="font-mono text-[10px]">{met ? "✓" : "○"}</span>
                            <span>{rule.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-[10px] text-[var(--text-muted)]">
                      Strength: {passwordStrength} / {PASSWORD_RULES.length}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-muted)]">Confirm Password</label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2.5 focus-within:border-[var(--accent)]">
                  <Lock size={16} className="text-[var(--text-muted)]" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                  />
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <div className="mt-1 text-xs text-red-400">Passwords do not match.</div>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || authLoading || !allRulesMet || !passwordsMatch || !email}
                className="btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {busy ? "Creating your Inkforge Account..." : "Create Inkforge Account"}
              </button>
            </form>

            {/* Secondary Google option */}
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
              Already have an Inkforge Account?{" "}
              <Link href="/login" className="text-[var(--accent)] hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-[10px] text-[var(--text-muted)]">
        Your Inkforge Account includes 50 starter coins. First chapter of every comic is always free.
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
