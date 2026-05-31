// ============================================================
// Dacmos Password Manager — Google OAuth (PWA)
// F4.3: Reemplazo de chrome.identity para la PWA.
// Usa Google Identity Services JS (GIS) en lugar de chrome.identity.
//
// DECISIÓN DE SEGURIDAD: el access_token vive SOLO en variables
// de módulo (scope privado de JS). Nunca se escribe en localStorage,
// sessionStorage ni IndexedDB. Al cerrar la pestaña, el motor JS
// libera esta memoria y el token desaparece — comportamiento idéntico
// al de la extensión Chrome cuando el service worker se reinicia.
//
// GIS carga via <script async> en index.html. Este módulo expone
// una promesa interna (_gisListo) que resuelve cuando window.google
// está disponible, evitando condiciones de carrera.
// ============================================================

// ── Configuración ──
// CLIENT_ID debe ser un OAuth2 Client ID de tipo "Aplicación web"
// registrado en Google Cloud Console (distinto del Client ID de la
// extensión Chrome, que es de tipo "Extensión de Chrome").
// Ver docs/f4.3-oauth-setup.md para el paso a paso de registro.
const CLIENT_ID = '386629612056-g253j3h0f4iahkqeavhqbbvquc7sa2q1.apps.googleusercontent.com'
const SCOPES    = 'https://www.googleapis.com/auth/drive.appdata'

// ── Estado interno del módulo ──
// DECISIÓN DE SEGURIDAD: ninguna de estas variables se persiste fuera
// del scope de este módulo JS. Son invisibles para localStorage,
// IndexedDB y cualquier otro mecanismo de persistencia.
let _accessToken = null  // token activo o null si no hay sesión
let _expiraEn    = 0     // Date.now() (ms) en que expira el token actual
let _tokenClient = null  // instancia GIS Token Client (singleton)

// ── Promesa de carga de GIS ──
// GIS se carga con <script async> en index.html — puede no estar listo
// cuando este módulo se importa. _gisListo resuelve cuando
// window.google.accounts.oauth2 está disponible.
const _gisListo = new Promise((resolve) => {
  // Caso rápido: GIS ya cargó antes de que este módulo se importara
  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
    resolve()
    return
  }

  // Polling liviano con requestAnimationFrame — no bloquea el hilo principal
  // y se detiene en cuanto GIS está disponible.
  const verificar = () => {
    if (window.google?.accounts?.oauth2) {
      resolve()
    } else {
      requestAnimationFrame(verificar)
    }
  }
  requestAnimationFrame(verificar)
})

// ── Inicialización del Token Client (singleton) ──
// initTokenClient() debe llamarse solo una vez. El callback se
// sobreescribe en cada llamada a _solicitarToken() para envolver
// la operación en una Promise.
async function _obtenerTokenClient() {
  await _gisListo

  if (_tokenClient) return _tokenClient

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope:     SCOPES,
    callback:  () => {}, // se sobreescribe por llamada en _solicitarToken()
  })

  return _tokenClient
}

// ── Solicitar token con callback envuelto en Promise ──
// GIS usa callbacks — esta función los convierte en async/await.
// opciones.prompt: '' = silencioso (usa sesión Google activa en browser)
// opciones.prompt: 'consent' = fuerza popup de selección de cuenta
async function _solicitarToken(opciones = {}) {
  const client = await _obtenerTokenClient()

  return new Promise((resolve, reject) => {
    // Sobreescribir el callback para esta solicitud específica
    client.callback = (respuesta) => {
      if (respuesta.error) {
        reject(new Error(`GOOGLE_AUTH_ERROR:${respuesta.error}`))
        return
      }
      // Guardar token en scope de módulo con timestamp de expiración
      // 60 segundos de margen para renovar antes del vencimiento real
      _accessToken = respuesta.access_token
      _expiraEn    = Date.now() + (respuesta.expires_in - 60) * 1000
      resolve(_accessToken)
    }

    client.requestAccessToken(opciones)
  })
}

// ── API PÚBLICA ──

// Muestra el popup de login de Google.
// Llamar solo desde la UI cuando el usuario hace clic en "Conectar" —
// el browser puede bloquear popups no originados por interacción de usuario.
export async function conectar() {
  await _solicitarToken({ prompt: 'consent' })
}

// Retorna un access_token válido para la Google Drive API.
// 1. Si el token en memoria está vigente → retorna sin llamada de red.
// 2. Si expiró → llama a GIS con prompt vacío (re-auth silenciosa).
//    Si Google tiene sesión activa en el browser → token sin popup.
//    Si no hay sesión activa → GIS abre el popup automáticamente.
export async function obtenerToken() {
  if (_accessToken && Date.now() < _expiraEn) {
    return _accessToken
  }
  return await _solicitarToken({ prompt: '' })
}

// Invalida el token en memoria sin revocar en Google.
// Útil cuando el servidor retorna 401 — el token puede haber sido
// revocado externamente antes de que _expiraEn lo marque como expirado.
// La próxima llamada a obtenerToken() pedirá uno nuevo a GIS.
export function invalidarToken() {
  _accessToken = null
  _expiraEn    = 0
}

// Revoca el token en los servidores de Google y limpia el estado local.
// La revocación es best-effort: si falla, el token expira naturalmente
// en ~1 hora. El estado local se limpia siempre, independientemente.
export async function desconectar() {
  if (!_accessToken) return

  const tokenARevoke = _accessToken

  // Limpiar estado local primero — no bloquear si la revocación falla
  _accessToken = null
  _expiraEn    = 0

  await _gisListo
  google.accounts.oauth2.revoke(tokenARevoke, () => {
    // Callback vacío — revocación best-effort, no bloqueante
  })
}

// Verifica si hay un token activo en memoria.
// No hace llamadas de red — solo consulta el estado local del módulo.
export function estaConectado() {
  return _accessToken !== null && Date.now() < _expiraEn
}
