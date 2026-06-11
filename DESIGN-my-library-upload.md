# DESIGN: Complete "My Library + Upload" System (Short Design Doc per AGENTS.md)

**Date**: 2026  
**Status**: Design produced first (as required for structural changes). Highest-priority implementation to follow while strictly preserving invariants.  
**Reference**: AGENTS.md (client-side only, ComicsContext sole source of truth, localStorage bridges for user-published + creator imports, premium/first-chapter-free logic, source handling, data: URLs in panels/covers, no new backend, update AGENTS + docs at end).

## Executive Summary & Goals
Build a cohesive "My Library + Upload" experience on top of existing features (/upload for creation, /creator for management, scattered "My" elements like myUnlockedComics, getLikedComics, history, bookmarks, continue, getMyUploadedComics, getRecommendedComics).

**Explicit Goals from query**:
- **Unified "My Comics" section**: Combine uploaded (getMyUploadedComics / source:'user' or pub- ids), unlocked (myUnlockedComics), favorites/liked (getLikedComics), plus in-progress (from getReadingHistory + getBookmarks + getContinueReading). Make it prominent, filterable, actionable (read, edit, delete).
- **Robust upload flow with preview reader**: Enhance /upload (and integration with /creator) so users can preview the comic in a reader-like view (vertical scroll, panels, zoom basics if possible) *before* publishing. Reuse existing reader patterns/SmartImage without duplicating full reader page.
- **Edit / Delete / Publish toggle for user-created comics**: Leverage/extend existing in /creator (updateUploadedComic, removePublishedComic, addChaptersToUploadedComic). Add "Publish toggle" (e.g. status or isPublished flag on user comics to control visibility in main discovery vs "My" only; or simple "Mark Complete" that affects sort/filters). Full CRUD for user uploads (title, chapters, panels via uploadUtils, pricing, metadata).
- **Better localStorage strategy**: Current pain: data: URLs for panels/covers bloat LS (5-10MB typical quota). Propose (and lightly implement highest-priority) hybrid: keep comic metadata + small assets in LS (PUBLISHED_KEY / CREATOR_PUBLISHED_KEY); move large panel arrays to IndexedDB (with IDB keys or blob references in comic objects). Provide migration util + resolver (e.g. resolvePanel(panelRef) => data: or objectURL). Consider for new uploads first; backward compat for existing data: . Avoid full migration in v1 to minimize risk.

**Non-goals for this doc/iteration** (to stay scoped):
- Full replacement of all data: (would touch reader, SmartImage, export, PWA cache, etc.).
- New backend or sync.
- Overhauling all existing "My" features (build on them).

**Success Criteria**:
- One discoverable "My Library" surface (e.g. /my or enhanced home tab/section) showing unified view with actions.
- Upload flow feels "robust" (draft auto-save from prior work + live preview reader).
- User comics fully manageable (edit panels/pricing/metadata, delete, "publish" visibility toggle).
- Storage note + optional helper in place; no breakage to current comics.
- All existing invariants 100% preserved (see below).

## Current State Snapshot (from exploration)
- **ComicsContext** (single source): 
  - myUnlockedComics (premium flow), getLikedComics, getReadingHistory, getBookmarks, getContinueReading, getRecommendedComics (uses unlocked + history + bookmarks + genre overlap), getMyUploadedComics (user source/pub-), getFilteredComics (sourceFilter supports 'user' indirectly via 'official'), publishComic, updateUploadedComic, addChaptersToUploadedComic, saveUploadDraft etc (from advanced upload prior work), removePublishedComic.
  - Persistence: PUBLISHED_KEY for user (source 'user'/pub-), CREATOR_PUBLISHED_KEY for bridge. Many other LS keys (coins, unlocked, liked, history, bookmarks, drafts, cachedChapters...).
