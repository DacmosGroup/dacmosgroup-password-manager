/**
 * session.js — Estado de sesión en memoria para la PWA
 *
 * La clave AES y las credenciales descifradas viven en variables de módulo
 * JS (scope privado). No se escriben en IndexedDB ni en sessionStorage —
 * se destruyen al recargar la página.
 *
 * Equivalente a chrome.storage.session de la extensión Chrome.
 * Documentado en documento-tecnico.md §6: "Session state lives in JS module memory only."
 */

// Clave AES-256 activa — null cuando el vault está bloqueado
let _claveSesion = null

// Credenciales descifradas en memoria durante la sesión activa
let _credenciales = []

/** Establece la clave AES de sesión (llamar solo desde unlock.js y setup.js) */
export function establecerClave(clave) {
  _claveSesion = clave
}

/** Retorna la clave AES activa o null si el vault está bloqueado */
export function obtenerClave() {
  return _claveSesion
}

/** Retorna true si hay una sesión desbloqueada activa */
export function sesionActiva() {
  return _claveSesion !== null
}

/** Establece las credenciales descifradas en memoria */
export function establecerCredenciales(credenciales) {
  _credenciales = credenciales
}

/** Retorna las credenciales en memoria */
export function obtenerCredenciales() {
  return _credenciales
}

/** Bloquea la sesión: limpia clave y credenciales de la memoria */
export function limpiarSesion() {
  _claveSesion  = null
  _credenciales = []
}
