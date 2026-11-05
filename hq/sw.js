// 『最終講義』：ネットがない会場でも開けるようにする仕組み（2026-11-05）
// ・まずネットから最新のページを取りに行く（つながれば、いつも最新の版）。取れたら控えとして保存する。
// ・ネットにつながらない、または4秒たっても返事がないときだけ、前に開いたときの控えを出す。
// ・ページは three.js・フォント・光の絵まで全部入りの1ファイルなので、控えるのはページ1枚で足りる。
const CACHE = "final-lecture-v1";
const WAIT_MS = 4000;

self.addEventListener("install", () => { self.skipWaiting(); });
// 最初に開いたときのページはまだ sw.js を通っていないので、働き始めたときにページ1枚を取って控えておく（1回開くだけでネットなしでも開けるように）
self.addEventListener("activate", (e) => {
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.open(CACHE).then((c) => c.match(self.registration.scope).then((hit) => hit || c.add(self.registration.scope))).catch(() => {}),
  ]));
});

function fromNetwork(req) {
  return fetch(req).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const useCache = () => caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (done) return;
      if (hit) { done = true; resolve(hit); }
    });
    const timer = setTimeout(useCache, WAIT_MS);
    fromNetwork(req).then((res) => {
      clearTimeout(timer);
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      caches.match(req, { ignoreSearch: true }).then((hit) => {
        if (done) return;
        done = true;
        resolve(hit || new Response("ネットにつながっていません。一度ネットにつながった状態でこのページを開くと、次からはネットなしでも開けます。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }));
      });
    });
  }));
});
