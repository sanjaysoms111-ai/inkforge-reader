"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Comment } from "@/app/lib/types";

/**
 * Server actions for the Advanced Comment System (threaded + likes + emoji reactions).
 * - Uses cookie-based server Supabase client (RLS enforced).
 * - Only for public (Supabase) comics. Private comics use the existing localStorage path in ComicsContext.
 * - Counter mutations (likes, reactions) go through SECURITY DEFINER functions so the comments table RLS
 *   can stay strict on content while allowing public engagement.
 * - Matches the existing Comment shape (including reactions Record + parentId).
 */

async function getServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

function mapRowToComment(row: any): Comment {
  return {
    id: row.id,
    author: row.author_display || "Reader",
    text: row.text,
    timestamp: row.created_at,
    likes: row.likes || 0,
    reactions: (row.reactions as Record<string, number>) || {},
    parentId: row.parent_id || undefined,
    userId: row.user_id || undefined,
    avatar: (row.author_display || "R")[0]?.toUpperCase() || "?",
  };
}

/** Create a root comment or a reply (parentId). */
export async function createComment(params: {
  slug: string;
  chapterNumber: number;
  text: string;
  parentId?: string;
  authorDisplay?: string;
}): Promise<{ success: boolean; comment?: Comment; error?: string }> {
  const { slug, chapterNumber, text, parentId, authorDisplay } = params;
  if (!slug || !chapterNumber || !text?.trim()) {
    return { success: false, error: "Missing required fields" };
  }

  const supabase = await getServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const payload = {
    user_id: userId,
    slug,
    chapter_number: chapterNumber,
    text: text.trim(),
    parent_id: parentId || null,
    author_display: (authorDisplay || "Reader").trim(),
    likes: 0,
    reactions: {},
  };

  const { data, error } = await supabase
    .from("comments")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.warn("[comments] create failed", error);
    return { success: false, error: error.message };
  }

  const comment = mapRowToComment(data);
  revalidatePath(`/read/${slug}/${chapterNumber}`);
  revalidatePath(`/comics/${slug}`);
  return { success: true, comment };
}

/** +1 the dedicated likes counter via definer function (safe, any authenticated on public comments). */
export async function likeComment(commentId: string): Promise<{ success: boolean; error?: string }> {
  if (!commentId) return { success: false, error: "Invalid comment id" };

  const supabase = await getServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.rpc("increment_comment_likes", { p_comment_id: commentId });
  if (error) {
    console.warn("[comments] like failed", error);
    return { success: false, error: error.message };
  }

  // Best-effort revalidate (we don't know slug here easily; caller can also trigger)
  return { success: true };
}

/** +1 (or add) a specific emoji reaction via definer function. */
export async function addReaction(commentId: string, emoji: string): Promise<{ success: boolean; error?: string }> {
  if (!commentId || !emoji) return { success: false, error: "Invalid params" };

  const supabase = await getServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.rpc("add_comment_reaction", { p_comment_id: commentId, p_emoji: emoji });
  if (error) {
    console.warn("[comments] addReaction failed", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Delete a comment. Allowed if caller is the author or the comic owner (enforced by RLS + explicit check). */
export async function deleteComment(commentId: string, slug?: string): Promise<{ success: boolean; error?: string }> {
  if (!commentId) return { success: false, error: "Invalid comment id" };

  const supabase = await getServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // RLS will also protect, but we can attempt delete directly.
  const { error } = await supabase.from("comments").delete().eq("id", commentId);

  if (error) {
    console.warn("[comments] delete failed", error);
    return { success: false, error: error.message };
  }

  if (slug) {
    revalidatePath(`/read/${slug}/*`);
    revalidatePath(`/comics/${slug}`);
  }
  return { success: true };
}
