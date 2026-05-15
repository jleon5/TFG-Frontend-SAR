// =========================================================================
// SAR AI SYSTEM C2 PRO — Service Worker
// Estrategia: Cache-First para assets estáticos y modelo ONNX.
//             Network-Only para llamadas al backend (Ngrok).
// =========================================================================

const CACHE_VERSION = 'sar-c2-v5';

// Assets críticos que se pre-cachean en la instalación.
// Sin estos, la app no puede arrancar offline.
const PRECACHE_ASSETS = [
  './index.html',
  './best_yolo26.onnx',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Assets de CDN que se cachean la primera vez que se usan
// (estrategia Stale-While-Revalidate).
const CDN_ORIGINS = [
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// Hosts de backend: NUNCA cachear, siempre red.
const NETWORK_ONLY_HOSTS = [
  'ngrok-free.dev',
  'ngrok-free.app',
  'ngrok.io',
  'ngrok.app',
];


// -------------------------------------------------------------------------
// INSTALL: pre-cachear assets críticos
// -------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando SAR C2 Service Worker...');
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      console.log('[SW] Pre-cacheando assets críticos...');
      // Intentamos cachear cada asset individualmente para no fallar en bloque
      // si algún CDN no responde en el momento de la instalación.
      const results = await Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn(`[SW] No se pudo pre-cachear: ${url}`, err);
          })
        )
      );
      const ok = results.filter(r => r.status === 'fulfilled').length;
      console.log(`[SW] Pre-cache completado: ${ok}/${PRECACHE_ASSETS.length} assets.`);
    })
  );
  // Activar inmediatamente sin esperar a que el tab actual se cierre
  self.skipWaiting();
});


// -------------------------------------------------------------------------
// ACTIVATE: limpiar cachés antiguas
// -------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando SAR C2 Service Worker...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log(`[SW] Eliminando caché antigua: ${key}`);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log('[SW] Service Worker activo y controlando todos los clientes.');
      return self.clients.claim();
    })
  );
});


// -------------------------------------------------------------------------
// FETCH: lógica de estrategia por tipo de recurso
// -------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 0. BYPASS PARA WATCHDOG (Fuerza pasar por la red física)
  if (url.searchParams.has('network_check')) {
    event.respondWith(fetch(request));
    return;
  }

  // 1. NETWORK-ONLY: llamadas al backend Ngrok — nunca cachear
  if (NETWORK_ONLY_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. El modelo ONNX es grande — Cache-First estricto
  //    Una vez descargado, siempre desde caché para no re-descargarlo.
  if (url.pathname.endsWith('.onnx') || url.pathname.endsWith('.wasm')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 3. CDN de terceros — Stale-While-Revalidate
  //    Responde desde caché inmediatamente y actualiza en background.
  if (CDN_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 4. Assets locales (index.html, iconos, manifest) — Cache-First
  if (url.origin === self.location.origin) {
    if (url.searchParams.has('network_check')) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(cacheFirst(request));
    return;
  }

  // 5. Cualquier otra request — intentar red con fallback a caché
  event.respondWith(networkWithCacheFallback(request));
});


// -------------------------------------------------------------------------
// ESTRATEGIAS DE CACHÉ
// -------------------------------------------------------------------------

/**
 * Cache-First: devuelve caché si existe, si no va a red y cachea el resultado.
 * Ideal para assets estáticos y el modelo ONNX.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Cache-First: sin red y sin caché para', request.url);
    return offlineFallback(request);
  }
}

/**
 * Stale-While-Revalidate: responde con caché inmediatamente y actualiza en background.
 * Ideal para CDN de terceros (Tailwind, Chart.js, etc.).
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || await networkFetch || offlineFallback(request);
}

/**
 * Network-With-Cache-Fallback: intenta red primero, si falla usa caché.
 */
async function networkWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

/**
 * Fallback offline: devuelve el index.html cacheado para rutas de navegación.
 */
async function offlineFallback(request) {
  if (request.destination === 'document') {
    const cached = await caches.match('./index.html');
    if (cached) return cached;
  }
  return new Response(
    JSON.stringify({ error: 'SAR C2: sin conexión y recurso no cacheado.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}


// -------------------------------------------------------------------------
// MENSAJE: forzar actualización desde la UI (para futuras versiones)
// -------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Actualización forzada recibida.');
    self.skipWaiting();
  }
});
