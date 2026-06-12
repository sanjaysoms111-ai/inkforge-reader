# DESIGN-supabase-auth.md — Supabase Auth + Shared Comics Library

**Date**: 2026 (per request)
**Status**: Design first (concise). Auth foundation complete. Public comics + Storage upload + hybrid context + library + gating + Advanced Upload implemented (2026). RLS policies for comics/chapters provided + verified in SUPABASE_RLS_POLICIES.sql (fixes the common INSERT "violates row-level security" error). Pre-existing Next /login prerender suspense warning (unrelated). Per AGENTS.md.

## High-Level Goals (verbatim from request)
- User signup, login, logout (email/password + social login).
- Replace localStorage with Supabase for: user profile, coins, unlocked chapters, reading progress, favorites, comments.
- Add "My Library" page (personal comics + unlocked).
- Public comics discovery: published comics visible to all logged-in users.
- Keep first-chapter-free rule, premium coin system (now with shared public comics).
- Uploaded comics can be marked public/private.
- Clean separation: new UserContext + Supabase clients (ComicsContext remains for catalog merge).
- Use server components/actions where possible for security.

Current baseline (post "remove all monetizing"): MOCK_COMICS=[], all chapters freely readable, isPremium only for "PREMIUM" display badge, heavy client localStorage for published (data:), comments, progress, likes, history, drafts, creator bridge. Upload/creator flows intact, PWA intact.

## 1. Supabase Schema (tables + relationships)

Use Supabase Auth (email + OAuth providers). Create project at supabase.com, get URL + anon key.

Run this SQL in Supabase SQL Editor (one-time). Also create Storage bucket.

**Step 1**: Run the table creation SQL below.
**Step 2**: Run the RLS policies from `SUPABASE_RLS_POLICIES.sql` (or the policy block shown further down in the "RLS Policies" section). This step is required to fix "new row violates row-level security policy for table 'comics'" during public publish.

```sql
-- 1. Profiles (1:1 with auth.users). Auto-create via trigger or app code on first login.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  coin_balance integer not null default 50, -- starter coins for demo
  created_at timestamptz not null default now()
);

-- 2. Comics (user uploads; is_public controls shared discovery)
create table if not exists public.comics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null,
  author text not null,
  description text,
  cover_url text, -- https from Storage or fallback
  genres text[] default '{}',
  tags text[] default '{}',
  status text default 'ongoing',
  is_public boolean not null default false,
  published_at timestamptz not null default now(),
  views integer not null default 0,
  unlock_all_price integer,
  source text default 'user'
);

-- 3. Chapters (normalized; panels are Storage public URLs)
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  comic_id uuid not null references public.comics(id) on delete cascade,
  number integer not null,
  title text not null,
  is_premium boolean not null default true,
  coin_price integer not null default 10,
  thumbnail_url text,
  panels text[] not null default '{}', -- array of https URLs (Storage)
  unique (comic_id, number)
);

-- 4. Unlocks (server truth for premium access)
create table if not exists public.unlocks (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, chapter_id)
);

-- 5. Reading progress (per-user, per-chapter last panel)
create table if not exists public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null, -- denormalized for fast lookup (or comic_id)
  chapter_number integer not null,
  panel_index integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, slug, chapter_number)
);

-- 6. Favorites / likes
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null, -- or comic_id
  created_at timestamptz not null default now(),
  primary key (user_id, slug)
);

-- 7. Comments (shared on public comics; nested via parent_id)
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  slug text not null,
  chapter_number integer not null,
  text text not null,
  parent_id uuid references public.comments(id) on delete cascade,
  likes integer not null default 0,
  author_display text, -- denorm for display
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists idx_comics_public on public.comics(is_public, published_at desc) where is_public = true;
create index if not exists idx_chapters_comic on public.chapters(comic_id, number);
create index if not exists idx_unlocks_user on public.unlocks(user_id);
create index if not exists idx_progress_user_slug on public.reading_progress(user_id, slug);
```

