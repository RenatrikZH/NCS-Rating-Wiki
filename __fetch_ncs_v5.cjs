// NCS.io Scraper v5 - use data-* attributes from .player-play anchors (most reliable)
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const OUTFILE = path.join(__dirname, 'catalog.json');
const PROGRESS = path.join(__dirname, '__catalog_progress_v5.json');

let state = {
  tracks: {},
  pagesDone: {},
  totalCalls: 0,
  errors: 0,
  startedAt: Date.now()
};
if (fs.existsSync(PROGRESS)) {
  try { state = Object.assign(state, JSON.parse(fs.readFileSync(PROGRESS, 'utf8'))); } catch(e){}
}
function saveState() { fs.writeFileSync(PROGRESS, JSON.stringify(state, null, 1)); }
function saveCatalog() {
  const arr = Object.values(state.tracks);
  const withCover = arr.filter(s => s.coverUrl && !s.coverUrl.endsWith("no-track.png")).length;
  const withAudio = arr.filter(s => s.audioUrl).length;
  const withArtist = arr.filter(s => s.artists).length;
  const out = {
    meta: {
      version: 5,
      scrapedAt: new Date().toISOString(),
      source: 'https://ncs.io/music-search',
      total: arr.length,
      withCover,
      withAudio,
      withArtist,
      totalCalls: state.totalCalls,
      errors: state.errors,
      genres: new Set(arr.flatMap(s => s.genreNames || [])).size,
      moods: new Set(arr.flatMap(s => s.moodNames || [])).size,
      durationSec: Math.round((Date.now() - state.startedAt)/1000)
    },
    tracks: arr
  };
  fs.writeFileSync(OUTFILE, JSON.stringify(out, null, 1));
  console.log(`\n💾 Saved: ${arr.length} tracks (cov=${withCover} aud=${withAudio} art=${withArtist}), calls=${state.totalCalls}, errs=${state.errors}`);
}

// ============ HTTP ============
function fetchURL(urlStr, opts = {}, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('Too many redirects'));
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const timeoutMs = opts.timeout || 30000;
    const headers = Object.assign({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://ncs.io/music-search'
    }, opts.headers || {});
    const req = lib.get({
      hostname: u.hostname,
      port: u.port || null,
      path: u.pathname + u.search,
      headers,
      timeout: timeoutMs
    }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        let next = res.headers.location;
        if (!next.startsWith('http')) next = new URL(next, u.origin).href;
        res.resume();
        return resolve(fetchURL(next, opts, depth + 1));
      }
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function unescapeAttr(s) {
  if (!s) return '';
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&nbsp;/g,' ').trim();
}

function parseMaxPage(html) {
  let max = 1;
  const re = /<a\b[^>]*class="page-link"[^>]*href="[^"]*page=(\d+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const n = parseInt(m[1]);
    if (!isNaN(n) && n > max) max = n;
  }
  return max;
}

