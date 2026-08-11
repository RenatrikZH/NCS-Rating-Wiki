// NCS Ratings - 应用逻辑
// 评分和评论存储在浏览器 localStorage 中

(function() {
  'use strict';

  // === 数据存储 ===
  const STORAGE_KEY_RATINGS = 'ncs_ratings';
  const STORAGE_KEY_COMMENTS = 'ncs_comments';
  const STORAGE_KEY_USERNAME = 'ncs_username';

  // 获取本地存储的评分
  function getRatings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_RATINGS) || '{}'); }
    catch { return {}; }
  }
  // 保存评分
  function saveRatings(ratings) {
    localStorage.setItem(STORAGE_KEY_RATINGS, JSON.stringify(ratings));
  }
  // 获取本地存储的评论
  function getComments() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_COMMENTS) || '{}'); }
    catch { return {}; }
  }
  // 保存评论
  function saveComments(comments) {
    localStorage.setItem(STORAGE_KEY_COMMENTS, JSON.stringify(comments));
  }
  // 获取用户名
  function getUsername() {
    return localStorage.getItem(STORAGE_KEY_USERNAME) || null;
  }
  function setUsername(name) {
    localStorage.setItem(STORAGE_KEY_USERNAME, name);
  }

  // === 歌曲统计计算 ===
  function getSongStats(songId) {
    const ratings = getRatings();
    const comments = getComments();
    let like = 0, dislike = 0;
    // 遍历所有用户的评分（localStorage 里只有一个用户的数据，但结构支持多用户）
    const songRatings = ratings[songId] || [];
    for (const r of songRatings) {
      if (r.rating === 'like') like++;
      else dislike++;
    }
    const total = like + dislike;
    const percentage = total > 0 ? Math.round((like / total) * 100) : 0;
    const commentCount = (comments[songId] || []).length;
    // 当前用户的评分
    const myRating = songRatings.find(r => r.user === getUsername())?.rating || null;
    return { like, dislike, total, percentage, commentCount, myRating };
  }

  // === 生成封面渐变色 ===
  function getCoverGradient(song) {
    // 基于歌曲标题生成确定性渐变色
    let hash = 0;
    for (let i = 0; i < song.title.length; i++) {
      hash = song.title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue1 = Math.abs(hash) % 360;
    const hue2 = (hue1 + 60) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 70%, 45%), hsl(${hue2}, 70%, 35%))`;
  }

  function getCoverInitial(song) {
    return song.title.charAt(0).toUpperCase();
  }

  // === 渲染歌曲列表 ===
  function renderGrid(songs) {
    const grid = document.getElementById('grid');
    if (songs.length === 0) {
      grid.innerHTML = '<div class="empty">没有找到匹配的歌曲</div>';
      return;
    }
    grid.innerHTML = songs.map(song => {
      const stats = getSongStats(song.id);
      const badge = stats.total > 0
        ? `<div class="card-badge" style="color:${stats.percentage >= 60 ? 'var(--like)' : 'var(--dislike)'}">${stats.percentage}%</div>`
        : '';
      return `
        <div class="card" onclick="window.openSong('${song.id}')">
          <div class="card-cover" style="background:${getCoverGradient(song)}">
            <span style="color:rgba(255,255,255,.5);font-weight:bold">${getCoverInitial(song)}</span>
            ${badge}
          </div>
          <div class="card-body">
            <div class="card-title">${song.title}</div>
            <div class="card-artist">${song.artist}</div>
            <div class="card-stats">
              <span class="like">赞 ${stats.like}</span>
              <span class="dislike">踩 ${stats.dislike}</span>
              <span>评 ${stats.commentCount}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // === 搜索和排序 ===
  function filterAndSort() {
    const q = document.getElementById('search').value.toLowerCase().trim();
    const sort = document.getElementById('sort').value;
    let songs = NCS_SONGS.filter(s =>
      !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    );
    if (sort === 'popular') {
      songs.sort((a, b) => b.popular - a.popular);
    } else if (sort === 'az') {
      songs.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'za') {
      songs.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sort === 'rating') {
      songs.sort((a, b) => getSongStats(b.id).percentage - getSongStats(a.id).percentage);
    }
    renderGrid(songs);
  }

  // === 歌曲详情弹窗 ===
  window.openSong = function(songId) {
    const song = NCS_SONGS.find(s => s.id === songId);
    if (!song) return;
    const stats = getSongStats(songId);
    const comments = getComments()[songId] || [];
    const username = getUsername();

    const modal = document.getElementById('modal');
    modal.innerHTML = `
      <button class="close-btn" onclick="window.closeModal()">✕</button>
      <div class="modal-header">
        <div class="modal-song">
          <div class="modal-cover" style="background:${getCoverGradient(song)};color:rgba(255,255,255,.5);font-weight:bold">
            ${getCoverInitial(song)}
          </div>
          <div class="modal-info">
            <h2>${song.title}</h2>
            <div class="artist">${song.artist}</div>
            <div class="meta">
              <span>类型: ${song.genre}</span>
              <span>年份: ${song.year}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-body">
        <div class="rating-section">
          <h3>评分</h3>
          <div class="rating-buttons">
            <button class="rate-btn ${stats.myRating === 'like' ? 'active like' : ''}" onclick="window.rate('${songId}', 'like')">
              👍 好评 <span style="margin-left:.25rem">(${stats.like})</span>
            </button>
            <button class="rate-btn ${stats.myRating === 'dislike' ? 'active dislike' : ''}" onclick="window.rate('${songId}', 'dislike')">
              👎 差评 <span style="margin-left:.25rem">(${stats.dislike})</span>
            </button>
          </div>
          ${stats.total > 0 ? `
            <div class="rating-bar">
              <div class="rating-bar-labels">
                <span style="color:var(--like)">好评 ${stats.percentage}%</span>
                <span style="color:var(--muted)">共 ${stats.total} 人评分</span>
              </div>
              <div class="rating-bar-track">
                <div class="rating-bar-fill" style="width:${stats.percentage}%"></div>
              </div>
            </div>
          ` : '<p class="login-hint">暂无评分，成为第一个评分的人</p>'}
          ${!username ? '<p class="login-hint">需要先设置昵称才能评分</p>' : ''}
        </div>
        <div class="comments">
          <h3>评论 (${comments.length})</h3>
          ${username ? `
            <div class="comment-form">
              <textarea id="comment-input" placeholder="写下你的评论..." maxlength="500"></textarea>
              <div class="comment-form-bottom">
                <span class="char-count"><span id="char-count">0</span>/500</span>
                <button class="btn" onclick="window.submitComment('${songId}')">发表评论</button>
              </div>
            </div>
          ` : '<div style="background:var(--surface);border:1px solid var(--border);border-radius:.5rem;padding:1rem;text-align:center;color:var(--muted);margin-bottom:1.5rem">请先设置昵称后发表评论</div>'}
          <div class="comment-list" id="comment-list">
            ${comments.length === 0
              ? '<div class="no-comments">暂无评论，来写第一条评论吧</div>'
              : comments.map(c => `
                <div class="comment">
                  <div class="comment-header">
                    <span class="comment-author">${c.user}</span>
                    <div>
                      <span class="comment-date">${new Date(c.date).toLocaleString('zh-CN')}</span>
                      ${c.user === username ? `<button class="comment-delete" onclick="window.deleteComment('${songId}', '${c.id}')">删除</button>` : ''}
                    </div>
                  </div>
                  <div class="comment-content">${escapeHtml(c.content)}</div>
                </div>
              `).join('')
            }
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-overlay').classList.add('active');
    // 绑定字符计数
    const textarea = document.getElementById('comment-input');
    if (textarea) {
      textarea.addEventListener('input', function() {
        document.getElementById('char-count').textContent = this.value.length;
      });
    }
  };

  window.closeModal = function() {
    document.getElementById('modal-overlay').classList.remove('active');
  };

  // === 评分 ===
  window.rate = function(songId, rating) {
    let username = getUsername();
    if (!username) {
      showNameOverlay();
      return;
    }
    const ratings = getRatings();
    if (!ratings[songId]) ratings[songId] = [];
    // 查找当前用户的已有评分
    const idx = ratings[songId].findIndex(r => r.user === username);
    if (idx >= 0) {
      if (ratings[songId][idx].rating === rating) {
        // 再次点击相同评分 = 取消
        ratings[songId].splice(idx, 1);
      } else {
        // 切换评分
        ratings[songId][idx].rating = rating;
      }
    } else {
      ratings[songId].push({ user: username, rating: rating, date: new Date().toISOString() });
    }
    saveRatings(ratings);
    // 重新渲染弹窗和列表
    openSong(songId);
    filterAndSort();
  };

  // === 评论 ===
  window.submitComment = function(songId) {
    const textarea = document.getElementById('comment-input');
    const content = textarea.value.trim();
    if (!content) return;
    let username = getUsername();
    if (!username) {
      showNameOverlay();
      return;
    }
    const comments = getComments();
    if (!comments[songId]) comments[songId] = [];
    comments[songId].unshift({
      id: 'c' + Date.now(),
      user: username,
      content: content,
      date: new Date().toISOString()
    });
    saveComments(comments);
    // 重新渲染
    openSong(songId);
    filterAndSort();
  };

  window.deleteComment = function(songId, commentId) {
    const comments = getComments();
    if (!comments[songId]) return;
    comments[songId] = comments[songId].filter(c => c.id !== commentId);
    saveComments(comments);
    openSong(songId);
    filterAndSort();
  };

  // === 昵称设置 ===
  function showNameOverlay() {
    document.getElementById('name-overlay').classList.add('active');
    document.getElementById('username-input').focus();
  }

  document.getElementById('save-username').addEventListener('click', function() {
    const name = document.getElementById('username-input').value.trim();
    if (!name) return;
    setUsername(name);
    document.getElementById('name-overlay').classList.remove('active');
  });

  document.getElementById('username-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('save-username').click();
    }
  });

  // === 统计 ===
  document.getElementById('stats-link').addEventListener('click', function(e) {
    e.preventDefault();
    const ratings = getRatings();
    const comments = getComments();
    let totalRatings = 0, totalLikes = 0, totalDislikes = 0, totalComments = 0;
    for (const sid in ratings) {
      for (const r of ratings[sid]) {
        totalRatings++;
        if (r.rating === 'like') totalLikes++;
        else totalDislikes++;
      }
    }
    for (const sid in comments) {
      totalComments += comments[sid].length;
    }
    alert(`NCS Ratings 统计\n\n歌曲总数: ${NCS_SONGS.length}\n你的评分: ${totalRatings} (好评 ${totalLikes} / 差评 ${totalDislikes})\n你的评论: ${totalComments}\n昵称: ${getUsername() || '未设置'}\n\n注意: 数据存储在本地浏览器中，清除浏览器数据会导致丢失。`);
  });

  // === HTML 转义 ===
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // === 事件绑定 ===
  document.getElementById('search').addEventListener('input', filterAndSort);
  document.getElementById('sort').addEventListener('change', filterAndSort);
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
  });

  // === 初始化 ===
  filterAndSort();
})();
