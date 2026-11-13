// 오프라인용 Service Worker
// - 앱 화면과 코드: 설치할 때 미리 저장, 이후에는 저장본을 먼저 쓰고 뒤에서 최신으로 갱신
// - 화면(HTML): 인터넷이 되면 최신(3초 안에 응답 없으면 저장본), 안 되면 저장본
// - 이름 사전: 홈 화면 웹앱이 "오프라인 준비"를 요청하면 통합본(full.json)을 한 번 저장하고,
//   인터넷이 없을 때 글자별 조각 요청을 통합본에서 만들어 돌려준다
const VERSION = 'nl-app-2026-11-13a';      // 코드를 바꾸면 이 값을 올린다
const DICT_CACHE = 'nl-dict-v1';           // 사전을 다시 만들면 이 값을 올린다
const DICT_FULL = new URL('./dict/full.json', self.location).href;

const SHELL = [
  './', './index.html', './print.html', './manifest.webmanifest',
  './convert.mjs', './input.mjs', './rank.mjs', './reading.mjs', './honorific.mjs',
  './payload.mjs', './label.mjs', './keepsake.mjs',
  './vendor/qrcode.mjs', './vendor/jsQR.js', './vendor/niimbluelib.min.js',
  './dict/kanji.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== DICT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ── 페이지와의 메시지: 오프라인 준비 / 상태 확인 ──
self.addEventListener('message', e => {
  const port = e.ports[0];
  if (e.data === 'prepare-offline') {
    e.waitUntil((async () => {
      try {
        const c = await caches.open(DICT_CACHE);
        if (!(await c.match(DICT_FULL))) {
          const r = await fetch(DICT_FULL, { cache: 'no-cache' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          await c.put(DICT_FULL, r);
        }
        port?.postMessage({ ready: true });
      } catch (err) { port?.postMessage({ ready: false, error: String(err) }); }
    })());
  }
  if (e.data === 'status') {
    e.waitUntil(caches.open(DICT_CACHE).then(c => c.match(DICT_FULL)).then(r => port?.postMessage({ ready: !!r })));
  }
});

// ── 통합본에서 글자별 조각 만들기 ──
let indexP = null;
function shardIndex() {
  indexP ??= caches.open(DICT_CACHE).then(c => c.match(DICT_FULL)).then(async r => {
    if (!r) { indexP = null; return null; }
    const full = await r.json(), idx = new Map();
    for (const kind of ['s', 'g']) for (const [k, v] of Object.entries(full[kind])) {
      const ch = String.fromCodePoint(k.codePointAt(0));
      if (!idx.has(ch)) idx.set(ch, { s: {}, g: {} });
      idx.get(ch)[kind][k] = v;
    }
    return idx;
  });
  return indexP;
}
const json = obj => new Response(JSON.stringify(obj), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

async function shard(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  try {
    const r = await fetch(request);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);   // 공유기·프록시 오류 페이지도 실패로 본다
    (await caches.open(DICT_CACHE)).put(request, r.clone());
    return r;
  } catch {
    const hex = new URL(request.url).pathname.split('/').pop().replace('.json', '');
    const idx = await shardIndex();
    return json(idx?.get(String.fromCodePoint(parseInt(hex, 16))) ?? { s: {}, g: {} });
  }
}

async function page(request) {
  const cache = await caches.open(VERSION);
  try {
    const r = await Promise.race([fetch(request), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 3000))]);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    cache.put(request, r.clone());
    return r;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match('./index.html')) ?? Response.error();
  }
}

async function asset(request, event) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request, { ignoreSearch: true });
  const update = fetch(request).then(r => { if (r.ok) cache.put(request, r.clone()); return r; }).catch(() => null);
  if (hit) { event.waitUntil(update); return hit; }
  return (await update) ?? Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const path = new URL(req.url).pathname;
  if (req.mode === 'navigate') return e.respondWith(page(req));
  if (path.includes('/dict/shard/')) return e.respondWith(shard(req));
  if (req.url === DICT_FULL) return e.respondWith(caches.match(req).then(r => r ?? fetch(req)));
  e.respondWith(asset(req, e));
});