**Storage**:
- Create bucket `comics` (Public bucket recommended for discovery images).
- Policies (Dashboard or SQL): Authenticated users can upload to `auth.uid()/*` prefix; anyone can read objects in public bucket. (Private comics stay in client data: and never uploaded.)

**RLS Policies (comics + chapters) — CRITICAL FOR PUBLIC PUBLISH**:
The original design only described the intended policies in prose. In practice you must create the actual `CREATE POLICY` statements (RLS is deny-by-default once enabled).

A complete, copy-pasteable set of policies is provided in the project at:
`SUPABASE_RLS_POLICIES.sql`

Key policies for `comics` (run after your CREATE TABLE statements and `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`):

```sql
-- SELECT: public comics visible to all; owners see their private ones too
CREATE POLICY "comics_select_public_or_owner"
ON public.comics FOR SELECT
USING (is_public = true OR owner_id = auth.uid());

-- INSERT: only rows where owner_id matches the authenticated user
CREATE POLICY "comics_insert_own"
ON public.comics FOR INSERT
WITH CHECK (owner_id = auth.uid());

-- UPDATE + DELETE: only own rows (WITH CHECK prevents changing owner)
CREATE POLICY "comics_update_own"
ON public.comics FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "comics_delete_own"
ON public.comics FOR DELETE
USING (owner_id = auth.uid());
```

You **also need equivalent policies on `chapters`** (the publish flow inserts chapters right after the comic row). See `SUPABASE_RLS_POLICIES.sql` for the full safe-to-re-run block (with DROP IF EXISTS + chapters policies using EXISTS subqueries on the parent comic).

After applying, the server action (`app/actions/publish-public.ts`) and `makeComicPublic` (browser client path) will succeed for authenticated users.

**Optional security definer function for atomic spend** (call via rpc from server action):
```sql
create or replace function public.spend_coins_and_unlock(p_user_id uuid, p_chapter_id uuid, p_cost int)
returns boolean language plpgsql security definer as $$
declare v_balance int;
begin
  select coin_balance into v_balance from public.profiles where id = p_user_id for update;
  if v_balance < p_cost then return false; end if;
  update public.profiles set coin_balance = coin_balance - p_cost where id = p_user_id;
  insert into public.unlocks (user_id, chapter_id) values (p_user_id, p_chapter_id) on conflict do nothing;
  return true;
end;
$$;
```

