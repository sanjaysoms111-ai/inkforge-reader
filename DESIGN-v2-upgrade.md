# DESIGN: Inkforge Reader v2 Major Upgrade

**Version**: v2.0 (Major)
**Status**: Design Phase (awaiting approval)
**Date**: 2026
**Author**: Grok (per AGENTS.md process)
**Scope**: Comprehensive upgrade to the client-side Next.js webtoon/manhwa reader platform. Focus on polish, completeness, and new capabilities while **strictly preserving all existing invariants** (see below).

This document follows the AGENTS.md directive to produce a design doc for structural/major changes before implementation.

## Executive Summary
The Inkforge Reader has evolved through iterative upgrades (advanced reader features, discovery enhancements, light social/library, creator bridge polish). v2 formalizes these into a cohesive major release with:
- Polished, production-ready "Advanced Reader" experience.
- Significantly improved discovery and personalization.
- Full "User Profiles & Library" experience.
- Creator tools maturity.
- First-class PWA support for offline/installable use.
- Comprehensive accessibility for inclusive use.

**Key Principle**: Everything remains **zero-backend, client-side + localStorage only**. No new dependencies beyond what's already in use (framer-motion, jszip, lucide, Next.js primitives). All state flows through `ComicsContext` / `useComics()`.

**Target Users**: Readers of AI-generated webtoons/manhwa (from the companion inkforg_apexpanel Creator App), with strong support for creators consuming their own content.

**Success Criteria**:
- Feature-complete in the listed areas.
- Preserves 100% of current behavior for premium flow, creator imports, persistence keys, etc.
- Measurable improvements in usability (e.g., faster discovery, better offline experience, WCAG 2.1 AA baseline).
- Clean, documented, and maintainable per AGENTS.md.

## Current State (Baseline)
- **Tech**: Next.js 16 App Router + React 19 + TS + Tailwind v4 + framer-motion + lucide-react. SmartImage (next/image + fallback), basic virtualization, dynamic modals.
- **Core Architecture** (per AGENTS.md):
  - `ComicsContext` is the single source of truth. All global state (comics, unlocks, coins, progress, history, bookmarks/likes, settings, achievements/streaks, creator analytics, etc.) lives here.
  - MOCK_COMICS is empty; content comes from Creator bridge (`inkforg_apexpanel_published_comics` localStorage) + legacy user-published.
  - Premium flow: `isPremium` flag + `isChapterUnlocked` (with coin costs; first chapter free). Custom `coinPrice` / `unlockAllPrice` supported.
  - Creator comics: `source: 'creator'`, special badges/analytics, always visible unless filtered.
  - Persistence: Many localStorage keys (coins, unlocked, published, creator bridge, comments, displayName, progress, bookmarks, history, readerSettings, likedComics, achievements, streak).
- **Current Reader** (already quite advanced from prior iterations):
  - Vertical (default) + Paged modes.
  - Auto-scroll with speed control.
  - Zoom/pinch, brightness/contrast sliders, fullscreen.
  - Virtualization for panels + SmartImage (skeletons, optimization).
  - Per-chapter progress save/restore + continue reading.
  - Offline: Download chapter as ZIP (JSZip, gated to unlocked).
  - Enhanced comments: Nested replies (parentId), avatars (initials), likes, reactions, timestamps, display name.
  - Chapter drawer, prev/next with thumbnails, keyboard shortcuts (arrows, space, a/f/c/b/v/esc, etc.), swipe (gated).
  - Creator badge + analytics (views/unlocks).
- **Current Discovery**:
  - Debounced search (title/author/tags).
  - Filters: Genres, Source (all/creator/official), Status (ongoing/completed).
  - Sorts: Newest/oldest/az/za/mostChapters/popular/trending/byCoins.
  - "For You" recs (genre overlap from unlocked + history + bookmarks).
  - Trending as horizontal carousel.
  - Creator import with preview/validation (paste + confirm step in home).
- **Current Library / Social**:
  - Reading History (last 20 via `getReadingHistory` + continue banner).
  - Bookmarks (per-page or per-chapter).
  - Likes/Favorites (distinct `getLikedComics` / toggle).
  - Streaks (`getCurrentStreak`) + simple Achievements (`getAchievements`, auto-checked on actions like read/comment/like/unlock).
  - Progress per chapter.
- **Creator Tools** (polished in prior):
  - Custom per-chapter `coinPrice` + per-comic `unlockAllPrice` (in types, normalize, unlock logic, UI badges/buttons).
  - Import preview + validation (`previewCreatorImport`, `validateAndImportCreatorComic`).
  - Analytics (`getCreatorAnalytics`, `recordCreatorView` on read).
  - Enhanced badges with stats.
- **Other**: Theme (dark default + system + toggle with glass), framer animations, toasts (DOM pattern), SmartImage, basic a11y (some keyboard, focus), no PWA yet.

