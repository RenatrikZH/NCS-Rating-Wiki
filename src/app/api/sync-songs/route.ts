import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllNCSTracks } from "@/lib/spotify";

// 同步 NCS 歌曲到数据库
// 用法：POST /api/sync-songs，Header: Authorization: Bearer <SYNC_SECRET>
export async function POST(request: Request) {
  // 验证密钥（如果配置了 SYNC_SECRET）
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // 从 Spotify 获取所有 NCS 歌曲
    const tracks = await getAllNCSTracks();

    const supabase = await createClient();

    // 转换为数据库格式
    const songs = tracks.map((track) => ({
      spotify_id: track.id,
      title: track.name,
      artist: track.artist,
      album: track.album,
      image_url: track.image_url,
      preview_url: track.preview_url,
      spotify_url: track.spotify_url,
      release_date: track.release_date,
    }));

    // 批量 upsert（有则更新，无则插入）
    const { data, error } = await supabase
      .from("songs")
      .upsert(songs, { onConflict: "spotify_id" })
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      synced: data?.length || 0,
      total_tracks: tracks.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// 也支持 GET 请求（方便浏览器直接访问测试）
export async function GET(request: Request) {
  // 如果配置了 SYNC_SECRET，GET 请求也需要验证
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");
    if (authHeader !== `Bearer ${syncSecret}` && querySecret !== syncSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const tracks = await getAllNCSTracks();
    const supabase = await createClient();

    const songs = tracks.map((track) => ({
      spotify_id: track.id,
      title: track.name,
      artist: track.artist,
      album: track.album,
      image_url: track.image_url,
      preview_url: track.preview_url,
      spotify_url: track.spotify_url,
      release_date: track.release_date,
    }));

    const { data, error } = await supabase
      .from("songs")
      .upsert(songs, { onConflict: "spotify_id" })
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      synced: data?.length || 0,
      total_tracks: tracks.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
