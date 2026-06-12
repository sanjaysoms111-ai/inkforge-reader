-- ============================================================================
-- SUPABASE RLS POLICIES FIX for Inkforge Reader
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)
--
-- This fixes the error:
--   "new row violates row-level security policy for table 'comics'"
--
-- Requirements implemented:
-- 1. Authenticated users can INSERT their own comics (owner_id = auth.uid())
-- 2. Authenticated users can UPDATE and DELETE only their own comics
-- 3. Anyone (authenticated or not for public discovery) can SELECT public comics (is_public = true).
--    Owners can SELECT all their own comics (public or private).
--
-- Also includes policies for the `chapters` table (required because we insert chapters
-- right after the comic in the server action and makeComicPublic flow).
--
-- IMPORTANT:
-- - Run this AFTER you have created the tables (the CREATE TABLE statements from DESIGN-supabase-auth.md).
-- - RLS must be enabled on the tables (the ALTER TABLE ... ENABLE ROW LEVEL SECURITY lines below do this).
-- - After running, test by logging in and publishing a comic as "Public" from /upload or /creator.
-- - If you still get RLS errors after this, check:
--     a) You are actually logged in (the server action calls auth.getUser() from cookies).
--     b) The project URL + anon key in .env.local are correct.
--     c) You are targeting the correct project in the Supabase dashboard.
-- ============================================================================

-- 1. Enable RLS on the relevant tables (safe to run multiple times)
ALTER TABLE public.comics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- (Optional but recommended) Also enable on supporting tables if you haven't already
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.unlocks ENABLE ROW LEVEL SECURITY;
-- etc.

-- ============================================================================
-- COMICS TABLE POLICIES
-- ============================================================================

-- Drop existing policies with these names so re-running is safe
DROP POLICY IF EXISTS "comics_select_public_or_owner" ON public.comics;
DROP POLICY IF EXISTS "comics_insert_own" ON public.comics;
DROP POLICY IF EXISTS "comics_update_own" ON public.comics;
DROP POLICY IF EXISTS "comics_delete_own" ON public.comics;

-- SELECT: Public comics are visible to everyone.
--         Owners can also see their private (is_public=false) comics.
CREATE POLICY "comics_select_public_or_owner"
ON public.comics
FOR SELECT
USING (
  (is_public = true)
  OR (owner_id = auth.uid())
);

-- INSERT: A user can only insert a row if they set owner_id to their own uid.
--         We explicitly pass owner_id from the server action / client code.
CREATE POLICY "comics_insert_own"
ON public.comics
FOR INSERT
WITH CHECK (owner_id = auth.uid());

-- UPDATE: Only the owner can update their rows.
--         WITH CHECK ensures they can't change owner_id to someone else's.
CREATE POLICY "comics_update_own"
ON public.comics
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- DELETE: Only the owner can delete their rows.
CREATE POLICY "comics_delete_own"
ON public.comics
FOR DELETE
USING (owner_id = auth.uid());

-- ============================================================================
-- CHAPTERS TABLE RLS POLICIES (FIX FOR "public comics but chapters not visible to others")
-- ============================================================================
-- This section was added/updated to fix the issue where public comics were visible
-- but their chapters (panels) were not returned to other logged-in users.
--
-- Requirements:
-- - Anyone (any authenticated user) can SELECT chapters where the *parent comic* has is_public = true.
-- - Owner can fully manage (SELECT/INSERT/UPDATE/DELETE) chapters for comics they own
--   (this covers both their public and private comics).
--
-- The comics table must have its own public/owner SELECT policy in place first.
--
-- These are safe to re-run (DROP IF EXISTS).
-- Run this whole file (or at least the chapters section + ALTERs) in Supabase SQL Editor.
-- ============================================================================

-- Ensure RLS is on
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- Drop previous versions for clean re-apply
DROP POLICY IF EXISTS "chapters_select_via_parent_comic" ON public.chapters;
DROP POLICY IF EXISTS "chapters_select_public" ON public.chapters;
DROP POLICY IF EXISTS "chapters_owner_all" ON public.chapters;
DROP POLICY IF EXISTS "chapters_insert_via_parent_owner" ON public.chapters;
DROP POLICY IF EXISTS "chapters_update_via_parent_owner" ON public.chapters;
DROP POLICY IF EXISTS "chapters_delete_via_parent_owner" ON public.chapters;

-- 1. Anyone can read chapters belonging to a *public* comic.
--    This is the key policy for "other users" seeing chapters of public comics.
CREATE POLICY "chapters_select_public"
ON public.chapters
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.comics c
    WHERE c.id = chapters.comic_id
      AND c.is_public = true
  )
);

