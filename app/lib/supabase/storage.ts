import { getSupabaseBrowserClient } from "./client";

/**
 * Uploads images (from data: URLs) to Supabase Storage under the comics bucket.
 * Path structure: comics/{userId}/{comicSlug}/{fileName}
 * Returns a map of original identifiers (e.g. 'cover' or `ch${num}-p${idx}`) to public https URLs.
 * Processes sequentially to allow progress reporting.
 * Throws on auth or upload failure (caller should handle fallback to private).
 */
export async function uploadComicMediaToStorage(
  userId: string,
  comicSlug: string,
  files: Array<{
    key: string; // e.g. 'cover', 'ch1-p0', 'ch2-p3'
    dataUrl: string;
    contentType?: string;
  }>,
  onProgress?: (uploaded: number, total: number, currentKey?: string) => void
): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  const bucket = "comics";
  const prefix = `comics/${userId}/${comicSlug}`;

  const results: Record<string, string> = {};
  const total = files.length;
  let uploaded = 0;

  for (const file of files) {
    if (onProgress) onProgress(uploaded, total, file.key);

    // Convert data: URL to Blob (works for base64 images from our canvas processing)
    const res = await fetch(file.dataUrl);
    const blob = await res.blob();
    const contentType = file.contentType || blob.type || "image/webp";

    // Sanitize filename (keep extension if present, or default)
    const safeKey = file.key.replace(/[^a-zA-Z0-9_-]/g, "_");
    const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "webp";
    const path = `${prefix}/${safeKey}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType,
      upsert: true, // allow overwrite on re-publish/edit
    });

    if (error) {
      throw new Error(`Storage upload failed for ${file.key}: ${error.message}`);
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!urlData?.publicUrl) {
      throw new Error(`Failed to get public URL for ${file.key}`);
    }

    results[file.key] = urlData.publicUrl;
    uploaded += 1;
    if (onProgress) onProgress(uploaded, total, file.key);
  }

  if (onProgress) onProgress(total, total);
  return results;
}

/**
 * Helper to prepare the list of files from a comic draft (cover + chapters' panels).
 * Returns array ready for uploadComicMediaToStorage.
 */
export function prepareMediaForUpload(
  coverUrl: string,
  chapters: Array<{ number: number; panels: string[] }>
): Array<{ key: string; dataUrl: string }> {
  const files: Array<{ key: string; dataUrl: string }> = [];

  if (coverUrl && coverUrl.startsWith("data:")) {
    files.push({ key: "cover", dataUrl: coverUrl });
  }

  chapters.forEach((ch) => {
    ch.panels.forEach((panel, pIdx) => {
      if (panel && panel.startsWith("data:")) {
        files.push({
          key: `ch${ch.number}-p${pIdx}`,
          dataUrl: panel,
        });
      }
    });
  });

  return files;
}
