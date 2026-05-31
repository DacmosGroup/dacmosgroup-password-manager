/**
 * app.js — Punto de entrada de la PWA Dacmos Password Manager
 *
 * Responsabilidades en F4.4 + F4.5:
 *  1. Registrar el Service Worker
 *  2. Inicializar MSAL.js v3 (F4.3 — requerido antes del primer uso de OneDrive)
 *  3. Capturar beforeinstallprompt temprano (F4.4 — antes de cualquier interacción)
 *  4. Montar la barra de navegación (nav-bottom / sidebar)
 *  5. Determinar la vista inicial según el estado del vault y la sesión
 *  6. Montar la vista inicial
 */

import { inicializar as inicializarMsal } from './auth/microsoft-auth.js'
import { idbStorage }                     from './storage/indexeddb-adapter.js'
import { montarNavBottom }                from './ui/layout/nav-bottom.js'
import { inicializarPwaInstall }          from './ui/onboarding/pwa-install.js'
import { montarVistaInicial }             from './ui/router.js'

/* ── Registro del Service Worker ──────────────────────────────────────
   Solo se intenta si el navegador lo soporta (todos los modernos sí).
   El SW vive en la raíz (/service-worker.js) para tener scope '/'
   y poder interceptar todas las rutas de la PWA. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // ── Service Worker ──
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(registro => {
        console.log('SW registrado — scope:', registro.scope)
        // Activar detección de actualizaciones disponibles
        _configurarActualizacionSW(registro)
      })
      .catch(error => {
        // El error de registro no es crítico — la PWA funciona sin SW
        // (solo pierde las capacidades offline y de caché)
        console.error('Error al registrar SW:', error)
      })

    // ── F4.3: inicializar MSAL en paralelo con el SW ──
    await inicializarMsal()

    // ── F4.4: capturar beforeinstallprompt antes de la primera interacción ──
    inicializarPwaInstall()

    // ── F4.4: montar la barra de navegación ──
    montarNavBottom()

    // ── F4.4: determinar y montar la vista inicial ──
    await _inicializarVista()
  })
} else {
  console.warn('Service Workers no disponibles en este navegador.')
}

/**
 * Determina qué vista mostrar al arrancar la PWA:
 *   - Sin vault configurado → setup (primera visita)
 *   - Con vault y sesión activa → vault (refresco dentro de sesión)
 *   - Con vault y sin sesión → unlock (retorno después de cerrar pestaña)
 */
async function _inicializarVista() {
  try {
    const datos = await idbStorage.get(['vaultConfigurado'])

    let rutaInicial
    if (!datos.vaultConfigurado) {
      // Primera visita — configurar vault
      rutaInicial = '#/setup'
    } else {
      // Vault existe — siempre pedir contraseña (sesión en memoria no persiste)
      rutaInicial = '#/unlock'
    }

    // Sincronizar el hash de la URL con la ruta determinada
    window.location.hash = rutaInicial

    // Montar la vista inicial
    await montarVistaInicial(rutaInicial)

  } catch (error) {
    console.error('Error al inicializar la vista:', error)
    // Fallback seguro: ir a unlock
    window.location.hash = '#/unlock'
    await montarVistaInicial('#/unlock')
  }
}

console.log('Dacmos Password Manager — PWA lista (F4.4 + F4.5)')

/**
 * Configura la detección de actualizaciones del Service Worker.
 *
 * Dos casos cubiertos:
 *  · Caso 1: la página carga con un SW ya en estado 'waiting' — ocurre
 *    cuando el usuario tenía la tab cerrada durante un deploy.
 *  · Caso 2: el nuevo SW se descarga durante la sesión activa — ocurre
 *    cuando Cloudflare sirve el SW actualizado mientras la tab está abierta.
 *
 * En ambos casos se muestra el banner no bloqueante. El SW solo toma
 * control cuando el usuario confirma — nunca de forma automática.
 */
function _configurarActualizacionSW(registro) {
  // Caso 1: ya hay un SW en waiting al momento del registro
  if (registro.waiting) {
    _mostrarBannerActualizacion(registro.waiting)
    return
  }

  // Caso 2: nueva versión descubierta durante la sesión
  registro.addEventListener('updatefound', () => {
    const swNuevo = registro.installing
    if (!swNuevo) return

    swNuevo.addEventListener('statechange', () => {
      // 'installed' = el nuevo SW descargó e instaló — espera activación.
      // La comprobación de controller confirma que hay un SW anterior activo
      // (sin él, sería la primera instalación, no una actualización).
      if (swNuevo.state === 'installed' && navigator.serviceWorker.controller) {
        _mostrarBannerActualizacion(swNuevo)
      }
    })
  })
}

/**
 * Crea y muestra el banner de actualización disponible.
 * No bloquea la UI — el usuario puede seguir usando la app.
 * El banner se crea via createElement para no depender de la vista activa.
 */
function _mostrarBannerActualizacion(swEsperando) {
  // Evitar duplicados si el evento se dispara más de una vez
  if (document.querySelector('.sw-update-banner')) return

  const banner = document.createElement('div')
  banner.className = 'sw-update-banner'
  banner.setAttribute('role', 'status')
  banner.setAttribute('aria-live', 'polite')

  const texto = document.createElement('span')
  texto.className = 'sw-update-banner__texto'
  texto.textContent = 'Nueva versión disponible.'

  const btn = document.createElement('button')
  btn.className = 'sw-update-banner__btn'
  btn.type = 'button'
  btn.textContent = 'Actualizar ahora'

  btn.addEventListener('click', () => {
    // Escuchar controllerchange ANTES de enviar el mensaje para no perder
    // el evento si la transición de SW ocurre en el mismo microtask.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    }, { once: true })

    // Ordenar al SW waiting que salte la fase de espera.
    // service-worker.js responde llamando self.skipWaiting().
    swEsperando.postMessage({ tipo: 'SKIP_WAITING' })
  })

  banner.appendChild(texto)
  banner.appendChild(btn)
  document.body.appendChild(banner)
}
