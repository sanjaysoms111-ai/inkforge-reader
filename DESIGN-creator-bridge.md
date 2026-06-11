# Short Design Doc: Strengthen Creator Bridge (Inkforge Reader)

**Date**: Current (post prior QOL/discovery/social updates)
**Scope**: Non-breaking enhancements to the existing creator import bridge (localStorage + clipboard JSON from inkforg_apexpanel Creator App). Goal: make the bridge more robust, creator-friendly, and visible while preserving all existing premium/unlock logic, first-chapter-free behavior, panel URL handling (data: or https), client-side only nature, and ComicsContext as single source of truth.

## Current State (from code + AGENTS.md)
- Creator comics arrive via:
  - `inkforg_apexpanel_published_comics` localStorage key (array of raw exports).
  - Clipboard import of single JSON (via `importCreatorComic`).
- Normalization in `normalizeCreatorComic` (in ComicsContext): maps to internal Comic shape. Sets `source: 'creator'`, `isAIGenerated: true`, first chapter `isPremium: false` (free), rest true. Genres from singular `genre`.
- Badges: Simple emerald "This comic was created using AI on inkforg_apexpanel." in reader + detail. Creator comics always eligible in discovery (sourceFilter), trending, recs.
- Prices: Hardcoded (10 per premium chapter in `unlockChapter`, 60 for `unlockAllChapters`). UI hardcodes the numbers in locked states, ChapterListItem, detail.
- Analytics: Basic `views` on Comic (static 420 for creator). No per-creator unlocks tracking exposed. Unlocks use the shared `unlocked` Record in context.
- Import UI: Basic "import from Creator App" button in home + clipboard support. No preview/validation before merge.
- Persistence: Creator items stored separately; `removePublishedComic` cleans the bridge key for creator sources. `resetToDemo` clears creator key.
- AGENTS: "Creator-published comics import via localStorage bridge." "keep creator-published comics visible." Premium flow (isPremium gating) must be preserved exactly. Everything client-side.

No structural breakage allowed. All new state (custom prices, analytics) lives in context or Comic/Chapter types. New localStorage? Avoid if possible; reuse/extend existing shapes.

