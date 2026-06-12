"use client";

import React from 'react';
import { Upload } from 'lucide-react';

interface DropZoneProps {
  onFiles: (files: FileList | File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  sublabel?: string;
  className?: string;
  compact?: boolean;
}

export function DropZone({
  onFiles,
  accept = "image/jpeg,image/png,image/webp",
  multiple = true,
  disabled = false,
  label = "Drag & drop images or click to choose",
  sublabel = "JPG / PNG / WEBP • optimized (resize + WebP) before upload",
  className = "",
  compact = false,
}: DropZoneProps) {
  const [isOver, setIsOver] = React.useState(false);

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsOver(false);
    if (disabled) return;
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length) {
      onFiles(dt.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!disabled) setIsOver(true);
  };

  const handleDragLeave = () => setIsOver(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files && e.target.files.length) {
      onFiles(e.target.files);
      // reset input so same file can be re-selected
      e.target.value = '';
    }
  };

  return (
    <label
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      className={[
        "group flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-all",
        isOver ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40 bg-[var(--accent)]/5" : "border-[var(--border)] hover:border-[var(--accent)]/60",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        compact ? "py-6" : "py-10",
        className,
      ].join(" ")}
    >
      <Upload className="mb-3 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition" size={compact ? 18 : 24} />
      <div className="text-sm text-center">{label}</div>
      {sublabel && (
        <div className="text-[10px] text-[var(--text-muted)] mt-1 text-center">{sublabel}</div>
      )}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </label>
  );
}

export default DropZone;
