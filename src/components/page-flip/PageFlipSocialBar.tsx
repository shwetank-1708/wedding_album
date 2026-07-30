"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Heart, Info, Loader2, Maximize2, MessageCircle, Send, Share2, Trash2, UserSearch, X } from "lucide-react";
import { addComment, deletePhotoComment, onPhotoInteractions, toggleLike } from "@/lib/database";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import type { GalleryMediaItem, PageFlipThemeConfig } from "./types";

interface PhotoInteraction {
  id: string;
  userId: string;
  userName: string;
  text?: string;
  createdAt?: string;
}

interface PageFlipSocialBarProps {
  item: GalleryMediaItem;
  config: PageFlipThemeConfig;
  positionLabel: string;
  showLikes?: boolean;
  showComments?: boolean;
  showShare?: boolean;
  showDownload?: boolean;
  showFullscreen?: boolean;
  showFindYou?: boolean;
  visible?: boolean;
  immersive?: boolean;
  onDownload: () => void;
  onFullscreen: () => void;
  onFindYou?: () => void;
}

function getGuestIdentity() {
  if (typeof window === "undefined") return { id: "anonymous", name: "Guest" };
  const saved = sessionStorage.getItem("wedding_guest_details");
  if (!saved) return { id: "anonymous", name: "Guest" };

  try {
    const parsed = JSON.parse(saved) as { name?: string; phone?: string };
    return {
      id: parsed.phone || "anonymous",
      name: parsed.name || "Guest",
    };
  } catch {
    return { id: "anonymous", name: "Guest" };
  }
}

