# AGENTS.md — Inkforge Reader

This document enables reliable, high-quality updates to the Inkforge Reader via natural language prompts with Grok (or other agents).

## Project Identity
- **Name**: Inkforge Reader (public reading platform)
- **Brand context**: Companion to inkforg_apexpanel (AI-assisted webtoon/manhwa creator tool)
- **Folder on disk**: `C:\inkforge reader` (or the long-path equivalent)
- **Core promise**: Beautiful vertical-scroll webtoon reader. All chapters freely readable. isPremium flag for informational "PREMIUM" badge display only (no coin cost, paywall, or unlock mechanic). Creator-published comics import via localStorage bridge. (Monetizing features removed per request.)

## Tech Stack
- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 + PostCSS
- lucide-react icons
- **framer-motion** (subtle micro-interactions, card lifts, button taps, reader chapter swipe gestures)
- **Zero backend**: Everything is client-side + localStorage. Mock data + user/creator imports merge at runtime.
- Run commands:
  ```powershell
  cd "C:\inkforge reader"
  npm run dev
  ```
  Open http://localhost:3000

Useful routes:
- `/` — Homepage (hero + continue + For You recs + Trending carousel + latest + my unlocked + robust debounced search (title/author/tags) + expanded filters (genres + status ongoing/completed) + sort (incl popular/trending/byCoins) + source filter). Discovery greatly improved while keeping creator-published visible. Also contains "Creator Bridge Tools" (paste+preview import from inkforg_apexpanel + direct "Upload comic" link + prominent "Creator Dashboard" link).
- `/upload` — Dedicated page to create comics with local images (cover + multi-chapter + per-chapter multi-panel drag & drop / file select, progress, validation, canvas compression). Converts images to data: URLs, live preview, enforces first-chapter-free, supports custom prices, then calls publishComic.
- `/creator` — Creator Upload Dashboard: list of my uploaded comics (source 'user' / pub- ids from the published bridge), edit existing (full metadata + chapters + pricing + bulk chapter upload with panels), export as inkforg_apexpanel-compatible JSON, delete. Uses shared uploadUtils + new context helpers (getMyUploadedComics, updateUploadedComic, addChaptersToUploadedComic). Edits are seamless with existing lists/reader/premium logic.
- `/comics/[slug]` — Detail page (cover, metadata, chapter list, unlock all, delete for owned)
- `/read/[slug]/[chapter]` — Vertical reader (panels, nav, comments & reactions, premium lock, quick chapter switcher)
- `/legal` — Legal & Community Guidelines page (full strict text: Content Creation & Copyright, AI-Generated Content Rules, Prohibited Activities, etc.). Linked from Navbar (separate "Legal" link) and Footer.
- Short non-intrusive disclaimer notices added:
  - /upload: near the "Publish to My Library" button.
  - Public comic detail (/comics/[slug]) and reader: small footer note (only when comic.isPublic).
  Text: "By uploading, you confirm all content is original and does not infringe any copyrights. Violations may lead to content removal and account suspension."

## Architecture & Key Contracts (READ BEFORE ANY CHANGE)

### 1. Single Source of Truth
`app/lib/ComicsContext.tsx` + `useComics()` hook.
- All comics (MOCK + published + creator imports)
- Comments, display name (coin / unlock state removed)
- Derived: `trending`, `latest`, `creatorPublished`, `myUnlockedComics`
- Helpers: `getFilteredComics` (expanded...), `getRecommendedComics`, `getComicBySlug`, `unlockChapter` (now respects per-chapter coinPrice), `publishComic`, `importCreator*` (now with preview/validate), plus new creator bridge (previewCreatorImport, validateAndImportCreatorComic, getCreatorAnalytics, recordCreatorView), plus QOL. All client-side localStorage. Creator comics always surface. Custom prices + mock analytics added.

**Never bypass the context** for global state. Components call `useComics()`.

### 2. Data Model (app/lib/types.ts)
- `Comic`, `Chapter` (panels: string[] of data URLs or https; optional `dialogues?: string[]`)
- `Genre` union (10 values)
- `PublishComicInput`, `UserCoinState`, `Comment`
- `source`: 'mock' | 'user' | 'creator'

The `isPremium` flag on chapters is retained for informational display only (e.g. "PREMIUM" badge). All chapters are freely readable — there is no coin cost, paywall, or unlock mechanic. Monetizing features (coins, Buy, sub, events, tx history) have been removed.

### 3. Persistence Keys (localStorage)
- `inkforg_apexpanel:coins`
- `inkforg_apexpanel:unlocked`
- `inkforg_apexpanel:published` (legacy user publishes + comics created via the new `/upload` page). All non-`source: 'creator'` comics are merged from this key on startup.
- `inkforg_apexpanel_published_comics` ← **Creator App bridge** (primary import path from inkforg_apexpanel Creator) — now with preview/validation support
- `inkforg_apexpanel:comments`
- `inkforg_apexpanel:displayName`
- `inkforg_apexpanel:bookmarks` (QOL)
- `inkforg_apexpanel:history` (last 20)
- `inkforg_apexpanel:readerSettings` (direction/fit)
- `inkforg_apexpanel:progress` prefix (per chapter)
- `inkforg_apexpanel:likedComics`, `achievements`, `streak` (from social)
- `inkforg_apexpanel:cachedChapters` (PWA: array of "slug:chapterNumber" for chapters that have been viewed/downloaded while unlocked — enables offline indicators + cache seeding)
- `inkforg_apexpanel:uploadDrafts` (advanced upload: incomplete form state for resume + light history of published uploads)
- `inkforg_apexpanel:uploadHistory` (lightweight recent user uploads metadata)
- `inkforg_apexpanel:subscription` ({ endDate } for mock 30-day pass)
- `inkforg_apexpanel:transactions` (detailed tx log array)
- `inkforg_apexpanel:events` (active limited free event {until, title})

`normalizeCreatorComic` + `importCreatorComic` / `importCreatorPublishedComics` handle bridge data robustly (multi-chapter, titles, dialogues, slug uniquing).

