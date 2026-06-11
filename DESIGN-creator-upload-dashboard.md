# DESIGN: Creator Upload Dashboard

**Per AGENTS.md request** (structural addition on top of existing /upload flow). Short design doc first, then implement.

## Goals
- Proper "Creator Upload Dashboard" at `/creator` for managing user-created comics (the ones from /upload, source:'user', pub- ids, stored in `inkforg_apexpanel:published`).
- Accessible via prominent button (in homepage "Creator Bridge Tools" section, and perhaps from /upload).
- "Creator mode" treated as the dashboard itself (no complex toggle; button always available for users who have uploaded).
- Features:
  - List "My Uploaded Comics" (filter comics with source==='user' || id.startsWith('pub-')).
  - Edit existing: full metadata (title, author, desc, genres, status ongoing/completed, tags, unlockAllPrice), chapters (titles, pricing/coinPrice, isPremium), add/remove/reorder chapters, replace/add panels per chapter.
  - Bulk chapter upload support: in edit, easily add one or more new chapters with multiple panel images (drag/drop or multi-select per new chapter; repeat for bulk).
  - Simple metadata editor as part of edit form.
  - Export comic as JSON compatible with inkforg_apexpanel CreatorPublishedComic format (for backup, sharing, or re-import via the existing homepage paste/preview tool).
