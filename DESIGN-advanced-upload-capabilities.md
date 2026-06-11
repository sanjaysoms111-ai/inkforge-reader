# DESIGN: Advanced Upload Capabilities (Short)

**Per AGENTS.md** (follow-up enhancement to /upload + /creator flows and shared utils). Produce short design first, then implement step-by-step. All client-side, modern browser APIs (Canvas, FileReader, localStorage, KeyboardEvent, aria). Preserve every invariant.

## Goals
- **Image optimization**: Before any data: URL storage, client-side resize (canvas max dim) + WebP conversion (quality ~0.82) for smaller storage footprint and better perf. Fallback to JPEG if WebP unsupported (test via canvas.toDataURL).
- **Chapter thumbnail generation**: Auto-generate small thumbnail (e.g. 120-160px wide data URL) from first panel of each chapter. Store as `thumbnail?: string` on Chapter. Use in lists/cards for visual polish (e.g. in /creator list, ComicCard previews).
- **Cover gallery or banner image**: Extend support for `coverGallery?: string[]` (multiple optimized cover variants) and/or `bannerUrl?: string` (wide banner/hero). UI allows uploading additional images for gallery or dedicated banner. Carried through publish/edit/export.
- **Upload history / drafts**: Persistent drafts of *incomplete* comics (title, chapters partial, images, metadata) in localStorage. Auto-save (debounced), loadable into /upload form. Simple history of recent completed uploads (slugs or metadata) for quick re-access. Key: `inkforg_apexpanel:uploadDrafts`.
- **Keyboard shortcuts + accessibility for upload form**: Keyboard-driven (document keydown handlers with guards for inputs). A11y baseline: proper labels, ARIA live regions for progress/errors/status, focus management on dynamic adds (chapters/panels), roles, reduced-motion respect (existing css), visible focus.

**Scope limits**: Enhance existing /upload (primary) and /creator (display/edit support). No new routes. Re-use/extend uploadUtils.ts and context methods. Browser APIs only (no libs).

## Architecture Decisions
- **Optimization in utils (central)**: Enhance `app/lib/uploadUtils.ts`:
  - New/updated: `optimizeImage(file: File, options?: {maxDim, quality, preferWebP}): Promise<string>` — load via FileReader or Image, canvas draw (resize preserving aspect), try `toDataURL('image/webp', q)`, fallback `image/jpeg`.
  - Keep backward: `processImageFile` / `processImageFiles` now use advanced optimize internally (with progress hooks).
  - New: `generateThumbnail(dataUrl: string, maxWidth=160): Promise<string>` — small canvas version of first panel.
  - Validation stays (types, size pre-optimize, max panels).
- **Types (minimal, optional for compat)**:
  - `Chapter`: add `thumbnail?: string` (generated from panels[0]).
  - `Comic`: add `coverGallery?: string[]`, `bannerUrl?: string`.
  - `PublishComicInput` / `PublishChapterInput` carry through (no change needed; new fields on final Comic).
  - In publish/update/addChapters: copy new optional fields.
- **ComicsContext additions** (as explicitly requested "Add to ComicsContext"):
  - New persisted state + effects for drafts (like other QOL: bookmarks, history).
  - Methods (exposed in interface/value):
    - `saveUploadDraft(draftKey: string, data: any)` — partial form state (title, author, description, genres, status, tags, coverUrl/galleries, chapters partial with panels + thumbs).
    - `loadUploadDraft(draftKey: string): any | null`
    - `getUploadDrafts(): Record<string, {key, timestamp, title?, preview?}>`
    - `deleteUploadDraft(draftKey: string)`
    - `getUploadHistory(): Array<{slug, title, timestamp, coverUrl}>` (light; populated on successful publish from user uploads, or derive from myUploaded + date).
  - Optional helpers: `optimizeForUpload(file)`, `generateChapterThumbnail(panelDataUrl)`.
  - In `publishComic` / `updateUploadedComic` / `addChaptersToUploadedComic`: after building, auto-generate thumbnails for chapters (if not present), attach gallery/banner. Call persist.
  - Draft key: use temp uuid or slugBase-timestamp for incomplete.
- **UI integration**:
  - `/upload/page.tsx` (main):
    - Use updated utils for *all* image processing (covers, panels, gallery, banner).
    - On first panel per chapter → auto `generateThumbnail` + store `ch.thumbnail`.
    - Cover section: main cover + "Add to gallery" (multi) + "Banner image" (separate upload, optimized).
    - Drafts: Auto-save effect (debounce 800ms on any change) to `saveUploadDraft('current' or id)`. UI section or dropdown "Load draft / History" (list from `getUploadDrafts()`, click loads into form state, clears current if needed). On successful publish, optionally save to history + clear draft.
    - Keyboard: `useEffect` keydown listener. Examples: `a`/`A` = add new chapter (focus title), `p` = focus/add panels for current/last chapter, `Ctrl/Cmd + Enter` = publish (if can), `Ctrl/Cmd + S` = manual save draft, `Esc` = clear errors or close any, `1-9` jump chapters if <10. Guard: if focused in input/textarea, only meta combos. Announce via aria-live.
    - A11y: Add explicit `<label for=...>`, `aria-label`, `aria-live="polite"` regions for "Processing X/Y", errors, "Draft saved", "Thumbnail generated". `role="form"`, `tabIndex` where dynamic lists. Use existing focus-visible. Announce shortcuts on help text or first load (polite). Support `prefers-reduced-motion`.
  - `/creator/page.tsx`: 
    - In list cards: show chapter thumbnails (small SmartImage or img from `ch.thumbnail` || panels[0]).
    - In edit modal: support editing gallery (add/remove covers), banner, display thumbnails per chapter. When saving updates, thumbnails stay or regen.
    - History/drafts: Link or section to load a draft back into /upload.
