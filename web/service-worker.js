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

/* ── Identificador de deploy ───────────────────────────────────────────
   En desarrollo local siempre es 'dev'.
   El pipeline de CI (deploy-pwa.yml) reemplaza este valor con los
   primeros 7 caracteres del commit SHA antes de desplegar a Cloudflare
   Pages. Esto garantiza que cada deploy genera nombres de caché únicos,
   forzando a Workbox a descartar entradas obsoletas y refetchar todos
   los assets con sus versiones actualizadas. */
const SW_DEPLOY_ID = 'dev'

/* ── Configuración global de nombres de caché ──────────────────────────
   El prefijo 'dacmos-pm' separa estos cachés de cualquier otro origen
   que pudiera compartir el mismo dominio en el futuro.
   El suffix incluye SW_DEPLOY_ID para que cada deploy invalide
   automáticamente los cachés del deploy anterior. */
workbox.core.setCacheNameDetails({
  prefix: 'dacmos-pm',
  suffix: SW_DEPLOY_ID,
  precache: 'precache',
  runtime: 'runtime',
})

/* ── Nombre del caché de assets estáticos ──────────────────────────────
   Incluye SW_DEPLOY_ID para que cada deploy cree un caché nuevo.
   El listener 'activate' elimina los cachés del deploy anterior. */
const CACHE_ASSETS = `dacmos-assets-${SW_DEPLOY_ID}`

/* ── Precache de offline.html ──────────────────────────────────────────
   Al instalar el SW, offline.html queda guardado en caché para poder
   servirlo aunque no haya red. */
/* ── Precache de assets estáticos (Condición 3: lista explícita) ──────
   Se listan individualmente — sin globs — para control preciso de qué
   se cachea y qué revisión fuerza la actualización del precache.
   revision usa SW_DEPLOY_ID: Workbox detecta el cambio en cada deploy
   y descarga versiones frescas de todos los archivos. */
workbox.precaching.precacheAndRoute([
  { url: '/offline.html',                              revision: SW_DEPLOY_ID },

  /* ── Estilos ── */
  { url: '/src/ui/styles/main.css',                    revision: SW_DEPLOY_ID },

  /* ── Router y layout ── */
  { url: '/src/ui/router.js',                          revision: SW_DEPLOY_ID },
  { url: '/src/ui/layout/nav-bottom.js',               revision: SW_DEPLOY_ID },

  /* ── Componentes ── */
  { url: '/src/ui/components/swipe-card.js',           revision: SW_DEPLOY_ID },

  /* ── Vistas ── */
  { url: '/src/ui/views/setup.js',                     revision: SW_DEPLOY_ID },
  { url: '/src/ui/views/unlock.js',                    revision: SW_DEPLOY_ID },
  { url: '/src/ui/views/vault.js',                     revision: SW_DEPLOY_ID },
  { url: '/src/ui/views/credential-form.js',           revision: SW_DEPLOY_ID },
  { url: '/src/ui/views/health.js',                    revision: SW_DEPLOY_ID },
  { url: '/src/ui/views/generator.js',                 revision: SW_DEPLOY_ID },
  { url: '/src/ui/views/settings.js',                  revision: SW_DEPLOY_ID },

  /* ── Onboarding ── */
  { url: '/src/ui/onboarding/pwa-install.js',          revision: SW_DEPLOY_ID },

  /* ── Storage (F4.5) ── */
  { url: '/src/storage/persistence-manager.js',        revision: SW_DEPLOY_ID },
  { url: '/src/storage/session.js',                    revision: SW_DEPLOY_ID },

  /* ── Health (fork) ── */
  { url: '/src/health/password-health.js',             revision: SW_DEPLOY_ID },
])

/* ── Limpieza de cachés obsoletos en activación ────────────────────────
   Cuando un nuevo SW se activa (después de skipWaiting), este listener
   elimina todos los cachés 'dacmos-*' que pertenecen al deploy anterior.
   evento.waitUntil() garantiza que la limpieza termina antes de que el
   SW tome control de los clientes — sin ventanas de estado inconsistente. */
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) =>
            nombre.startsWith('dacmos-') && !nombre.includes(SW_DEPLOY_ID)
          )
          .map((nombre) => caches.delete(nombre))
      )
    )
  )
})

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
    cacheName: `dacmos-pages-${SW_DEPLOY_ID}`,
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
