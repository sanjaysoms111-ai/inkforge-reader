"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Menu, X, Sun, Moon, Monitor } from "lucide-react";
import { useComics } from "../lib/ComicsContext";
import { useTheme, type Theme } from "../lib/ThemeContext";

export function Navbar() {
  const { displayName, setDisplayName } = useComics();
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);

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

              {/* Display name (local, persisted) - click to edit */}
              <div className="hidden md:flex items-center gap-1.5 text-sm">
                {showNameInput ? (
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onBlur={() => setShowNameInput(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setShowNameInput(false)}
                    className="input px-2 py-0.5 text-sm w-28 focus:border-rose-500"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => setShowNameInput(true)}
                    className="text-[var(--text-muted)] hover:text-[var(--text)] transition px-2 py-0.5 rounded hover:bg-[var(--bg-card)]"
                    title="Click to edit your display name (local only)"
                  >
                    {displayName || 'Reader'}
                  </button>
                )}
              </div>

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
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    setShowBuyModal(true);
                  }}
                  className="flex items-center gap-2 py-1 text-left text-amber-400"
                >
                  <Coins className="h-4 w-4" /> Buy Coins — {coinBalance} available
                </button>
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
                <div className="py-1 text-xs text-[var(--text-muted)]">
                  Local demo — no account needed
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>


    </>
  );
}