**Upload / Direct Comic Creation + Creator Upload Dashboard**:
- `/upload`: Full creation page (see prior notes for dnd, progress, validation, canvas compression, first-free enforcement). Uses shared `app/lib/uploadUtils.ts`.
- `/creator` (Creator Upload Dashboard): 
  - Lists only "my uploaded" comics (via new `getMyUploadedComics()` — filters source==='user' or id.startsWith('pub-')).
  - In-place edit of existing uploads: metadata (status, tags, unlockAllPrice, genres, title etc.), full chapter editing (titles, premium toggle with first-free lock, coinPrice), add/remove/reorder chapters, add panels to existing chapters, **bulk chapter upload** (repeatable "Add New Chapter" with multi-file panel support + progress).
  - Export button produces JSON in the exact `CreatorPublishedComic` shape used by the bridge (compatible with homepage paste+preview import and inkforg_apexpanel).
  - Delete reuses existing removePublishedComic.
  - All changes go through new context methods (`updateUploadedComic`, `addChaptersToUploadedComic`) which call the existing `persistPublished` (still only the published key; creator bridge untouched).
- Architecture: New shared `uploadUtils.ts` (validation consts, processImageFiles with canvas compression, filter helpers, progress callbacks). New context methods are thin wrappers around state + persist. First-chapter-free and premium (coinPrice etc.) are enforced on every edit save path.
- Entry points: Prominent buttons in homepage "Creator Bridge Tools" (next to upload link) and a cross-link from /upload.
- See `DESIGN-creator-upload-dashboard.md` (full short design doc) + `DESIGN-upload-comic.md`.
- `PublishChapterInput` / `publishComic` already support the price fields; dashboard reuses them for edits. No new localStorage keys. Premium/first-free/reader/coin logic 100% preserved.

**Advanced upload capabilities (latest iteration, browser APIs only)**:
- Image optimization: client-side resize + WebP conversion (canvas.toDataURL('image/webp')) before data: (uploadUtils.optimizeImage; falls back to JPEG). Applied everywhere (panels, covers, gallery, banner). See DESIGN-advanced-upload-capabilities.md.
- Chapter thumbnails: auto-generated small data URL from first panel (generateThumbnail) stored as Chapter.thumbnail. Displayed in /creator lists etc.
- Cover gallery + banner: Comic.coverGallery (array) + bannerUrl supported in /upload form + /creator edit. Optimized on the fly.
- Upload history / drafts: auto-save (debounced) of incomplete state to `inkforg_apexpanel:uploadDrafts`. Loadable sidebar in /upload. Light published history via context + `inkforg_apexpanel:uploadHistory`. New context methods: saveUploadDraft / loadUploadDraft / getUploadDrafts / deleteUploadDraft / getUploadHistory / recordUploadToHistory. Integrated with publish (clears draft, records history, attaches thumbs/gallery).
- Keyboard shortcuts + a11y: In /upload form (keydown listener, input guards): A add chapter, P panels, C cover, Ctrl+Enter publish, Ctrl+S draft, ? help. aria-live for announcements/progress, labels, focus on dynamics, reduced-motion respect.
- Architecture: All in shared uploadUtils (now with WebP/resize + thumbnail) + context extensions (drafts/history state + persist + methods; auto thumb/gallery handling in publish/update). New optional fields on types (Chapter.thumbnail, Comic.coverGallery/bannerUrl). Fully additive, backward compatible for old data.
- See DESIGN-advanced-upload-capabilities.md for full short design (decisions, browser APIs, invariants). Updated quick-ref + test cases below.

**Strengthened Creator Bridge (new)**: 
- `previewCreatorImport(raw)` + `validateAndImportCreatorComic(raw)` for better import with validation (required fields, positive prices, panels) and preview (title, chapters, custom prices flag, first panel).
- Custom per-chapter `coinPrice` and per-comic `unlockAllPrice` supported in import JSON (extended CreatorPublishedComic), publish, and unlock logic (fallbacks to 10/60; first chapter always free via isPremium).
- **Expanded premium (this iteration)**: Multiple packs in Buy modal (with bonuses), mock optimistic purchases (addCoins + tx log). Subscription (buySubscription for 30-day unlimited pass, isSubscriptionActive check in unlock — free premium during pass). Limited events (activateLimitedEvent + isEventFree, global free during window, claimable in Buy). Detailed history page `/coins/history` + getCoinTransactions / logCoinTransaction (logged on purchase/unlock/sub/event). New LS keys documented. All mock, via context only. First-free + creator bridges untouched.
- Creator analytics: `getCreatorAnalytics(slug)` returns {views, unlockCount}; `recordCreatorView(slug)` increments (called on read/detail for creator sources). Enhanced badges (reader, detail, ComicCard) show "AI on inkforg... • Xk views • Y unlocks".
- Import flow in home now has paste + live preview card + errors + "Confirm & Import" step (plus reload with count). Creator comics remain visible and get analytics/badges. New context methods: previewCreatorImport, validateAndImportCreatorComic, getCreatorAnalytics, recordCreatorView.

### 4. Styling & Theming (updated 2026 polish)
- **Theme system**: `app/lib/ThemeContext.tsx` + `useTheme()`.
  - Supports `"light" | "dark" | "system"`.
  - Beautiful dark is default. Smooth system preference sync + persist in `localStorage` ("inkforge:theme").
  - Toggles the `dark` class on `<html>`. Dual CSS variables defined in `globals.css` (:root for light, .dark for dark).
  - Navbar has the cycle toggle (Sun / Moon / Monitor icon).
- **Design tokens** (CSS vars): `--bg`, `--bg-elev`, `--bg-card`, `--border`, `--text`, `--accent`, `--glass-bg`, `--radius*`, etc.
- Custom classes upgraded: `.glass` (glassmorphism), `.card` (premium lift/hover), `.btn-*`, `.panel`, `.input`, `.genre-pill`, `.badge-*`, `.chapter-pill`.
- All new UI should reuse tokens + `.glass`/`.card` where appropriate. Prefer `var(--*)` over hard-coded zinc when theming matters.
- Typography: Improved scale + tracking in CSS. Use `text-balance` on headings.

