// ============================================================
// Dacmos Password Manager — Sync Manager (PWA)
// BUG-1: Reemplaza el upload-only de F4.3 por sync bidireccional
// LWW (Last Write Wins) para Google Drive y OneDrive.
// v0.4.2: Enriquecimiento de blob con sales (BUG-3 / scope ampliado,
//         aprobado por arquitecto para cerrar round-trip PWA↔Extension).
//
// Equivalente PWA de src/sync/sync-manager.js de la extensión
// Chrome. Diferencias clave respecto al original:
//   · idbStorage en lugar de chrome.storage.local
//   · session.js en lugar de chrome.storage.session
//   · Sin guardia _syncTs — no hay listener onChanged en la PWA.
//     La re-entrada concurrente está cubierta por _sincronizandoAhora.
//
// ENRIQUECIMIENTO DE BLOB (BUG-3):
// Cada upload incluye sal, sal2 y tokenVerificacion junto al vault.
// Formato plano: { ...vaultCifrado, sal, sal2, tokenVerificacion }
// Al descargar, se extraen esos campos y se actualizan en IDB, permitiendo
// que la extensión Chrome derive la clave AES correcta con la misma
// contraseña maestra — resuelve el round-trip PWA→Extension.
// Detección de blob enriquecido: blobRemoto.sal existe.
//
// ATOMICIDAD DE DESCARGA (D3):
// Al descargar un blob enriquecido, se leen sal/sal2/token previos en IDB
// antes de escribir los nuevos (estadoPrevio). Si el descifrado post-descarga
// falla (clave de sesión activa no puede descifrar el vault remoto), se
// revierten TODOS los campos escritos — incluidas las sales. Sin pérdida
// de datos local, sin estado inconsistente.
//
// DECISIÓN DE SEGURIDAD: este módulo opera exclusivamente sobre
// el blob cifrado (vaultCifrado). Llama a cargarVaultDescifrado()
// y pasa el resultado directamente a establecerCredenciales()
// sin inspeccionar ni almacenar las credenciales descifradas.
// ============================================================

import { idbStorage }            from '../storage/indexeddb-adapter.js'
import { cargarVaultDescifrado } from '../crypto/engine.js'
import { obtenerClave, establecerCredenciales } from '../storage/session.js'

// Previene re-entrada concurrente si el usuario dispara
// múltiples syncs antes de que el primero complete.
let _sincronizandoAhora = false

/**
 * Sincroniza el vault con el proveedor cloud usando estrategia LWW.
 *
 * Lógica de decisión:
 *   · modRemoto === null    → archivo no existe en proveedor → primera subida
 *   · modRemoto > ultimaSync → proveedor más reciente → descargar
 *   · modRemoto ≤ ultimaSync → local más reciente o igual → subir
 *
 * D2 — Primera sync (sin ultimaSincronizacion previa):
 *   ultimaSync = 0 → el proveedor siempre gana → protege vault vacío
 *   local de sobrescribir datos existentes en el proveedor.
 *
 * D3 — Descarga atómica con rollback de sales:
 *   Si el descifrado post-descarga falla (master password distinta),
 *   se revierten vaultCifrado Y las sales escritas en IDB.
 *   Lanza SYNC_MASTER_PASSWORD_MISMATCH.
 *
 * @param {StorageAdapter} adapter — adaptador del proveedor cloud
 * @returns {{ resultado: 'descargado'|'subido'|'sin_cambios' }}
 * @throws {Error} si hay error de red o SYNC_MASTER_PASSWORD_MISMATCH
 */
export async function sincronizar(adapter) {
  if (_sincronizandoAhora) return { resultado: 'sin_cambios' }
  _sincronizandoAhora = true
  try {
    return await _ejecutarSync(adapter)
  } finally {
    _sincronizandoAhora = false
  }
}

// ── Implementación interna ────────────────────────────────────

async function _ejecutarSync(adapter) {
  // Leer estado local completo antes de cualquier operación de red.
  // sal/sal2/tokenVerificacion se leen aquí para:
  //   · Enriquecer el blob en el upload (evitar una segunda lectura IDB).
  //   · Tener el estado previo disponible para rollback completo en _descargar().
  const datos      = await idbStorage.get(['vaultCifrado', 'syncConfig', 'sal', 'sal2', 'tokenVerificacion'])
  const vaultLocal = datos.vaultCifrado ?? null
  const syncConfig = datos.syncConfig   ?? {}
  const estadoPrevio = {
    vaultCifrado:      datos.vaultCifrado      ?? null,
    sal:               datos.sal               ?? null,
    sal2:              datos.sal2              ?? null,
    tokenVerificacion: datos.tokenVerificacion ?? null,
  }

  // D2: sin historial previo → ultimaSync = 0 → el proveedor siempre gana
  const ultimaSync = syncConfig.ultimaSincronizacion
    ? new Date(syncConfig.ultimaSincronizacion).getTime()
    : 0

  // Obtener timestamp del proveedor — si la red falla, propagamos
  // el error al caller para que muestre un mensaje apropiado al usuario.
  const modRemoto = await adapter.ultimaModificacion()

  if (modRemoto === null) {
    // Archivo no existe en el proveedor todavía
    if (!vaultLocal) return { resultado: 'sin_cambios' }
    // Primera subida: incluir sales en el blob para habilitar round-trip cross-platform
    const blobEnriquecido = _enriquecerBlob(vaultLocal, estadoPrevio)
    await adapter.guardar(blobEnriquecido)
    await _actualizarUltimaSync()
    return { resultado: 'subido' }
  }

  if (modRemoto > ultimaSync) {
    // Proveedor tiene datos más recientes (o es primera sync) → descargar
    return await _descargar(adapter, estadoPrevio)
  }

  // Local más reciente o igual → subir al proveedor con blob enriquecido
  if (vaultLocal) {
    const blobEnriquecido = _enriquecerBlob(vaultLocal, estadoPrevio)
    await adapter.guardar(blobEnriquecido)
    await _actualizarUltimaSync()
    return { resultado: 'subido' }
  }

  return { resultado: 'sin_cambios' }
}

