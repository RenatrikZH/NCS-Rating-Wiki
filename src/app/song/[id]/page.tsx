import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { RatingButtons } from "@/components/RatingButtons";
import { CommentSection } from "@/components/CommentSection";
import type { Comment } from "@/lib/types";

export default async function SongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 获取歌曲
  const { data: song, error } = await supabase
    .from("songs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !song) {
    notFound();
  }

  // 获取评分统计
  const { data: ratings } = await supabase
    .from("ratings")
    .select("rating")
    .eq("song_id", id);

  const likeCount = ratings?.filter((r) => r.rating === "like").length || 0;
  const dislikeCount =
    ratings?.filter((r) => r.rating === "dislike").length || 0;

  // 获取评论
  const { data: rawComments } = await supabase
    .from("comments")
    .select("*")
    .eq("song_id", id)
    .order("created_at", { ascending: false });

  // 批量获取评论用户的资料
  const userIds = [...new Set(rawComments?.map((c) => c.user_id) || [])];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, email")
    .in("id", userIds);

  const profileMap = new Map(
    profiles?.map((p) => [p.id, { username: p.username, email: p.email }]) ||
      []
  );

  const comments: Comment[] =
    rawComments?.map((c) => ({
      ...c,
      profiles: profileMap.get(c.user_id) || null,
    })) || [];

  // 获取当前用户和用户评分
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRating: "like" | "dislike" | null = null;
  if (user) {
    const { data: userRatingData } = await supabase
      .from("ratings")
      .select("rating")
      .eq("song_id", id)
      .eq("user_id", user.id)
      .single();
    userRating = (userRatingData?.rating as "like" | "dislike") || null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 歌曲信息 */}
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full shrink-0 sm:w-64">
          {song.image_url ? (
            <img
              src={song.image_url}
              alt={song.title}
              className="aspect-square w-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-surface">
              <span className="text-6xl text-muted">♪</span>
            </div>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{song.title}</h1>
          <p className="mt-2 text-lg text-muted">{song.artist}</p>
          {song.album && (
            <p className="mt-1 text-sm text-muted">专辑: {song.album}</p>
          )}
          {song.release_date && (
            <p className="mt-1 text-sm text-muted">
              发布日期: {song.release_date}
            </p>
          )}
          {song.preview_url && (
            <div className="mt-4">
              <audio controls className="w-full">
                <source src={song.preview_url} type="audio/mpeg" />
              </audio>
            </div>
          )}
          {song.spotify_url && (
            <a
              href={song.spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-md border border-brand px-4 py-2 text-sm text-brand hover:bg-brand hover:text-black transition"
            >
              在 Spotify 收听
            </a>
          )}
        </div>
      </div>

      {/* 评分系统 */}
      <div className="mt-8 rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 text-xl font-bold">评分</h2>
        <RatingButtons
          songId={song.id}
          initialRating={userRating}
          initialLikeCount={likeCount}
          initialDislikeCount={dislikeCount}
          isLoggedIn={!!user}
        />
      </div>

      {/* 评论区 */}
      <div className="mt-8">
        <CommentSection
          songId={song.id}
          isLoggedIn={!!user}
          initialComments={comments}
          currentUserId={user?.id || null}
        />
      </div>
    </div>
  );
}