// Parse row using player-play data-* attributes (cleanest source)
function parseListPage(html) {
  const tracks = [];
  // Split by <tr> first (gives us row isolation)
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const row = rowMatch[1];
    // Must contain player-play anchor
    if (!/class="[^"]*player-play[^"]*"/i.test(row)) continue;
    
    // Helper: grab data-* attribute directly from row (handles attribute values containing > or HTML)
    const get = (name) => {
      const re = new RegExp(`data-${name}="([\\s\\S]*?)"(?=\\s+[a-z-]+="|\\s*>|\\s*$)`, 'i');
      const m = row.match(re);
      return m ? unescapeAttr(m[1]) : '';
    };
    
    const audioUrl = get('url');          // S3 mp3 direct link e.g. ncsmusic.s3..../track.mp3
    const title = get('track');            // Song title
    const artists = get('artistraw');      // "Artist1, Artist2"
    const coverRaw = get('cover');         // 100x100 version
    const genreFromBtn = get('genre');     // Primary genre
    const tid = get('tid');                // UUID for alt download link
    const versions = get('versions');      // "Regular" or "Regular, Instrumental"
    
    if (!audioUrl && !title && !tid) continue;
    
    // Up-res cover to 325x325 if it contains dimension path
    let coverUrl = coverRaw;
    if (coverUrl) coverUrl = coverUrl.replace(/\/\d+x\d+\//, '/325x325/');
    
    // Slug from link like <a href="/thisfeeling">
    let slug = '';
    const slugRe = /<a\b[^>]*href="\/([A-Za-z0-9_\-]+)"[^>]*>\s*<img/i;
    const slugM = row.match(slugRe);
    if (slugM) slug = slugM[1];
    
    // Fallback slug from any non-artist, non-pagination short link
    if (!slug) {
      const alt = row.match(/<a\b[^>]*href="\/([A-Za-z0-9_\-]+)"(?!\s+[^>]*class="tag")[^>]*>\s*<p>/i);
      if (alt) slug = alt[1];
    }
    
    // Genre + Mood tags from second <td width:15%> (the one with a.tag elements)
    const genreNames = [];
    const moodNames = [];
    // Find all <a class="tag">
    const tagRe = /<a\b[^>]*class="[^"]*tag[^"]*"[^>]*href="\/music-search\?(genre|mood)=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let tm;
    while ((tm = tagRe.exec(row)) !== null) {
      const [, type, id, nameHTML] = tm;
      const name = unescapeAttr(nameHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
      if (!name) continue;
      if (type === 'genre') {
        if (!genreNames.includes(name)) genreNames.push(name);
      } else {
        if (!moodNames.includes(name)) moodNames.push(name);
      }
    }
    // Primary genre fallback
    if (genreNames.length === 0 && genreFromBtn) genreNames.push(genreFromBtn);
    
    // Release date
    let releaseDate = '';
    const dateM = row.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/);
    if (dateM) {
      const mN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(dateM[2]) + 1;
      releaseDate = `${dateM[3]}-${String(mN).padStart(2,'0')}-${dateM[1].padStart(2,'0')}`;
    }
    
    const key = tid || audioUrl || slug || (title + '|' + artists);
    if (!title && !slug) continue;
    
    // Fallback audioUrl: build from tid (if S3 URL missing)
    const finalAudio = audioUrl || (tid ? `https://ncs.io/track/download/${tid}` : '');
    
    tracks.push({
      key,
      slug,
      title: title || slug || '',
      artists,
      coverUrl,
      audioUrl: finalAudio,
      genreNames,
      moodNames,
      releaseDate,
      version: versions || '',
      trackId: tid || '',
      trackPageUrl: slug ? `https://ncs.io/${slug}` : ''
    });
  }
  return tracks;
}

// ============ Queue ============
const CONCURRENCY = 10;
let running = 0;
let qIdx = 0;
let queue = [];
let lastSave = Date.now();