- **Persistence**: 
  - Drafts: new `inkforg_apexpanel:uploadDrafts` (JSON object). Persist like other keys (useEffect on change, load on mount, clear in resetToDemo).
  - History: lightweight array in same key or separate `inkforg_apexpanel:uploadHistory`. On publish success for user comic, push {slug, title, publishedAt, coverUrl}.
  - Thumbnails/gallery/banner: stored inline as data: in the Comic/Chapter objects → go into published key (same as panels). Compression keeps sizes reasonable.
- **Export/Import compat**: When exporting from /creator or building input, include new fields if present (CreatorPublishedComic can be extended; homepage preview will ignore unknown gracefully or we can map).
- **Invariants (non-negotiable)**:
  - Everything client + LS only. No backend.
  - ComicsContext sole source: new draft/history methods live here; UI calls them + publish/update.
  - User uploads remain source:'user' / pub- in published key; creator bridge untouched.
  - Premium/first-free: unchanged (edits still force ch0 free; thumbnails don't affect logic).
  - Existing data (old uploads without thumbs/gallery) render fine (optional fields).
  - Performance: optimization happens before storage; thumbnails small; drafts auto but debounced.
  - A11y/keyboard additive, respect reduced-motion/existing patterns.
- **Browser APIs only**: Canvas 2D (drawImage, toDataURL with type/quality), FileReader, URL.createObjectURL (temp if wanted but prefer data:), KeyboardEvent, localStorage, requestAnimationFrame for smooth if needed. Feature-detect WebP (small canvas test once).

## Files to Touch
- `app/lib/uploadUtils.ts` (core: new optimize + thumbnail gens; update process* to use them).
- `app/lib/types.ts` (optional fields on Comic/Chapter).
- `app/lib/ComicsContext.tsx` (new draft/history state + methods + effects + wire into publish/update + expose; update resetToDemo to clear new key).
- `app/upload/page.tsx` (integrate opts, gallery/banner UI, drafts UI + auto, key handlers + a11y attrs, call context draft methods, generate thumbs on panel set).
- `app/creator/page.tsx` (consume thumbnails in UI, support gallery/banner in edit, drafts/history access).
- `app/page.tsx` (minor: mention new capabilities in creator tools tip?).
- `AGENTS.md` (update persistence keys, upload/creator sections with new features, context methods, utils, a11y/keyboard patterns, test cases; reference this design).
- `DESIGN-advanced-upload-capabilities.md` (this file) + cross-ref in prior DESIGN-*.md if needed.

## Risks & Mitigations
- WebP support: Detect once (try canvas.toDataURL('image/webp').startsWith('data:image/webp')), fallback JPEG. Document in UI "optimized (WebP where supported)".
- Data URL bloat even optimized: Resize aggressively for thumbs/gallery; existing 50 cap + size hints remain. Compression quality tunable.
- Drafts growing: Auto-prune old (>30 days?) or max N drafts on save. Clear on publish success or reset.
- Keyboard conflicts: Scope to form (not global when modals/reader open); use specific combos; provide help text listing shortcuts (accessible via ? or footer).
- A11y: Audit with existing focus styles; use polite live regions for dynamic updates (progress, draft saved, "chapter added"). Test tab order.
- Edit compat: Old comics without new fields load fine; when editing old, new fields added on save.
- Performance: All async/await with progress; avoid blocking UI on many images (sequential batch already).
- No breakage: All additive; old publish paths still work (thumbnails optional, generated on new uploads).

## Implementation Steps (after this doc)
1. Enhance uploadUtils (optimize + thumbnail fns, update existing process to call them, add WebP detect helper).
2. Extend types (optional fields).
3. Extend context (drafts/history state/persist/load/clear, new methods, integrate gen in publish/update flows).
4. Update /upload page (UI for gallery/banner, drafts panel + auto/load, shortcuts listener + a11y, call new utils/context, attach thumbnails).
5. Light updates to /creator (thumbnails display, gallery/banner fields in edit).
6. Update AGENTS.md + any cross-refs.
7. Build + test (optimization produces WebP/smaller, thumbs present, drafts persist/load, shortcuts work without breaking inputs, a11y attributes, full create/edit/publish roundtrip, premium/first-free intact, creator bridge unaffected).

This advances the creator tools while staying 100% faithful to AGENTS.md contracts and prior design decisions (shared utils, context as brain, published key for user content, etc.).

**End of short design.** Ready for implementation.