function formatCommentTime(value?: string) {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function PageFlipSocialBar({
  item,
  config,
  positionLabel,
  showLikes = true,
  showComments = true,
  showShare = true,
  showDownload = true,
  showFullscreen = true,
  showFindYou = false,
  visible = true,
  immersive = false,
  onDownload,
  onFullscreen,
  onFindYou,
}: PageFlipSocialBarProps) {
  const { user } = useAuth();
  const identity = useMemo(() => {
    if (user) return { id: user.uid, name: user.name || user.email?.split("@")[0] || "User" };
    return getGuestIdentity();
  }, [user]);
  const [likes, setLikes] = useState<PhotoInteraction[]>([]);
  const [comments, setComments] = useState<PhotoInteraction[]>([]);
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [likePending, setLikePending] = useState(false);
  const [commentPending, setCommentPending] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isLiked = likes.some((like) => like.userId === identity.id);

  useEffect(() => {
    const unsubscribe = onPhotoInteractions(item.id, (data) => {
      setLikes(data.likes);
      setComments(data.comments);
    });
    return () => unsubscribe();
  }, [item.id]);

  useEffect(() => {
    if (!commentDrawerOpen) return;
    const timer = window.setTimeout(() => commentInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [commentDrawerOpen]);

  useEffect(() => {
    if (!commentDrawerOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setCommentDrawerOpen(false);
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [commentDrawerOpen]);

  const handleToggleLike = async () => {
    if (likePending) return;
    const optimisticLike = { id: `optimistic-${identity.id}`, userId: identity.id, userName: identity.name };
    const previousLikes = likes;
    setLikePending(true);
    setLikes((current) => isLiked ? current.filter((like) => like.userId !== identity.id) : [optimisticLike, ...current]);

    try {
      await toggleLike(item.id, identity.id, identity.name);
    } catch (error) {
      console.error("Cover flow like failed", error);
      setLikes(previousLikes);
    } finally {
      setLikePending(false);
    }
  };

  const handleAddComment = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = commentText.trim();
    if (!text || commentPending || text.length > 1000) return;

    const optimisticComment: PhotoInteraction = {
      id: `optimistic-${Date.now()}`,
      userId: identity.id,
      userName: identity.name,
      text,
      createdAt: new Date().toISOString(),
    };
    setCommentPending(true);
    setCommentText("");
    setComments((current) => [optimisticComment, ...current]);

    const saved = await addComment(item.id, identity.id, identity.name, text);
    if (!saved) {
      setComments((current) => current.filter((comment) => comment.id !== optimisticComment.id));
      setCommentText(text);
    }
    setCommentPending(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const previousComments = comments;
    setComments((current) => current.filter((comment) => comment.id !== commentId));
    const deleted = await deletePhotoComment(commentId);
    if (!deleted) setComments(previousComments);
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: item.filename || "EveBash media", url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 1600);
      }
    } catch (error) {
      console.error("Cover flow share failed", error);
    }
  };

  const actionClass = cn("flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45", config.controlClass);

  return (
    <>
      <div className={cn(
        "fixed inset-x-3 bottom-5 z-[116] flex justify-center transition-all duration-300 md:bottom-8",
        !visible && "pointer-events-none translate-y-8 opacity-0",
        immersive && "bottom-6 md:bottom-7"
      )}>
        <div className={cn("flex max-w-[min(94vw,980px)] flex-wrap items-center justify-center gap-2 rounded-2xl border px-3 py-3 shadow-2xl backdrop-blur-2xl", config.pageClass)}>
          {showLikes && (
            <button type="button" onClick={handleToggleLike} disabled={likePending} className={cn(actionClass, isLiked && "text-rose-300")} aria-pressed={isLiked} aria-label={isLiked ? "Unlike media" : "Like media"}>
              {likePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />}
              {likes.length}
            </button>
          )}
          {showComments && (
            <button type="button" onClick={() => setCommentDrawerOpen(true)} className={actionClass} aria-label="Open comments">
              <MessageCircle className="h-4 w-4" />
              {comments.length}
            </button>
          )}
          {showShare && (
            <button type="button" onClick={handleShare} className={actionClass} aria-label="Share gallery media">
              {shareCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{shareCopied ? "Copied" : "Share"}</span>
            </button>
          )}
          {showDownload && (
            <button type="button" onClick={onDownload} className={actionClass} aria-label="Download original media">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}
          {showFullscreen && (
            <button type="button" onClick={onFullscreen} className={actionClass} aria-label="Open fullscreen">
              <Maximize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>
          )}
          {showFindYou && (
            <button type="button" onClick={onFindYou} className={actionClass} aria-label="Find me in this gallery">
              <UserSearch className="h-4 w-4" />
              <span className="hidden sm:inline">Find You</span>
            </button>
          )}
          <div className="hidden min-h-11 items-center gap-2 rounded-full px-3 text-xs font-bold uppercase tracking-[0.14em] opacity-70 md:flex">
            <Info className="h-4 w-4" />
            {positionLabel}
          </div>
        </div>
      </div>

      {commentDrawerOpen && (
        <div className="fixed inset-0 z-[135] bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Media comments">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setCommentDrawerOpen(false)} aria-label="Close comments" />
          <div className={cn("absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col overflow-hidden rounded-t-3xl border md:inset-y-0 md:left-auto md:right-0 md:w-[min(420px,92vw)] md:max-h-none md:rounded-l-3xl md:rounded-tr-none", config.pageClass)}>
            <div className="flex items-center justify-between border-b border-current/10 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Comments</p>
                <p className="text-sm opacity-70">{comments.length} shared thoughts</p>
              </div>
              <button type="button" onClick={() => setCommentDrawerOpen(false)} className={cn("flex h-11 w-11 items-center justify-center rounded-full border", config.controlClass)} aria-label="Close comments">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {comments.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center text-center opacity-60">
                  <MessageCircle className="mb-3 h-9 w-9" />
                  <p className="text-sm font-bold">No comments yet</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-current/10 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-black">{comment.userName || "Guest"}</p>
                      <span className="shrink-0 text-xs opacity-55">{formatCommentTime(comment.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed opacity-80">{comment.text}</p>
                    {comment.userId === identity.id && !comment.id.startsWith("optimistic-") && (
                      <button type="button" onClick={() => handleDeleteComment(comment.id)} className="mt-3 flex items-center gap-1 text-xs font-black uppercase tracking-widest text-rose-300">
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="border-t border-current/10 p-4">
              <div className="flex gap-2">
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value.slice(0, 1000))}
                  placeholder="Write a comment..."
                  className="min-h-11 flex-1 resize-none rounded-2xl border border-current/10 bg-black/20 px-4 py-3 text-sm outline-none focus-visible:ring-2"
                  maxLength={1000}
                />
                <button type="submit" disabled={!commentText.trim() || commentPending} className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border", config.controlClass)} aria-label="Submit comment">
                  {commentPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-right text-[10px] font-bold uppercase tracking-widest opacity-45">{commentText.length}/1000</p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
