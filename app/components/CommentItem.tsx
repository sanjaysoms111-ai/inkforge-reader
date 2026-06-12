"use client";

import { useState } from "react";
import { Heart, Trash2, Reply, Smile } from "lucide-react";
import { useComics } from "@/app/lib/ComicsContext";
import { useUser } from "@/app/lib/UserContext";
import type { Comment } from "@/app/lib/types";

interface CommentItemProps {
  comment: Comment;
  allComments: Comment[]; // flat list used to find children
  slug: string;
  chapterNumber: number;
  level?: number; // for indentation depth
}

const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "👏", "💯"];

function relativeTime(iso: string) {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export function CommentItem({ comment, allComments, slug, chapterNumber, level = 0 }: CommentItemProps) {
  const { addComment, likeComment, addReaction, deleteComment } = useComics();
  const { user, displayName } = useUser();

  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isOwn = user && (comment.userId === user.id || comment.author === displayName);
  const replies = allComments.filter((c) => c.parentId === comment.id);

  const handleLike = () => {
    likeComment(slug, chapterNumber, comment.id);
  };

  const handleReact = (emoji: string) => {
    addReaction(slug, chapterNumber, comment.id, emoji);
    setShowEmojiPicker(false);
  };

  const handleDelete = () => {
    if (confirm("Delete this comment?")) {
      deleteComment(slug, chapterNumber, comment.id);
    }
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) return;
    addComment(slug, chapterNumber, trimmed, displayName || "Reader", undefined, comment.id);
    setReplyText("");
    setShowReply(false);
  };

  const indent = Math.min(level, 4) * 16; // cap depth visually

  return (
    <div
      className="glass rounded-xl border border-[var(--border)] p-3"
      style={{ marginLeft: `${indent}px` }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="mt-0.5 w-8 h-8 rounded-full bg-[var(--bg-elev)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {comment.avatar || comment.author?.[0]?.toUpperCase() || "R"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-[var(--text)]">{comment.author}</span>
            <span className="text-[10px] text-[var(--text-muted)]">{relativeTime(comment.timestamp)}</span>
            {comment.parentId && (
              <span className="text-[10px] px-1.5 py-px rounded bg-[var(--bg-elev)] text-[var(--text-muted)]">reply</span>
            )}
          </div>

          <div className="mt-1 text-[14px] leading-relaxed text-[var(--text)] whitespace-pre-wrap break-words">
            {comment.text}
          </div>

          {/* Actions */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {/* Like */}
            <button
              onClick={handleLike}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-elev)] active:bg-[var(--accent)]/10 text-[var(--text-muted)] hover:text-[var(--accent)] transition"
              title="Like"
            >
              <Heart size={14} className={comment.likes > 0 ? "fill-current text-rose-400" : ""} />
              <span>{comment.likes || 0}</span>
            </button>

            {/* Reactions */}
            <div className="flex items-center gap-1">
              {Object.entries(comment.reactions || {}).map(([emoji, count]) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-elev)] text-[13px] transition active:scale-[0.985]"
                  title={`React with ${emoji}`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px] tabular-nums text-[var(--text-muted)]">{count}</span>
                </button>
              ))}

              {/* Add reaction */}
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-elev)] text-[var(--text-muted)] hover:text-[var(--accent)]"
                  title="Add reaction"
                >
                  <Smile size={14} />
                </button>

                {showEmojiPicker && (
                  <div className="absolute z-50 mt-1 left-0 glass rounded-xl border border-[var(--border)] p-2 shadow-lg flex gap-1 flex-wrap w-44">
                    {QUICK_EMOJIS.map((em) => (
                      <button
                        key={em}
                        onClick={() => handleReact(em)}
                        className="text-xl leading-none p-1 hover:bg-[var(--bg-elev)] rounded transition active:scale-90"
                        title={em}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reply */}
            <button
              onClick={() => setShowReply((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-elev)] text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              <Reply size={14} /> Reply
            </button>

            {/* Delete (own only) */}
            {isOwn && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                title="Delete comment"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Inline reply composer */}
          {showReply && (
            <form onSubmit={handleReplySubmit} className="mt-3">
              <div className="flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${comment.author}...`}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1.5 text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/60"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          )}

          {/* Threaded children (indented) */}
          {replies.length > 0 && (
            <div className="mt-3 space-y-3 border-l border-[var(--border)] pl-3">
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  allComments={allComments}
                  slug={slug}
                  chapterNumber={chapterNumber}
                  level={level + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
