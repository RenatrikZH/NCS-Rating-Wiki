import { createClient } from "@/lib/supabase/server";
import { SongCard } from "@/components/SongCard";
import type { SongWithStats, Song } from "@/lib/types";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  // 构建查询
  let query = supabase.from("songs").select("*");

  if (params.q) {
    query = query.or(
      `title.ilike.%${params.q}%,artist.ilike.%${params.q}%`
    );
  }

  const sort = params.sort || "newest";
  if (sort === "newest") {
    query = query.order("release_date", { ascending: false, nullsFirst: false });
  } else if (sort === "oldest") {
    query = query.order("release_date", { ascending: true, nullsFirst: false });
  } else if (sort === "title") {
    query = query.order("title", { ascending: true });
  }

  const { data: songs, error } = await query.limit(60);

  // 获取统计数据
  let songsWithStats: SongWithStats[] = [];

  if (songs && songs.length > 0) {
    const songIds = songs.map((s) => s.id);

    // 批量获取评分
    const { data: ratings } = await supabase
      .from("ratings")
      .select("song_id, rating")
      .in("song_id", songIds);

    // 批量获取评论
    const { data: comments } = await supabase
      .from("comments")
      .select("song_id")
      .in("song_id", songIds);

    // 获取当前用户的评分
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let userRatingsMap = new Map<string, "like" | "dislike">();
    if (user) {
      const { data: userRatings } = await supabase
        .from("ratings")
        .select("song_id, rating")
        .eq("user_id", user.id)
        .in("song_id", songIds);
      if (userRatings) {
        userRatingsMap = new Map(
          userRatings.map((r) => [r.song_id, r.rating as "like" | "dislike"])
        );
      }
    }

    // 聚合评分统计
    const ratingMap = new Map<string, { like: number; dislike: number }>();
    for (const r of ratings || []) {
      if (!ratingMap.has(r.song_id)) {
        ratingMap.set(r.song_id, { like: 0, dislike: 0 });
      }
      const stats = ratingMap.get(r.song_id)!;
      if (r.rating === "like") stats.like++;
      else stats.dislike++;
    }

    // 聚合评论计数
    const commentMap = new Map<string, number>();
    for (const c of comments || []) {
      commentMap.set(c.song_id, (commentMap.get(c.song_id) || 0) + 1);
    }

    songsWithStats = songs.map((song: Song) => {
      const stats = ratingMap.get(song.id) || { like: 0, dislike: 0 };
      const total = stats.like + stats.dislike;
      const like_percentage =
        total > 0 ? Math.round((stats.like / total) * 100) : 0;
      return {
        ...song,
        like_count: stats.like,
        dislike_count: stats.dislike,
        total_ratings: total,
        like_percentage,
        comment_count: commentMap.get(song.id) || 0,
        user_rating: userRatingsMap.get(song.id) || null,
      };
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">NCS 歌曲评分</h1>
        <p className="mt-2 text-muted">
          浏览所有 NoCopyrightSounds 厂牌歌曲，为喜欢的歌评分
        </p>
      </div>

      {/* 搜索和排序 */}
      <form className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          name="q"
          defaultValue={params.q || ""}
          placeholder="搜索歌曲或艺术家..."
          className="flex-1 rounded-md border border-border bg-surface px-4 py-2 text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">排序:</span>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
          >
            <option value="newest">最新发布</option>
            <option value="oldest">最早发布</option>
            <option value="title">按标题</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-brand px-4 py-2 font-medium text-black hover:bg-brand-dark transition"
          >
            确定
          </button>
        </div>
      </form>

      {/* 歌曲列表 */}
      {error ? (
        <div className="py-12 text-center text-dislike">
          加载失败: {error.message}
        </div>
      ) : songsWithStats.length === 0 ? (
        <div className="py-12 text-center text-muted">
          <p>暂无歌曲数据</p>
          <p className="mt-2 text-sm">
            请先通过{" "}
            <code className="rounded bg-surface px-2 py-0.5">/api/sync-songs</code>{" "}
            接口同步歌曲
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {songsWithStats.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      )}
    </div>
  );
}
