"use client";

import Image from "next/image";
import { useState } from "react";

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  loading?: "lazy" | "eager";
  onLoad?: () => void;
}

/**
 * Smart image that uses next/image for remote https URLs (with optimization, lazy, etc.)
 * Falls back to native <img> for data: URLs, blobs, and SVGs (common for demo panels/covers).
 * Includes basic skeleton while loading.
 */
export function SmartImage({
  src,
  alt,
  className = "",
  width,
  height,
  priority = false,
  loading = "lazy",
  onLoad,
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isRemote = src.startsWith("http://") || src.startsWith("https://");
  const isData = src.startsWith("data:");

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    console.error('[SmartImage] Failed to load src:', src?.substring(0, 120));
  };

  if (isRemote) {
    console.log('[SmartImage] rendering remote (Supabase https expected):', src?.substring(0, 100));
  }

  if (isRemote && !isData && !hasError) {
    // Use Next Image for optimization (blur placeholder possible in future)
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image
          src={src}
          alt={alt}
          width={width || 640}
          height={height || 920}
          className={`object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          priority={priority}
          loading={loading}
          onLoad={handleLoad}
          onError={handleError}
          unoptimized={false} // allow optimization + caching
        />
        {!loaded && !hasError && (
          <div className="absolute inset-0 bg-[var(--bg-elev)] animate-pulse" />
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 text-xs text-red-400">
            Failed to load image
          </div>
        )}
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`relative overflow-hidden flex items-center justify-center bg-red-900/20 text-xs text-red-400 ${className}`}>
        Failed to load image
      </div>
    );
  }

  // Fallback for data: URLs and everything else (preserves exact pixel panels from Creator exports)
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        className={`block w-full h-auto transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
      />
      {!loaded && !hasError && (
        <div className="absolute inset-0 bg-[var(--bg-elev)] animate-pulse" />
      )}
    </div>
  );
}
