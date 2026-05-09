// ================================================
// Dacmos Password Manager — OneDrive Adapter
// F2.2: Sincronización con Microsoft OneDrive (AppFolder)
// ================================================
// DECISIÓN DE SEGURIDAD: Solo usamos el scope Files.ReadWrite.AppFolder.
// La carpeta approot es invisible en el OneDrive del usuario y no puede
// ser listada ni leída por otras apps. Microsoft solo almacena bytes
// cifrados AES-256-GCM — nunca ve el contenido del vault.
//
// AUTENTICACIÓN: Authorization Code + PKCE via chrome.identity.launchWebAuthFlow.
// No usamos chrome.identity.getAuthToken (exclusivo de Google).
// El PKCE (SHA-256) se implementa con Web Crypto API nativa — sin librerías.

import { StorageAdapter } from './storage-adapter.js'

const GRAPH_APPROOT  = 'https://graph.microsoft.com/v1.0/me/drive/special/approot'
const AUTH_ENDPOINT  = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const CLIENT_ID      = 'e344398b-b03a-4819-8679-f12ff50e7c4d'
// offline_access es necesario para obtener refresh_token y evitar re-autenticación constante
const SCOPES         = 'Files.ReadWrite.AppFolder offline_access'
const VAULT_FILENAME = 'dacmos-vault.bin'

export class OneDriveAdapter extends StorageAdapter {

  // ── PKCE ──

  // Genera el par code_verifier / code_challenge usando Web Crypto API pura
  // code_verifier: 96 bytes aleatorios → base64url (longitud ~128 chars)
  // code_challenge: SHA-256(verifier) → base64url sin padding
  async _generarPKCE() {
    const verifier  = _base64url(crypto.getRandomValues(new Uint8Array(96)))
    const hash      = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
    const challenge = _base64url(new Uint8Array(hash))
    return { verifier, challenge }
  }

  // ── Gestión de tokens ──

  // Persiste access_token, refresh_token y timestamp de expiración
  async _guardarTokens(data) {
    await new Promise(resolve =>
      chrome.storage.local.set({
        onedriveSyncToken: {
          accessToken:  data.access_token,
          refreshToken: data.refresh_token,
          // 60 segundos de margen para renovar antes del vencimiento real
          expiresAt:    Date.now() + (data.expires_in - 60) * 1000,
        },
      }, resolve)
    )
  }

  // Retorna un access_token válido; renueva automáticamente si expiró
  async _obtenerToken() {
    const tokens = await new Promise(resolve =>
      chrome.storage.local.get(['onedriveSyncToken'], r => resolve(r.onedriveSyncToken ?? null))
    )
    if (!tokens) throw new Error('TOKEN_NO_DISPONIBLE')
    if (Date.now() >= tokens.expiresAt) {
      return this._refrescarToken(tokens.refreshToken)
    }
    return tokens.accessToken
  }

  // Intercambia el refresh_token por un nuevo par de tokens en Microsoft
  async _refrescarToken(refreshToken) {
    if (!refreshToken) throw new Error('TOKEN_NO_DISPONIBLE')
    const resp = await fetch(TOKEN_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        client_id:     CLIENT_ID,
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    if (!resp.ok) throw new Error(`ONEDRIVE_REFRESH_${resp.status}`)
    const data = await resp.json()
    await this._guardarTokens(data)
    return data.access_token
  }

  // ── HTTP ──

  // Fetch autenticado con reintento automático en caso de 401 (token revocado)
  async _fetch(url, opciones = {}) {
    const token = await this._obtenerToken()
    const resp  = await fetch(url, {
      ...opciones,
      headers: { ...opciones.headers, Authorization: `Bearer ${token}` },
    })

    if (resp.status === 401) {
      // Token revocado externamente — intentar refresh y reintentar una sola vez
      const tokens = await new Promise(resolve =>
        chrome.storage.local.get(['onedriveSyncToken'], r => resolve(r.onedriveSyncToken ?? null))
      )
      const tokenFresco = await this._refrescarToken(tokens?.refreshToken)
      return fetch(url, {
        ...opciones,
        headers: { ...opciones.headers, Authorization: `Bearer ${tokenFresco}` },
      })
    }

    return resp
  }

  // ── OAuth (solo al conectar por primera vez) ──

  // Lanza el flujo interactivo OAuth con PKCE via chrome.identity.launchWebAuthFlow
  async conectar() {
    const { verifier, challenge } = await this._generarPKCE()
    // chrome.identity.getRedirectURL() genera https://<ext-id>.chromiumapp.org/
    // Este URI debe estar registrado en Azure como "Mobile and desktop applications"
    const redirectUri = chrome.identity.getRedirectURL()

    const params = new URLSearchParams({
      client_id:             CLIENT_ID,
      response_type:         'code',
      redirect_uri:          redirectUri,
      scope:                 SCOPES,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
      response_mode:         'query',
    })

    // Abrir ventana de login de Microsoft — el usuario selecciona su cuenta
    const redireccion = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: `${AUTH_ENDPOINT}?${params}`, interactive: true },
        (url) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || 'Error de autenticación'))
          } else {
            resolve(url)
          }
        }
      )
    })

    // Extraer el código de autorización de la URL de redirección
    const code = new URL(redireccion).searchParams.get('code')
    if (!code) throw new Error('ONEDRIVE_NO_CODE')

    // Intercambiar el código por tokens usando el code_verifier PKCE
    const resp = await fetch(TOKEN_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        client_id:     CLIENT_ID,
        code,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        code_verifier: verifier,
      }),
    })
    if (!resp.ok) throw new Error(`ONEDRIVE_TOKEN_${resp.status}`)
    await this._guardarTokens(await resp.json())
  }

  // ── StorageAdapter ──

  // Guarda el vault cifrado en OneDrive AppFolder (PUT crea o reemplaza sin multipart)
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

  // Descarga el vault cifrado desde OneDrive AppFolder
  async cargar() {
    const resp = await this._fetch(`${GRAPH_APPROOT}:/${VAULT_FILENAME}:/content`)
    if (resp.status === 404) return null  // archivo aún no existe en OneDrive
    if (!resp.ok) throw new Error(`ONEDRIVE_${resp.status}`)
    return resp.json()
  }

  // Retorna el timestamp (ms) de la última modificación del archivo en OneDrive
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

  // Verifica conectividad sin mostrar ningún prompt al usuario
  async verificarConexion() {
    try {
      await this._obtenerToken()
      return true
    } catch (_) {
      return false
    }
  }

  nombreProveedor() { return 'OneDrive' }

  // Elimina los tokens locales (desconexión local — el token expira naturalmente en Microsoft)
  async desconectar() {
    await new Promise(resolve =>
      chrome.storage.local.remove(['onedriveSyncToken'], resolve)
    )
  }
}

// ── Utilidades internas ──

// Codifica un Uint8Array en base64url sin padding (requerido por PKCE)
function _base64url(bytes) {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