**Gaps for v2**:
- Reader: More robust offline (beyond single-chapter zip), better vertical experience polish.
- Discovery: Categories/tags UI, more rec signals.
- Library: Dedicated "Reading List", richer history UI, profile-like view.
- Creator: More polish (e.g., per-comic settings surface).
- PWA: Installable, offline-capable (service worker for cached comics + assets).
- Accessibility: Comprehensive ARIA, full keyboard nav, high contrast mode, screen reader testing baseline.

## Invariants (Must Preserve 100%)
Per AGENTS.md and code history — **non-negotiable**:
- Client-side + localStorage only. No backend, no new external services.
- `ComicsContext` / `useComics()` is the only place for global state. All new features (profiles/library, PWA cache hints, a11y prefs) must integrate here or via small dedicated contexts (e.g., keep ThemeProvider).
- Premium flow: First chapter free (`!isPremium`), others gated by `isChapterUnlocked` + coins. Custom prices respected. `unlockChapter` / `unlockAllChapters` behavior unchanged except where extended for custom prices.
- Creator bridge: `source === 'creator'` comics always visible (unless explicitly filtered), use the `inkforg_apexpanel_published_comics` key + normalization. `importCreator*` methods preserved/enhanced only.
- Data model: Panels as string[] (data: or https). No breaking changes to Comic/Chapter/Comment shapes beyond additive optional fields.
- Persistence keys: All existing ones (coins, unlocked, published, creator bridge, comments, displayName, progress*, bookmarks, history, readerSettings, likedComics, achievements, streak) must continue to work. New keys only if truly needed and documented.
- First-chapter-free + isPremium logic in normalization, publish, UI, and gating.
- No breaking changes to existing UI flows (e.g., reader modes, discovery filters, comments, like/fav, streaks).
- Performance/a11y baseline from prior (SmartImage, virtualization, dynamic modals, some keyboard) must not regress.
- Creator-published comics get special treatment (badges, analytics, import).
- All toasts, animations (framer), glass styling, etc., follow existing patterns.

Any v2 feature that would violate these must be rejected or heavily adapted.

## Detailed Feature Areas

### 1. Advanced Reader (Vertical + Auto-scroll + Offline)
**Current**: Already strong (vertical default + paged toggle, auto-scroll + speed slider, virtual panels, SmartImage, progress, download ZIP for unlocked chapters, chapter drawer, keyboard/swipe, zoom/filters/fullscreen, direction/fit settings).

**v2 Goals**:
- **Polish vertical experience**: Smoother infinite-like scroll, better momentum, panel preloading hints, optional "continuous" mode without virtualization artifacts.
- **Auto-scroll enhancements**: Per-chapter speed memory (via readerSettings), pause on user scroll, "smart" auto-scroll that respects reading direction/fit, visual progress scrubber.
- **Offline**: 
  - Full chapter caching in PWA (see PWA section).
  - "Download for offline" button that caches the chapter's panels + metadata locally (extend current ZIP to also store in a client-side "offline library" using IndexedDB or extended localStorage + progress).
  - Offline indicator + ability to read cached chapters without network.
  - Graceful degradation if images are data: URLs (already self-contained) vs remote.
- **Additional polish**: Double-tap to zoom (mobile), reading timer / session stats, "mark as read" for chapter, better handling of very long chapters (progressive loading + memory management).
- **Integration**: Tie into User Library (auto-add to Reading List / History when opened; respect Favorites).

**Design Notes**:
- Keep existing `readingMode`, `isAutoScrolling`, `autoSpeed`, `zoom`/`brightness`/`contrast`, `readerSettings`.
- Add `offlineChapters` or cache manifest in context (or leverage PWA Cache API).
- New UI: Offline download progress, cached chapters list in library.

### 2. Enhanced Discovery (Search, Recs, Categories)
**Current**: Debounced search (title/author/tags), genre + status + source filters, rich sorts (newest...byCoins), "For You" recs (genre overlap from unlocked/history/bookmarks), Trending horizontal carousel, creator import preview tools.

**v2 Goals**:
- **Search**: Make it more robust (fuzzy? highlights in results, search within genres/tags/status). Persisted recent searches. "Search in my library only" toggle.
- **Recommendations**: Improve `getRecommendedComics` — more signals (genre + tags overlap, reading history recency, favorites, "similar creators" via author, "because you read X"). "Surprise me" random from high-rated unseen. "Because you liked [genre]" carousels.
- **Categories**: Formal "Categories" / "Genres" hub page or section. Browse by single genre with counts. "Trending in [Genre]", "New in [Genre]". Tag cloud or filterable categories (using `tags` + `genres` + `status`).
- **Homepage layout polish**: Hero with "Continue Reading" + streak/achievements teaser. "For You" (recs) carousel. "Trending" carousel. "New Releases" / "From Creators You Follow" (if author signals). Full "Discover" with all filters + infinite or "load more" grid. "My Library" quick links.
- **Creator visibility**: Always prominent (dedicated "From the Community" or source-aware sections).