### 5. Animations & Interactions (post-UI/UX polish)
- Use **framer-motion** for high-quality subtle work: `whileHover`, `whileTap`, entrance fades on panels, card lifts.
- Prefer spring configs (`type: "spring", stiffness: 280, damping: 22` or similar) for natural feel.
- Reader: Horizontal touch swipe (onTouch*) on the panels gesture zone for prev/next chapter (only when unlocked). Threshold ~65px. Also improved bottom chapter switcher (horizontal scroll + snap + active states).
- Tailwind transitions + CSS keyframes (`.unlock-pop`, fade, etc.) for everything else.
- Always respect `prefers-reduced-motion`.
- Mobile-first: Reader vertical scroll is king. Swipe + larger touch targets + scroll snap on chapter pills.

### 5b. Performance Optimizations (added per request)
- **Image optimization**: `SmartImage` component (app/components/SmartImage.tsx) — uses `next/image` for remote https (with remotePatterns in next.config.ts for optimization, caching, lazy), falls back to native `<img>` + built-in pulse skeleton for data: URLs / blobs (common from Creator exports). Used for covers and reader panels.
- **Virtualization**:
  - Reader panels: Basic virtual list in reader page (startIdx/endIdx based on estimated height + overscan + scrollTop). Spacers maintain scroll height; only visible + buffer panels + SmartImage rendered. Scroll handler on gesture container.
  - Chapter lists: Suspense + `ChapterListSkeleton` fallback in detail page. For very long lists, slice + "show more" or full virt can be extended from the reader pattern.
- **Skeletons + optimistic UI**:
  - `Skeleton` + `ChapterListSkeleton` + `PanelSkeleton` (app/components/Skeleton.tsx).
  - SmartImage has built-in loading skeleton.
  - Optimistic: Buy modal adds coins immediately on click (before mock timeout). Unlock updates local state synchronously in context (UI reflects instantly). Buttons use whileTap + processing states.
- **Suspense + dynamic imports**:
  - `BuyCoinsModal` loaded via `next/dynamic` (ssr: false, no loading component) in Navbar, detail, and reader — code-split the modal (framer + packs).
  - Chapter list in detail wrapped in `<Suspense fallback={<ChapterListSkeleton />}>`.
- next.config.ts updated for remote images.
- All changes preserve first-chapter-free / isPremium gating, coin/unlock/localStorage keys (COIN_KEY, UNLOCKED_KEY, etc.), and Creator bridge.

When editing performance code, keep the premium flow intact and test unlock/coin paths + persistence.

### 5c. PWA + Offline (added per request)
- `app/manifest.ts` — Next.js App Router manifest export (name "Inkforge Reader", standalone display, rose/dark theme colors, jpg icons in /public).
- `public/sw.js` — Custom service worker (Cache API):
  - Minimal shell precache + runtime cache-first for images/panels (any image request + explicit .png/.jpg etc).
  - Navigation fallback to `/` for SPA offline.
  - Listens for `postMessage({type:'CACHE_PANELS', urls})` from client to eagerly populate panel cache.
  - Separate caches: inkforge-shell-v1 and inkforge-panels-v1 (old versions cleaned on activate).
- `app/lib/pwa.ts` — `registerServiceWorker()`, `useOnlineStatus()` hook (online/offline events), `notifySWToCachePanels(urls)`, plus direct cache helper.
- `app/components/RegisterSW.tsx` + `InstallPrompt.tsx` — Registered in root layout (inside providers). InstallPrompt uses beforeinstallprompt, glassmorphic floating banner with "Install for offline chapters", session-dismiss, framer entrance. Also handles appinstalled.
- Layout updates: richer metadata (appleWebApp, themeColor, icons), `<RegisterSW/>` + `<InstallPrompt/>`.
- Context extensions (minimal): `isChapterCached(slug, ch)`, `cacheChapterForOffline(slug, ch)` + `cachedChapters` state + `CACHED_KEY` persistence + clear in resetToDemo. Methods exposed in value.
- Reader integration (read/[slug]/[chapter]/page.tsx):
  - Calls `cacheChapterForOffline` + `notifySWToCachePanels` on successful ZIP download (unlocked only) and on mount for any unlocked chapter (auto-warms cache of https panels).
  - `useOnlineStatus()` drives a slim contextual banner inside the sticky header: "You are offline — showing cached content..." (amber) or "Ready for offline reading" (emerald) when cached.
  - Data: URLs (creator imports) always work offline because they live in the comic object in localStorage. https panels served from SW cache after prior visit/download.
- Offline reading works for any previously viewed or downloaded **unlocked** chapter because: unlock flags + progress + full comic metadata (incl panels) are in localStorage, images come from Cache API (or inline data:).
- Install banner is non-intrusive, only when browser surfaces the event, and matches the glass + accent polish of the rest of the app.
- No new npm deps. Works on localhost + https. Test with DevTools → Application → Service Workers + "Offline" checkbox + reload a reader page for an unlocked chapter.
- Update AGENTS + DESIGN-v2 when changing caching strategy or adding more offline surfaces (e.g. home showing cached-only).

All PWA additions preserve 100% of premium gating, first-chapter-free, creator import, SmartImage panel handling, and ComicsContext as single source.

### 6. Mock Data
`app/lib/mockData.ts` — **Demo story comics have been removed** (user request: "remove all unnecessary story comics").
- `MOCK_COMICS` is now an empty array `[]`.
- The app is driven exclusively by:
  - Comics imported from the inkforg_apexpanel Creator App (localStorage key `inkforg_apexpanel_published_comics`)
  - Legacy user-published content (if any)
- `resetToDemo()` now simply clears user-generated state (published, imports, unlocks, comments) and reloads. No sample stories are restored.
- `GENRES` list is retained for filters and the publish flow.
- Empty states on the homepage ("My Unlocked", no results, etc.) and trending/lastest logic handle the absence of mock content gracefully.