## Goals / Requirements (from query)
1. **Better import flow with preview and validation**:
   - Before adding to `comics` state + persisting to bridge key, parse raw export.
   - Show preview: title, author, #chapters, genres/tags, cover, first few panels (thumbnails), detected prices if present.
   - Validation: required fields (title, chapters array with panels), valid panel URLs (data: or https), at least 1 chapter, first chapter free-ish (warn if not), slug uniqueness (handle collisions as current code does).
   - UI: Modal or dedicated import screen/stepper. "Preview & Validate" button -> summary (green/red) -> "Import" (or "Import with fixes").
   - Support custom prices in import JSON (see #3).
   - Keep existing auto-import on load + manual clipboard button.

2. **Creator badge enhancements + analytics (views/unlocks mock data in context)**:
   - Enhance badge: "Created with AI on inkforg_apexpanel" + small stats (e.g. "1.2k views • 87 unlocks").
   - Analytics in context: 
     - Mock `views` increment (e.g. on chapter read in reader, or on detail view).
     - Track unlocks per creator comic (derive from existing `unlocked` map or add lightweight per-comic counter).
     - Expose `getCreatorAnalytics(slug)` or attach to Comic on load (views, unlockCount, lastRead?).
   - Badges shown in ComicCard (subtle), detail, reader. Filterable in discovery.
   - Mock data only (no real backend). Persist lightly in localStorage or compute on fly from existing keys.

3. **Allow creators to set custom coin prices per comic/chapter**:
   - Extend import format + internal model:
     - Per-chapter: `chapters[].coinPrice?: number` (default 10 if premium).
     - Per-comic: `unlockAllPrice?: number` (default 60).
   - In `normalizeCreatorComic` + publish flow: read from raw/input if present.
   - Unlock logic (in `unlockChapter` / `unlockAllChapters`): use custom if set on the Chapter/Comic, else fallback to 10/60.
   - UI impact: Locked state in reader shows "Unlock with X coins" (X = custom or default). ChapterListItem and detail "Unlock All" respect per-comic. First chapter remains free (isPremium:false overrides price).
   - Validation in import: prices positive integers.
   - Creator side (external app) can now export these fields; reader supports them on import.
   - Preserve: Free chapters ( !isPremium ) never cost anything. All gating still via `isChapterUnlocked || !isPremium`.

## Design Decisions (short)
- **Structural?** Yes (new fields on types + normalization, new methods in context for import preview + analytics, UI changes to import + badges + price display). Hence this doc.
- **No new heavy deps**: Pure client (JSON parse + simple validation). Use existing framer-motion for nice preview modal if needed. Existing SmartImage for panel previews.
- **Context-only**: New helpers like `previewCreatorComic(raw)`, `validateCreatorComic(raw)`, `importWithPreview(raw)`, `getCreatorAnalytics(slug)`, `incrementCreatorViews(slug)`. Prices live on Comic/Chapter (extend existing shapes). Analytics can be lightweight derived state or attached during merge.
- **Import UX**: One new "Import from Creator" flow with 2-step (paste/ load -> preview/validate -> confirm). Auto on homepage load stays (but can be made to use preview internally for future).
- **Analytics mock**: On reader mount (if creator source), increment views (debounced). Unlock count = count of true values in unlocked map for that comic's chapters. Show in badges. Persist? Optional extra key or recompute.
- **Custom prices backward compat**: If absent in import JSON, use current hardcoded defaults. First chapter free rule always wins.
- **Creator visibility**: Unchanged (source==='creator' special in filters/recs/trending). Badges make them stand out more.
- **Persistence**: Reuse `CREATOR_PUBLISHED_KEY`. For analytics, either compute live or add small `creatorAnalytics` in context state (persisted optionally). Avoid polluting every Comic.
- **Testing / edge cases** (per AGENTS checklist): Import invalid JSON (validation error), custom price=5 chapter, read increments view, creator comic shows enhanced badge + analytics, unlock uses custom price, first chapter free even if price set, remove/delete cleans correctly, reset clears.
- **Future-proof**: Import format documented in AGENTS. Prices can evolve (e.g. per-comic base + chapter multipliers).

## Files Likely Touched
- types.ts (Chapter + Comic + CreatorPublishedComic extension)
- ComicsContext.tsx (normalize, new preview/validate/import helpers, analytics methods, price-aware unlock, views increment, state for analytics)
- reader/[slug]/[chapter]/page.tsx (use custom price in lock UI, call view increment + share? , enhanced creator badge)
- comics/[slug]/page.tsx (detail: custom prices in unlock all / chapter list, badge + analytics)
- components/ (ComicCard for subtle creator badge/analytics, perhaps new ImportPreviewModal)
- app/page.tsx (stronger import button that opens preview flow)
- AGENTS.md (update persistence, import contract, new context methods, "Creator bridge" section)
- (Optional) New small component for preview card.

## Implementation Order (post-doc)
1. Types + normalize/publish updates for prices + status (if needed).
2. Context: analytics (views/unlocks), price-aware unlock, preview/validate/import helpers.
3. UI: import preview flow (modal), badge enhancements everywhere, custom price display in lock/unlock UIs.
4. Polish + test (build, manual flows for creator import with/without custom prices, analytics update on read).
5. AGENTS update + this doc reference.

**Risks/Mitigations**: 
- Breaking existing creator exports: Mitigate with defaults + optional fields.
- Price logic complexity: Centralize in context unlock methods only.
- Over-engineering import: Start with modal preview using existing clipboard button; enhance auto-import later.
- Client-only analytics: Mock increments are fine (views on read, unlocks from existing state).

This keeps the "companion to inkforg_apexpanel" promise strong: creators get better feedback, custom monetization, visibility of their stats in the reader.

Next: implement per the plan above.
