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
