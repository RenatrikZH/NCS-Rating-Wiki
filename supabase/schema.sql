-- NCS Ratings 数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件

-- ============================================
-- 1. 用户资料表（扩展 auth.users）
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  email text,
  created_at timestamptz default now()
);

-- 当新用户注册时自动创建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 2. 歌曲表
-- ============================================
create table if not exists public.songs (
  id uuid default gen_random_uuid() primary key,
  spotify_id text unique not null,
  title text not null,
  artist text not null,
  album text,
  image_url text,
  preview_url text,
  spotify_url text,
  release_date date,
  created_at timestamptz default now()
);

-- ============================================
-- 3. 评分表（好评/差评）
-- ============================================
create table if not exists public.ratings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  song_id uuid references public.songs on delete cascade not null,
  rating text not null check (rating in ('like', 'dislike')),
  created_at timestamptz default now(),
  unique(user_id, song_id) -- 每个用户对每首歌只能评一次
);

-- ============================================
-- 4. 评论表
-- ============================================
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  song_id uuid references public.songs on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- ============================================
-- 5. Row Level Security (RLS)
-- ============================================

-- profiles: 用户只能看和改自己的资料
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- songs: 所有人可读
alter table public.songs enable row level security;

create policy "Songs are viewable by everyone"
  on public.songs for select using (true);

-- ratings: 所有人可读，登录用户可管理自己的评分
alter table public.ratings enable row level security;

create policy "Ratings are viewable by everyone"
  on public.ratings for select using (true);

create policy "Users can insert own ratings"
  on public.ratings for insert with check (auth.uid() = user_id);

create policy "Users can update own ratings"
  on public.ratings for update using (auth.uid() = user_id);

create policy "Users can delete own ratings"
  on public.ratings for delete using (auth.uid() = user_id);

-- comments: 所有人可读，登录用户可管理自己的评论
alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select using (true);

create policy "Users can insert own comments"
  on public.comments for insert with check (auth.uid() = user_id);

create policy "Users can update own comments"
  on public.comments for update using (auth.uid() = user_id);

create policy "Users can delete own comments"
  on public.comments for delete using (auth.uid() = user_id);

-- ============================================
-- 6. 索引（提升查询性能）
-- ============================================
create index if not exists idx_ratings_song_id on public.ratings(song_id);
create index if not exists idx_ratings_user_id on public.ratings(user_id);
create index if not exists idx_comments_song_id on public.comments(song_id);
create index if not exists idx_comments_user_id on public.comments(user_id);
create index if not exists idx_songs_spotify_id on public.songs(spotify_id);
create index if not exists idx_songs_release_date on public.songs(release_date desc);
