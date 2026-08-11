"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface RatingButtonsProps {
  songId: string;
  initialRating: "like" | "dislike" | null;
  initialLikeCount: number;
  initialDislikeCount: number;
  isLoggedIn: boolean;
}

export function RatingButtons({
  songId,
  initialRating,
  initialLikeCount,
  initialDislikeCount,
  isLoggedIn,
}: RatingButtonsProps) {
  const [rating, setRating] = useState(initialRating);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [loading, setLoading] = useState(false);

  const handleRate = async (newRating: "like" | "dislike") => {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (rating === newRating) {
      // 再次点击相同评分 = 取消评分
      const { error } = await supabase
        .from("ratings")
        .delete()
        .eq("song_id", songId)
        .eq("user_id", user.id);

      if (!error) {
        if (newRating === "like") setLikeCount((c) => c - 1);
        else setDislikeCount((c) => c - 1);
        setRating(null);
      }
    } else {
      // 新评分或切换评分（upsert 自动处理唯一约束）
      const { error } = await supabase
        .from("ratings")
        .upsert(
          { song_id: songId, user_id: user.id, rating: newRating },
          { onConflict: "user_id,song_id" }
        );

      if (!error) {
        // 更新计数：减旧加新
        if (rating === "like") setLikeCount((c) => c - 1);
        else if (rating === "dislike") setDislikeCount((c) => c - 1);

        if (newRating === "like") setLikeCount((c) => c + 1);
        else setDislikeCount((c) => c + 1);

        setRating(newRating);
      }
    }
    setLoading(false);
  };

  const total = likeCount + dislikeCount;
  const likePercentage =
    total > 0 ? Math.round((likeCount / total) * 100) : 0;

  return (
    <div>
      {/* 评分按钮 */}
      <div className="flex gap-3">
        <button
          onClick={() => handleRate("like")}
          disabled={loading}
          className={`flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition disabled:opacity-50 ${
            rating === "like"
              ? "bg-like text-white"
              : "border border-border bg-surface text-muted hover:text-foreground"
          }`}
        >
          <span>👍</span>
          <span>好评</span>
          <span className="ml-1 text-sm">({likeCount})</span>
        </button>
        <button
          onClick={() => handleRate("dislike")}
          disabled={loading}
          className={`flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition disabled:opacity-50 ${
            rating === "dislike"
              ? "bg-dislike text-white"
              : "border border-border bg-surface text-muted hover:text-foreground"
          }`}
        >
          <span>👎</span>
          <span>差评</span>
          <span className="ml-1 text-sm">({dislikeCount})</span>
        </button>
      </div>

      {/* 评分进度条 */}
      {total > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-like">好评 {likePercentage}%</span>
            <span className="text-muted">共 {total} 人评分</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-like transition-all"
              style={{ width: `${likePercentage}%` }}
            />
          </div>
        </div>
      )}

      {!isLoggedIn && (
        <p className="mt-3 text-sm text-muted">需要登录后才能评分</p>
      )}
    </div>
  );
}
