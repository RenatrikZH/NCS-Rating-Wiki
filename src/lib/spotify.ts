import type { SpotifyTrack } from "./types";

// NoCopyrightSounds 的 Spotify Artist ID
const NCS_ARTIST_ID = "0oOet7zM9EqZVt4exza8au";

// 缓存 access token
let cachedToken: { token: string; expiresAt: number } | null = null;

// 使用 Client Credentials Flow 获取 Spotify access token
async function getAccessToken(): Promise<string> {
  // 如果缓存的 token 还有效，直接返回
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials not configured");
  }

  const response: Response = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get Spotify access token");
  }

  const data: { access_token: string; expires_in: number } =
    await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  release_date: string;
  image_url: string;
}

// Spotify API 返回的专辑数据结构
interface SpotifyAlbumResponse {
  items: Array<{
    id: string;
    name: string;
    release_date: string;
    images: Array<{ url: string }>;
  }>;
  next: string | null;
}

// Spotify API 返回的曲目数据结构
interface SpotifyTracksResponse {
  items: Array<{
    id: string;
    name: string;
    preview_url: string | null;
    external_urls: { spotify?: string };
    artists: Array<{ name: string }>;
  }>;
  next: string | null;
}

// 获取 NCS 的所有专辑（包括 singles）
export async function getNCSAlbums(): Promise<SpotifyAlbum[]> {
  const token = await getAccessToken();
  const albums: SpotifyAlbum[] = [];

  let url: string | null = `https://api.spotify.com/v1/artists/${NCS_ARTIST_ID}/albums?include_groups=album,single&limit=50&market=US`;

  while (url) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch albums: ${response.status}`);
    }

    const data: SpotifyAlbumResponse = await response.json();

    for (const album of data.items) {
      albums.push({
        id: album.id,
        name: album.name,
        release_date: album.release_date,
        image_url: album.images?.[0]?.url || "",
      });
    }

    url = data.next; // 翻页
  }

  return albums;
}

// 从单张专辑中获取歌曲
export async function getTracksFromAlbum(
  album: SpotifyAlbum
): Promise<SpotifyTrack[]> {
  const token = await getAccessToken();
  const tracks: SpotifyTrack[] = [];

  let url: string | null = `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=50&market=US`;

  while (url) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error(`Failed to fetch tracks for album ${album.id}`);
      break;
    }

    const data: SpotifyTracksResponse = await response.json();

    for (const track of data.items) {
      tracks.push({
        id: track.id,
        name: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        album: album.name,
        image_url: album.image_url,
        preview_url: track.preview_url,
        spotify_url: track.external_urls?.spotify || null,
        release_date: album.release_date,
      });
    }

    url = data.next;
  }

  return tracks;
}

// 获取所有 NCS 歌曲
export async function getAllNCSTracks(): Promise<SpotifyTrack[]> {
  const albums = await getNCSAlbums();
  const allTracks: SpotifyTrack[] = [];
  const seenIds = new Set<string>();

  for (const album of albums) {
    const tracks = await getTracksFromAlbum(album);
    for (const track of tracks) {
      // 去重（同一首歌可能出现在不同专辑/合辑中）
      if (!seenIds.has(track.id)) {
        seenIds.add(track.id);
        allTracks.push(track);
      }
    }
  }

  return allTracks;
}