- Seamless with existing bridges: edits only affect user-published (the PUBLISHED_KEY), never touch creator bridge key. Use same persistPublished, remove logic. New comics still created via publishComic.
- Preserve **all** invariants:
  - First-chapter-free: on any edit/save, force chapter 0 isPremium=false, others optional premium.
  - Premium flow: coinPrice, unlockAllPrice, isPremium respected exactly as before (unlock logic, badges, etc. unchanged).
  - Client-side only, localStorage, ComicsContext sole truth.
  - source handling, slug stability (don't change slug on edit), ComicCard/delete/homepage lists continue to work.
  - No impact on creator imports, reader, PWA, etc.

## Architecture Decisions
- **Route**: `/creator` (new `app/creator/page.tsx`). "Dashboard" feel: list at top, "New Comic" links to existing /upload, selected comic opens edit form (modal or below-list editor for simplicity; modal preferred for polish using framer).
- **Entry**: Prominent "Creator Dashboard" / "Manage My Uploads" button in the existing Creator Bridge Tools glass box on homepage (next to upload link). Also link from /upload page ("Back to Dashboard").
- **"My" comics**: New context method `getMyUploadedComics(): Comic[]` filtering `source === 'user' || id.startsWith('pub-')`. Creator imports (source 'creator') have separate bridge tools.
- **Edit support**: Extend ComicsContext with:
  - `getMyUploadedComics()`
  - `updateUploadedComic(id: string, updates: Partial<Comic>)` – for metadata + full chapters replacement (UI builds the new chapters array with data: panels).
  - `addChaptersToUploadedComic(id: string, newChInputs: PublishChapterInput[])` – for bulk add (enforces numbering, first-free if somehow first but won't).
  - (Optional granular `updateChapter`, `deleteChapterFromComic` for fine control inside editor.)
  - All updates call the existing `persistPublished` after mutating the comics array in state. Protect against editing creator-source.
- **Bulk chapter upload**: In the edit UI, a "Add New Chapter (Bulk Panels)" section with its own dropzone/multi-file input + title field. User repeats for multiple new chapters. Reuses the proven file processing (validation, canvas compress, progress) from /upload.
- **Image handling in edit**: Same client-side File → data: + optional compress as /upload improvements (max 50/ch, jpg/png/webp, size hints). Support adding to existing chapter's panels (append) and/or full replace for a chapter. Thumbnails for current panels + remove individual.
- **Metadata editor**: Inline in the edit form (inputs for status select, tags chips, etc.). Genres multi-pills.
- **Export**: In list or edit, "Export JSON for inkforg_apexpanel" → builds object matching internal `CreatorPublishedComic` shape (id, title, author, genre (first or ''), description, coverUrl, chapters array with number/title/panels/coinPrice, publishedAt, unlockAllPrice), triggers browser download as `comic-slug-export.json`. Compatible with homepage's "Paste & Preview JSON" + validate/import flow.
- **UI/Style**: Reuse glass, cards, motion, lucide, SmartImage (for thumbs), progress bars from upload improvements. List as responsive grid of mini cards (title, ch count, premium/free, status, actions). Edit as nice modal with sections: Metadata, Chapters (editable list + bulk adder), Preview mini.
- **Integration**: 
  - After any edit, since comics state updates, homepage lists, detail, reader, etc. reflect immediately (with badge).
  - Delete reuses `removePublishedComic`.
  - New uploads via /upload still appear in dashboard list.
  - Premium/first-free: Enforced in edit UI (first ch locked) + on the update call (force flag).
- **No new keys**: Everything stays in `inkforg_apexpanel:published` for user content + the creator bridge untouched.
- **Creator mode**: The /creator page *is* the dashboard. Button makes it discoverable. (Future could add LS "creatorMode" flag for UI hints, but not needed now.)

## Data Flow
1. User clicks "Creator Dashboard" → /creator loads, calls getMyUploadedComics() from context → renders list.
2. Edit: Select comic → open editor modal, prefill from comic data. User edits metadata, modifies chapters (edit titles/prices, add/remove panels via dnd/upload, bulk add new chs with images → convert via shared utils → update local draft).
3. Save Edit: Build updated chapters array (enforce first free), call updateUploadedComic(id, {title, ..., chapters: updated, status, tags, ...}). Context updates state + persistPublished (writes filtered user comics to LS).
4. Export: Map comic → CreatorPublishedComic-shaped JSON (use first genre or '', carry prices) → download.
5. Bulk: The addChaptersToUploadedComic can be used internally, or UI can do full update for simplicity.
6. After changes, context comics update → all derived (filtered, myUnlocked if applicable, continue, etc.) and UI lists update live.

## Files / Components
- **New**: `app/creator/page.tsx` (main dashboard + list + edit modal + export).
- **New/Extract**: `app/lib/uploadUtils.ts` (move consts + fileToDataUrl + compressImageIfLarge + processImageFiles + progress-aware batch from /upload for reuse in dashboard bulk/edit. Keeps DRY).
- **Modify**:
  - `app/lib/ComicsContext.tsx`: Add getMyUploadedComics, updateUploadedComic (and optional addChaptersTo...), update interface, implement using existing persist. Add comments.
  - `app/lib/types.ts`: Minor – perhaps export CreatorPublishedComic or add comment for export shape; ensure PublishChapterInput sufficient (it is).
  - `app/page.tsx`: Add "Creator Dashboard" button/link in Creator Bridge Tools section (after the upload link).
  - `app/upload/page.tsx`: Refactor to import+use shared uploadUtils (for consistency, no behavior change).
  - `AGENTS.md`: Document new route, context methods (getMyUploadedComics, update*), utils, edit flow, export format, integration notes, updated testing.
- Reuse: ComicCard (for list previews?), existing remove, publish patterns, premium badge logic, /upload's dnd/progress/validation code (now shared).

## Risks & Mitigations
- Editing deep (panels data: bloat): Same as creation – reuse compression + 50 cap + warnings. Edits can make comics larger.
- Breaking first-free/premium on edit: UI locks first ch, and update logic re-asserts `chapters[0].isPremium = false`. Test unlock after edit.
- Sync with bridges: Edits only touch user filter in persistPublished. Creator key untouched. If user imports a creator comic and wants to "edit", they can but we scope to uploaded for now.
- Complex UI in one page: Modal edit keeps dashboard clean. Extract chapter editor sub if grows, but inline first.
- Export compatibility: Use exact shape from CreatorPublishedComic interface (including optional dialogues/coinPrice/unlockAllPrice). Test roundtrip via homepage paste tool.
- No backend: All local, as required.
- Performance for large edits: Progress during image processing (reuse existing).

## Implementation Order (step-by-step)
1. Extract/create shared uploadUtils.ts + update /upload to use it.
2. Extend context (methods + interface + impl + persist safety).
3. Minor types updates/comments.
4. Build /creator/page.tsx (list using new getter, edit modal with full form + bulk uploader + metadata, export fn using shape, integration buttons).
5. Add prominent button in homepage tools.
6. Update AGENTS.md + any DESIGN notes.
7. Verify build + full flow tests (create → dashboard list → edit metadata+add bulk ch+change pricing+reorder panels → save → check lists/premium → export JSON → paste reimport → delete).

This builds on the existing upload + creator bridge work without duplication of persistence or premium logic.

**Ready for implementation.** All changes client-side, context-driven, invariants 100% preserved.