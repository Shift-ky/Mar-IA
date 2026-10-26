/* Generated with the application assets: no network bootstrap is needed on restart. */
const PRECACHE = __MAR_PRECACHE__;
const CACHE = 'mar-shell-v2-' + PRECACHE.version;
const SHELL = '/offline/';
const APP_ROUTES = new Set(['/', '/entrar', '/nova-senha', '/offline', '/offline/', '/offline/index.html']);
async function stored(path) {
  const current = await caches.open(CACHE);
  const hit = await current.match(path);
  if (hit) return hit;
  for (const key of (await caches.keys()).filter(k => k.startsWith('mar-shell-') && k !== CACHE).reverse()) {
    const old = await caches.open(key);
    const found = await old.match(path) || (path === SHELL ? await old.match('/offline/index.html') : undefined);
    if (found) return found;
  }
}
async function loadAsset(path) {
  const response = await fetch(path, {cache:'reload', credentials:'same-origin'});
  if (!response.ok) throw Error('Não foi possível preparar o arquivo offline: ' + path);
  const finalURL = new URL(response.url || path, self.location.origin);
  // Only the host's canonical index redirect is accepted, never a login page or another origin.
  if (response.redirected && (path !== SHELL || finalURL.origin !== self.location.origin || !['/offline/', '/offline/index.html'].includes(finalURL.pathname))) throw Error('Redirecionamento inesperado ao preparar o modo offline.');
  if (path === SHELL) {
    const text = await response.text();
    if (!text.includes('mar-offline-shell')) throw Error('Sessão necessária ou aplicação indisponível para preparar o modo offline.');
    return new Response(text, {status:200, headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  if (/\.(js|css)$/.test(path) && (response.headers.get('content-type') || '').includes('text/html')) throw Error('A hospedagem retornou uma página no lugar de um recurso offline.');
  return response;
}
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  for (const path of PRECACHE.files) await cache.put(path, await loadAsset(path));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Keep one previous complete version for tabs already open and interrupted updates.
  const old = (await caches.keys()).filter(k => k.startsWith('mar-shell-') && k !== CACHE);
  for (const key of old.slice(0, -1)) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data === 'READY') event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const missing = [];
    for (const path of PRECACHE.files) if (!await cache.match(path)) missing.push(path);
    event.ports[0]?.postMessage({ready:!missing.length, version:PRECACHE.version, missing});
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  // Auth tokens and financial API responses must never enter the public shell cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.includes('signin') || url.pathname.includes('signout') || url.pathname === '/callback') return;
  if (event.request.mode === 'navigate' && APP_ROUTES.has(url.pathname)) {
    event.respondWith((async () => {
      const shell = await stored(SHELL);
      if (shell) return shell;
      try { return await loadAsset(SHELL); }
      catch { return new Response('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>Mar IA</title><body style="background:#0A1E3A;color:white;font:18px system-ui;padding:32px"><h1>Mar IA</h1><p>Os arquivos do aplicativo ainda não estão disponíveis neste aparelho. Reconecte para concluir a preparação. Seus dados locais não foram apagados.</p><button onclick="location.reload()">Tentar novamente</button></body></html>', {status:503, headers:{'Content-Type':'text/html; charset=utf-8'}}); }
    })());
    return;
  }
  if (PRECACHE.files.includes(url.pathname) || url.pathname.startsWith('/offline/assets/')) event.respondWith((async () => {
    const cached = await stored(url.pathname);
    return cached || fetch(event.request);
  })());
});