-- 2. Owners can do everything (manage) on chapters of comics they own.
--    This allows owners to see/edit chapters even for their private (is_public=false) comics,
--    and also covers their public ones.
CREATE POLICY "chapters_owner_all"
ON public.chapters
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.comics c
    WHERE c.id = chapters.comic_id
      AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.comics c
    WHERE c.id = chapters.comic_id
      AND c.owner_id = auth.uid()
  )
);

-- (The old granular insert/update/delete policies are superseded by the "owner_all" FOR ALL policy above.
--  They are dropped for cleanliness. If you prefer granular, you can keep separate policies for INSERT/UPDATE/DELETE
--  using the same EXISTS owner check.)

-- ============================================================================
-- (Recommended) Minimal profiles policy if not already present
-- ============================================================================
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
-- DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
--
-- CREATE POLICY "profiles_select_own" ON public.profiles
--   FOR SELECT USING (id = auth.uid());
--
-- CREATE POLICY "profiles_update_own" ON public.profiles
--   FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============================================================================
-- VERIFICATION QUERIES (run these after applying the policies)
-- ============================================================================
-- 1. List current policies on comics
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('comics', 'chapters')
-- ORDER BY tablename, policyname;

-- 2. Quick test (after you are logged in via the app):
--    - The app should now be able to INSERT a row with owner_id = your uid when publishing Public.

COMMENT ON TABLE public.comics IS 'RLS policies fixed for owner-based insert/update/delete + public read. See SUPABASE_RLS_POLICIES.sql';
COMMENT ON TABLE public.chapters IS 'RLS policies fixed (parent comic ownership). See SUPABASE_RLS_POLICIES.sql';

-- ============================================================================
-- CHAPTER VIEWS + ACCURATE VIEW COUNTING (added for "accurate View Counting" feature)
-- ============================================================================
-- Requirements:
-- - A view is only counted when a logged-in user opens a chapter AND scrolls to the bottom (last panel visible).
-- - Count exactly once per (user, comic_slug, chapter_number) using unique constraint.
-- - Works for both public comics (any logged-in reader) and private comics (owner or direct link).
-- - Uses server action (record-chapter-view) + RLS.
-- - Cached total kept in existing comics.views column (already present in schema + normalize + UI display).
--   (Optional: you may also ALTER ADD total_views if you prefer a dedicated name; code uses `views` for compat.)
--
-- Run this section (and the table/policies) in Supabase SQL Editor after the main comics/chapters RLS.
-- Re-run is safe (DROP IF EXISTS + IF NOT EXISTS).
-- ============================================================================

-- 1. Create the tracking table (unique per user+slug+chapter_number prevents double counting)
CREATE TABLE IF NOT EXISTS public.chapter_views (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comic_slug text NOT NULL,
  chapter_number integer NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comic_slug, chapter_number)
);

-- Enable RLS (safe if already on)
ALTER TABLE public.chapter_views ENABLE ROW LEVEL SECURITY;

-- Drop prior versions for re-apply safety
DROP POLICY IF EXISTS "chapter_views_insert_own" ON public.chapter_views;
DROP POLICY IF EXISTS "chapter_views_select_own" ON public.chapter_views;

-- INSERT: any authenticated user can record their own view (RLS + PK enforces once-per-user-per-chapter).
-- This allows public comic readers + owners of private comics (via direct link) to contribute accurately.
CREATE POLICY "chapter_views_insert_own"
ON public.chapter_views
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- SELECT: users can see their own view records (useful for future "read history" or per-chapter stats).
-- Comic owners can be given broader visibility later via a separate policy or view if needed.
CREATE POLICY "chapter_views_select_own"
ON public.chapter_views
FOR SELECT
USING (user_id = auth.uid());