- **Homepage (app/page.tsx)**: Continue banner, For You recs, Trending/Latest carousels, "My Unlocked Comics" section (filteredMyUnlocked), source/genre/status filters, "Creator Bridge Tools" (import + /upload link + /creator dashboard button), streak/achievements/liked counts. ComicCard supports onDelete for user/creator/pub-.
- **Upload (/upload/page.tsx)**: Robust form (dnd, progress, validation, WebP/resize opt from advanced, gallery/banner, drafts auto-save, thumbnails, keyboard/a11y). Publishes via publishComic (user source).
- **Creator Dashboard (/creator/page.tsx)**: List of my uploads, edit modal (metadata, chapters, bulk panels, gallery/banner), export JSON (CreatorPublishedComic shape for bridge compat), delete.
- **Reader/Detail**: Full support for any comic (premium gating via isPremium + unlocks, SmartImage for data:/https, progress, etc.).
- **Types**: Comic (source, chapters with isPremium/coinPrice/panels, optional coverGallery/banner/thumbnail from prior), Publish* inputs.
- **Invariants (non-negotiable, per AGENTS.md + history)**:
  - ComicsContext + useComics() is *only* global state. All "My" selectors, publish/update must live here.
  - Client-side + localStorage (or IndexedDB as client extension) only. No backend.
  - User-created (source 'user' or pub- id) live in PUBLISHED_KEY via persistPublished (non-creator). Creator imports separate in CREATOR_PUBLISHED_KEY + normalize (read-only bridge).
  - Premium logic: First chapter always free (!isPremium), others gated by isChapterUnlocked + coin costs (custom coinPrice/unlockAllPrice supported). isUnlocked = isChapterUnlocked(...) || !isPremium. Optimistic UI, localStorage for coins/unlocked.
  - Data model: panels/covers as data: or https strings (SmartImage handles both + skeletons). First-chapter-free, source badges (creator emerald + analytics; user "Your upload"), delete only for own (pub- or creator).
  - No breaking existing data (old comics without new fields must work). getFilteredComics, recs, history etc must continue to surface user + creator comics correctly.
  - Update AGENTS.md, produce design first for structural, use todos, build clean, manual test + invariants checklist.

## Architecture Decisions
1. **Unified "My Comics" Section**:
   - **Location**: Highest priority = enhance existing homepage (add or expand a "My Library" tabbed/filtered section below "For You" or in browse area) + optional lightweight /my route (for focus). Use existing selectors in context (no new state).
   - **Content**:
     - Tabs or pills: "All My" | "Uploaded" (getMyUploadedComics) | "Unlocked" (myUnlockedComics) | "Favorites" (getLikedComics) | "In Progress" (combine getContinueReading + getReadingHistory + isChapterBookmarked or bookmarks).
     - Reuse ComicCard grid (with onDelete where appropriate, source badges).
     - Filters/search scoped to "My" (reuse getFilteredComics then intersect with my lists).
     - Quick actions: Read, Edit (for uploaded), Remove from favorites/unlocked (if applicable), Share.
   - **Why not full new page first?** Keeps discovery unified; homepage already has the building blocks (continue, my unlocked, recs from my signals). Add "My Library" header + link to dedicated if needed later.

2. **Robust Upload Flow with Preview Reader**:
   - In /upload (and /creator edit): Add "Preview in Reader" button.
   - **Implementation**: Build a temp "preview comic" object from draft state (same as current buildPreviewComic). On click, either:
     - Modal with simplified vertical reader (reuse panels rendering, SmartImage, basic zoom/brightness from reader page logic — extract a <ComicPreviewReader comic={preview} /> component for reuse).
     - Or navigate to a temp /read/preview?slug=... but since no real route, prefer modal or inline section to avoid polluting routes.
   - Integrate with existing drafts (auto-save draft before preview).
   - "Publish" finalizes via publishComic (or update for edits) + redirects to detail or My Library.

