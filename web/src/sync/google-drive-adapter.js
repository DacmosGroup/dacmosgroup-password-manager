// ============================================================
// Dacmos Password Manager — Google Drive Adapter (PWA)
// F4.3: Fork de src/sync/google-drive-adapter.js para la PWA.
//
// Diferencias respecto al original (extensión Chrome):
//   · chrome.identity.getAuthToken()  → obtenerToken() de google-auth.js
//   · chrome.storage.local.get/set()  → idbStorage (IndexedDB)
//   · _limpiarTokenCache()            → eliminado (no aplica en PWA)
//   · invalidarToken() de google-auth.js reemplaza la limpieza de caché
//     Chrome cuando el servidor retorna 401
//
// La interfaz pública (StorageAdapter) es idéntica al original:
// guardar(), cargar(), ultimaModificacion(), verificarConexion(),
// nombreProveedor(), desconectar(). Sin cambios de firma.
// ============================================================

import { StorageAdapter }                                 from './storage-adapter.js'
import { obtenerToken, invalidarToken, desconectar as desconectarGoogle } from '../auth/google-auth.js'
import { idbStorage }                                     from '../storage/indexeddb-adapter.js'

const DRIVE_FILES_API  = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'
const VAULT_FILENAME   = 'dacmos-vault.bin'

export class GoogleDriveAdapter extends StorageAdapter {

  // Fetch autenticado con reintento automático en caso de 401.
  // En la PWA, obtenerToken() de google-auth.js maneja la renovación
  // del token (silenciosa o con popup) de forma transparente.
  // En caso de 401, invalidarToken() fuerza la solicitud de un token
  // nuevo — equivalente a _limpiarTokenCache() + getAuthToken() del original.
  async _fetch(url, opciones = {}) {
    const token = await obtenerToken()
    const resp  = await fetch(url, {
      ...opciones,
      headers: { ...opciones.headers, Authorization: `Bearer ${token}` },
    })

    if (resp.status === 401) {
      // Token revocado externamente antes de _expiraEn — forzar renovación
      invalidarToken()
      const tokenFresco = await obtenerToken()
      return fetch(url, {
        ...opciones,
        headers: { ...opciones.headers, Authorization: `Bearer ${tokenFresco}` },
      })
    }

    return resp
  }

  // Busca el fileId de dacmos-vault.bin en appDataFolder.
  // Cachea el fileId en idbStorage bajo la clave 'syncConfig'
  // (equivalente a chrome.storage.local.get(['syncConfig']) del original).
  async _buscarFileId() {
    const datos  = await idbStorage.get(['syncConfig'])
    const cached = datos.syncConfig?.fileId ?? null
    if (cached) return cached

    const query = encodeURIComponent(`name = '${VAULT_FILENAME}'`)
    const resp  = await this._fetch(
      `${DRIVE_FILES_API}?spaces=appDataFolder&q=${query}&fields=files(id)`
    )
    if (!resp.ok) throw new Error(`DRIVE_${resp.status}`)

    const data = await resp.json()
    if (!data.files?.length) return null

    const fileId = data.files[0].id
    await this._patchSyncConfig({ fileId })
    return fileId
  }

  // Actualiza campos en syncConfig de idbStorage sin sobreescribir el resto.
  async _patchSyncConfig(campos) {
    const datos  = await idbStorage.get(['syncConfig'])
    const actual = datos.syncConfig || {}
    await idbStorage.set({ syncConfig: { ...actual, ...campos } })
  }

  // Limpia el fileId cacheado en syncConfig sin eliminar el resto de la config.
  // Llamar cuando Drive retorna 404 sobre un fileId conocido — indica que el
  // archivo fue borrado externamente. El próximo sync buscará el fileId en
  // Drive desde cero y, si sigue sin existir, guardar() lo creará nuevo.
  async _invalidarFileId() {
    await this._patchSyncConfig({ fileId: null })
  }

  // Guarda el vault cifrado en Drive.
  // Si el archivo ya existe → PATCH (actualizar contenido).
  // Si no existe → multipart upload (metadata + contenido en un solo request).
  async guardar(vaultCifrado) {
    const fileId = await this._buscarFileId()
    const cuerpo = JSON.stringify(vaultCifrado)

    if (fileId) {
      // Actualizar archivo existente
      const resp = await this._fetch(
        `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media`,
        {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    cuerpo,
        }
      )
      // 404 sobre un fileId cacheado indica borrado externo — limpiar caché
      // para que el próximo sync busque/cree el archivo desde cero en Drive.
      if (resp.status === 404) await this._invalidarFileId()
      if (!resp.ok) throw new Error(`DRIVE_${resp.status}`)
    } else {
      // Crear archivo nuevo en appDataFolder — multipart upload incluye
      // metadata (nombre + parent) y contenido en un único request
      const metadata = JSON.stringify({ name: VAULT_FILENAME, parents: ['appDataFolder'] })
      const boundary = '---DacmosVaultBoundary'
      const multipart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadata,
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        cuerpo,
        `--${boundary}--`,
      ].join('\r\n')

      const resp = await this._fetch(
        `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id`,
        {
          method:  'POST',
          headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
          body:    multipart,
        }
      )
      if (!resp.ok) throw new Error(`DRIVE_${resp.status}`)
      const data = await resp.json()
      await this._patchSyncConfig({ fileId: data.id })
    }
  }

  // Descarga el vault cifrado desde Drive.
  // Retorna null si el archivo no existe aún en appDataFolder.
  async cargar() {
    const fileId = await this._buscarFileId()
    if (!fileId) return null

    const resp = await this._fetch(`${DRIVE_FILES_API}/${fileId}?alt=media`)
    // 404 sobre un fileId cacheado indica borrado externo — limpiar caché.
    if (resp.status === 404) await this._invalidarFileId()
    if (!resp.ok) throw new Error(`DRIVE_${resp.status}`)
    return resp.json()
  }

  // Retorna el timestamp (ms) de la última modificación del archivo en Drive.
  async ultimaModificacion() {
    const fileId = await this._buscarFileId()
    if (!fileId) return null

    const resp = await this._fetch(`${DRIVE_FILES_API}/${fileId}?fields=modifiedTime`)
    if (!resp.ok) throw new Error(`DRIVE_${resp.status}`)
    const data = await resp.json()
    return data.modifiedTime ? new Date(data.modifiedTime).getTime() : null
  }

  // Verifica conexión silenciosa (sin prompt al usuario).
  // obtenerToken() con prompt='' no muestra popup si hay sesión Google activa.
  async verificarConexion() {
    try {
      await obtenerToken()
      return true
    } catch (_) {
      return false
    }
  }

  nombreProveedor() { return 'Google Drive' }

  // Revoca el token OAuth de Google y limpia el fileId cacheado en idbStorage.
  // Limpiar syncConfig garantiza que el próximo connect busque el fileId
  // desde Drive — evita fileIds inválidos si el usuario reconecta con
  // una cuenta diferente.
  async desconectar() {
    await desconectarGoogle()
    await idbStorage.remove(['syncConfig'])
  }
}
