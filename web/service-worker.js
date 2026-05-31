/**
 * service-worker.js — Service Worker de la PWA Dacmos Password Manager
 *
 * Estrategia de caché:
 *  - Assets estáticos (JS, CSS, HTML, íconos): CacheFirst
 *  - Fallback offline: servir offline.html si la red falla y el
 *    recurso no está en caché
 *
 * Workbox se carga via CDN de Google Storage.
 * NOTA: importScripts() en Service Workers no soporta el atributo
 * integrity de Subresource Integrity (SRI) como lo hacen las etiquetas
 * <script> en HTML. La mitigación aplicada es:
 *  1. Fijar la URL a una versión exacta (7.0.0) — nunca un "latest"
 *  2. La directiva CSP worker-src 'self' https://storage.googleapis.com
 *     en _headers limita de dónde puede cargarse código en el SW
 */
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js'
)

/* ── Configuración global de nombres de caché ──────────────────────────
   El prefijo 'dacmos-pm' separa estos cachés de cualquier otro origen
   que pudiera compartir el mismo dominio en el futuro. */
workbox.core.setCacheNameDetails({
  prefix: 'dacmos-pm',
  suffix: 'v1',
  precache: 'precache',
  runtime: 'runtime',
})

/* ── Nombre del caché de assets estáticos ──────────────────────────────
   Usado tanto en la ruta de runtime (CacheFirst) como en el precache
   de offline.html. */
const CACHE_ASSETS = 'dacmos-assets-v1'

/* ── Precache de offline.html ──────────────────────────────────────────
   Al instalar el SW, offline.html queda guardado en caché para poder
   servirlo aunque no haya red. */
/* ── Precache de assets estáticos (Condición 3: lista explícita) ──────
   Se listan individualmente — sin globs — para control preciso de qué
   se cachea y qué revisión fuerza la actualización del precache.
   Incrementar 'revision' cuando el contenido del archivo cambia. */
workbox.precaching.precacheAndRoute([
  { url: '/offline.html',                              revision: '1' },

  /* ── Estilos ── */
  { url: '/src/ui/styles/main.css',                    revision: '1' },

  /* ── Router y layout ── */
  { url: '/src/ui/router.js',                          revision: '1' },
  { url: '/src/ui/layout/nav-bottom.js',               revision: '1' },

  /* ── Componentes ── */
  { url: '/src/ui/components/swipe-card.js',           revision: '1' },

  /* ── Vistas ── */
  { url: '/src/ui/views/setup.js',                     revision: '1' },
  { url: '/src/ui/views/unlock.js',                    revision: '1' },
  { url: '/src/ui/views/vault.js',                     revision: '1' },
  { url: '/src/ui/views/credential-form.js',           revision: '1' },
  { url: '/src/ui/views/health.js',                    revision: '1' },
  { url: '/src/ui/views/generator.js',                 revision: '1' },
  { url: '/src/ui/views/settings.js',                  revision: '1' },

  /* ── Onboarding ── */
  { url: '/src/ui/onboarding/pwa-install.js',          revision: '1' },

  /* ── Storage (F4.5) ── */
  { url: '/src/storage/persistence-manager.js',        revision: '1' },
  { url: '/src/storage/session.js',                    revision: '1' },

  /* ── Health (fork) ── */
  { url: '/src/health/password-health.js',             revision: '1' },
])

/* ── Estrategia CacheFirst para assets estáticos ──────────────────────
   Primera visita: descarga y almacena en caché.
   Visitas siguientes: sirve desde caché sin tocar la red.
   Ideal para archivos cuyo nombre incluye hash de versión (JS, CSS)
   y para íconos que cambian raramente. */
workbox.routing.registerRoute(
  /* Captura todas las rutas del mismo origen que terminen en
     extensiones de assets estáticos */
  ({ request }) => {
    const destino = request.destination
    return (
      destino === 'script'   ||
      destino === 'style'    ||
      destino === 'image'    ||
      destino === 'font'     ||
      destino === 'manifest'
    )
  },
  new workbox.strategies.CacheFirst({
    cacheName: CACHE_ASSETS,
    plugins: [
      /* Expiración: máximo 30 días, máximo 60 entradas en caché */
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
)

/* ── Estrategia NetworkFirst para documentos HTML ─────────────────────
   Los documentos HTML (navegación) se intentan primero desde la red
   para recibir actualizaciones. Si la red falla, se sirve desde caché.
   Si tampoco hay caché, se sirve el fallback offline. */
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'document',
  new workbox.strategies.NetworkFirst({
    cacheName: 'dacmos-pages-v1',
    networkTimeoutSeconds: 5,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  })
)

/* ── Fallback offline para navegación ─────────────────────────────────
   Si la estrategia NetworkFirst agota el tiempo o la red falla y no
   hay entrada en caché, el SW responde con offline.html. */
workbox.routing.setCatchHandler(async ({ event }) => {
  /* Solo aplicar el fallback a peticiones de documentos (navegación) */
  if (event.request.destination === 'document') {
    return workbox.precaching.matchPrecache('/offline.html')
  }
  /* Para otros tipos de recursos fallidos, devolver error estándar */
  return Response.error()
})

/* ── Activación controlada por el usuario ─────────────────────────────
   La página envía { tipo: 'SKIP_WAITING' } cuando el usuario pulsa
   "Actualizar ahora" en el banner de actualización. Esto permite que
   el nuevo SW tome control sin interrumpir sesiones activas del vault —
   la decisión es siempre del usuario, nunca automática.

   IMPORTANTE: self.skipWaiting() NO se llama en ningún otro evento
   (install, activate, etc.) — solo en respuesta a este mensaje explícito. */
self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
