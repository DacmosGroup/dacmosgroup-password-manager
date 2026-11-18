/**
 * platform.js — Detección de plataforma (D1-10).
 *
 * Un solo helper para toda la PWA. Sirve SOLO para decidir qué se muestra en la
 * interfaz y qué canal de salida se usa; NUNCA como control de seguridad
 * (cualquier script de la página podría simular window.Capacitor).
 *
 * La PWA no tiene bundler ni importa @capacitor/core: el runtime nativo inyecta
 * window.Capacitor. En el navegador no existe y el resultado es false.
 */
export function esPlataformaNativa() {
  return window.Capacitor?.isNativePlatform?.() === true
}