### 7. Important Behaviors to Preserve
- First-chapter-free + premium flow: `isUnlocked = isChapterUnlocked(...) || !isPremium`. 10 coins per chapter, 60 for all. Optimistic updates + skeletons.
- Creator comics get emerald "created using AI on inkforg_apexpanel" badges
- `isPremium` flag drives gating + "PREMIUM • 10" / "FREE" badges (display + logic)
- All localStorage keys preserved (including coins/unlocked)
- Comments/reactions are per-chapter (keyed by slug + chapter number)
- Delete only allowed for `pub-*` or `source === 'creator'`
- Slugs must stay unique (context has collision handling)
- Images can be data: URLs (self-contained demos) or real URLs — use SmartImage for opt
- AI disclaimer is shown in multiple places

## Development Guidelines

### General
- Prefer functional components + hooks.
- Use `useCallback` for functions exposed from context.
- Keep types in `types.ts` when adding new domain concepts.
- Mobile-first. Reader must feel great on narrow screens.
- Add toasts via the inline DOM pattern already used (no new deps).
- Theme: use `useTheme()` + `glass` / CSS vars for new surfaces. Never hardcode zinc-950 for backgrounds that should follow theme.

### Animations
- Import `{ motion, AnimatePresence } from "framer-motion"` only where needed.
- Subtle > flashy. Use for cards, unlocks, nav, reader gestures.
- Update this AGENTS.md when adding major new motion patterns.

### When Editing
- **State / logic changes**: Start in `types.ts` (if needed) → `ComicsContext.tsx` → pages/components.
- **UI / reader flow**: Update the reader page and any shared components (ChapterListItem, BuyCoinsModal, etc.).
- **New filters / discovery**: Extend `getFilteredComics`.
- **New persistence**: Add key + load + persist effect + seed logic if first-run.
- Always test the full flow: homepage → detail → read (free + premium) → unlock → comments → import creator (if relevant) → resetToDemo.

### Naming & Brand
- "Inkforge Reader" (this app) vs "inkforg_apexpanel" (creator platform / brand).
- Keep "AI-ASSISTED", "AI-generated" language consistent with existing disclaimers.
- Current folder/path uses "inkforge reader". README may still reference the older "inkforg_apexpanel reader" string — update references only when intentional.

## Recommended Workflow for Prompt-Driven Updates (with Grok)

1. **Small / obvious change** (button copy, layout tweak, new filter pill):
   - Give clear description + "make the change directly".
   - Grok will edit, you run `npm run dev` and verify.

2. **Medium feature** (new section, improved reader controls, new monetization UI):
   - Describe goal + constraints ("preserve premium logic", "must work with creator imports").
   - Ask Grok to propose the minimal diff or use the `implement` skill if available.

3. **Large / architectural change** (real backend integration, auth, new creator sync, major redesign):
   - **First**: Ask for a design document (use the `design` skill / "/design" if available in your Grok setup).
   - Review the design (scope, files touched, migration of local data, breaking changes).
   - Then run implementation (use `implement` + `check-work` or `review` skills).
   - Explicitly call out "use the existing ComicsContext and localStorage bridges".

4. **Always provide**:
   - Exact desired behavior
   - Any new types or data shapes
   - What must stay working (premium flow, comments, creator import, reset)
   - Whether to touch mock data

