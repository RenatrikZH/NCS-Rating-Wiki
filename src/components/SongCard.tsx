import Link from "next/link";
import type { SongWithStats } from "@/lib/types";

export function SongCard({ song }: { song: SongWithStats }) {
  const hasRatings = song.total_ratings > 0;
  const isLiked = song.like_percentage >= 60;

  return (
    <Link href={`/song/${song.id}`} className="group block">
      <div className="overflow-hidden rounded-lg border border-border bg-surface transition hover:border-brand">
        <div className="relative aspect-square">
          {song.image_url ? (
            <img
              src={song.image_url}
              alt={song.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-hover">
              <span className="text-4xl text-muted">♪</span>
            </div>
          )}
          {/* 评分百分比角标 */}
          {hasRatings && (
            <div className="absolute right-2 top-2 rounded-md bg-black/80 px-2 py-1 text-sm font-bold backdrop-blur">
              <span className={isLiked ? "text-like" : "text-dislike"}>
                {song.like_percentage}%
              </span>
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="truncate font-semibold group-hover:text-brand transition">
            {song.title}
          </h3>
          <p className="mt-1 truncate text-sm text-muted">{song.artist}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted">
            <span className="text-like">赞 {song.like_count}</span>
            <span className="text-dislike">踩 {song.dislike_count}</span>
            <span>评 {song.comment_count}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
