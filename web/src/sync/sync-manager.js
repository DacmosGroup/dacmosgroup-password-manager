// ============================================================
// Dacmos Password Manager — Sync Manager (PWA)
// BUG-1: Reemplaza el upload-only de F4.3 por sync bidireccional
// LWW (Last Write Wins) para Google Drive y OneDrive.
//
// Equivalente PWA de src/sync/sync-manager.js de la extensión
// Chrome. Diferencias clave respecto al original:
//   · idbStorage en lugar de chrome.storage.local
//   · session.js en lugar de chrome.storage.session
//   · Sin guardia _syncTs — no hay listener onChanged en la PWA.
//     La re-entrada concurrente está cubierta por _sincronizandoAhora.
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
 * D3 — Descarga atómica:
 *   Si el descifrado post-descarga falla (master password distinta),
 *   se revierte la escritura en IDB. Lanza SYNC_MASTER_PASSWORD_MISMATCH.
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
  // Leer estado local antes de cualquier operación de red
  const datos      = await idbStorage.get(['vaultCifrado', 'syncConfig'])
  const vaultLocal = datos.vaultCifrado ?? null
  const syncConfig = datos.syncConfig   ?? {}

  // D2: sin historial previo → ultimaSync = 0 → proveedor siempre gana
  const ultimaSync = syncConfig.ultimaSincronizacion
    ? new Date(syncConfig.ultimaSincronizacion).getTime()
    : 0

  // Obtener timestamp del proveedor — si la red falla, propagamos
  // el error al caller para que muestre un mensaje apropiado al usuario.
  const modRemoto = await adapter.ultimaModificacion()

  if (modRemoto === null) {
    // Archivo no existe en el proveedor todavía
    if (!vaultLocal) return { resultado: 'sin_cambios' }
    // Primera subida: vault existe solo localmente
    await adapter.guardar(vaultLocal)
    await _actualizarUltimaSync()
    return { resultado: 'subido' }
  }

  if (modRemoto > ultimaSync) {
    // Proveedor tiene datos más recientes (o es primera sync) → descargar
    return await _descargar(adapter, vaultLocal)
  }

  // Local más reciente o igual → subir al proveedor
  if (vaultLocal) {
    await adapter.guardar(vaultLocal)
    await _actualizarUltimaSync()
    return { resultado: 'subido' }
  }

  return { resultado: 'sin_cambios' }
}

/**
 * Descarga el vault del proveedor y actualiza IDB + memoria de sesión.
 * Operación atómica (D3): si cualquier paso falla, revierte el IDB.
 *
 * @param {StorageAdapter} adapter
 * @param {Object|null} vaultPrevio — vault local antes de la descarga (para rollback)
 */
async function _descargar(adapter, vaultPrevio) {
  const vaultRemoto = await adapter.cargar()

  // cargar() retorna null si el archivo desapareció entre
  // ultimaModificacion() y cargar() (404 en el segundo request).
  // En ese caso no tocamos el estado local.
  if (!vaultRemoto) return { resultado: 'sin_cambios' }

  // Escribir blob descargado a IDB
  await idbStorage.set({ vaultCifrado: vaultRemoto })

  // Re-descifrado y actualización de memoria si hay sesión activa (D3)
  const clave = obtenerClave()
  if (clave) {
    try {
      // cargarVaultDescifrado lee desde IDB (ya actualizado arriba)
      const credenciales = await cargarVaultDescifrado(clave)
      // Pasar a session.js sin inspeccionar el contenido en este módulo
      establecerCredenciales(credenciales)
    } catch (_) {
      // Descifrado falló — el vault en el proveedor usa una master
      // password distinta a la de la sesión activa. Revertir IDB (D3).
      if (vaultPrevio) {
        await idbStorage.set({ vaultCifrado: vaultPrevio })
      } else {
        await idbStorage.remove(['vaultCifrado'])
      }
      throw new Error('SYNC_MASTER_PASSWORD_MISMATCH')
    }
  }
  // Sin sesión activa: IDB tiene el blob actualizado.
  // El próximo unlock cargará el vault descargado.

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
