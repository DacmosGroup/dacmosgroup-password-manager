/**
 * pwa-install.js — Lógica de "Agregar al Home Screen" (F4.4)
 *
 * Dos caminos según plataforma:
 *   Chrome Android/Desktop: captura beforeinstallprompt → muestra prompt nativo
 *   iOS Safari: muestra overlay con instrucciones paso a paso (sin API nativa)
 *
 * iOS Safari no implementa beforeinstallprompt — la instalación requiere
 * que el usuario use el menú Compartir de Safari manualmente.
 *
 * IMPORTANTE: inicializarPwaInstall() debe llamarse desde app.js en el evento
 * load para capturar beforeinstallprompt antes de cualquier interacción del usuario.
 * El evento solo se dispara una vez y no se repite si se pierde.
 */

// Evento beforeinstallprompt capturado para uso diferido
let _promptDiferido = null

// Flag para evitar registrar el listener más de una vez
let _inicializado = false

/**
 * Inicializa el módulo: registra el listener de beforeinstallprompt.
 * Llamar exactamente una vez desde app.js.
 */
export function inicializarPwaInstall() {
  if (_inicializado) return
  _inicializado = true

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevenir el mini-infobar automático de Chrome
    e.preventDefault()
    _promptDiferido = e
  })
}

// ── Detección de iOS Safari ──
// navigator.standalone es true solo cuando ya está instalada en el Home Screen.
// Si el user agent indica iOS Y standalone es false → todavía no está instalada.
function _esIosSafariNoInstalada() {
  const esIos      = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const noEsChrome = !/crios/i.test(navigator.userAgent)  // Chrome en iOS se identifica como CriOS
  const yaInstalada = Boolean(navigator.standalone)
  return esIos && noEsChrome && !yaInstalada
}

/**
 * Retorna true si hay algo que mostrar al usuario para instalar la PWA.
 * Chrome: true si beforeinstallprompt fue capturado y no usado.
 * iOS Safari: true si la app aún no está instalada en el Home Screen.
 */
export function estaInstalable() {
  return _promptDiferido !== null || _esIosSafariNoInstalada()
}

/**
 * Muestra el prompt de instalación (Chrome) o el overlay de instrucciones (iOS).
 * Debe llamarse desde un event handler de usuario (clic de botón).
 *
 * @returns {Promise<boolean>} true si el usuario aceptó (Chrome); false en otros casos
 */
export async function instalar() {
  if (_promptDiferido) {
    await _promptDiferido.prompt()
    const { outcome } = await _promptDiferido.userChoice
    // El evento no es reutilizable — limpiar la referencia
    _promptDiferido = null
    return outcome === 'accepted'
  }

  if (_esIosSafariNoInstalada()) {
    _mostrarOverlayIos()
    return false  // el resultado lo decide el usuario interactuando con Safari
  }

  return false
}

// ── Overlay de instrucciones para iOS Safari ──
function _mostrarOverlayIos() {
  // Evitar duplicados si el usuario pulsa el botón varias veces
  if (document.getElementById('overlay-ios-install')) return

  const overlay = document.createElement('div')
  overlay.id        = 'overlay-ios-install'
  overlay.className = 'overlay-install'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', 'Instrucciones de instalación')

  overlay.innerHTML = `
    <div class="overlay-install__panel">
      <button class="overlay-install__cerrar" aria-label="Cerrar instrucciones">✕</button>
      <h2 class="overlay-install__titulo">📱 Agregar al Home Screen</h2>
      <p class="overlay-install__intro">
        Para instalar Dacmos PM en tu iPhone o iPad, sigue estos pasos en Safari:
      </p>
      <ol class="overlay-install__pasos">
        <li>
          <strong>Toca el botón Compartir</strong>
          — el ícono de cuadrado con flecha hacia arriba
          en la barra inferior de Safari
        </li>
        <li>
          Desplázate en el menú y toca
          <strong>"Añadir a pantalla de inicio"</strong>
        </li>
        <li>
          Toca <strong>"Añadir"</strong>
          en la esquina superior derecha para confirmar
        </li>
      </ol>
      <p class="overlay-install__nota">
        Una vez instalada, Dacmos PM funciona como cualquier otra aplicación:
        sin barra de Safari, con acceso offline a tu vault.
      </p>
    </div>`

  document.body.appendChild(overlay)

  // Cerrar con el botón X
  overlay.querySelector('.overlay-install__cerrar').addEventListener('click', () => {
    overlay.remove()
  })

  // Cerrar al tocar fuera del panel
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  // Cerrar con tecla Escape (desktop)
  const cerrarConEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove()
      document.removeEventListener('keydown', cerrarConEscape)
    }
  }
  document.addEventListener('keydown', cerrarConEscape)
}
