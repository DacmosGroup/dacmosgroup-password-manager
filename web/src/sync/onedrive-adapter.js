// ============================================================
// Dacmos Password Manager — OneDrive Adapter (PWA)
// F4.3: Fork de src/sync/onedrive-adapter.js para la PWA.
//
// Diferencias respecto al original (extensión Chrome):
//   · chrome.identity.launchWebAuthFlow → conectar() de microsoft-auth.js
//   · _obtenerToken() propio            → obtenerToken() de microsoft-auth.js
//   · _generarPKCE()                    → eliminado (MSAL lo implementa internamente)
//   · _guardarTokens()                  → eliminado (MSAL gestiona sessionStorage)
//   · _refrescarToken()                 → eliminado (MSAL hace silent renewal)
//   · chrome.storage.local              → eliminado (MSAL gestiona sus propios tokens)
//   · CLIENT_ID, AUTH_ENDPOINT, TOKEN_ENDPOINT, SCOPES → eliminados (en microsoft-auth.js)
//
// La interfaz pública (StorageAdapter) es idéntica al original:
// conectar(), guardar(), cargar(), ultimaModificacion(),
// verificarConexion(), nombreProveedor(), desconectar(). Sin cambios de firma.
// ============================================================

import { StorageAdapter } from './storage-adapter.js'
import {
  conectar     as conectarMicrosoft,
  obtenerToken as obtenerTokenMicrosoft,
  desconectar  as desconectarMicrosoft,
} from '../auth/microsoft-auth.js'

const GRAPH_APPROOT  = 'https://graph.microsoft.com/v1.0/me/drive/special/approot'
const VAULT_FILENAME = 'dacmos-vault.bin'

export class OneDriveAdapter extends StorageAdapter {

  // Fetch autenticado con reintento automático en caso de 401.
  // obtenerToken() de MSAL maneja la renovación silenciosa y, si es necesario,
  // abre el popup de Microsoft para re-autenticar (InteractionRequiredAuthError).
  // El segundo intento tras 401 fuerza que MSAL evalúe el token fresco.
  async _fetch(url, opciones = {}) {
    const token = await obtenerTokenMicrosoft()
    const resp  = await fetch(url, {
      ...opciones,
      headers: { ...opciones.headers, Authorization: `Bearer ${token}` },
    })

    if (resp.status === 401) {
      // Token revocado externamente — MSAL intentará renovar o mostrar popup
      const tokenFresco = await obtenerTokenMicrosoft()
      return fetch(url, {
        ...opciones,
        headers: { ...opciones.headers, Authorization: `Bearer ${tokenFresco}` },
      })
    }

    return resp
  }

  // ── OAuth (primer connect) ──

  // Lanza el flujo interactivo OAuth con MSAL (popup Microsoft Login).
  // Este método no está en StorageAdapter base — es específico de OneDrive.
  // Llamar solo desde la UI cuando el usuario hace clic en "Conectar OneDrive".
  async conectar() {
    await conectarMicrosoft()
  }

  // ── StorageAdapter ──

  // Guarda el vault cifrado en OneDrive AppFolder.
  // PUT crea el archivo si no existe, o lo reemplaza si ya existe.
  // A diferencia de Google Drive, no requiere multipart upload.
  async guardar(vaultCifrado) {
    const resp = await this._fetch(
      `${GRAPH_APPROOT}:/${VAULT_FILENAME}:/content`,
      {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(vaultCifrado),
      }
    )
    if (!resp.ok) throw new Error(`ONEDRIVE_${resp.status}`)
  }

  // Descarga el vault cifrado desde OneDrive AppFolder.
  // Retorna null si el archivo aún no existe (404).
  async cargar() {
    const resp = await this._fetch(`${GRAPH_APPROOT}:/${VAULT_FILENAME}:/content`)
    if (resp.status === 404) return null  // archivo aún no existe en OneDrive
    if (!resp.ok) throw new Error(`ONEDRIVE_${resp.status}`)
    return resp.json()
  }

  // Retorna el timestamp (ms) de la última modificación del archivo en OneDrive.
  async ultimaModificacion() {
    const resp = await this._fetch(
      `${GRAPH_APPROOT}:/${VAULT_FILENAME}?$select=lastModifiedDateTime`
    )
    if (resp.status === 404) return null  // archivo aún no existe
    if (!resp.ok) throw new Error(`ONEDRIVE_${resp.status}`)
    const data = await resp.json()
    return data.lastModifiedDateTime
      ? new Date(data.lastModifiedDateTime).getTime()
      : null
  }

  // Verifica conectividad sin mostrar ningún prompt al usuario.
  // obtenerToken() de MSAL usa silent renewal — no abre popup.
  // Si el refresh_token expiró lanzará InteractionRequiredAuthError,
  // que aquí capturamos como false (no conectado).
  async verificarConexion() {
    try {
      await obtenerTokenMicrosoft()
      return true
    } catch (_) {
      return false
    }
  }

  nombreProveedor() { return 'OneDrive' }

  // Elimina todas las cuentas y tokens del caché local de MSAL (sessionStorage).
  // El usuario deberá re-autenticarse al próximo connect.
  async desconectar() {
    await desconectarMicrosoft()
  }
}