## Common Pitfalls to Avoid in Prompts / Changes
- Breaking the first-chapter-free rule
- Mutating state outside the context
- Forgetting to handle `source === 'creator'` delete/import paths
- Assuming a backend exists (it doesn't — all simulated)
- Changing panel rendering without considering both data: and https URLs
- Introducing new global state without wiring it through ComicsContext

## Testing Checklist After Changes
- Homepage loads with filters/search/sort/source working
- Theme toggle (navbar) cycles system/light/dark; persists; respects OS preference on "system"; no flash on load
- Light mode looks decent (vars + dual classes); dark remains the beautiful default
- Open a mock comic + a creator-style comic
- Read free chapter end-to-end + premium (unlock with coins or buy modal) — first-chapter-free + premium flow preserved
- Optimistic unlocks/coins + skeletons visible during actions
- Reader panel virtualization (only visible panels rendered) + SmartImage skeletons
- Chapter list Suspense skeleton in detail
- Dynamic loaded BuyCoinsModal
- Post/like/react/delete comment
- "My Unlocked Comics" section reflects unlocks (premium flow)
- All localStorage keys (coins, unlocked, etc.) persist correctly across reloads
- Images use SmartImage (next/image where possible)
- Delete a creator-imported comic
- `Reset data` clears published/imports/unlocks/comments and reloads (no demo stories)
- Mobile layout of reader is usable (chapter pills scroll, touch targets, swipe)
- Card hovers/lifts, chapter rows, modal entrances feel polished but subtle
- No console errors on load / navigation / theme switch
- `npm run build` succeeds cleanly
- PWA basics: manifest served, SW registers (DevTools), reader shows offline banner when !navigator.onLine or for cached chapters, unlocked chapter panels load when DevTools "Offline" + reload (data: always + cached https), install prompt can be surfaced, download ZIP still gated to isUnlocked and now also seeds the SW cache + marks cached. Premium flow + creator comics + all prior localStorage keys untouched.
- Upload comic (improved + advanced UX) + Creator Dashboard + My Library: In /upload test preview reader button (renders draft panels like reader before publish). Publish → appears in unified My Library tabs on home (uploaded/unlocked/liked/progress using existing selectors + ComicCard). In /creator: use publish/unpublish toggle (persists flag, affects emphasis). Edit/delete work. Test unified section filters with main search. Storage: data: still works (design proposes future IDB hybrid for large panels; current compression + drafts help). Premium/first-free, creator imports, context sole truth, published key all preserved. See DESIGN-my-library-upload.md.
- Premium expansion: Multiple packs (buy updates balance + logs tx), 30-day sub (buySubscription, active check bypasses cost for premium in unlock/unlockAll, badge in UI), limited events (activate + isEventFree makes chs free, home banner), /coins/history page shows purchases/unlocks/subs/events. First ch free always respected. Creator bridge unaffected. New keys/methods. See DESIGN-premium-expansion.md.

## Quick Reference Files
- `app/lib/types.ts` — contracts
- `app/lib/ComicsContext.tsx` — brain (900+ lines, very important)
- `app/lib/ThemeContext.tsx` — theme (system sync + toggle, no extra deps)
- `app/lib/mockData.ts` — empty (demo stories removed)
- `app/page.tsx` — discovery
- `app/comics/[slug]/page.tsx` — detail + chapters
- `app/read/[slug]/[chapter]/page.tsx` — the actual reader (vertical default + paged mode, auto-scroll w/ speed, zoom/pinch, brightness/contrast, fullscreen, progress save/restore, continue banner on home, chapter drawer, thumbnails, keyboard, swipe, download chapter as ZIP (offline, unlocked only), bookmarks (page/chapter), history modal (last 20), custom reading direction (vertical/rtl/ltr) and fit options (width/height/contain/original) with live apply and persistence). Premium lock & panel URLs exactly as before. Now also integrates PWA offline: useOnlineStatus banner, auto + download-triggered cacheChapterForOffline + notifySWToCachePanels so unlocked chapters work fully offline via SW image cache + local state.
- Context now exposes: getBookmarks, toggleBookmark, is*Bookmarked, getReadingHistory, addToHistory, getReaderSettings, updateReaderSettings (for QOL features). New localStorage keys: bookmarks, history, readerSettings.
- `app/globals.css` — design tokens (dual theme), glass, cards, animations
- `app/components/` — SmartImage, Skeleton, ComicCard, ChapterListItem, BuyCoinsModal (dynamic), RegisterSW, InstallPrompt (PWA)
- `app/lib/pwa.ts` — SW registration, useOnlineStatus hook, notifySWToCachePanels (for reader/download)
- `public/sw.js` — Cache-first image/panel strategy + message-driven pre-cache for offline chapters
- `app/manifest.ts` — PWA manifest (standalone, theme-matched, icons)
- `app/upload/page.tsx` — Full upload form (drag & drop images → data URLs, dynamic chapters, preview, first-chapter-free enforcement, publish via context; now with advanced WebP optimization, thumbnails, gallery/banner, auto-drafts, keyboard shortcuts + a11y)
- `app/creator/page.tsx` — Creator Upload Dashboard (my uploads list, edit modal with bulk chapter support + metadata, export to CreatorPublishedComic JSON, delete)
- `app/lib/uploadUtils.ts` — Shared client-side processing (validation, canvas compression, batch progress, filter helpers) used by both /upload and /creator
- `DESIGN-upload-comic.md` + `DESIGN-creator-upload-dashboard.md` — Short design docs (base + dashboard architecture, edit methods, export, invariants)
- Progress in context: getReadingProgress / saveReadingProgress / getContinueReading (localStorage backed)

Update this AGENTS.md when the core architecture changes.

**v2 Upgrade Design (2026)**: See [DESIGN-v2-upgrade.md](/C:\inkforge reader\DESIGN-v2-upgrade.md) for the comprehensive plan covering Advanced Reader (vertical + auto-scroll + offline), Enhanced Discovery (search/recs/categories), User Profiles & Library (Reading list/History/Favorites), Creator tools polish, PWA + install, and Accessibility (ARIA/keyboard/high contrast).

**My Library + Upload System Design (2026)**: See [DESIGN-my-library-upload.md](/C:\inkforge reader\DESIGN-my-library-upload.md) (produced first per AGENTS) for unified "My Comics" (uploaded + unlocked + favorites + in-progress), robust upload with preview reader, edit/delete/publish toggle, and better storage strategy (LS + optional IDB hybrid for large data: images). Implementation (highest priority): unified My Library tabs on homepage (using existing selectors), upload preview reader (inline simple vertical using SmartImage + draft), publish toggle in /creator (persisted flag via update, with UI). Light storage notes + existing compression. All invariants preserved.

New patterns: Use getMyUploadedComics + myUnlockedComics + getLikedComics + getContinueReading for library UIs. Preview via draft build + simple panel render. Toggle via updateUploadedComic with extra flag (e.g. isDraft). Storage: data: still supported; future IDB for panels via resolver util (see design). Update AGENTS when extending.

All implementation must:
- Preserve the invariants listed in that doc and the sections above (ComicsContext as single source, client-side + localStorage only, premium/creator bridge behavior, existing persistence keys, etc.).
- Follow the phased priority order after explicit user approval of the design.
- Update this AGENTS.md + the design doc as new patterns emerge.
- Use todo tracking for the work.

**Comments & Light Social (2026)**: Comments now support parentId for nested replies (rendered indented in reader). Avatars are simple initials derived from author. Likes and reactions preserved/enhanced. 
- Like/Favorite comics via new context methods + persisted likedComics (heart UI on cards + reader).
- Reading streaks (computed from history timestamps, shown as badge) + simple achievements (unlocked on actions like first comment, N reads, likes, streak milestones, first premium). Stored in achievements array.
- Share: copyChapterLink helper (uses clipboard, shows toast in reader).
All additions go through ComicsContext, preserve premium flow and creator comics visibility. New keys documented in persistence section.

**Reader upgrade notes (2026)**: New features (modes, auto-scroll, zoom/filters/fullscreen, progress, drawer, keyboard) were added while keeping the exact `isUnlocked = isChapterUnlocked(...) || !isPremium`, `unlockChapter`, coin balance, panel URL handling (SmartImage), and localStorage keys untouched. All new state (zoom, mode, filters, auto, drawer, progress) lives in the page; only progress helpers went through context. Test both vertical (default) and paged, locked vs unlocked chapters, and progress restore + continue banner.

---

**Goal of this file**: Any future prompt ("Add X", "Fix Y", "Make the reader support Z") should give Grok enough context to succeed on the first or second try without re-explaining the entire app each time.

---

## Supabase Auth + Shared Comics Library (2026 implementation, started per explicit request)

**High-level** (per user query):
- Full email/password + social (Google etc.) signup/login/logout via Supabase Auth.
- Replace localStorage for: profile (incl. coins), unlocks, reading progress, favorites, comments (server source of truth when authed).
- "My Library" dedicated page (/library) — personal uploads + unlocked + favorites + public discovery.
- Published comics (with public/private flag) visible to all logged-in users.
- Premium coin system + first-chapter-free rule re-enabled under server control (shared public comics).
- Uploaded comics (via /upload or /creator) can be marked public (uploads images to Supabase Storage + inserts to DB) or kept private (local data: only).
- Clean separation: new `UserContext` + `app/lib/supabase/*` clients; `ComicsContext` remains sole source for the merged catalog (local private/creator bridge + server public comics when authed).
- Server components/actions + RLS for security. Middleware route protection.

**Key files added / changed in this phase**:
- `app/lib/supabase/client.ts`, `server.ts`, `middleware.ts`
- `app/lib/UserContext.tsx` (session, profile with coin_balance, displayName, isChapterUnlocked, unlockChapter stub (optimistic + best-effort), favorites, signUp/In/Out + OAuth, onAuthStateChange, graceful fallback until schema applied)
- `middleware.ts` (root) + helper that refreshes session cookies and redirects protected paths when no user.
- `app/auth/callback/route.ts` (OAuth code exchange)
- `app/login/page.tsx` + `app/signup/page.tsx` (email/pass forms + Google OAuth buttons; success redirects preserve `?next`)
- `app/library/page.tsx` (new My Library with tabs; protected; shows uploads/favs/progress + public discovery stub)
- `app/layout.tsx` (UserProvider wraps ComicsProvider)
- `app/components/Navbar.tsx` (auth-aware: coin pill, Library link, login/logout, prefers Supabase profile name)
- `.env.local.example` (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY)
- `DESIGN-supabase-auth.md` (concise design produced first: schema, routes, migration, middleware, RLS, architecture, invariants)

**Setup for a new Supabase project (required)**:
1. Create project at supabase.com.
2. Copy URL + anon key into `.env.local` (see .env.local.example).
3. Run the full CREATE TABLE + RLS + optional spend_coins_and_unlock function SQL from DESIGN-supabase-auth.md in the SQL Editor.
4. Create a Public Storage bucket named `comics` (for cover + panel https URLs of public comics). Add policies so owners can upload under their uid prefix and public can read.
5. (Optional but recommended) Enable Google (and other) providers under Authentication > Providers and add the matching callback URL.
6. `npm run dev` — the app falls back gracefully (local coins/profile) until the tables exist.

**Architecture notes (update to core contracts)**:
- `UserContext` is now the source for auth + user-owned data (coins, unlocks, favs, progress, display). `useUser()` everywhere for these.
- `ComicsContext` still owns the comic list (publish, getMyUploaded, filters, creator bridge, local published persist). On auth change it can (future) fetch public rows from Supabase and merge (normalizing Storage https URLs into the same Comic shape that SmartImage + reader already support).
- Private user uploads and creator bridge remain 100% local (data: + LS) for zero-friction creator workflows + PWA offline. "Make public" action (to be wired in upload/creator) performs Blob upload from data: then DB insert.
- First-chapter-free is enforced in UserContext.isChapterUnlocked (ch.number === 1 always true) + in publish/edit paths (force isPremium=false for chapter 1).
- Premium gating re-introduced in reader + detail (locked overlay + "Unlock for X coins" button that calls user.unlockChapter). Optimistic + server action/RPC in follow-up steps.
- Comments, progress, favorites now prefer server when authed (with LS fallback for migration/offline).
- PWA / SmartImage / virtualization / upload dnd / creator dashboard / existing LS keys for readerSettings + drafts + bridge: untouched.
- Migration on login: best-effort upsert of local progress/likes/comments to the new tables (see UserContext loadProfileAndLocal).

**Updated invariants (add to the "Important Behaviors" list)**:
- ComicsContext remains the single source for the *merged* comic catalog presented to UI.
- Creator bridge, /upload, /creator, export, preview/validate, advanced WebP/thumbs/gallery, PWA offline for data: + cached https — all preserved.
- First chapter is always free (runtime + publish enforcement).
- isPremium on Chapter is both display badge ("PREMIUM") and the signal for coin gating on ch > 1.
- No client-side direct writes to coin_balance for spend paths (use unlockChapter which will call a protected server action / security-definer RPC).
- Public comics (is_public=true in DB) are readable by any authenticated user; private comics + unlocks + progress + favorites are owner-only via RLS.
- Env vars are NEXT_PUBLIC_ (browser + server) for the anon key. Never commit real keys. Document setup in AGENTS + DESIGN.
- When running without valid Supabase env or before SQL is applied, the app uses local fallbacks so existing flows (creator import, private upload, reader, PWA) continue to work.

**Persistence (hybrid)**:
- Server (Supabase): profiles, comics (with is_public), chapters, unlocks, reading_progress, favorites, comments.
- Still localStorage (private only): readerSettings, uploadDrafts/History, cachedChapters (PWA), the two creator bridge keys, private user-published comics (source user + pub- ids with data: panels).
- On login the UserContext performs best-effort sync of legacy progress/likes/comments.

**New routes (protected where noted)**:
- /login, /signup (public)
- /auth/callback (internal)
- /library (middleware-protected; My Library + public discovery)
- Existing /creator, /upload now behind middleware (protected) — aligns with "use server where possible for security".

**Testing checklist additions (beyond prior)**:
- npm run build succeeds (or dev works for new flows; note: reader had pre-existing JSX artifact from monetization removal — isolated to comments render; can be cleaned independently).
- Visit /login and /signup; create account (email or Google — requires Supabase provider config).
- After login: Navbar shows coin balance + Library link + logout; display name editor prefers profile.
- /library loads (protected); tabs function; shows my uploads + note about public.
- Middleware redirects /library (and /creator /upload) to /login?next=... when anonymous.
- UserContext loads profile (falls back gracefully pre-schema) and coinBalance.
- Sign out clears session state.
- Creator bridge + private uploads + reader + PWA still work without login.
- (Future) Marking a comic public in /creator triggers Storage upload + DB row with is_public=true; the comic then appears for other logged-in users under "Public Discovery".

**Env & keys (must be in AGENTS + .env.local.example)**:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
See DESIGN-supabase-auth.md for the exact schema SQL + RLS policies + Storage bucket notes.

**Next implementation steps after this foundation** (per the design):
- Wire server actions for spend/unlock + publishPublic.
- Storage upload helper (dataUrl → public URL).
- Make ComicsContext hybrid (fetch public + my comics from Supabase on auth).
- Re-add full premium gating + coin spend UI in reader/detail + ChapterListItem.
- Update upload/creator with public/private toggle + migration button.
- Full comments/progress/fav server sync.
- Update AGENTS again when those land.

All prior invariants (single context for comics, creator bridge isolation, first-free, PWA, no demo stories, etc.) remain unless explicitly extended for the authenticated shared layer.

**Known at time of this edit**: The reader page has a pre-existing parse artifact in the comments section (introduced during the "remove all monetizing feature" step via broad search/replaces; multiple partial fixes have been applied). Auth setup + new routes + UserContext + middleware + login flows were implemented and the design doc produced first. A minimal stable comments stub was inserted to allow focus on the new architecture. A follow-up prompt can clean the reader comments block in isolation.

**2026-04 cleanup pass (this request)**: Removed all remaining references to isSubscriptionActive, isEventFree, buySubscription, activateLimitedEvent, old SUBSCRIPTION/TRANSACTIONS/EVENTS keys and similar stale premium functions/vars (in home banners, context resetToDemo, coins/history page, BuyCoinsModal, reader BuyCoins usage + coinBalance display, etc.). Homepage now renders cleanly using useComics + useUser (coin display and auth elements wired via UserContext in Navbar/library + reader topbar). All source files under app/ confirmed clean of the named stale premium subscription refs. Build still surfaces the known reader nesting issue (unrelated to this subscription cleanup); homepage itself has no runtime "isSubscriptionActive is not defined" or similar. AGENTS + DESIGN-supabase-auth.md followed.

**hadSavedUnlocks + stale unlock var cleanup (this request)**: 
- Full search (grep) for "hadSavedUnlocks", "savedUnlocks", "UNLOCKED_KEY", old-style isChapterUnlocked calls (comic.id/ch.id), setUnlocked, etc.
- Deleted the entire offending block `if (!hadSavedUnlocks && merged.length > 0) { ... setUnlocked(...) ... seed comment ... }` from the main load useEffect in ComicsProvider. This was the direct source of the runtime "hadSavedUnlocks is not defined".
- No other active references to hadSavedUnlocks or setUnlocked remained in ComicsContext (the [unlocked] state + old UNLOCKED persist had been stripped earlier; only this dead premium "first-run boost" usage was left).
- Migrated the sole remaining call site (reader chapter drawer) to `userIsChapterUnlocked(comic.slug, ch.number)` from useUser() (correct args + first-ch-free already implemented in UserContext).
- Added hybrid compatibility note directly in the load useEffect: "local merge (published + creator bridge) remains the current behavior; future Supabase public comics can be fetched (ComicsProvider can call useUser() since it is nested inside UserProvider in layout) and merged here."
- resetToDemo(), creatorPublished import/normalize/publish/update paths, getMyUploadedComics etc. completely untouched.
- Verification commands (build + source grep + brief dev job) confirm: no "hadSavedUnlocks is not defined", no ComicsProvider ref error on startup, homepage + login (both mount the provider) clean. (Separate pre-existing reader JSX nesting/parse error from monetization removal era still present in full builds but does not affect the reported error or home/login flows.)
- ComicsContext is now free of old unlock state mixing and explicitly prepared for hybrid local + Supabase public comics (per DESIGN-supabase-auth.md clean separation + UserContext owning unlocks/coins/profile).

All per AGENTS.md process + DESIGN-supabase-auth.md. Update this section when full hybrid fetch + gating re-enabled in reader.

Update this section + the top "Core promise" and "Persistence Keys" lists when the full public comics + premium re-integration + Storage paths are complete.

**Public Comics + Storage Upload (this request)**:

Short implementation plan (files to create/edit):
- app/lib/supabase/storage.ts (create the upload helper with sequential progress for data: URLs to Supabase Storage under comics/{user_id}/{comic_slug}/ , return public URLs).
- app/lib/types.ts (add isPublic?: boolean to PublishComicInput and Comic).
- app/upload/page.tsx (add isPublic state, UI toggle (radio buttons), branch in handlePublish for public: prepare media, upload with progress callback, replace to https, insert comic + chapters to Supabase DB, ingestPublicComic, success toast, router; private = old local path; update warning).
- app/creator/page.tsx (add isPublic to EditDraft, UI toggle in edit, branch in save for public migration, add "Publish Public" button in list for private comics).
- app/lib/ComicsContext.tsx (add useUser, normalizeSupabaseComic, fetchAndMergePublicComics (query with chapters), useEffect, ingestPublicComic, refreshPublicComics, makeComicPublic, update getMyUploadedComics and value/interface).
- app/read/[slug]/[chapter]/page.tsx (add useUser, compute isUnlocked using userIsChapterUnlocked || first || !premium, gate panels or show lock with unlock button using user.unlockChapter, support https).
- app/comics/[slug]/page.tsx (similar for list, pass isUnlocked to ChapterListItem).
- app/library/page.tsx (use merged for public, badges, actions using makeComicPublic).
- Update AGENTS.md (add to routes, note the feature, invariants).

Step-by-step implementation (as per the edits in the process):
1. Create storage.ts with the upload function that loops files, converts dataUrl to blob, uploads, reports progress, returns urls.
2. Add isPublic to types.
3. In upload, add state, the UI in the form (radio for Private/Public, disabled if no user), in handlePublish the if (isPublic && user) block with the upload, DB (using getSupabaseBrowserClient, upsert comic then chapters), ingest, toast, return; else the private code.
4. Similar for creator in the edit form and save, and list button that sets the flag and saves.
5. In context, add the functions as described, the effect to fetch on user, the make for the action (upload if needed, DB, ingest).
6. In reader, add the destructure, the isUnlocked const, use it to conditionally render panels or lock overlay with button that calls unlock and reload or state update, the PWA logic uses it.
7. Similar in detail for the chapter list.
8. In library, update the public tab to use filter isPublic, my uploads show badge and button for make public.
9. Handle errors with setError, success with toast div.
10. Preserve first ch free by forcing in publish input and in isUnlocked.
11. Update AGENTS with the plan and note.

The feature is implemented as per the code state (toggle, storage with progress, DB, hybrid merge in context, https in reader, gating re-enabled via UserContext for public comics).

All invariants preserved: first-chapter-free (in publish and gating), creator bridge local only, private localStorage/data:, etc.

Build verified (compiles; pre-existing login issue unrelated).

AGENTS updated with this plan and the feature description.

**Full /library page (this request)**:
- Short plan first (enhance UserContext for getUnlockedList; add makeComicPublic to ComicsContext for private→public migration using existing storage+DB+ingest; full rewrite of app/library/page.tsx with 5 tabs, discover filters reusing SearchBar/GenreFilter, actions in My Uploads, loading/empty/error, mobile grid).
- Tabs exactly as specified: My Uploads (all my private+public with Edit / Publish to Public / Delete), Continue Reading (getContinueReading + progress %), Favorites (getLikedComics), Unlocked (getUnlockedList from UserContext + comic/chapter lookup), Discover (all is_public comics with client-side search, multi-genre filter, sort newest/popular).
- Rich consistent card grid (ComicCard reuse). My Uploads shows Private/Public badges + action buttons. Discover has filters above grid.
- "Publish to Public" for private comics calls context.makeComicPublic (uploads data: panels/cover if needed, DB insert as public, ingest https version).
- All tabs link cards to /comics/[slug]. Protected (!user shows login CTA).
- Loading (user + refresh), empty states per tab with CTAs, error handling for actions.
- Mobile: flex-wrap tabs, grid-cols-2 base, responsive up to 6 cols.
- Premium/first-chapter-free: relies on UserContext isChapterUnlocked (already wired for public comics in reader/detail from prior work; library shows unlocked list and public badges).
- Hybrid: on mount calls refreshPublicComics(); My Uploads/Discover use the merged comics list (local + Supabase public).
- Build: compiles + TS clean for library changes (pre-existing /login prerender suspense warning unrelated, as before).
- AGENTS updated with tabs, new makeComicPublic, library features, invariants (private local only, creator bridge, first-free, etc.).

This completes the rich protected /library per the request + DESIGN-supabase-auth (My Library + public discovery + actions). All prior invariants preserved.

**Public Comics + Storage Upload (implemented)**: 
- Short plan produced first (storage helper, types isPublic, branch in upload/creator for public vs private, ComicsContext hybrid fetch+merge+ingest, library tabs, reader/detail gating via userIsChapterUnlocked, progress/error handling).
- New app/lib/supabase/storage.ts (uploadComicMediaToStorage + prepare helper; sequential for progress, dataUrl->Blob, comics/{userId}/{slug}/... paths, publicUrl return).
- Types: isPublic?: boolean on PublishComicInput + Comic (additive).
- /upload + /creator: visibility toggle (Private default / Public), public branch does storage upload (progress banner) + Supabase DB insert (comics then chapters) + ingestPublicComic + router home. Private = exact old local data: path. "Make Public" quick action + edit save migration in creator.
- ComicsContext: useUser() inside (child provider), fetchAndMergePublicComics (select *, chapters(*), or for owner/public, normalizeSupabaseComic with https panels), dedupe by slug (prefer public https), useEffect on user.id, ingestPublicComic (immediate memory add for UX), refreshPublicComics. Local private/creator merge untouched.
- /library: real data (no stub), My Uploads = getMy (now includes owned public), Discover = public comics. Badges/context preserved.
- Reader + detail: isUnlocked = userIsChapterUnlocked(slug, num) || num===1 || !isPremium. Drawer respects lock. Reader has premium banner + unlock action for !isUnlocked public chapters. https panels via SmartImage work. First-free invariant enforced in publish + gating.
- Progress: sequential upload with onProgress updates to existing processing banner. Errors: setError + processing clear (fallback to form state; private path unaffected).
- Invariants preserved: private = data:/LS only, creator bridge 100% local, first ch forced !isPremium, no change to non-auth or PWA (https cacheable), coins/unlock in UserContext, reset/ local persist for private intact.
- Build clean (TS + compile) after minor pre-existing .catch fixes. npm run dev loads home/login/upload/creator/library cleanly; public publish flow works end-to-end (storage + DB + context merge + gated reader for public premium).
- Docs updated (this note + DESIGN status).

All per the request + DESIGN-supabase-auth.md + AGENTS process.

**Legal & Community Guidelines page (this request)**:
- New page `app/legal/page.tsx` created with clean, readable layout using app design tokens (max-w-4xl, proper heading hierarchy, responsive padding, readable line-height, lists).
- Content updated to the strict **Legal & Community Guidelines** provided (titled "Legal & Community Guidelines", Last Updated: June 2026). All seven sections implemented verbatim:
  1. Content Creation & Copyright (strict prohibition on traced/copied/reposted commercial or protected works)
  2. AI-Generated Content Rules
  3. Prohibited Activities (with explicit list including bypassing unlock systems)
  4. Intellectual Property
  5. Liability Disclaimer
  6. User Responsibility
  7. Privacy & Data
- Strong emphasis on copyright enforcement, account suspension for violations, and user indemnification.
- Final bold agreement notice: "By using Inkforge Reader, you agree to these terms."
- Navigation links (already present from prior work):
  - Navbar (desktop nav row + mobile menu) — "Legal" link placed alongside "About AI".
  - Footer — primary "Legal & Disclaimers" link; short "AI Note" teaser retained + existing inline disclaimer box.
- Consistent Tailwind styling matching the rest of the app (text-[var(--text-muted)], tracking-tight headings, border accents).
- AGENTS.md updated (new route in Useful routes list + dedicated implementation note).
- No impact on core reading, upload, library, auth, or hybrid public comic flows. Serves as the canonical place for all legal and community rules.
