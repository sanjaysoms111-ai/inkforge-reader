/**
 * Shared client-side upload utilities for Creator flows (/upload and /creator dashboard).
 * - File → data: conversion
 * - Validation (types, size, max panels)
 * - Optional lightweight canvas compression for large images (to help localStorage)
 * - Progress-aware batch processing
 *
 * All pure browser APIs (FileReader, canvas, no deps). Used for both new comics and edits.
 * See DESIGN-creator-upload-dashboard.md and AGENTS.md.
 */

export const MAX_PANELS_PER_CHAPTER = 50;
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ProcessingProgress = {
  current: number;
  total: number;
  label: string;
};

// WebP support (tested once via canvas). Modern browsers support it; fallback to JPEG.
let webpSupported: boolean | null = null;
function supportsWebP(): boolean {
  if (webpSupported !== null) return webpSupported;
  if (typeof document === 'undefined') {
    webpSupported = true; // assume in non-DOM (tests) or server
    return webpSupported;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const dataUrl = canvas.toDataURL('image/webp');
    webpSupported = dataUrl.startsWith('data:image/webp');
  } catch {
    webpSupported = false;
  }
  return webpSupported;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Lightweight compression for files > ~1MB.
 * Scales down + re-encodes as JPEG q=0.85. Small files returned as-is.
 * Lossy but dramatically reduces storage for panels while remaining usable.
 */
export async function compressImageIfLarge(dataUrl: string, originalSize: number): Promise<string> {
  if (originalSize < 1024 * 1024) return dataUrl; // keep quality for small

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const MAX_DIM = 1400;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false })!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.85);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Validate + convert + advanced optimize (resize + WebP preferred) a single file.
 * Throws on unsupported type. Now uses the advanced optimizeImage for modern results.
 */
export async function processImageFile(file: File): Promise<string> {
  const typeOk = (VALID_IMAGE_TYPES as readonly string[]).includes(file.type);
  const extOk = /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!typeOk && !extOk) {
    throw new Error(`Unsupported file type for ${file.name}. Only JPG, PNG, WEBP allowed.`);
  }
  // Use advanced path (resize + WebP where supported) for all new processing
  return optimizeImage(file);
}

/**
 * Batch process files with progress callback.
 * Respects max panels (caller should slice first).
 * Returns the resulting data: URLs (compressed where applicable).
 */
export async function processImageFiles(
  files: File[],
  onProgress?: (current: number, total: number, label?: string) => void
): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const url = await processImageFile(files[i]);
    results.push(url);
    onProgress?.(i + 1, files.length, `Processing image ${i + 1}/${files.length}`);
  }
  return results;
}

/**
 * Helper to filter incoming files to valid images + enforce remaining room for a chapter.
 */
export function filterValidImageFiles(
  files: FileList | File[] | null,
  currentPanelCount: number
): { valid: File[]; skippedCount: number; wouldExceed: boolean } {
  if (!files) return { valid: [], skippedCount: 0, wouldExceed: false };
  const arr = Array.isArray(files) ? files : Array.from(files);
  const valid: File[] = [];
  let skipped = 0;

  for (const f of arr) {
    const typeOk = (VALID_IMAGE_TYPES as readonly string[]).includes(f.type);
    const extOk = /\.(jpe?g|png|webp)$/i.test(f.name);
    if (typeOk || extOk) {
      valid.push(f);
    } else {
      skipped++;
    }
  }

  const room = Math.max(0, MAX_PANELS_PER_CHAPTER - currentPanelCount);
  const wouldExceed = valid.length > room;
  const toUse = valid.slice(0, room);

  return {
    valid: toUse,
    skippedCount: skipped + (valid.length - toUse.length),
    wouldExceed,
  };
}

/**
 * Advanced client-side optimization (per advanced capabilities request).
 * - Resize to maxDim while preserving aspect (using canvas).
 * - Convert to WebP (if supported + smaller) or high-quality JPEG fallback.
 * Always produces a data: URL ready for panels/cover/gallery/banner storage.
 * This replaces/enhances the prior JPEG-only compress for better modern results.
 */
export async function optimizeImage(
  fileOrDataUrl: File | string,
  options: { maxDim?: number; quality?: number } = {}
): Promise<string> {
  const { maxDim = 1400, quality = 0.82 } = options;

  let dataUrl: string;
  let originalSize = 0;

  if (typeof fileOrDataUrl === 'string') {
    dataUrl = fileOrDataUrl;
  } else {
    originalSize = fileOrDataUrl.size;
    dataUrl = await fileToDataUrl(fileOrDataUrl);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: true })!;
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP for modern size/quality win when supported
      let optimized: string;
      if (supportsWebP()) {
        optimized = canvas.toDataURL('image/webp', quality);
        // If WebP somehow larger than original (rare), fallback
        if (originalSize > 0 && optimized.length > originalSize * 1.1) {
          optimized = canvas.toDataURL('image/jpeg', quality);
        }
      } else {
        optimized = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(optimized);
    };
    img.onerror = () => resolve(dataUrl); // graceful fallback
    img.src = dataUrl;
  });
}

/**
 * Generate a small thumbnail data URL from a panel (first panel of chapter recommended).
 * Used for visual lists/cards without loading full images.
 */
export async function generateThumbnail(
  panelDataUrl: string,
  maxWidth = 160
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = maxWidth / img.width;
      const w = maxWidth;
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: true })!;
      ctx.drawImage(img, 0, 0, w, h);
      // Small thumbnails use WebP or JPEG; quality high enough for preview
      const thumb = supportsWebP()
        ? canvas.toDataURL('image/webp', 0.75)
        : canvas.toDataURL('image/jpeg', 0.8);
      resolve(thumb);
    };
    img.onerror = () => resolve(panelDataUrl); // fallback to original (small risk)
    img.src = panelDataUrl;
  });
}
