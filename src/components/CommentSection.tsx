"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Comment } from "@/lib/types";

interface CommentSectionProps {
  songId: string;
  isLoggedIn: boolean;
  initialComments: Comment[];
  currentUserId: string | null;
}

export function CommentSection({
  songId,
  isLoggedIn,
  initialComments,
  currentUserId,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || loading) return;

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("comments")
      .insert({ song_id: songId, user_id: user.id, content: content.trim() })
      .select()
      .single();

    if (!error && data) {
      // 获取用户资料
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, email")
        .eq("id", user.id)
        .single();

      setComments([{ ...data, profiles: profile }, ...comments]);
      setContent("");
    }
    setLoading(false);
  };

  const handleDelete = async (commentId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);
    if (!error) {
      setComments(comments.filter((c) => c.id !== commentId));
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">评论 ({comments.length})</h2>

      {/* 评论输入框 */}
      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写下你的评论..."
            rows={3}
            maxLength={500}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
          />
          <div className="mt-2 flex justify-between">
            <span className="text-sm text-muted">{content.length}/500</span>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="rounded-md bg-brand px-4 py-1.5 font-medium text-black hover:bg-brand-dark transition disabled:opacity-50"
            >
              {loading ? "发送中..." : "发表评论"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4 text-center text-muted">
          请先登录后发表评论
        </div>
      )}

      {/* 评论列表 */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="py-8 text-center text-muted">
            暂无评论，来写第一条评论吧
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-brand">
                  {comment.profiles?.username ||
                    comment.profiles?.email ||
                    "匿名用户"}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">
                    {new Date(comment.created_at).toLocaleString("zh-CN")}
                  </span>
                  {currentUserId === comment.user_id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs text-dislike hover:underline"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-foreground">
                {comment.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
