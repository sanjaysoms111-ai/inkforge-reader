"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Server action to accurately record a chapter view.
 * - Only callable by authenticated users (via cookie session).
 * - Inserts into chapter_views with (user_id, comic_slug, chapter_number) PK.
 *   Unique violation = already counted for this user+chapter -> no double count.
 * - On first (new) insert, safely increments the cached comics.views via SECURITY DEFINER function.
 * - Works for public comics (any logged-in reader) and private comics (owner reading their own via link).
 * - Called from the reader only after IntersectionObserver confirms the user scrolled to the last panel.
 */
export async function recordChapterView(slug: string, chapterNumber: number): Promise<{ success: boolean; alreadyRecorded?: boolean; error?: string }> {
  if (!slug || typeof chapterNumber !== 'number' || chapterNumber < 1) {
    return { success: false, error: 'Invalid slug or chapterNumber' };
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  console.log('[recordChapterView] attempt for user', userId, 'slug=', slug, 'ch=', chapterNumber);

  try {
    // INSERT will fail with unique violation (23505) if this (user, slug, ch) already exists.
    // We treat that as "already counted" and do NOT increment again.
    const { error: insertErr } = await supabase
      .from('chapter_views')
      .insert({
        user_id: userId,
        comic_slug: slug,
        chapter_number: chapterNumber,
      });

    if (insertErr) {
      const msg = insertErr.message || '';
      const isUnique = insertErr.code === '23505' || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique');
      if (isUnique) {
        console.log('[recordChapterView] already recorded this user+chapter (no increment)', slug, chapterNumber);
        return { success: true, alreadyRecorded: true };
      }
      console.warn('[recordChapterView] insert failed (non-unique)', insertErr);
      return { success: false, error: insertErr.message };
    }

    // New row inserted => this is a fresh unique view for this user+chapter.
    // Bump the cached total using the definer function (works regardless of comic ownership).
    const { error: rpcErr } = await supabase.rpc('increment_comic_views', { p_slug: slug });
    if (rpcErr) {
      console.warn('[recordChapterView] increment_comic_views rpc failed (cached total may lag until next load)', rpcErr);
    } else {
      console.log('[recordChapterView] SUCCESS: incremented cached views for', slug);
    }

    // Revalidate the pages that surface the count so SSR/next visits are fresh.
    revalidatePath(`/comics/${slug}`);
    revalidatePath(`/read/${slug}/${chapterNumber}`);

    return { success: true, alreadyRecorded: false };
  } catch (e: any) {
    console.error('[recordChapterView] unexpected error', e);
    return { success: false, error: e?.message || 'Failed to record view' };
  }
}