**Design Notes**:
- Extend `getFilteredComics` + `getRecommendedComics` in context (already started).
- Add lightweight "categories" derived view or memo in context.
- Use framer-motion for smooth carousels (drag + buttons).
- Keep sourceFilter so creator comics are discoverable.

### 3. User Profiles & Library (Reading List, History, Favorites)
**Current**: History (last 20 + continue banner), Bookmarks (per page/chapter), Liked/Favorites (separate toggle), Streaks + Achievements (auto on actions), Per-chapter progress, Reading list implied via myUnlocked + bookmarks.

**v2 Goals**:
- **Dedicated Library / Profile view**: New route or prominent homepage tab/section: "My Library".
  - **Reading List**: User-curated list (add/remove from cards/reader). Separate from auto-history. Syncs with progress (e.g., "In Progress", "Completed").
  - **History**: Richer view of last 20+ (searchable, filter by genre/date, "Continue" buttons, delete items). Timeline view.
  - **Favorites / Liked**: Grid of hearted comics + quick stats (e.g., "Liked on [date]").
  - **Progress Overview**: Streaks (current + longest), Achievements (badges grid with unlock dates + "next to unlock" teasers), total chapters read, favorite genres.
- **Profiles**: Lightweight "Profile" (displayName + optional avatar seed + bio stub, all local). Settings hub (theme, reader defaults, data export/import for backup, clear data).
- **Integration**: Auto-add opened chapters to "Recently Read" / Reading List. Badges on ComicCard for "In Library", "Favorited", "Read".
- **Data model**: Leverage/extend existing (history, bookmarks as "Reading List" items, likedComics, progress, achievements, streak). Add `readingList: string[]` (slugs) if needed.

**Design Notes**:
- New or enhanced components in /components (LibrarySection, AchievementBadge, etc.).
- Expose more derived selectors in context (e.g., `getReadingListComics()`, `getInProgressComics()`).
- Export/Import for user data (JSON of library/history) as a "profile" feature.

### 4. Creator Tools Polish
**Current**: Custom coin prices (per chapter/comic, respected in unlock/UI), import with preview/validation (paste + confirm in home), analytics (views/unlocks + record), enhanced badges with stats, special source treatment.

**v2 Goals**:
- **Polish**: Dedicated "Creator Hub" or filter ("My Creations" if author matches imported). Per-comic analytics dashboard (mock views over time, unlock rate, "earnings" simulation based on unlocks * price).
- **Import enhancements**: Drag-and-drop for JSON, multi-select import with batch preview/validation, conflict resolution for duplicate slugs.
- **Custom prices UX**: In reader/detail for creator comics, show "Creator-set price" note. "Simulate earnings" tool.
- **Badges**: More variants (e.g., "Featured Creator", "High Engagement").
- **Integration**: When viewing own creation, show "Edit in Creator App" stub link (external), analytics prominently.

**Design Notes**:
- Build on `getCreatorAnalytics`, `previewCreatorImport`, custom price fields.
- Add `getMyCreations()` helper (filter by author or a "my" flag if we add simple local "myAuthor" setting).

### 5. PWA Support + Install Prompt
**Current**: None (basic metadata, no manifest, no SW, no install UI).

**v2 Goals**:
- **Web App Manifest**: `app/manifest.ts` or static (name, short_name, icons, theme_color matching our dark/rose, start_url, display: "standalone", shortcuts to / and library).
- **Service Worker**: Use Next.js PWA support or simple workbox / custom SW for:
  - Cache shell (app, CSS, fonts).
  - Cache recent comics (panels + metadata for offline reading, using the new offline features).
  - Background sync for "pending" actions (if any).
- **Install Prompt**: Custom "Install App" button (in Navbar or settings) using `beforeinstallprompt` event. Show only if not installed. Nice UI with benefits ("Read offline", "Faster access").
- **Offline Experience**: When offline, show cached content + "You're offline" banner. Reader falls back to downloaded/cached chapters. Discovery shows cached items first.
- **Icons & Theming**: Generate proper icons (or use existing favicon + placeholders). Match our theme (dark, rose accents).

**Design Notes**:
- Use Next.js built-in support where possible (app dir friendly).
- Integrate with existing offline download (ZIP can seed the SW cache).
- Add `useEffect` in layout or Navbar for install prompt handling.
- New context slice? Minimal — PWA state can be local to components, but "offline status" and "cached comics" should be in ComicsContext for consistency.

