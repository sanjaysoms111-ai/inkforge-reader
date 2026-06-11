# DESIGN: Upload Comic Feature (Short)

**Date**: 2026  
**Status**: Design produced → implement step-by-step  
**Per AGENTS.md + user request**: Short design doc first for structural feature addition, then code. Preserve **all** invariants.

## Goals & Scope
- Allow users to create/upload their own comics directly in the Reader app (images stay 100% client-side).
- New dedicated route `/upload` (full-featured form better than a cramped modal for multi-chapter + many panels).
- Entry point(s) from homepage "Creator Bridge Tools" section (and optionally Navbar) so it feels like an extension of the existing creator import flow.
- Core form:
  - Comic metadata: title, author, description, genres (multi), tags (freeform), status, cover image (single file upload + preview), optional `unlockAllPrice`.
  - Dynamic chapters: add/remove/reorder, per-chapter title + "isPremium" (first chapter **always free**), optional custom `coinPrice`, multiple panel images per chapter (drag & drop zone + file select, thumbnails, remove).
- Convert every selected image File → data URL (`data:image/...;base64,...`) immediately for `coverUrl` and `panels[]`. (Matches exact pattern used by the inkforg_apexpanel creator bridge.)
- Live-ish Preview section (or tab) showing the comic as it will appear (ComicCard + chapter summary) before commit.
- On "Publish / Save":
  - Build `PublishComicInput`.
  - Call existing `publishComic(...)` (single source of truth).
  - Redirect to the new comic's detail page.
- Automatically enforce "first chapter is free": UI locks first chapter `isPremium=false`; on save we guarantee it.
- Support the full premium logic (custom per-chapter prices, unlockAllPrice) that was added for creator imports.
- Resulting comics behave exactly like legacy user-published (pub- ids) + appear in discovery, detail, reader, with delete support, source handling, etc.

**Non-goals** (keep scope tight):
- No real server / cloud upload.
- No advanced image editing/compression (user responsible for reasonable file sizes).
- No reordering of panels via drag (buttons or append order is sufficient for v1).
- Do not duplicate the creator JSON paste flow.

## Architecture Decisions
1. **Route vs Modal**: Dedicated `/app/upload/page.tsx` (client component). Multi-file drag-drop + many chapters + preview is too heavy and poor UX in a modal. Homepage gets a clear call-to-action button inside the existing "Creator Bridge Tools" glass box. Direct navigation to `/upload` is supported and discoverable.
2. **Persistence**: **Reuse existing mechanism** — do **not** introduce `inkforg_apexpanel_user_comics` unless forced. 
   - Call the already-exported `publishComic(input: PublishComicInput)` from `useComics()`.
   - It already:
     - Generates unique `slug` + `id` (prefixed `pub-`).
     - Builds `Chapter[]` (numbers starting at 1).
     - Persists non-`creator` comics via `PUBLISHED_KEY = "inkforg_apexpanel:published"` (the "legacy user publishes" key documented in AGENTS).
     - Merges on load alongside the primary creator bridge (`inkforg_apexpanel_published_comics`).
   - This respects "existing published comics bridge" and avoids duplicating merge/persist/delete/reset logic.
   - In `publishComic` we will forward `coinPrice` (per chapter) + `unlockAllPrice` (comic) and explicitly set `source: 'user'`.
3. **Image handling**: `File` → `data:` URL via `FileReader` (or `URL.createObjectURL` + note that only data: survives reload/persist). Store the strings in local component state until save. Same as creator imports (panels and covers can be huge base64 in the LS key). 
   - Add a visible warning: "Images are converted to data URLs and stored locally. Use small/compressed files (< ~300-500 KB each) to stay under browser storage limits."
4. **First-chapter-free enforcement** (core invariant):
   - In the chapters UI: Chapter 1 is always rendered as "Free (always unlocked)" with `isPremium` forced `false` and no toggle.
   - Subsequent chapters default to `isPremium: true` with a toggle + optional coin price input.
   - On save / when building the input we re-assert `chapters[0].isPremium = false`.
   - This mirrors the documented "first chapter free" + `isUnlocked = isChapterUnlocked(...) || !isPremium` rule everywhere.
5. **Types**: Minor extension of `PublishChapterInput` (add optional `coinPrice?: number`) so upload can use the same custom-price feature as creator imports. Update `publishComic` implementation to copy the fields (previously it dropped them). No breaking changes.
6. **Source & filtering**: New comics get `source: 'user'`. They will appear under "official" in the current sourceFilter (or we can lightly extend the filter UI later). Delete logic already works via the `pub-` id prefix produced by publishComic. ComicCard can optionally show a subtle "Your upload" indicator for `source === 'user'`.
7. **Preview**: Client-side only. Build a transient `Comic`-shaped object from current form state (fake id/slug ok for preview rendering) and render `<ComicCard>` (read-only) + a simple chapter list with premium badges + panel counts. "Publish" button is the commit point.
8. **Styling/Polish**: Reuse all existing patterns — `.glass`, `.card`, `.btn-*`, `framer-motion` for chapter add/remove, lucide icons (Upload, Plus, Trash2, ArrowUp/Down, Image, etc.), Tailwind tokens, SmartImage where we show previews (it already handles data:). Keep mobile friendly (vertical stacking of chapter editors).

