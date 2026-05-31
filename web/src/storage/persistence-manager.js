/**
 * persistence-manager.js — Gestión de persistencia de almacenamiento (F4.5)
 *
 * Wrapper sobre la Storage API del browser (navigator.storage).
 * Aborda el riesgo de eviction de datos en iOS Safari:
 * Safari puede borrar datos de origen (IndexedDB incluida) tras
 * 7 días sin que el usuario visite la PWA instalada.
 *
 * DECISIÓN DE DISEÑO: este módulo es ortogonal al vault — no conoce
 * la clave AES ni el contenido del vault. Solo gestiona el contrato
 * de persistencia con el browser.
 *
 * Documentado en roadmap-v0.4.0.md §F4.5.
 */

/**
 * Solicita al browser que garantice la persistencia del origen.
 * IMPORTANTE: llamar solo desde un event handler de usuario (gesture required).
 *
 * Comportamiento por plataforma:
 *   Chrome Android/Desktop (PWA instalada): concede automáticamente sin diálogo
 *   Safari iOS 17+: puede mostrar diálogo nativo de permiso
 *   Firefox: concede automáticamente si bookmarked, diálogo si no
 *
 * @returns {Promise<{ concedida: boolean, soportada: boolean }>}
 */
export async function solicitarPersistencia() {
  if (!navigator.storage?.persist) {
    return { concedida: false, soportada: false }
  }
  try {
    const concedida = await navigator.storage.persist()
    return { concedida, soportada: true }
  } catch (_) {
    return { concedida: false, soportada: true }
  }
}

/**
 * Consulta el estado actual de persistencia sin solicitar nada.
 * Seguro llamar en cualquier momento, sin requerir gesture del usuario.
 *
 * @returns {Promise<{ persistente: boolean, usoBytes: number, cuotaBytes: number, soportada: boolean }>}
 */
export async function verificarPersistencia() {
  if (!navigator.storage) {
    return { persistente: false, usoBytes: 0, cuotaBytes: 0, soportada: false }
  }
  try {
    const [persistente, estimacion] = await Promise.all([
      navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
      navigator.storage.estimate  ? navigator.storage.estimate()  : Promise.resolve({ usage: 0, quota: 0 }),
    ])
    return {
      persistente,
      usoBytes:   estimacion.usage  ?? 0,
      cuotaBytes: estimacion.quota  ?? 0,
      soportada:  true,
    }
  } catch (_) {
    return { persistente: false, usoBytes: 0, cuotaBytes: 0, soportada: false }
  }
}
