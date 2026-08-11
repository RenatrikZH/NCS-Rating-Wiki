# NCS Ratings - NoCopyrightSounds 歌曲评分社区

为 NCS (NoCopyrightSounds) 厂牌的每首歌曲提供好评/差评评分和评论系统。

## 技术栈

- **前端**: Next.js 16 + React 19 + Tailwind CSS v4
- **后端**: Supabase (PostgreSQL + Auth)
- **数据来源**: Spotify Web API
- **部署**: Vercel

## 功能

- 歌曲列表（从 Spotify 获取 NCS 全部歌曲）
- 好评/差评评分系统（需登录）
- 评论系统（需登录）
- 搜索和排序
- 用户注册/登录

## 前置条件

1. **Node.js** 18+ 和 npm
2. **Git**（用于推送到 GitHub）
3. **Supabase 账号**（免费）- https://supabase.com
4. **Spotify 开发者账号**（免费）- https://developer.spotify.com
5. **Vercel 账号**（免费）- https://vercel.com
6. **GitHub 账号** - https://github.com

## 部署步骤

### 第一步：创建 Supabase 项目

1. 访问 https://supabase.com 注册并登录
2. 点击 "New Project" 创建新项目
3. 填写项目名称，选择免费套餐
4. 等待项目创建完成

### 第二步：初始化数据库

1. 在 Supabase 控制台中，点击左侧 "SQL Editor"
2. 点击 "New query"
3. 复制 `supabase/schema.sql` 文件的全部内容，粘贴到编辑器中
4. 点击 "Run" 执行
5. 确认表 `songs`、`ratings`、`comments`、`profiles` 已创建

### 第三步：配置 Supabase Auth

1. 在 Supabase 控制台中，点击左侧 "Authentication" > "Providers"
2. 确保 "Email" 已启用
3. （可选）关闭 "Confirm email" 以便测试时无需邮箱验证：
   - Authentication > Settings > Email auth > 关闭 "Enable email confirmations"

### 第四步：获取 Supabase 密钥

1. 在 Supabase 控制台中，点击左侧 "Settings" > "API"
2. 记下以下信息：
   - **Project URL**（如 `https://xxxxx.supabase.co`）
   - **anon public key**（一长串字符串）

### 第五步：获取 Spotify API 密钥

1. 访问 https://developer.spotify.com/dashboard
2. 登录后点击 "Create app"
3. 填写应用名称和描述，Redirect URI 填 `http://localhost:3000`
4. 创建后进入应用设置页面
5. 点击 "Settings" 查看：
   - **Client ID**
   - **Client Secret**（点击 "View client secret"）

### 第六步：创建 GitHub 仓库

1. 在 GitHub 上创建新仓库（如 `ncs-ratings`）
2. 将本地代码推送到 GitHub：

```bash
# 安装 Git（如果还没有安装）
# Windows: https://git-scm.com/download/win

# 初始化并推送
cd ncs-ratings
git init
git add .
git commit -m "Initial commit: NCS Ratings"
git branch -M main
git remote add origin https://github.com/你的用户名/ncs-ratings.git
git push -u origin main
```

### 第七步：部署到 Vercel

1. 访问 https://vercel.com 并用 GitHub 账号登录
2. 点击 "Add New" > "Project"
3. 选择你刚创建的 GitHub 仓库
4. 在 "Environment Variables" 中添加以下变量：

| 名称 | 值 |
|------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | 你的 Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 Supabase anon public key |
| `SPOTIFY_CLIENT_ID` | 你的 Spotify Client ID |
| `SPOTIFY_CLIENT_SECRET` | 你的 Spotify Client Secret |
| `SYNC_SECRET` | 自定义的随机字符串（用于保护同步接口） |

5. 点击 "Deploy" 等待部署完成
6. 部署完成后，Vercel 会给你一个 URL（如 `https://ncs-ratings.vercel.app`）

### 第八步：同步歌曲数据

部署完成后，需要从 Spotify 同步 NCS 歌曲到数据库：

```bash
# 用浏览器或 curl 调用同步接口
curl -X POST https://你的域名.vercel.app/api/sync-songs \
  -H "Authorization: Bearer 你的SYNC_SECRET"
```

或者直接在浏览器中访问：
```
https://你的域名.vercel.app/api/sync-songs?secret=你的SYNC_SECRET
```

同步完成后，访问首页即可看到所有 NCS 歌曲。

## 本地开发

1. 复制环境变量文件并填写：

```bash
cp .env.local.example .env.local
# 编辑 .env.local 填入真实值
```

2. 安装依赖并启动开发服务器：

```bash
npm install
npm run dev
```

3. 访问 http://localhost:3000

4. 同步歌曲到本地数据库：

```bash
curl -X POST http://localhost:3000/api/sync-songs \
  -H "Authorization: Bearer 你的SYNC_SECRET"
```

## 定时同步（可选）

可以在 Vercel 中设置 Cron Job 定期同步歌曲：

1. 在项目根目录创建 `vercel.json`：

```json
{
  "crons": [
    {
      "path": "/api/sync-songs",
      "schedule": "0 0 * * 1"
    }
  ]
}
```

2. 这会每周一自动同步歌曲（需要设置 `SYNC_SECRET` 环境变量）

## 项目结构

```
ncs-ratings/
├── src/
│   ├── app/
│   │   ├── api/sync-songs/route.ts  # 同步歌曲 API
│   │   ├── auth/callback/route.ts   # Auth 回调
│   │   ├── login/page.tsx           # 登录页
│   │   ├── signup/page.tsx          # 注册页
│   │   ├── song/[id]/page.tsx       # 歌曲详情页（评分+评论）
│   │   ├── globals.css              # 全局样式
│   │   ├── layout.tsx               # 根布局
│   │   ├── not-found.tsx            # 404 页面
│   │   └── page.tsx                 # 首页（歌曲列表）
│   ├── components/
│   │   ├── CommentSection.tsx       # 评论区组件
│   │   ├── LogoutButton.tsx         # 登出按钮
│   │   ├── Navbar.tsx               # 导航栏
│   │   ├── RatingButtons.tsx        # 评分按钮
│   │   └── SongCard.tsx             # 歌曲卡片
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts            # 浏览器端客户端
│   │   │   ├── middleware.ts        # 会话刷新
│   │   │   └── server.ts            # 服务端客户端
│   │   ├── spotify.ts               # Spotify API 封装
│   │   └── types.ts                 # TypeScript 类型
│   └── middleware.ts                # Next.js 中间件
├── supabase/
│   └── schema.sql                   # 数据库 Schema
├── .env.local.example               # 环境变量示例
└── package.json
```

## 免责声明

本站与 NoCopyrightSounds 官方无关，仅用于社区评分讨论。歌曲数据来源于 Spotify Web API。NCS 音乐版权归原作者所有。
