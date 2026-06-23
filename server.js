const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT          = 8765;
const ROOT          = __dirname;
const OVERRIDE_FILE = path.join(ROOT, 'maps_override.js');

const MIME = {
  '.html':'.txt/html',
  '.js'  :'application/javascript',
  '.css' :'text/css',
  '.png' :'image/png',
  '.jpg' :'image/jpeg',
  '.jpeg':'image/jpeg',
  '.json':'application/json',
  '.ico' :'image/x-icon',
  '.mp3' :'audio/mpeg',
  '.ogg' :'audio/ogg',
  '.wav' :'audio/wav',
};
// 正しいMIMEに修正
MIME['.html'] = 'text/html; charset=utf-8';

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // POST /api/save-maps → maps_override.js を上書きして index.html も自動更新
  if (req.method === 'POST' && req.url === '/api/save-maps') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        fs.writeFileSync(OVERRIDE_FILE, body, 'utf8');
        console.log('[保存] maps_override.js 更新完了');

        // maps_override.js のデータを buildGramanCastle01/Town01 に焼き込む
        try {
          const w = {};
          new Function('window', body)(w);
          const maps = w.GQ_MAP_OVERRIDES || {};
          const INDEX_FILE = path.join(ROOT, 'index.html');
          let html = fs.readFileSync(INDEX_FILE, 'utf8');
          let changed = false;

          const bake = (key1, key2, funcName, label) => {
            const m = maps[key1] || maps[key2];
            if (!m) return;
            const func = `function ${funcName}() {\n    const W = ${m.width}, H = ${m.height};\n    const tiles = ${JSON.stringify(m.tiles)};\n    const exits = ${JSON.stringify(m.exits||{})};\n    const npcs  = ${JSON.stringify(m.npcs||{})};\n    return {width:W,height:H,tiles,exits,npcs,name:"${label}"};\n}`;
            const start = html.indexOf(`function ${funcName}()`);
            if (start < 0) return;
            const end = html.indexOf('\nfunction ', start + 50);
            if (end < 0) return;
            html = html.slice(0, start) + func + html.slice(end);
            changed = true;
            console.log(`[焼込] ${funcName} 更新 (${m.width}x${m.height})`);
          };

          bake('castle_01', 'map_castle_01',  'buildGramanCastle01', 'グラマニア城');
          bake('town_01',   'map_town_01',    'buildGramanTown01',   'グラマニア城下町');

          if (changed) fs.writeFileSync(INDEX_FILE, html, 'utf8');
        } catch(e2) {
          console.error('[焼込エラー]', e2.message);
        }

        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true}));
      } catch(e) {
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:false, error:e.message}));
      }
    });
    return;
  }

  // GET 静的ファイル配信
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);

  // ディレクトリトラバーサル防止
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + urlPath); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    });
    res.end(data);
  });

}).listen(PORT, () => {
  console.log('');
  console.log('  ====================================');
  console.log('   Gravity Quest サーバー起動中');
  console.log('  ====================================');
  console.log('');
  console.log('   ゲーム   → http://localhost:' + PORT + '/');
  console.log('   エディタ → http://localhost:' + PORT + '/editor.html');
  console.log('');
  console.log('   停止: Ctrl+C');
  console.log('  ====================================');
});
