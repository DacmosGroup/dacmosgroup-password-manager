// ============================================================
// Dacmos Password Manager — Microsoft OAuth (PWA)
// F4.3: Reemplazo de chrome.identity para la PWA.
// Usa MSAL.js v3 (msal-browser) con PKCE S256 en lugar de
// chrome.identity.launchWebAuthFlow.
//
// DECISIÓN DE SEGURIDAD: los tokens viven en sessionStorage
// (gestionado internamente por MSAL) — se destruyen al cerrar
// la pestaña, sin posibilidad de acceso entre sesiones.
// El access_token que se retorna a los adaptadores de sync
// es un string en memoria — nuestro código nunca lo persiste.
//
// PKCE S256 es implementado internamente por MSAL — no se
// genera code_verifier/code_challenge manualmente (a diferencia
// del adaptador original de la extensión Chrome).
// ============================================================

import * as msal from '/libs/msal-browser.esm.min.js'

// ── Configuración MSAL ──
// CLIENT_ID: mismo App Registration de Azure que la extensión Chrome.
// La redirect URI /blank.html debe estar registrada en Azure Portal
// como tipo "Single Page Application". Ver docs/f4.3-oauth-setup.md.
const CLIENT_ID    = 'e344398b-b03a-4819-8679-f12ff50e7c4d'
const SCOPES       = ['Files.ReadWrite.AppFolder', 'offline_access']
const REDIRECT_URI = window.location.origin + '/blank.html'

const _config = {
  auth: {
    clientId:    CLIENT_ID,
    authority:   'https://login.microsoftonline.com/common',
    redirectUri: REDIRECT_URI,
  },
  cache: {
    // DECISIÓN DE SEGURIDAD: sessionStorage — los tokens son volátiles
    // y se borran al cerrar la pestaña. No usar localStorage.
    cacheLocation:          'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

// ── Instancia singleton de MSAL ──
// Una sola instancia por origen — requerimiento de msal-browser.
const _msalInstance = new msal.PublicClientApplication(_config)

// Flag de inicialización — initialize() debe llamarse exactamente una vez.
let _inicializado = false

// ── API PÚBLICA ──

// Inicializa MSAL. DEBE llamarse en app.js antes de cualquier otra
// operación de auth. En MSAL v3, initialize() es asíncrono: verifica
// el estado de redirects pendientes y limpia el caché de auth si es
// necesario para evitar loops de autenticación.
export async function inicializar() {
  if (_inicializado) return
  await _msalInstance.initialize()
  _inicializado = true
  console.log('MSAL v3 inicializado — redirectUri:', REDIRECT_URI)
}

// Muestra el popup de login de Microsoft.
// loginPopup() abre la ventana de Microsoft, el usuario selecciona su
// cuenta y acepta permisos, y la Promise resuelve con AuthenticationResult
// cuando el popup se cierra.
// Llamar solo desde la UI — requiere interacción del usuario.
export async function conectar() {
  try {
    await _msalInstance.loginPopup({ scopes: SCOPES })
  } catch (error) {
    // BrowserAuthError popup_window_error: popup bloqueado por el navegador.
    // Re-lanzar con código semántico propio — la UI muestra mensaje accionable
    // en lugar de exponer el error interno de MSAL al usuario.
    if (error instanceof msal.BrowserAuthError &&
        error.errorCode === 'popup_window_error') {
      throw new Error('MICROSOFT_POPUP_BLOQUEADO')
    }
    throw error
  }
}

// Retorna un access_token válido para Microsoft Graph.
// 1. acquireTokenSilent() — usa el refresh_token en sessionStorage.
//    No muestra UI si el token se renueva correctamente.
// 2. Si el refresh_token también expiró → InteractionRequiredAuthError
//    → acquireTokenPopup() abre el popup de Microsoft para re-autenticar.
export async function obtenerToken() {
  const cuentas = _msalInstance.getAllAccounts()
  if (!cuentas.length) throw new Error('MICROSOFT_NO_CUENTA')

  const solicitud = {
    account: cuentas[0],
    scopes:  SCOPES,
  }

  try {
    // Intento silencioso — MSAL usa el refresh_token cacheado
    const resultado = await _msalInstance.acquireTokenSilent(solicitud)
    return resultado.accessToken

  } catch (error) {
    // InteractionRequiredAuthError: refresh_token expirado o revocado
    // Se necesita interacción del usuario para obtener nuevos tokens.
    if (error instanceof msal.InteractionRequiredAuthError) {
      try {
        const resultado = await _msalInstance.acquireTokenPopup(solicitud)
        return resultado.accessToken
      } catch (errorPopup) {
        // BrowserAuthError popup_window_error: popup bloqueado por el navegador.
        // Error semántico distinto de credenciales inválidas — la UI debe ofrecer
        // reconexión explícita en lugar de mostrar un error genérico.
        if (errorPopup instanceof msal.BrowserAuthError &&
            errorPopup.errorCode === 'popup_window_error') {
          throw new Error('MICROSOFT_POPUP_BLOQUEADO')
        }
        throw errorPopup
      }
    }
    throw error
  }
}

// Elimina todas las cuentas y tokens del caché de MSAL (sessionStorage).
// No hace logout en Microsoft — la sesión del browser se mantiene.
// Al re-conectar, el usuario volverá a ver el picker de cuentas de Microsoft.
export async function desconectar() {
  await _msalInstance.clearCache()
}

// Verifica si hay al menos una cuenta autenticada en el caché de MSAL.
// No hace llamadas de red — consulta solo el estado en sessionStorage.
export function estaConectado() {
  return _msalInstance.getAllAccounts().length > 0
}