-- 2. SECURITY DEFINER helper to safely increment the cached counter (comics.views)
--    Called from the server action after a successful new chapter_view row.
--    This bypasses the strict "only owner can UPDATE comics" policy just for the counter.
--    The function only does +1 on the views column for the matching slug; no other mutations possible.
CREATE OR REPLACE FUNCTION public.increment_comic_views(p_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.comics
  SET views = views + 1
  WHERE slug = p_slug;
$$;

-- Grant execute to authenticated users (so the server action running as the user can call it)
GRANT EXECUTE ON FUNCTION public.increment_comic_views(text) TO authenticated;

-- (Optional) If you prefer a dedicated column name, uncomment and the action can be updated to use it:
-- ALTER TABLE public.comics ADD COLUMN IF NOT EXISTS total_views bigint NOT NULL DEFAULT 0;
-- Then adjust increment function + normalize to also mirror into total_views or prefer it.

COMMENT ON TABLE public.chapter_views IS 'Accurate once-per-user-per-chapter view tracking. Used with comics.views cached total. RLS + server action enforce rules.';
COMMENT ON FUNCTION public.increment_comic_views(text) IS 'SECURITY DEFINER counter bump for comics.views (called only after chapter_views unique insert succeeds).';

-- Verification after apply:
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'chapter_views';
-- \df public.increment_comic_views

-- Done with views section. Re-apply whole file or just this block when adding view counting.

-- ============================================================================
-- ADVANCED COMMENTS (threaded replies + likes + multi-emoji reactions via JSONB)
-- ============================================================================
-- Extends the existing comments table (from DESIGN-supabase-auth.md).
-- - reactions jsonb stores { "❤️": N, "😂": M, ... }
-- - likes remains the dedicated like/heart counter (or can be treated as special reaction)
-- - Top sort (in UI) weights total (likes + sum of all reaction counts) so emoji-rich comments rise.
-- - RLS: public read for comments on is_public comics (via slug), authenticated insert own, delete by owner or comic owner.
-- - Counter mutations via SECURITY DEFINER functions (so RLS on table can stay strict for content; anyone authenticated can engage on public comments).
-- - Works only for public (Supabase) comics; private comics keep comments in client localStorage via existing ComicsContext.
--
-- Run after the main table create + previous RLS blocks. Safe to re-run.
-- ============================================================================

-- 1. Extend table with reactions JSONB (additive, default empty object)
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Optional helpful index (for future queries; not required for current client-side sort)
CREATE INDEX IF NOT EXISTS idx_comments_slug_ch_created ON public.comments (slug, chapter_number, created_at);

-- 2. RLS for comments (drop first for re-apply safety)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_public_or_owner" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
DROP POLICY IF EXISTS "comments_delete_own_or_comic_owner" ON public.comments;
DROP POLICY IF EXISTS "comments_update_own" ON public.comments;

-- SELECT: anyone can read comments belonging to a public comic (or the comic owner can see comments on their private too).
-- Uses slug denorm to join to comics.is_public (no need to change schema to comic_id for comments).
CREATE POLICY "comments_select_public_or_owner"
ON public.comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.comics c
    WHERE c.slug = comments.slug
      AND (c.is_public = true OR c.owner_id = auth.uid())
  )
);

-- INSERT: only authenticated users, and they must set user_id to themselves. author_display etc supplied by client/server action.
CREATE POLICY "comments_insert_own"
ON public.comments
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- DELETE: comment author OR the owner of the parent comic (via slug) can delete (moderation / own cleanup).
CREATE POLICY "comments_delete_own_or_comic_owner"
ON public.comments
FOR DELETE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.comics c
    WHERE c.slug = comments.slug
      AND c.owner_id = auth.uid()
  )
);

-- Note: We do NOT allow arbitrary UPDATE on the row via RLS for content safety.
-- Likes and reactions are ONLY mutated via the definer functions below (called from trusted server actions).

-- 3. SECURITY DEFINER functions for safe public engagement counters
-- These allow any authenticated reader to +1 like or a specific emoji reaction on a comment
-- without being able to edit text or other fields. RLS on table can stay owner-strict for content.

CREATE OR REPLACE FUNCTION public.increment_comment_likes(p_comment_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.comments SET likes = likes + 1 WHERE id = p_comment_id;
$$;

CREATE OR REPLACE FUNCTION public.add_comment_reaction(p_comment_id uuid, p_emoji text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.comments
  SET reactions = jsonb_set(
    COALESCE(reactions, '{}'::jsonb),
    ARRAY[p_emoji],
    (COALESCE( (reactions ->> p_emoji)::int , 0 ) + 1 )::text::jsonb,
    true
  )
  WHERE id = p_comment_id;
$$;

-- Allow authenticated callers (server actions run with the user's JWT) to execute the engagement bumps.
GRANT EXECUTE ON FUNCTION public.increment_comment_likes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_comment_reaction(uuid, text) TO authenticated;

COMMENT ON TABLE public.comments IS 'Threaded comments for public comics (private stay local). reactions jsonb + likes for engagement. See advanced comments section in SUPABASE_RLS_POLICIES.sql';
COMMENT ON FUNCTION public.increment_comment_likes(uuid) IS 'SECURITY DEFINER: safely +1 likes counter (called from server action after RLS/auth).';
COMMENT ON FUNCTION public.add_comment_reaction(uuid, text) IS 'SECURITY DEFINER: safely +1 a specific emoji in the reactions jsonb (no text mutation possible).';

-- Verification
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'comments';
-- \df public.increment_comment_likes
-- \df public.add_comment_reaction

-- End of advanced comments RLS block. Re-run as needed when updating comment features.
-- Then test the /upload Public flow.