// Crea el blob enriquecido para subir al proveedor.
// Agrega sal, sal2 y tokenVerificacion al vault cifrado para que otros
// dispositivos (extensión Chrome) puedan derivar la clave AES correcta
// con solo la contraseña maestra — resuelve BUG-3 en dirección PWA→Extension.
function _enriquecerBlob(vaultCifrado, estadoPrevio) {
  return {
    ...vaultCifrado,
    sal:               estadoPrevio.sal,
    sal2:              estadoPrevio.sal2,
    tokenVerificacion: estadoPrevio.tokenVerificacion,
  }
}

/**
 * Descarga el vault del proveedor y actualiza IDB.
 * Operación atómica (D3): si el descifrado post-descarga falla, revierte
 * TODOS los campos escritos — incluidas las sales si el blob era enriquecido.
 *
 * Si el blob remoto es enriquecido (tiene campo sal), también actualiza
 * sal, sal2 y tokenVerificacion en IDB para habilitar el round-trip
 * cross-platform — resuelve BUG-3 en dirección Extension→PWA.
 *
 * @param {StorageAdapter} adapter
 * @param {Object} estadoPrevio — estado local leído antes de la descarga (rollback)
 */
async function _descargar(adapter, estadoPrevio) {
  const blobRemoto = await adapter.cargar()

  // cargar() retorna null si el archivo desapareció entre
  // ultimaModificacion() y cargar() (404 en el segundo request).
  // En ese caso no tocamos el estado local.
  if (!blobRemoto) return { resultado: 'sin_cambios' }

  // Detectar si el blob es enriquecido (tiene sal) o legacy
  const esEnriquecido = !!blobRemoto.sal

  // Extraer vault y sales si el blob está enriquecido
  let vaultCifradoRemoto, salRemoto, sal2Remoto, tokenRemoto
  if (esEnriquecido) {
    // Separar las sales del vault — las sales van a sus claves propias en IDB,
    // el vault va a 'vaultCifrado'. Esto mantiene el esquema de IDB consistente.
    const { sal, sal2, tokenVerificacion, ...vault } = blobRemoto
    vaultCifradoRemoto = vault
    salRemoto          = sal
    sal2Remoto         = sal2
    tokenRemoto        = tokenVerificacion
  } else {
    // Blob legacy — sin sales embebidas (backward compat con versiones anteriores)
    vaultCifradoRemoto = blobRemoto
  }

  // Construir patch de escritura para IDB
  const patchIdb = { vaultCifrado: vaultCifradoRemoto }
  if (esEnriquecido) {
    patchIdb.sal               = salRemoto
    patchIdb.sal2              = sal2Remoto
    patchIdb.tokenVerificacion = tokenRemoto
  }
  await idbStorage.set(patchIdb)

  // Re-descifrado y actualización de memoria si hay sesión activa (D3)
  const clave = obtenerClave()
  if (clave) {
    try {
      // cargarVaultDescifrado lee desde IDB (ya actualizado arriba)
      const credenciales = await cargarVaultDescifrado(clave)
      // Pasar a session.js sin inspeccionar el contenido en este módulo
      establecerCredenciales(credenciales)
    } catch (_) {
      // Descifrado falló — el vault remoto (y eventualmente las sales remotas)
      // son incompatibles con la clave de sesión activa.
      // Revertir IDB al estado previo completo (D3): vault + sales.
      const rollback = {}
      if (estadoPrevio.vaultCifrado) {
        rollback.vaultCifrado = estadoPrevio.vaultCifrado
      }
      if (esEnriquecido) {
        // Restaurar las sales previas que se sobreescribieron
        if (estadoPrevio.sal)               rollback.sal               = estadoPrevio.sal
        if (estadoPrevio.sal2)              rollback.sal2              = estadoPrevio.sal2
        if (estadoPrevio.tokenVerificacion) rollback.tokenVerificacion = estadoPrevio.tokenVerificacion
      }

      if (Object.keys(rollback).length > 0) {
        await idbStorage.set(rollback)
      }

      // Si no había vault previo, eliminar el que se acaba de escribir
      if (!estadoPrevio.vaultCifrado) {
        const keysEliminar = ['vaultCifrado']
        // Si no había sales previas y se escribieron sales remotas, eliminarlas también
        if (esEnriquecido && !estadoPrevio.sal) {
          keysEliminar.push('sal', 'sal2', 'tokenVerificacion')
        }
        await idbStorage.remove(keysEliminar)
      }

      throw new Error('SYNC_MASTER_PASSWORD_MISMATCH')
    }
  }
  // Sin sesión activa: IDB tiene el blob y las sales actualizados.
  // El próximo unlock derivará la clave con las sales del vault descargado.

  await _actualizarUltimaSync()
  return { resultado: 'descargado' }
}

/**
 * Persiste la marca de tiempo de la última sincronización exitosa.
 * Lee syncConfig desde IDB para no sobreescribir campos que el
 * adaptador pudo haber actualizado durante el sync (ej. fileId).
 */
async function _actualizarUltimaSync() {
  const datos      = await idbStorage.get(['syncConfig'])
  const syncConfig = datos.syncConfig ?? {}
  await idbStorage.set({
    syncConfig: { ...syncConfig, ultimaSincronizacion: new Date().toISOString() },
  })
}
