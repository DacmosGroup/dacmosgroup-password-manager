// ================================================
// Dacmos Password Manager — Google Drive Adapter
// F2.1: Sincronización con Google Drive (drive.appdata)
// ================================================
// DECISIÓN DE SEGURIDAD: Solo usamos el scope drive.appdata.
// La carpeta appDataFolder es invisible en la UI de Drive y no puede
// ser listada ni leída por otras apps. Google solo almacena bytes
// cifrados AES-256-GCM — nunca ve el contenido del vault.

import { StorageAdapter } from './storage-adapter.js'

const DRIVE_FILES_API  = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'
const VAULT_FILENAME   = 'dacmos-vault.bin'
const DRIVE_SCOPES     = ['https://www.googleapis.com/auth/drive.appdata']

export class GoogleDriveAdapter extends StorageAdapter {

  // Obtiene token OAuth via chrome.identity
  // interactive=true solo en el primer connect (requiere acción del usuario)
  async obtenerToken(interactive = false) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive, scopes: DRIVE_SCOPES }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Error de autenticación'))
        } else if (!token) {
          reject(new Error('TOKEN_NO_DISPONIBLE'))
        } else {
          resolve(token)
        }
      })
    })
  }

  // Limpia el token del cache de Chrome (necesario antes de refresh)
  async _limpiarTokenCache(token) {
    return new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve))
  }

  // Fetch con reintento automático en caso de 401 (token expirado)
  async _fetch(url, opciones, token) {
    const resp = await fetch(url, {
      ...opciones,
      headers: { ...opciones.headers, Authorization: `Bearer ${token}` },
    })

    if (resp.status === 401) {
      await this._limpiarTokenCache(token)
      const tokenFresco = await this.obtenerToken(false)
      return fetch(url, {
        ...opciones,
        headers: { ...opciones.headers, Authorization: `Bearer ${tokenFresco}` },
      })
    }

    return resp
  }

  // Busca el fileId del vault en appDataFolder; lo cachea en syncConfig
  async _buscarFileId(token) {
    const cached = await new Promise(resolve =>
      chrome.storage.local.get(['syncConfig'], r => resolve(r.syncConfig?.fileId ?? null))
    )
    if (cached) return cached

    const query = encodeURIComponent(`name = '${VAULT_FILENAME}'`)
    const resp  = await this._fetch(
      `${DRIVE_FILES_API}?spaces=appDataFolder&q=${query}&fields=files(id)`,
      {},
      token
    )
    if (!resp.ok) throw new Error(`DRIVE_${resp.status}`)

    const data = await resp.json()
    if (!data.files?.length) return null

    const fileId = data.files[0].id
    await this._patchSyncConfig({ fileId })
    return fileId
  }

  async _patchSyncConfig(campos) {
    const actual = await new Promise(resolve =>
      chrome.storage.local.get(['syncConfig'], r => resolve(r.syncConfig || {}))
    )
    await new Promise(resolve =>
      chrome.storage.local.set({ syncConfig: { ...actual, ...campos } }, resolve)
    )
  }

  // Limpia el fileId cacheado en syncConfig sin eliminar el resto de la config.
  // Llamar cuando Drive retorna 404 sobre un fileId conocido — indica que el
  // archivo fue borrado externamente. El próximo sync buscará el fileId en
  // Drive desde cero y, si sigue sin existir, guardar() lo creará nuevo.
  // (Port del fork PWA — F5.1-C, resuelve BUG-SYNC-404 en la Extension.)
  async _invalidarFileId() {
    await this._patchSyncConfig({ fileId: null })
  }

  // Guarda el vault cifrado en Drive (crea o actualiza)
  async guardar(vaultCifrado) {
    const token  = await this.obtenerToken(false)
    const fileId = await this._buscarFileId(token)
    const cuerpo = JSON.stringify(vaultCifrado)

    if (fileId) {
      // Actualizar archivo existente
      const resp = await this._fetch(
        `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: cuerpo,
        },
        token
      )
      // 404 sobre un fileId cacheado indica borrado externo — limpiar caché
      // para que el próximo sync busque/cree el archivo desde cero en Drive.
      if (resp.status === 404) await this._invalidarFileId()
      if (!resp.ok) throw new Error(`DRIVE_${resp.status}`)
    } else {
      // Crear archivo nuevo — multipart upload para enviar metadata + contenido en un request
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
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
          body: multipart,
        },
        token
      )
      if (!resp.ok) throw new Error(`DRIVE_${resp.status}`)
      const data = await resp.json()
      await this._patchSyncConfig({ fileId: data.id })
    }
  }

  // Descarga el vault cifrado desde Drive
  async cargar() {
    const token  = await this.obtenerToken(false)
    const fileId = await this._buscarFileId(token)
    if (!fileId) return null

    const resp = await this._fetch(
      `${DRIVE_FILES_API}/${fileId}?alt=media`,
      {},
      token
    )
    // 404 sobre un fileId cacheado indica borrado externo — limpiar caché.
    if (resp.status === 404) await this._invalidarFileId()
    if (!resp.ok) throw new Error(`DRIVE_${resp.status}`)
    return resp.json()
  }

  // Retorna el timestamp (ms) de la última modificación del archivo en Drive
  async ultimaModificacion() {
    const token  = await this.obtenerToken(false)
    const fileId = await this._buscarFileId(token)
    if (!fileId) return null

    const resp = await this._fetch(
      `${DRIVE_FILES_API}/${fileId}?fields=modifiedTime`,
      {},
      token
    )
    // 404 sobre un fileId cacheado: el archivo fue borrado externamente.
    // Invalidar el caché y reportar "no existe" → el sync-manager lo trata
    // como primera subida en vez de quedar atascado en DRIVE_404 (BUG-SYNC-404).
    if (resp.status === 404) {
      await this._invalidarFileId()
      return null
    }
    if (!resp.ok) throw new Error(`DRIVE_${resp.status}`)
    const data = await resp.json()
    return data.modifiedTime ? new Date(data.modifiedTime).getTime() : null
  }

  // Verifica conexión silenciosa (sin prompt al usuario)
  async verificarConexion() {
    try {
      await this.obtenerToken(false)
      return true
    } catch (_) {
      return false
    }
  }

  nombreProveedor() { return 'Google Drive' }

  // Revoca el token OAuth y lo elimina del cache de Chrome
  async desconectar() {
    return new Promise(resolve => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (!token) { resolve(); return }
        chrome.identity.removeCachedAuthToken({ token }, async () => {
          // Revocar en los servidores de Google — best-effort, no bloquea
          try {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' })
          } catch (_) {}
          resolve()
        })
      })
    })
  }
}