### 6. Accessibility (ARIA, Keyboard Nav, High Contrast)
**Current**: Partial (some keyboard in reader from prior, focus styles, basic ARIA on buttons/modals, theme supports contrast via vars, SmartImage alt texts).

**v2 Goals** (aim for WCAG 2.1 AA baseline):
- **ARIA**: Roles, labels, live regions (e.g., for toasts, loading states, filter result counts), describedby for complex controls (zoom sliders, auto-scroll). Proper headings hierarchy. Modal/dialog patterns (with focus trap if possible via existing or simple impl).
- **Keyboard Navigation**:
  - Full site: Logical tab order, visible focus rings (already partially there).
  - Reader: Enhanced (arrow keys for panels/scroll in both modes, space for auto, esc for drawers/modals, number keys for chapter jump?).
  - Discovery: Arrow key navigation in carousels/grids (framer + roving tabindex or simple JS).
  - Skip links, landmark regions (<main>, <nav> already present).
- **High Contrast**: Toggle or auto-detect (add to ThemeProvider / readerSettings). Increase contrast ratios in vars (e.g., stronger borders, bolder text). "High contrast mode" that boosts accents and reduces glass blurs.
- **Other**: Alt text for all images (SmartImage already good; enhance for panels). Reduced motion respect (already in CSS). Color not sole indicator (icons + text for premium/locked/achievements). Focus management on route changes and modals. Screen reader testing notes (e.g., comics as lists).
- **Implementation**: Add `aria-*` attributes systematically. New `AccessibilitySettings` in readerSettings or separate. Use existing framer for some focus, or simple hooks.

**Design Notes**:
- Audit existing components (Navbar, cards, reader controls, modals, filters).
- New small AccessibilityProvider or extend ThemeContext.
- Document in AGENTS.md as a new pattern.

## Architecture & Implementation Approach
- **State**: All new features (PWA cache hints, a11y prefs, richer library views, creator analytics surface) must be in or derived from `ComicsContext`. Add new state slices (e.g., `pwaStatus`, `accessibilityPrefs`) and methods (e.g., `getReadingList()`, `updateA11yPrefs()`). Avoid local component state for anything that should persist or be global.
- **Persistence**: Extend existing localStorage pattern. New keys only for truly new data (e.g., `pwaCacheManifest`, `a11yPrefs`). Keep migration/reset clean.
- **UI Patterns**: Reuse glass, motion, toasts (DOM), SmartImage, existing buttons. Add new components sparingly (e.g., `AchievementBadge`, `InstallPrompt`, `AccessibilityToggle`, `LibrarySection`).
- **Performance**: Build on existing (virtualization, dynamic, skeletons). PWA SW will help offline.
- **A11y First**: Add ARIA/keyboard in parallel with features, not as afterthought.
- **Testing**: Manual flows for all areas + invariants checklist from AGENTS. Build must stay clean.
- **Phasing** (priority order for implementation after approval):
  1. **Foundation & Polish** (low risk): PWA manifest + basic install prompt + core a11y audit/fixes (ARIA on existing, keyboard in discovery/reader). Update docs.
  2. **Reader Completion**: Fill gaps in "Advanced Reader" (full offline cache integration, vertical polish, auto-scroll enhancements).
  3. **Discovery & Library**: Categories UI, richer recs/history UI, dedicated Library/Profile surface, Reading List formalization.
  4. **Creator Polish + Integration**: Import flow polish, analytics dashboard surface, custom prices everywhere.
  5. **Full Integration & Hardening**: Cross-feature polish (e.g., a11y in new modals, PWA offline for library items, high contrast in reader), testing, AGENTS update.

**Risks & Mitigations**:
- Scope creep: Strict priority order + "minimal viable v2" per section.
- Breaking invariants: Every change reviewed against the list above. Design doc acts as contract.
- Client-only limits (e.g., real PWA offline for remote images): Use Cache API + graceful fallbacks; emphasize "download for full offline".
- A11y depth: Baseline AA; note advanced (e.g., full screen reader) as future.

## Open Questions (for discussion)
- Exact icon set / manifest details for PWA?
- How deep should "User Profiles" go (e.g., multiple profiles? export full library as JSON)?
- Any new localStorage keys we want to avoid?
- Should achievements be more gamified (points, levels) or keep light?
- High contrast: System preference auto or explicit toggle?
- Creator "tools polish": Any specific new per-comic settings beyond prices?

## Next Steps
1. Review and approve this design (or request changes).
2. Upon approval: Update AGENTS.md to reference this doc as the v2 plan.
3. Implement in the priority order above, using todo tracking, preserving invariants at every step, and updating AGENTS.md + this doc as patterns emerge.
4. Final verification: Full build, manual test of all areas + invariants, update README if needed.

This positions Inkforge Reader as a polished, accessible, installable companion for the inkforg_apexpanel ecosystem.

**End of Design Doc** (awaiting approval before code changes).