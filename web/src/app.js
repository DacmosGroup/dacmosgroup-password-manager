/**
 * app.js — Punto de entrada de la PWA Dacmos Password Manager
 *
 * Responsabilidades en F4.1:
 *  1. Registrar el Service Worker al cargar la PWA
 *  2. Confirmar en consola que la infraestructura PWA está lista
 *
 * Las responsabilidades de F4.2 en adelante (inicializar IndexedDB,
 * montar la UI, manejar autenticación) se agregarán aquí sin modificar
 * la lógica existente.
 */

/* ── Registro del Service Worker ──────────────────────────────────────
   Solo se intenta si el navegador lo soporta (todos los modernos sí).
   El SW vive en la raíz (/service-worker.js) para tener scope '/'
   y poder interceptar todas las rutas de la PWA. */
if ('serviceWorker' in navigator) {
  /* Esperar a que la página termine de cargar antes de registrar el SW
     evita competencia con los recursos críticos del primer paint. */
  window.addEventListener('load', () => {
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
  })
} else {
  /* Navegadores muy antiguos o contextos sin HTTPS */
  console.warn('Service Workers no disponibles en este navegador.')
}

/* ── Confirmación de arranque ─────────────────────────────────────────
   Placeholder para F4.2 — aquí se inicializará IndexedDB y la UI. */
console.log('Dacmos Password Manager — PWA lista (F4.1)')