async function runTask(task) {
  running++;
  try {
    state.totalCalls++;
    if (task.type === 'page') {
      const page = task.page;
      const url = `https://ncs.io/music-search?page=${page}`;
      process.stdout.write(`\r📄 p=${page}/${task.total} uniq=${Object.keys(state.tracks).length} run=${running} calls=${state.totalCalls} errs=${state.errors}   `);
      const resp = await fetchURL(url);
      if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`);
      const tracks = parseListPage(resp.body);
      for (const t of tracks) {
        const k = t.key; delete t.key;
        if (!state.tracks[k]) {
          state.tracks[k] = t;
        } else {
          const ex = state.tracks[k];
          if (!ex.coverUrl && t.coverUrl) ex.coverUrl = t.coverUrl;
          if (!ex.audioUrl && t.audioUrl) ex.audioUrl = t.audioUrl;
          if (!ex.artists && t.artists) ex.artists = t.artists;
          if (!ex.slug && t.slug) { ex.slug = t.slug; ex.trackPageUrl = t.trackPageUrl; }
          if (!ex.releaseDate && t.releaseDate) ex.releaseDate = t.releaseDate;
          if (!ex.version && t.version) ex.version = t.version;
          t.genreNames.forEach(g => { if (!ex.genreNames.includes(g)) ex.genreNames.push(g); });
          t.moodNames.forEach(m => { if (!ex.moodNames.includes(m)) ex.moodNames.push(m); });
        }
      }
      state.pagesDone[page] = true;
    }
  } catch (e) {
    state.errors++;
    if (task.type === 'page' && !task._retry) {
      queue.push({ ...task, _retry: true });
    }
  }
  running--;
  const now = Date.now();
  if (now - lastSave > 10000) {
    saveState(); saveCatalog();
    lastSave = now;
  }
}

async function drain() {
  while (qIdx < queue.length) {
    while (running >= CONCURRENCY) await new Promise(r => setTimeout(r, 50));
    if (qIdx >= queue.length) break;
    runTask(queue[qIdx++]);
    await new Promise(r => setTimeout(r, 25));
  }
  while (running > 0) await new Promise(r => setTimeout(r, 200));
}

async function debugMode() {
  console.log('🧪 DEBUG: parsing saved files...');
  const f = path.join(__dirname, '__debug_https_ncs_io_music_search.html');
  if (!fs.existsSync(f)) { console.log('No debug file.'); return; }
  const html = fs.readFileSync(f, 'utf8');
  const tracks = parseListPage(html);
  console.log(`  Tracks: ${tracks.length}\n`);
  tracks.slice(0, 5).forEach((t, i) => {
    delete t.key;
    console.log(`  [${i+1}] ${JSON.stringify(t, null, 2).split('\n').map(l=>'    '+l).join('\n')}\n`);
  });
  const missing = { artist: 0, audio: 0, cover: 0, date: 0 };
  tracks.forEach(t => {
    if (!t.artists) missing.artist++;
    if (!t.audioUrl) missing.audio++;
    if (!t.coverUrl) missing.cover++;
    if (!t.releaseDate) missing.date++;
  });
  console.log('Missing:', JSON.stringify(missing));
  console.log('Max page:', parseMaxPage(html));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--debug')) { await debugMode(); return; }
  
  // Discover max page from page 1
  let maxPage = 99;
  try {
    process.stdout.write('🔍 Fetching page 1 for pagination + pre-parse...');
    const r = await fetchURL('https://ncs.io/music-search?page=1');
    if (r.statusCode === 200) {
      maxPage = parseMaxPage(r.body);
      const p1 = parseListPage(r.body);
      for (const t of p1) { const k = t.key; delete t.key; state.tracks[k] = t; }
      state.pagesDone[1] = true;
      state.totalCalls++;
      process.stdout.write(` ok (maxPage=${maxPage}, p1tracks=${p1.length})\n`);
    }
  } catch (e) { process.stdout.write(` err ${e.message}, using default 99\n`); }
  
  const startPage = parseInt(args[0]) || 1;
  const endPage = Math.min(parseInt(args[1]) || maxPage, maxPage);
  
  console.log(`\n🚀 NCS.io scrape: pages ${startPage}-${endPage} of ${maxPage}`);
  console.log(`   Concurrency=${CONCURRENCY}  Prior tracks=${Object.keys(state.tracks).length}  Prior pages=${Object.keys(state.pagesDone).length}\n`);
  
  for (let p = startPage; p <= endPage; p++) {
    if (!state.pagesDone[p]) queue.push({ type: 'page', page: p, total: endPage });
  }
  console.log(`   Queue: ${queue.length} pages`);
  await drain();
  console.log('');
  saveState(); saveCatalog();
  
  const total = Object.keys(state.tracks).length;
  const wc = Object.values(state.tracks).filter(s => s.coverUrl).length;
  const wa = Object.values(state.tracks).filter(s => s.audioUrl).length;
  const wart = Object.values(state.tracks).filter(s => s.artists).length;
  console.log(`\n🏁 DONE in ${Math.round((Date.now()-state.startedAt)/1000)}s`);
  console.log(`   Total tracks : ${total}`);
  console.log(`   With cover   : ${wc} (${(wc/total*100).toFixed(1)}%)`);
  console.log(`   With audio   : ${wa} (${(wa/total*100).toFixed(1)}%)`);
  console.log(`   With artists : ${wart} (${(wart/total*100).toFixed(1)}%)`);
  console.log(`   Genres known : ${new Set(Object.values(state.tracks).flatMap(s=>s.genreNames)).size}`);
  console.log(`   Moods known  : ${new Set(Object.values(state.tracks).flatMap(s=>s.moodNames)).size}`);
}

main().catch(e => { console.error('\nFATAL:', e); process.exit(1); });
