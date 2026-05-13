// ═══════════════════════════════════════════════════════════════
// GÉNÉRATION A7 — SERVICE WORKER v2.0
// Stratégie : Cache-First pour les assets, Network-First pour l'HTML
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'a7-pwa-v2';
const OFFLINE_URL = 'index.html';

// Assets à mettre en cache lors de l'installation
const PRECACHE_ASSETS = [
  'index.html',
  'manifest.json'
];

// ── INSTALL : pré-cache des ressources essentielles ──
self.addEventListener('install', event => {
  console.log('[SW] Installation v2...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).then(() => {
        console.log('[SW] Pré-cache OK');
        // Ne pas attendre — activer immédiatement
        return self.skipWaiting();
      });
    }).catch(err => {
      console.warn('[SW] Pré-cache partiel:', err);
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE : nettoyage des anciens caches ──
self.addEventListener('activate', event => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Suppression cache obsolète:', key);
              return caches.delete(key);
            })
      );
    }).then(() => {
      console.log('[SW] Actif — contrôle de tous les clients');
      return self.clients.claim();
    })
  );
});

// ── MESSAGE : skip waiting (pour mise à jour immédiate) ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting reçu');
    self.skipWaiting();
  }
});

// ── FETCH : stratégie de cache ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les extensions du navigateur
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.protocol === 'moz-extension:') return;

  // Ressources externes (CDN fonts, Remix Icon, jsPDF…)
  if (!url.origin.includes(self.location.origin) && !isAllowedExternal(url)) {
    event.respondWith(networkWithCache(request));
    return;
  }

  // HTML principal → Network-First (toujours fraîche si possible)
  if (request.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Tout le reste → Cache-First
  event.respondWith(cacheFirst(request));
});

// ── Domaines externes autorisés à être mis en cache ──
function isAllowedExternal(url) {
  const allowed = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'remixicon.com'
  ];
  return allowed.some(d => url.hostname.includes(d));
}

// ── Stratégie : Cache-First ──
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback();
  }
}

// ── Stratégie : Network-First ──
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback();
  }
}

// ── Stratégie : Network avec mise en cache ──
async function networkWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineFallback();
  }
}

// ── Page de secours hors ligne ──
function offlineFallback() {
  return caches.match(OFFLINE_URL).then(cached => {
    if (cached) return cached;
    // Minimal fallback si l'app n'est pas encore en cache
    return new Response(
      `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Génération A7 — Hors ligne</title>
<style>body{font-family:system-ui;background:#0d0a06;color:#fef3c7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}
.box{max-width:320px}.icon{font-size:64px;margin-bottom:16px}.title{font-size:24px;font-weight:800;color:#f59e0b;margin-bottom:8px}.sub{color:#9a7a50;font-size:14px;line-height:1.5}</style>
</head>
<body><div class="box">
  <div class="icon">📡</div>
  <div class="title">Hors connexion</div>
  <div class="sub">L'application Génération A7 nécessite une connexion internet lors du premier chargement.<br><br>Reconnectez-vous puis réouvrez l'application.</div>
</div></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  });
}