## Data Flow (Upload → Persist)
Form state (local useState) → on image change: `fileToDataUrl(file)` → store data strings → Preview derives a temp Comic → "Publish" → `const input = buildPublishInput(state); const created = publishComic(input); router.push(\`/comics/${created.slug}\`)`

`publishComic` (existing):
- Maps to internal `Chapter` (adds ids/numbers).
- Unique slug logic (already collision-proof).
- `setComics`, `persistPublished` (writes only the non-creator ones to LS).
- Returned comic is immediately visible in all derived lists (`getFilteredComics`, etc.) and in `ComicsContext`.

On reload: the load effect in provider pulls from `PUBLISHED_KEY` + creator bridge exactly as before.

Delete (via ComicCard on home or detail "remove"): already routes through `removePublishedComic` which cleans the published key (and special-cases creator key).

## Component / File Plan
**New**:
- `app/upload/page.tsx` — main page ("use client"). Form + chapters editor + preview + save.
- (Optional small) `app/components/ChapterEditor.tsx` or inline in the page for the per-chapter block (dropzone, panel thumbnails, title, premium toggle/price). Start inline to avoid over-abstraction; extract later if it grows.

**Modify**:
- `app/lib/types.ts` — extend `PublishChapterInput` with `coinPrice?: number`.
- `app/lib/ComicsContext.tsx` — 
  - Update `publishComic` to (a) forward `coinPrice` into chapters, (b) set `unlockAllPrice` on the comic, (c) set `source: 'user'`.
  - (No new methods needed; `publishComic` is already exposed.)
- `app/page.tsx` — inside the existing Creator Bridge Tools section, add a prominent button / call-to-action: "Upload comic with images →" that links to `/upload`. Short explainer text.
- `app/components/ComicCard.tsx` (light) — if desired, show a "Uploaded" badge when `source === 'user'` (non-breaking).
- `AGENTS.md` — add `/upload` to useful routes, document the (still-used) `inkforg_apexpanel:published` key for user uploads, add "Upload guidelines" subsection under persistence or a new "Upload / User Content Creation" section, update checklist.
- (Possibly) `app/layout.tsx` or Navbar if we want top-level nav item (keep minimal — homepage entry is sufficient for this iteration).

**No changes** to reader, detail (they already handle any comic with `isPremium` + unlocks + pub- ids), SmartImage, PWA, etc.