3. **Edit / Delete / Publish Toggle for User-Created Comics**:
   - **Location**: Primarily /creator (already has list + edit modal using updateUploadedComic / removePublishedComic). Enhance it.
   - **Edit**: Already strong (metadata, chapters, bulk panels, gallery/banner from prior). Add "Publish Toggle": e.g. a switch for `isPublished: boolean` on user comics (stored in Comic, affects getFilteredComics visibility or sort boost in main lists vs "My" only; default true on publish). Or simpler: use `status` + a "Draft vs Published" pill.
   - **Delete**: Already present; ensure optimistic + context-driven.
   - **Publish Toggle**: On save in edit, or quick action in list ("Publish" / "Unpublish"). For "unpublish", keep in LS but filter out of main discovery (sourceFilter or custom flag). Update getFilteredComics? Or add a `visibleInDiscovery` derived.
   - Extend context lightly if needed (e.g. togglePublished(id) helper that calls updateUploadedComic).
   - Creator imports: View-only or separate (don't allow edit/publish toggle here to protect bridge).

4. **Better localStorage Strategy (IndexedDB consideration)**:
   - **Problem**: Panels/covers as inline data: URLs in LS comics objects → quota hits quickly for image-heavy webtoons (dozens of panels per ch).
   - **Proposal (design)**:
     - **Hybrid approach** (recommended, non-breaking):
       - Metadata (title, author, genres, status, tags, unlockAllPrice, chapter titles/numbers/isPremium/coinPrice, views, publishedAt, source, id/slug) stays in LS (current PUBLISHED_KEY structure).
       - Large binary (panels[], coverUrl, coverGallery[], bannerUrl) moved to IndexedDB.
       - In Comic object: store references e.g. `panels: ['idb:comic-slug-ch1-p0', ...]` or keep data: for small, reference for large. Add resolver util: `async resolveAsset(refOrData: string): Promise<string>` (if starts with 'idb:' fetch from IDB and createObjectURL or base64; else return as-is for backward data: /https).
     - **Implementation priority**:
       - Highest: Design + light util in lib (e.g. `app/lib/storage.ts` with IDB wrapper for images + resolve + migrate helper). Update uploadUtils to optionally store to IDB.
       - Medium: Wire into context publish/update (store images to IDB, put refs in comic). Update SmartImage/reader to use resolver (async? careful with current sync expectations).
       - Low (v1): Full migration of existing data (one-time on load for user comics). Keep old data: working in parallel.
     - **Why not pure IndexedDB for everything?** LS is simpler for small metadata, works offline immediately, current code (persistPublished, load effects, JSON.stringify in context) assumes it. Hybrid minimizes changes.
     - **Quota**: IDB has much higher limits (50MB+ per origin typically, user permission for more). Use structured clone for blobs if possible (better than data: bloat).
     - **Other notes**: Keep drafts/history in LS (small). PWA cache (sw.js) can still work with resolved URLs. Export JSON can inline or reference.
   - **Risk to invariants**: Any change must not break existing comics on reload (resolver must handle legacy data: transparently). Context remains source (just storage layer abstracted). Test roundtrips with creator import/export.
   - **Alternative if too risky**: Just improve compression (already in utils) + user warnings + cap enforcement. Defer IDB.

5. **Other Cross-Cutting**:
   - **Preview Reader**: Extract reusable <PreviewReader comic={Comic} mode="vertical" /> from reader logic (virtual panels, SmartImage, basic controls). Use in upload/creator for drafts + published user comics.
   - **Context extensions** (minimal): If needed, helpers like `getUnifiedMyComics()` (merges uploaded + unlocked + liked with dedupe), `toggleUserComicPublished(id)`, `resolveComicAssets(comic)` for storage layer. Keep getMy* etc.
   - **UI/Style**: Reuse glass, ComicCard, framer, tokens. Mobile-first. "My Library" as section with tabs or segmented control.
   - **Persistence keys** (update AGENTS): Existing + possibly new for IDB (but IDB not key-value LS). Drafts/history already added in prior.
   - **Invariants enforcement**: Every change reviewed against list in AGENTS (context only, first-free wins in publish/edit, source 'creator' protected, etc.). No payable removal.

## Priority Order for Implementation (after this doc)
1. **Unified "My Comics" section** (highest impact, low risk): Enhance homepage with "My Library" subsection or tabs using existing context selectors + ComicCard. Add simple /my page if time.
2. **Robust upload with preview reader**: Add "Preview" button + modal/inline reader in /upload (and /creator edit). Extract minimal PreviewReader component. Wire with current draft state.
3. **Edit/Delete/Publish toggle polish**: In /creator, add quick "Publish/Unpublish" toggle (using updateUploadedComic + new flag or status). Ensure delete works for all user comics. Test visibility in main lists.
4. **Storage strategy foundation** (design + light code): Create storage util with IDB basics + resolveAsset. Update uploadUtils + one publish path optionally. Add note/warning in UI. Full migration later.
5. **Polish + invariants**: Update links (home creator tools, /upload <-> /creator), a11y, tests in AGENTS. Update design doc if needed.

**Out of scope for "highest priority"**: Complete IDB migration for all assets, new dedicated /library route with advanced filters, full reader extraction.

## Files Likely to Change
- DESIGN-my-library-upload.md (this).
- app/page.tsx (unified My Library section).
- app/upload/page.tsx + app/creator/page.tsx (preview reader integration, publish toggle UI).
- app/lib/ComicsContext.tsx (possible light helpers like getUnifiedMyComics, togglePublished; wire storage if implemented).
- app/lib/types.ts (if new flags like isPublished on Comic for user).
- app/components/ (new PreviewReader.tsx or inline; enhance ComicCard for library actions).
- app/lib/storage.ts (new, for IDB hybrid).
- app/lib/uploadUtils.ts (minor for storage hooks).
- AGENTS.md (new keys if any, context methods, patterns for library/upload, storage strategy, testing checklist).
- Possibly extract from reader for preview.

## Risks & Mitigations (to Invariants)
- **Breaking existing persistence/reader**: Hybrid storage + resolver must be transparent for data:/https. Mitigate: implement resolver as drop-in, test with current comics first. Don't change existing data on load.
- **Context bloat**: New "My" selectors must be pure derivations from existing state (no new top-level state unless persisted like prior drafts).
- **Premium/creator bridge**: User edit/publish toggle only for source 'user'. Creator comics protected (as in current remove/update). First chapter free enforced in any new publish/edit paths.
- **IndexedDB complexity**: IDB is async; current code is sync. Mitigate by making resolver async where used (SmartImage can handle Promise? or use useEffect + state). Start with proposal + util only.
- **Scope creep**: Stick to highest priority (UI unification + preview + toggle + storage design). Defer full IDB.
- **Data loss on storage change**: Always support legacy inline data: . Provide one-way migrate util (opt-in).
- **Performance (many images)**: Thumbnails + optimization (existing) help. IDB for blobs better than base64 bloat.

## Testing & Success (per AGENTS)
- Manual: Create/upload comic → see in unified My Library (uploaded tab) + main lists. Preview in upload flow (panels render like reader). Edit in /creator (change panels/pricing, toggle publish, see effect in lists). Delete. Load old comics (no breakage). Premium chapters still require unlock/coins after edit.
- Build clean (`npm run build`).
- Invariants checklist in AGENTS (context only, bridges, premium, source, first-free, client-only).
- Update AGENTS.md with new design ref, methods, storage notes, patterns (e.g. "use getUnifiedMyComics for library UIs", "preview via extracted reader component").

This positions the app with a complete, user-friendly library + upload experience while honoring the "pure local shell for creator content" promise.

**Next**: User review/approval of design (per history), then implement highest priorities via code changes + final AGENTS update + verify.

End of design doc. (Ready for implementation phase.)