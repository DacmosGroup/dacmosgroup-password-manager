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
import { establecerClave, establecerCredenciales } from '../../storage/session.js'
import { navegar } from '../router.js'

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

        <p style="text-align:center; margin-top:1.25rem; font-size:0.75rem; color:var(--color-muted);">
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
