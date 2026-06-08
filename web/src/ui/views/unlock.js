/**
 * unlock.js — Vista de desbloqueo del vault (F4.4)
 *
 * Se muestra cuando el vault está configurado pero la sesión no está activa.
 * Al desbloquear exitosamente:
 *   1. Establece clave AES en sesión (módulo session.js)
 *   2. Carga las credenciales en memoria
 *   3. Navega a #/vault
 */

import { desbloquearVault, cargarVaultDescifrado } from '../../crypto/engine.js'
import { establecerClave, establecerCredenciales, limpiarSesion } from '../../storage/session.js'
import { navegar } from '../router.js'
import { idbStorage } from '../../storage/indexeddb-adapter.js'
import * as autoLock from '../../auto-lock/auto-lock-manager.js'

/** Monta la vista de desbloqueo en el contenedor dado */
export async function montar(contenedor) {
  contenedor.innerHTML = `
    <div class="vista--centrada">
      <div class="tarjeta tarjeta--unlock">
        <div class="unlock__logo">🔐</div>
        <h1 class="unlock__titulo">Dacmos Password Manager</h1>
        <p class="unlock__subtitulo">Ingresa tu contraseña maestra para acceder al vault</p>

        <form class="unlock__form" id="form-unlock" novalidate>
          <div class="campo">
            <label for="unlock-password">Contraseña maestra</label>
            <div class="campo__wrapper">
              <input type="password"
                     id="unlock-password"
                     class="input"
                     placeholder="Tu contraseña maestra"
                     autocomplete="current-password"
                     autofocus>
              <button type="button" class="campo__toggle" id="toggle-pass" aria-label="Mostrar contraseña">👁️</button>
            </div>
          </div>

          <div class="unlock__error oculto" id="unlock-error" role="alert"></div>

          <button type="submit" class="btn btn--primario btn--completo" id="btn-desbloquear">
            Desbloquear
          </button>
        </form>

        <p class="unlock__olvide-link" id="link-olvide">¿Olvidaste tu contraseña?</p>

        <div class="unlock__olvide-panel oculto" id="panel-olvide">
          <p class="unlock__olvide-aviso">
            ⚠️ Crear un vault nuevo eliminará permanentemente todas tus credenciales.
            Tu backup local y vault en la nube también quedarán inaccesibles.
            Esta acción no se puede deshacer.
          </p>
          <div class="unlock__olvide-acciones">
            <button class="btn btn--secundario btn--sm" id="btn-olvide-cancelar">Cancelar</button>
            <button class="btn btn--peligro btn--sm" id="btn-olvide-confirmar">Crear vault nuevo</button>
          </div>
        </div>

        <p class="auth__nota-pie">
          Zero-Knowledge · AES-256-GCM · Local-first
        </p>
      </div>
    </div>`

  // ── Referencias DOM ──
  const form       = contenedor.querySelector('#form-unlock')
  const inputPass  = contenedor.querySelector('#unlock-password')
  const btnDesbloq = contenedor.querySelector('#btn-desbloquear')
  const errorEl    = contenedor.querySelector('#unlock-error')

  // ── Toggle de visibilidad ──
  contenedor.querySelector('#toggle-pass').addEventListener('click', () => {
    inputPass.type = inputPass.type === 'password' ? 'text' : 'password'
  })

  // ── Flujo "Olvidé mi contraseña" ──
  contenedor.querySelector('#link-olvide').addEventListener('click', () => {
    contenedor.querySelector('#panel-olvide').classList.remove('oculto')
    contenedor.querySelector('#link-olvide').classList.add('oculto')
  })

  contenedor.querySelector('#btn-olvide-cancelar').addEventListener('click', () => {
    contenedor.querySelector('#panel-olvide').classList.add('oculto')
    contenedor.querySelector('#link-olvide').classList.remove('oculto')
  })

  contenedor.querySelector('#btn-olvide-confirmar').addEventListener('click', async () => {
    await idbStorage.clear()
    await navegar('#/setup')
  })

  // ── Submit del formulario ──
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    _ocultarError(errorEl)

    const password = inputPass.value
    if (!password) return

    // Bloquear durante PBKDF2 (~1 segundo)
    btnDesbloq.disabled    = true
    btnDesbloq.textContent = 'Verificando...'

    try {
      const clave = await desbloquearVault(password)

      if (!clave) {
        // Contraseña incorrecta — AES-GCM rechazó el descifrado
        _mostrarError(errorEl, 'Contraseña incorrecta. Intenta de nuevo.')
        inputPass.value        = ''
        inputPass.focus()
        btnDesbloq.disabled    = false
        btnDesbloq.textContent = 'Desbloquear'
        return
      }

      // Sesión exitosa: guardar clave y cargar credenciales en memoria
      establecerClave(clave)
      const credenciales = await cargarVaultDescifrado(clave)
      establecerCredenciales(credenciales)

      // Iniciar auto-lock (F5-A)
      const { config: cfg } = await idbStorage.get(['config'])
      autoLock.init({
        limitMinutos: cfg?.autoLock ?? 5,
        onLock: () => { limpiarSesion(); navegar('#/unlock') },
      })

      await navegar('#/vault')

    } catch (error) {
      if (error.message?.startsWith('VAULT_VERSION_INCOMPATIBLE')) {
        // El vault fue creado con una versión más nueva — necesita actualización
        _mostrarError(errorEl,
          'Este vault fue creado con una versión más reciente de Dacmos PM. ' +
          'Actualiza la aplicación para abrirlo.')
      } else {
        console.error('Error al desbloquear:', error)
        _mostrarError(errorEl, 'Error al desbloquear. Recarga la página e intenta de nuevo.')
      }
      btnDesbloq.disabled    = false
      btnDesbloq.textContent = 'Desbloquear'
    }
  })
}

// ── Helpers privados ──

function _mostrarError(el, mensaje) {
  el.textContent = mensaje
  el.classList.remove('oculto')
}

function _ocultarError(el) {
  el.classList.add('oculto')
}
