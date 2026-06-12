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

-- Done. Paste the whole file (or the relevant sections) into Supabase SQL Editor and click Run.
-- Then test the /upload Public flow.