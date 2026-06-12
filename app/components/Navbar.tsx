"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Menu, X, Sun, Moon, Monitor, Coins, Library, LogOut, LogIn, User } from "lucide-react";
import { useComics } from "../lib/ComicsContext";
import { useTheme } from "../lib/ThemeContext";
import { useUser } from "../lib/UserContext";

export function Navbar() {
  const router = useRouter();
  const { displayName: localDisplayName, setDisplayName: setLocalDisplayName } = useComics();
  const { theme, toggleTheme } = useTheme();
  const { user, coinBalance, displayName, setDisplayName, signOut } = useUser();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);

  const effectiveDisplayName = displayName || localDisplayName || "Reader";

  const ThemeIcon = ({ size = 17 }: { size?: number }) => {
    if (theme === "light") return <Sun size={size} />;
    if (theme === "dark") return <Moon size={size} />;
    return <Monitor size={size} />;
  };

  const themeLabel = theme === "system" ? "System" : theme === "light" ? "Light" : "Dark";

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] glass bg-[var(--glass-bg)] supports-[backdrop-filter]:bg-[var(--glass-bg)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600">
                <BookOpen className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tracking-tight">inkforg_apexpanel</span>
                <span className="text-xs font-medium text-rose-500">READER</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden items-center gap-8 text-sm md:flex">
              <Link href="/" className="text-zinc-300 transition hover:text-white">
                Discover
              </Link>
              <a
                href="#disclaimer"
                className="text-zinc-400 transition hover:text-zinc-300"
              >
                About AI
              </a>
              <Link href="/legal" className="text-zinc-400 transition hover:text-zinc-300">
                Legal
              </Link>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Theme toggle (beautiful dark default + system sync) */}
              <button
                onClick={toggleTheme}
                className="glass flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-all active:scale-[0.985]"
                title={`Theme: ${themeLabel} (click to cycle)`}
                aria-label="Toggle theme"
              >
                <ThemeIcon />
                <span className="hidden text-[10px] font-medium tracking-wide md:inline text-[var(--text-muted)]">
                  {themeLabel}
                </span>
              </button>

              {/* Auth + Coins (new) + Display name */}
              {user ? (
                <div className="hidden items-center gap-2 md:flex">
                  {/* Coin balance */}
                  <Link
                    href="/library"
                    className="glass inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-sm text-amber-400 hover:text-amber-300"
                    title="My Library &amp; coins"
                  >
                    <Coins size={15} />
                    <span className="font-medium">{coinBalance}</span>
                  </Link>

                  {/* Library quick link */}
                  <Link
                    href="/library"
                    className="hidden items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] md:flex"
                  >
                    <Library size={15} /> Library
                  </Link>

                  {/* Profile link */}
                  <Link
                    href="/profile"
                    className="hidden items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] md:flex"
                  >
                    <User size={15} /> Profile
                  </Link>

                  {/* Display name (prefers Supabase profile) */}
                  <div className="flex items-center gap-1.5 text-sm">
                    {showNameInput ? (
                      <input
                        type="text"
                        value={effectiveDisplayName}
                        onChange={(e) => {
                          setDisplayName(e.target.value);
                          setLocalDisplayName(e.target.value);
                        }}
                        onBlur={() => setShowNameInput(false)}
                        onKeyDown={(e) => e.key === "Enter" && setShowNameInput(false)}
                        className="input px-2 py-0.5 text-sm w-28 focus:border-rose-500"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => setShowNameInput(true)}
                        className="text-[var(--text-muted)] hover:text-[var(--text)] transition px-2 py-0.5 rounded hover:bg-[var(--bg-card)]"
                        title="Edit display name (synced when signed in)"
                      >
                        {effectiveDisplayName}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={async () => {
                      await signOut();
                      router.push("/");
                    }}
                    className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text)]"
                    title="Sign out"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="hidden items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card)] md:flex"
                >
                  <LogIn size={15} /> Login
                </Link>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text)] md:hidden"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="border-t border-[var(--border)] py-4 text-sm md:hidden glass">
              <div className="flex flex-col gap-3 px-1">
                <Link href="/" className="py-1 text-[var(--text-muted)]" onClick={() => setMobileOpen(false)}>
                  Discover
                </Link>

                {user ? (
                  <>
                    <Link href="/library" className="flex items-center gap-2 py-1 text-amber-400" onClick={() => setMobileOpen(false)}>
                      <Coins className="h-4 w-4" /> Coins: {coinBalance} — My Library
                    </Link>
                    <Link href="/library" className="py-1 text-[var(--text-muted)]" onClick={() => setMobileOpen(false)}>
                      Full Library
                    </Link>
                    <Link href="/profile" className="py-1 text-[var(--text-muted)]" onClick={() => setMobileOpen(false)}>
                      Profile
                    </Link>
                    <button
                      onClick={async () => {
                        setMobileOpen(false);
                        await signOut();
                        router.push("/");
                      }}
                      className="flex items-center gap-2 py-1 text-left text-[var(--text-muted)]"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </>
                ) : (
                  <Link href="/login" className="py-1 text-[var(--accent)]" onClick={() => setMobileOpen(false)}>
                    Login / Sign up
                  </Link>
                )}

                <button
                  onClick={() => {
                    setMobileOpen(false);
                    toggleTheme();
                  }}
                  className="flex items-center gap-2 py-1 text-left text-[var(--text-muted)]"
                >
                  <ThemeIcon size={16} /> Theme: {themeLabel}
                </button>
                <a href="#disclaimer" className="py-1 text-[var(--text-muted)]" onClick={() => setMobileOpen(false)}>
                  About AI Comics
                </a>
                <Link href="/legal" className="py-1 text-[var(--text-muted)]" onClick={() => setMobileOpen(false)}>
                  Legal
                </Link>
                <div className="py-1 text-xs text-[var(--text-muted)]">
                  {user ? "Synced via Supabase" : "Sign in for shared library + coins"}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>


    </>
  );
}
