#!/usr/bin/env node
// Incremental sync of NCS latest releases (pages 1..N).
// Merges any new songs into existing catalog.json, updates meta.scrapedAt,
// and writes catalog.json back (overwriting the old one).
// If nothing changed, we still update scrapedAt only.
// Designed for GitHub Actions cron usage (netlify auto-deploys on push).

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const https = require('https');
const zlib = require('zlib');

const ROOT = __dirname;
const IN_PATH = join(ROOT, 'catalog.json');
const OUT_PATH = join(ROOT, 'catalog.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function httpGet(url){
  return new Promise((resolve, reject)=>{
    const u = new URL(url);
    const req = https.request({
      method:'GET',
      hostname: u.hostname,
      path: u.pathname + u.search,
      port:443,
      headers:{
        'User-Agent': UA,
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language':'en-US,en;q=0.9',
        'Accept-Encoding':'gzip, deflate, br',
        'Cache-Control':'no-cache'
      },
      timeout: 30000
    }, (res)=>{
      if(res.statusCode >= 300 && res.statusCode < 400 && res.headers.location){
        const loc = /^https?:/.test(res.headers.location) ? res.headers.location : ('https://'+u.hostname+res.headers.location);
        return resolve(httpGet(loc));
      }
      if(res.statusCode !== 200){
        let body = '';
        res.setEncoding('utf8');
        res.on('data', c => body += c);
        res.on('end', ()=> reject(new Error('HTTP '+res.statusCode+' '+res.statusMessage+' '+url)));
        return;
      }
      let stream = res;
      const ce = (res.headers['content-encoding']||'').toLowerCase();
      if(ce.includes('br')) stream = stream.pipe(zlib.createBrotliDecompress());
      else if(ce.includes('gzip')) stream = stream.pipe(zlib.createGunzip());
      else if(ce.includes('deflate')) stream = stream.pipe(zlib.createInflate());
      let buf = [];
      stream.on('data', c => buf.push(c));
      stream.on('end', ()=> resolve(Buffer.concat(buf).toString('utf8')));
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', ()=>{ req.destroy(new Error('timeout '+url)); });
    req.end();
  });
}

function escUrl(u){ return (u||'').replace(/^\/\//, 'https://').replace(/\s/g, '').trim(); }
function unescapeAttr(s){ return String(s||'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function clean(s){ return (s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim(); }

function parseTracksFromListHtml(html){
  const out = [];
  if(!html) return out;
  const rowRe = /<div[\s\S]*?data-track-type=["']track["'][\s\S]*?(?:\/div>\s*<\/div>|<\/div>\s*<\/div>|<\/div>\s*$)/gi;
  const anchorRe = /<a[\s\S]*?class=["'][^"']*\bplayer-play\b[^"']*["'][\s\S]*?<\/a>/gi;
  const anchors = html.match(anchorRe) || [];
  for(const a of anchors){
    const get = (name) => {
      const re = new RegExp(`data-${name}="([\\s\\S]*?)"(?=\\s+[a-z-]+="|\\s*>|\\s*$)`, 'i');
      const m = a.match(re);
      return m ? unescapeAttr(m[1]) : '';
    };
    const audioUrl = get('url');
    const title = clean(get('track'));
    const artists = clean(get('artistraw'));
    const coverRaw = get('cover');
    const genreFromBtn = get('genre');
    const tid = get('tid');
    const versions = get('versions');
    const album = clean(get('album'));
    const duration = clean(get('duration'));
    const bpm = Number(get('bpm'))||0;
    const released = clean(get('released'));
    const moods = clean(get('mood')).split(/[,，;]+/).map(s=>s.trim()).filter(Boolean);
    const genresAll = [];
    [genreFromBtn, album].forEach(x =>{
      if(x){
        x.split(/[,，/]+/).map(s=>s.trim()).filter(Boolean).forEach(g=>{
          if(!genresAll.includes(g)) genresAll.push(g);
        });
      }
    });
    if(!audioUrl || !title) continue;
    const coverUrl = (() => {
      const c = coverRaw;
      if(!c) return '';
      const url = c.replace(/^\/\//,'https://');
      if(/no-track\.png|100x100_ncs|default|avatar_placeholder/.test(url)) return '';
      return url.replace(/\/100x100\//g,'/325x325/').replace(/\/100_/g,'/325_');
    })();
    out.push({
      title, artists: artists || 'Unknown',
      audioUrl: escUrl(audioUrl),
      coverUrl: coverUrl || '',
      genreNames: genresAll,
      moodNames: moods,
      releaseDate: released,
      bpm, duration, album,
      tid: tid || '',
      versions: versions || '',
      ncsPage: 0
    });
  }
  return out;
}

async function main(){
  const pages = Number(process.env.NCS_SYNC_PAGES || process.argv[2] || 5);
  const json = existsSync(IN_PATH) ? JSON.parse(readFileSync(IN_PATH, 'utf8')) : null;
  const existing = (json && Array.isArray(json.tracks)) ? json.tracks.slice() : [];
  const byAudio = new Map(existing.map(t => [t.audioUrl, t]));
  let added = 0, updatedCover = 0;

  console.log('[sync] existing tracks:', existing.length, '; checking pages: 1..'+pages);

  for(let p = 1; p <= pages; p++){
    const url = `https://ncs.io/music-search?q=&genre=&mood=&page=${p}`;
    console.log(`[sync] fetch page ${p}/${pages} ...`);
    let html = '';
    try{ html = await httpGet(url); }
    catch(e){ console.error('[sync] error page '+p+':', e.message); continue; }
    const tracks = parseTracksFromListHtml(html);
    if(tracks.length === 0){ console.warn('[sync] page '+p+' no tracks parsed, break.'); break; }
    for(const t of tracks){
      const prior = byAudio.get(t.audioUrl);
      if(!prior){
        t.firstSeen = new Date().toISOString();
        existing.unshift(t);
        byAudio.set(t.audioUrl, t);
        added++;
      }else{
        // enrich
        if(t.coverUrl && (!prior.coverUrl || /no-track|100x100_ncs|default/.test(prior.coverUrl) || prior.coverUrl.includes('100x100'))){
          prior.coverUrl = t.coverUrl; updatedCover++;
        }
        if(t.genreNames){ for(const g of t.genreNames){ if(!prior.genreNames) prior.genreNames=[]; if(!prior.genreNames.includes(g)) prior.genreNames.push(g); }}
        if(t.moodNames){ for(const m of t.moodNames){ if(!prior.moodNames) prior.moodNames=[]; if(!prior.moodNames.includes(m)) prior.moodNames.push(m); }}
        if(!prior.artists || prior.artists === 'Unknown'){ if(t.artists && t.artists !== 'Unknown') prior.artists = t.artists; }
        if(t.releaseDate && !prior.releaseDate) prior.releaseDate = t.releaseDate;
        if(t.bpm && !prior.bpm) prior.bpm = t.bpm;
      }
    }
    await new Promise(r => setTimeout(r, 250));
  }

  const gSet = new Set(), mSet = new Set();
  existing.forEach(t => { (t.genreNames||[]).forEach(g => gSet.add(g)); (t.moodNames||[]).forEach(m => mSet.add(m)); });
  const out = {
    meta: {
      source: 'ncs.io incremental sync',
      scrapedAt: new Date().toISOString(),
      pagesChecked: pages,
      tracks: existing.length,
      withCover: existing.filter(t=>t.coverUrl).length,
      withAudio: existing.filter(t=>t.audioUrl).length,
      withArtist: existing.filter(t=>t.artists && t.artists!=='Unknown').length,
      genres: gSet.size,
      moods: mSet.size
    },
    tracks: existing
  };

  writeFileSync(OUT_PATH, JSON.stringify(out, null, 0));
  console.log('[sync] done. added='+added+' updatedCover='+updatedCover+' total='+existing.length+' genres='+gSet.size+' moods='+mSet.size);
  process.exit(0);
}

main().catch(e=>{ console.error('[sync] FATAL', e); process.exit(1); });
