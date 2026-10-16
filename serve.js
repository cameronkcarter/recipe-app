// Tiny local web server (no installs needed): `node serve.js`, then open http://localhost:5173
// Your phone on the same Wi-Fi can open http://<this-computer's-IP>:5173 too.
//
// Also provides /api/page?url=... which downloads a web page for recipe import (browsers can't
// fetch other sites directly). The online version uses a public page reader instead.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

// ---------- Page fetch for recipe import ----------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

// Many recipe sites (behind Cloudflare) refuse Node's built-in fetch but accept curl,
// which ships with Windows 10+, macOS and Linux. So try curl first, then fetch.
function curlGet(url) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-s', '-L', '--compressed', '--max-time', '12', '-A', UA,
      '-H', 'Accept: text/html,application/xhtml+xml', '-H', 'Accept-Language: en-US,en;q=0.9',
      '-w', '\n__STATUS__%{http_code}', url],
      { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
        if (err) return reject(err);
        const i = stdout.lastIndexOf('\n__STATUS__');
        resolve({ status: +stdout.slice(i + 11), html: stdout.slice(0, i) });
      });
  });
}
async function fetchGet(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
    return { status: res.status, html: await res.text() };
  } finally { clearTimeout(timer); }
}

async function getPage(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('That doesn’t look like a web link.');
  let page;
  try { page = await curlGet(url); } catch (e) { page = null; }
  if (!page || page.status >= 400 || !page.html) {
    try { page = await fetchGet(url); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'The site took too long to respond.' : 'Couldn’t reach that site.'); }
  }
  if (page.status >= 400) throw new Error(`The site blocked the request (error ${page.status}).`);
  return { html: page.html };
}

// ---------- Server ----------
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');

  if (u.pathname === '/api/page') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const data = await getPage(u.searchParams.get('url') || '');
      res.end(JSON.stringify(data));
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  const urlPath = decodeURIComponent(u.pathname);
  const file = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': (TYPES[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).on('error', e => {
  if (e.code === 'EADDRINUSE') { console.log(`The app is already running — open http://localhost:${PORT}`); process.exit(0); }
  throw e;
}).listen(PORT, () => console.log(`Recipe app running at http://localhost:${PORT}`));