## Risks & Mitigations
- **localStorage quota / huge data: URLs**: Primary risk (same as creator bridge today). Mitigation: prominent warning in the form + README/AGENTS note. In code we can optionally skip very large files with a toast ("Image too large — try compressing first"). Data URLs are the contract; we do not switch to blobs/object URLs (they don't survive refresh).
- **Duplicate slugs**: Already handled by publishComic's timestamp + suffix loop.
- **Premium invariants broken**: Enforced in UI + on the input we build before calling publish. First chapter free is non-negotiable.
- **Poor mobile UX for many panels**: Use responsive grids, scrollable chapter list, clear "Add chapter" / "Remove" affordances.
- **No validation on save**: Add basic required-field checks (title, at least 1 chapter with ≥1 panel, cover). Show inline errors.
- **State loss on accidental nav**: Simple confirm on unload if form dirty (optional, can add `beforeunload` listener).
- **Performance**: Many base64 images in React state can be heavy. Use `useMemo` for derived preview comic. Thumbnails are small `<img>` (not full SmartImage until saved).

## Implementation Steps (after this doc)
1. Update types.ts (add coinPrice to PublishChapterInput).
2. Enhance publishComic in context to forward prices + set source:'user'. Update any related comments.
3. Create `app/upload/page.tsx`:
   - Client form state (meta + chapters[]).
   - Helper `fileToDataUrl`.
   - Drag/drop + input file handlers per chapter + for cover.
   - Chapter list (add, remove, reorder with up/down, per-ch title + premium controls — first locked free).
   - Optional price inputs.
   - Preview pane (derived comic + summary).
   - Validation + Publish button (build input, call context.publishComic, router.push).
   - Nice empty states, loading spinners on conversion, success feedback.
4. Wire entry point in `app/page.tsx` Creator Bridge Tools box.
5. (Light) Update ComicCard delete condition or badge if needed for source 'user'.
6. Update AGENTS.md (routes, keys, new "Upload guidelines", test cases).
7. `npm run build` + manual test flow (cover + 2 chapters with panels, preview, save, appears everywhere, first ch free + readable without coins, later chapters require unlock, delete works, reload persists, creator imports unaffected).
8. If time: small polish (genre multi-select pills reuse GenreFilter logic or simple buttons, framer for chapter enter/exit).

## Invariants Checklist (must hold after implementation)
- ComicsContext is the only way new comics enter the system.
- `publishComic` (or a thin wrapper) is used for the save path.
- First chapter always `isPremium: false`; premium chapters still respect `coinBalance`, `unlockChapter`, `isChapterUnlocked`, custom prices.
- New comics get `pub-` ids → deletable via existing UI.
- They appear in `getFilteredComics`, recommendations, continue/history (once read), etc.
- Creator bridge (`inkforg_apexpanel_published_comics`) and legacy published key behavior unchanged.
- No new global state outside context.
- SmartImage continues to receive either data: or (in future) https for panels/covers.
- All existing localStorage keys + resetToDemo continue to work.
- Premium/coin/unlock flow, source badges (creator), slug uniqueness, etc. untouched except for the new creation path.

This keeps the app a pure local shell while giving users a first-class way to bring their own image-based comics in, exactly as requested.

**End of short design doc** (ready for implementation).

---

## UX Improvements (Follow-up Request)

**Date**: subsequent iteration  
**Goal**: Polish the `/upload` flow for production-ready creator UX while staying 100% client-side.

### Required Enhancements
- Stronger drag-and-drop for cover + per-chapter panels (with visual feedback: ring highlight on dragover).
- Reorder panels *within* a chapter via drag-and-drop on the thumbnail grid (HTML5 drag events, array splice for new order — order is preserved in `panels[]` for reading order).
- Progress indicators: during batch image conversion + optional compression show "Processing X/Y images (Z%)" + a progress bar. Especially important when user drops 20–50 large files.
- Validation (hard + hints):
  - File types strictly limited to image/jpeg, image/png, image/webp (by mime + extension fallback).
  - Per-file size limit (e.g. 5 MB); above threshold → compression hint + auto lightweight processing.
  - Hard cap: 50 panels per chapter (extra files dropped with clear message; UI prevents going over).
- Premium chapter option already present (first chapter forced free + "FREE" badge; all subsequent default `isPremium: true` with coin price input). Keep and surface clearly.
- After successful publish: the new comic (source 'user', pub- id) must immediately appear in all homepage lists (grid, carousels, filtered, etc.) and receive a creator-style / "Your upload" emerald badge treatment in ComicCard (so it stands out like creator comics).
- Compression: optional-but-default lightweight client-side via `<canvas>` (scale to reasonable max dim + JPEG quality ~0.82-0.85 when original > ~1 MB). Original quality kept for small files. Note that this is lossy but dramatically reduces localStorage bloat while keeping panels usable.
- No new dependencies. All FileReader + canvas + DataTransfer + React state.

### Architecture Notes (no breakage to invariants)
- All logic stays inside `app/upload/page.tsx` (local component state for drafts, processing, drag state).
- Final save still builds `PublishComicInput` and calls the (already enhanced) `publishComic` from context → source:'user', prices forwarded, persisted via existing `inkforg_apexpanel:published` key, merged exactly like before.
- First-chapter-free enforcement remains (UI + explicit on the input object passed to publish).
- `ComicCard` receives the real persisted comic (with `source: 'user'`) and will render an additional badge next to the creator analytics one.
- Homepage delete conditions extended to `source === 'user'` (in addition to the `pub-` prefix) for clarity.
- Types: no structural change needed beyond what was done (PublishChapterInput already carries coinPrice).
- Context: only minor comment / doc updates if desired; the publish path is reused.
- Progress & validation are purely UI concerns during the File → data: phase.
- Reorder only mutates the local `chapters[].panels` draft array before save (final order goes into the published comic).
- After publish we can choose redirect target: to make "automatically show in homepage lists" literal we redirect to `/` (newest sort surfaces it right away with the new badge). Detail page remains one click away.

### Files Touched (incremental)
- `app/upload/page.tsx` (main work: dnd improvements, reorder impl, progress state + UI, validation helpers + canvas compress, updated handlers + thumbnail grid with draggable items, change publish redirect behavior + success messaging).
- `app/components/ComicCard.tsx` (add `source === 'user'` branch that renders an emerald "• Your upload" badge in the same line as the creator analytics badge).
- `app/page.tsx` (update the repeated `onDelete` condition in all ComicCard usages to also accept `source === 'user'`; already includes user comics via the published merge).
- `DESIGN-upload-comic.md` (this section) + `AGENTS.md` (new patterns: canvas compression, native dnd reorder, progress UX, validation constants, user-source badge treatment).
- Minor: comments in `ComicsContext.tsx` / `types.ts` acknowledging user-upload path produces source:'user' comics that participate in the same premium / discovery / delete flows.

### Risks & Mitigations (same as base design)
- Canvas compression is synchronous per image and can feel janky for dozens of huge files on low-end devices → process sequentially with state updates + small setTimeout(...,0) between items if needed; show clear %.
- Reorder dnd can be finicky across browsers → use simple index-based dataTransfer (text/plain), preventDefault everywhere, test basic swap/insert.
- Changing redirect to `/` for "auto show in lists" may surprise users who expect to land on their new comic → provide a clear inline success message + "Open detail" secondary action before/after push, or keep detail redirect and rely on the fact that lists are live.
- Still no server quota protection — the 50 cap + size + compression are the client guardrails.

These changes make the upload flow feel like a real mini creator tool while obeying every AGENTS.md rule (client-only, context as single source, existing persistence + publish path, first-free, premium costs, no breakage to creator bridge or reader).

Implementation follows the same step-by-step todo discipline.