## 2. New Routes / Pages
- `/login` — Email + password form + "Continue with Google" (OAuth). Link to signup.
- `/signup` — Email/pass signup + confirm. Social buttons.
- `/library` — "My Library" (protected). Tabs: My Uploads (private+public), Unlocked (from unlocks table), Favorites, Continue Reading (progress). Also section "Public Library" (other users' is_public=true comics).
- Auth callback (for OAuth): `/auth/callback` (small route handler that exchanges code).
- Updates to existing:
  - `/` (home): If authed, prominently show public comics + personalized My Library summary. Continue using existing filters. "Creator Bridge Tools" remain (local).
  - `/upload` + `/creator`: Add "Visibility" toggle (Private / Public). Private = local LS only (data:). Public = upload images to Storage + insert comics+chapters rows (is_public=true). Keep local copy for offline.
  - `/comics/[slug]` + `/read/[slug]/[chapter]`: Support DB-sourced public comics (https panels). Re-add premium gating UI + Unlock button (only if !first && isPremium && !unlocked).
- Navbar: User avatar/menu (coins pill, Library link, Logout). Login button when anonymous.
- Optional future: `/profile` (edit name, coin tx history stub).

Keep `/coins/history` or repurpose as profile transactions (server-backed).

## 3. Migration Strategy from localStorage
- **Keep in LS (non-sensitive, client-only, offline-first)**:
  - `inkforg_apexpanel:readerSettings`, uploadDrafts, uploadHistory, cachedChapters (PWA), creator bridge key (`inkforg_apexpanel_published_comics`), private user published (data: images stay local).
  - Theme key.
- **Migrate on login (UserContext bootstrap)**:
  - Read local progress:* keys, likedComics, bookmarks, comments, history.
  - Upsert to profiles (displayName), reading_progress, favorites, comments (server).
  - Show toast "Local progress & favorites synced".
- **User-published comics (pub- / source 'user')**:
  - Stay private + local by default (preserves existing /upload /creator / PWA data: workflows).
  - In /creator list: per-comic "Publish publicly" button. On click: convert cover + panels (data: -> Blob via fetch), uploadFile to `comics/${user.id}/${comic.id}/...`, receive public URLs, build chapters rows, insert comic + chapters with is_public=true via server action or client (with RLS). Then optionally mark local as "synced" or keep for creator export.
- **Creator imports**: remain 100% local (bridge untouched). They can be "re-published" by owner as public.
- **ResetToDemo**: clears only LS keys; does not touch server rows for the logged-in user (add "Clear my cloud data" later behind confirm).
- First-run for new users: starter 50 coins in profile.
- Comments on local comics stay LS; on public DB comics use server comments table (merge view in UI if needed).

One-time migration is optimistic + best-effort (ignore duplicates via unique constraints).

## 4. Auth Middleware / Protection
- `middleware.ts` (root):
  - Use `@supabase/ssr` `createServerClient` + cookie handlers to refresh session on every request (standard Supabase Next pattern).
  - Protected paths: `/library`, `/creator`, `/upload`, `/profile` (and any future private). If no session, redirect to `/login?next=<path>`.
  - Public paths (home, /comics/*, /read/*, /login, /signup) allow anonymous (public comics visible).
  - Reader/detail: load public comic for anyone; gate "save progress / favorite / comment / unlock" behind login (show sign-in prompt in UI).
- Client: `useUser()` hook (from UserContext) guards buttons + shows modals.
- Server actions / RSC: always read user via `createServerClient` (cookies) — never trust client user id alone.

## 5. Security Considerations (RLS + Architecture)
- **RLS enabled on every table** (see schema). Policies:
  - `profiles`: `auth.uid() = id` for all ops.
  - `comics`: SELECT `(is_public OR owner_id = auth.uid())`; INSERT/UPDATE/DELETE `owner_id = auth.uid()`.
  - `chapters`: 
  - SELECT: Anyone can read chapters for comics where is_public=true (via EXISTS on parent).
  - Owner can manage (SELECT/INSERT/UPDATE/DELETE) their own chapters (covers private comics too) via owner check on parent.
  See SUPABASE_RLS_POLICIES.sql for the exact "chapters_select_public" + "chapters_owner_all" policies.
  - `unlocks/progress/favorites`: `user_id = auth.uid()`.
  - `comments`: SELECT if comic public (or owner); INSERT any authenticated; DELETE own comment or comic owner.
- **Never client-direct balance mutation**. Use `spend_coins_and_unlock` RPC (security definer) or server action that calls it. Server action for "mock buy coins" adds to balance (self only).
- Client uses only anon key + user JWT (via supabase client). Server uses anon key + cookies for user context.
- Image uploads for public: only owner can put to their path; public read via bucket policy.
- Data: URLs (private comics, creator imports) never leave device until explicit "make public".
- PWA offline: data: always works; https Storage URLs cached by existing SW (cache-first). Unlocks/progress require login to restore from server (graceful degrade to local when offline).
- First-chapter-free enforced in two places: (a) publish/edit forces ch1.isPremium=false, (b) `isUnlocked = (chapter.number === 1) || hasUnlockRow || !chapter.isPremium`.
- Coins start at 50 on signup. All unlocks cost coinPrice (default 10) or unlockAllPrice.
- No service_role key in browser or client env. Use only for one-off admin scripts.
- Validate slugs unique on insert (or use server action that retries with suffix).

## 6. Architecture & Separation (ComicsContext vs UserContext)
- **New**: `app/lib/supabase/{client.ts,server.ts,middleware.ts}` + `app/lib/UserContext.tsx` (or AuthContext).
  - UserContext: session, user, profile (coins, displayName), myUnlocks (Set of chapter keys or ids), favorites (Set of slugs), my progress map.
  - Methods: `signUp`, `signInWithPassword`, `signInWithOAuth`, `signOut`, `ensureProfile`, `getCoinBalance`, `unlockChapter(slug, chNum, cost)` (calls action), `isChapterUnlocked`, `toggleFavorite`, `saveProgress`, `fetchMyComments` etc.
  - Listens to `onAuthStateChange`, refreshes profile/unlocks on login.
- **Updated**: `ComicsContext` remains sole source for the *merged comic catalog*.
  - Still loads local published + creator bridge.
  - On mount + when user changes: if authed, query Supabase for (public comics + my comics) via browser client, normalize to internal Comic shape (https panels), merge (dedupe by slug or id).
  - publishComic gains `isPublic?: boolean`. If true + authed → storage upload helper + DB insert (chapters too) instead of (or +) pure LS persist.
  - Exposes some user methods via composition or context merge for convenience (or keep separate hooks).
- **Server actions** (`app/actions.ts` or `lib/actions.ts`): `unlockChapterAction`, `addCoinsAction`, `publishPublicComicAction`, `saveProgressAction`.
- **Types**: Extend `Comic` with optional `isPublic?: boolean`, `remoteId?: string`. `Chapter` already has coinPrice/isPremium. Add `PublishComicInput.isPublic`.
- Upload processing (canvas/WebP/dnd) unchanged. Only the final "persist" path branches on visibility.
- PWA / SmartImage / virtualization / reader QOL / creator bridge: 100% preserved. Public comics just use https panels (already supported).

## 7. Implementation Order (this request)
1. Auth setup (install, clients, middleware, UserContext, login/signup pages, Navbar integration).
2. Schema + basic profile/coins.
3. Re-enable premium gating + unlock flow (first-free rule).
4. Public comics fetch + merge into ComicsContext.
5. /library page + public discovery.
6. Public/private toggle + Storage upload path in upload/creator.
7. Comments/progress/favorites on server for authed users.
8. Polish, migration sync, build verification, AGENTS.md update.

## 8. Risks & Mitigations
- Large data: URLs on public publish → compress + sequential upload + progress; warn user.
- Offline + auth: reader works for cached/public https + local private; cloud sync on reconnect.
- Creator bridge: untouched (local only). Users can still export/import.
- Existing local published: private by default — explicit "publish public" action.
- Multiple origins for creator LS bridge still works.
- Build: add supabase packages; update next.config if needed for storage host (but ** already allows all https).

## 9. Env & Keys (update AGENTS + README)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
```
Never commit real keys. Document setup steps in AGENTS.

## 10. Invariants to Preserve (update AGENTS)
- ComicsContext single source for merged list (now hybrid local+server).
- Creator import/publish/preview/validate/export/ /creator dashboard /upload all continue to work (private by default).
- First chapter always free (force on publish + runtime check).
- isPremium only informational badge + now also gating for ch>1.
- PWA offline for previously viewed/downloaded (data: + cached https).
- No direct client balance writes; server actions/RPC for coins/unlocks.
- All existing localStorage keys for private data + reader prefs + bridge stay (new server replaces only profile/coins/unlocks/progress/favs/comments for authed flows).
- Slugs unique, delete only for owned (pub-/user/creator).
- SmartImage handles both data: and new https storage URLs.

This design keeps the app a "pure shell" for creator content while adding the requested shared authenticated library. Implementation will be incremental, starting with auth, with build checks after each major phase.

See AGENTS.md (will be updated at end) + existing DESIGN-*.md for style.
