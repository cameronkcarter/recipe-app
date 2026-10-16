// Tiny local web server (no installs needed): `node serve.js`, then open http://localhost:5173
// Your phone on the same Wi-Fi can open http://<this-computer's-IP>:5173 too.
//
// Also provides /api/import?url=... which fetches a recipe page and returns the structured
// recipe data most recipe sites embed (schema.org "Recipe" JSON-LD). Browsers can't fetch
// other sites directly, so this has to happen on a server. When the app is hosted later,
// this same function moves to a serverless function.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

// ---------- Recipe import ----------
const decode = s => String(s ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, "'")
  .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&frac12;/g, '½').replace(/&frac14;/g, '¼').replace(/&frac34;/g, '¾')
  .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
  .replace(/\s+/g, ' ').trim();

function findRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  const type = node['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return node;
  return findRecipe(node['@graph']) || findRecipe(node.mainEntity) || null;
}

// Instructions come as strings, HowToStep objects, or HowToSection groups — flatten to strings.
function flattenSteps(ins) {
  if (!ins) return [];
  if (typeof ins === 'string') return ins.split(/\n+|(?<=\.)\s+(?=\d+\.\s)/).map(decode).filter(Boolean);
  if (Array.isArray(ins)) return ins.flatMap(flattenSteps);
  if (ins.itemListElement) return flattenSteps(ins.itemListElement);
  return [decode(ins.text || ins.name || '')].filter(Boolean);
}

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

async function importRecipe(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('That doesn’t look like a web link.');
  let page;
  try { page = await curlGet(url); } catch (e) { page = null; }
  if (!page || page.status >= 400 || !page.html) {
    try { page = await fetchGet(url); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'The site took too long to respond.' : 'Couldn’t reach that site.'); }
  }
  if (page.status >= 400) throw new Error(`The site blocked the request (error ${page.status}). Try “Paste list” in the editor instead.`);
  const html = page.html;

  let recipe = null;
  for (const m of html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { recipe = findRecipe(JSON.parse(m[1].trim())); } catch (e) { /* skip broken blocks */ }
    if (recipe) break;
  }
  if (!recipe) throw new Error('Couldn’t find recipe info on that page. Try the site’s main recipe page, or use “Paste list” in the editor.');

  const yieldVal = [].concat(recipe.recipeYield || []).map(String).find(y => /\d/.test(y));
  return {
    name: decode(recipe.name),
    servings: yieldVal ? parseInt(yieldVal.match(/\d+/)[0], 10) : null,
    ingredients: [].concat(recipe.recipeIngredient || recipe.ingredients || []).map(decode).filter(Boolean),
    steps: flattenSteps(recipe.recipeInstructions),
    source: url,
  };
}

// ---------- Server ----------
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');

  if (u.pathname === '/api/import') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const data = await importRecipe(u.searchParams.get('url') || '');
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
