// 歌曲类型
export interface Song {
  id: string;
  spotify_id: string;
  title: string;
  artist: string;
  album: string | null;
  image_url: string | null;
  preview_url: string | null;
  spotify_url: string | null;
  release_date: string | null;
  created_at: string;
}

// 评分类型
export interface Rating {
  id: string;
  user_id: string;
  song_id: string;
  rating: "like" | "dislike";
  created_at: string;
}

// 评论类型
export interface Comment {
  id: string;
  user_id: string;
  song_id: string;
  content: string;
  created_at: string;
  profiles?: {
    username: string | null;
    email: string | null;
  } | null;
}

// 带统计信息的歌曲（用于列表和详情页）
export interface SongWithStats extends Song {
  like_count: number;
  dislike_count: number;
  total_ratings: number;
  like_percentage: number;
  comment_count: number;
  user_rating?: "like" | "dislike" | null;
}

// Spotify 轨道类型
export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  image_url: string | null;
  preview_url: string | null;
  spotify_url: string | null;
  release_date: string | null;
}
