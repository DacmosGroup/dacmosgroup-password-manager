/**
 * app.js — Punto de entrada de la PWA Dacmos Password Manager
 *
 * Responsabilidades en F4.3:
 *  1. Registrar el Service Worker al cargar la PWA
 *  2. Inicializar MSAL.js v3 (requerido antes del primer uso de OneDrive)
 *  3. Confirmar en consola que la infraestructura PWA está lista
 *
 * Las responsabilidades de F4.4 en adelante (montar la UI, manejar
 * sesiones) se agregarán aquí sin modificar la lógica existente.
 */

/* F4.3: inicializar MSAL.js v3 en el evento load, después del SW.
   initialize() es asíncrono en MSAL v3 — se llama con await dentro
   de un event listener async para no bloquear el hilo principal. */
import { inicializar as inicializarMsal } from './auth/microsoft-auth.js'

/* ── Registro del Service Worker ──────────────────────────────────────
   Solo se intenta si el navegador lo soporta (todos los modernos sí).
   El SW vive en la raíz (/service-worker.js) para tener scope '/'
   y poder interceptar todas las rutas de la PWA. */
if ('serviceWorker' in navigator) {
  /* Esperar a que la página termine de cargar antes de registrar el SW
     evita competencia con los recursos críticos del primer paint.
     El listener es async para poder await inicializarMsal() después. */
  window.addEventListener('load', async () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(registro => {
        /* El scope confirma qué rutas controla el SW */
        console.log('SW registrado — scope:', registro.scope)
      })
      .catch(error => {
        /* El error de registro no es crítico; la PWA funciona sin SW
           (solo pierde las capacidades offline y de caché). */
        console.error('Error al registrar SW:', error)
      })

    /* F4.3: inicializar MSAL después de lanzar el registro del SW.
       El registro del SW es fire-and-forget (no se awaita) — MSAL
       puede inicializarse en paralelo sin esperar al SW. */
    await inicializarMsal()
  })
} else {
  /* Navegadores muy antiguos o contextos sin HTTPS */
  console.warn('Service Workers no disponibles en este navegador.')
}

/* ── Confirmación de arranque ─────────────────────────────────────────
   Actualizado a F4.3 — auth OAuth PKCE operativo. */
console.log('Dacmos Password Manager — PWA lista (F4.3)')
