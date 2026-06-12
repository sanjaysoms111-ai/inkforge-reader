"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

interface PublishPublicInput {
  slug: string;
  title: string;
  author: string;
  description?: string;
  coverUrl: string;
  genres?: string[];
  tags?: string[];
  status?: "ongoing" | "completed";
  unlockAllPrice?: number;
  isPublic?: boolean; // whether to set is_public=true in DB (defaults to true for this action)
  chapters: Array<{
    number: number;
    title: string;
    isPremium: boolean;
    coinPrice?: number;
    panels: string[]; // must already be https Storage URLs
    thumbnail?: string; // optional https or can be regenerated
  }>;
}

/**
 * Server action: securely insert a public comic + chapters after the client
 * has already uploaded the media to Storage (for reliable real-time progress).
 *
 * Uses the authenticated server client (cookies) so RLS enforces owner_id = auth.uid().
 * Returns the inserted comic row (or throws).
 */
export async function publishPublicComic(input: PublishPublicInput) {
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
    throw new Error("Not authenticated");
  }

  // Determine is_public from input (default true because this action is intended for public publishes)
  const shouldBePublic = input.isPublic !== false; // treat undefined or true as public
  console.log('[publishPublicComic] called. input.isPublic=', input.isPublic, 'resolved shouldBePublic=', shouldBePublic, 'userId=', userId, 'slug=', input.slug);

  // Insert comic. Use the resolved flag so callers can control it.
  const insertPayload = {
    owner_id: userId,
    slug: input.slug,
    title: input.title,
    author: input.author,
    description: input.description || "",
    cover_url: input.coverUrl,
    genres: input.genres || [],
    tags: input.tags || [],
    status: input.status || "ongoing",
    is_public: shouldBePublic,
    unlock_all_price: input.unlockAllPrice || null,
    source: "user",
  };
  console.log('[publishPublicComic] about to INSERT into comics with payload.is_public=', insertPayload.is_public, 'full payload keys:', Object.keys(insertPayload));

  const { data: comic, error: comicErr } = await supabase
    .from("comics")
    .insert(insertPayload)
    .select()
    .single();

  if (comic) {
    console.log('[publishPublicComic] INSERT succeeded. Returned row is_public=', (comic as any).is_public, 'id=', (comic as any).id);
  }

  if (comicErr || !comic) {
    console.error('[publishPublicComic] INSERT failed. comicErr=', comicErr);
    const msg = comicErr?.message || "Failed to create public comic";
    if (msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("violates")) {
      throw new Error(
        "RLS policy blocked the insert. Make sure you ran the policies from SUPABASE_RLS_POLICIES.sql " +
        "(comics_insert_own policy is required). Also ensure you are logged in."
      );
    }
    throw new Error(msg);
  }

  // Insert chapters (panels are already public https from prior Storage step)
  const chapterRows = input.chapters.map((ch) => ({
    comic_id: comic.id,
    number: ch.number,
    title: ch.title,
    is_premium: ch.isPremium,
    coin_price: ch.coinPrice ?? 10,
    panels: ch.panels,
    thumbnail_url: ch.thumbnail || null,
  }));

  const { error: chErr } = await supabase.from("chapters").insert(chapterRows);
  if (chErr) {
    // Best-effort rollback of orphan comic row
    await supabase.from("comics").delete().eq("id", comic.id);
    throw new Error(chErr.message || "Failed to insert chapters");
  }

  // Revalidate relevant paths so library / home pick up the new public row quickly
  revalidatePath("/library");
  revalidatePath("/");
  revalidatePath(`/comics/${input.slug}`);

  return comic;
}
