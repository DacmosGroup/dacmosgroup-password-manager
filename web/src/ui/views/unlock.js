/**
 * unlock.js — Vista de desbloqueo del vault (F4.4)
 *
 * Se muestra cuando el vault está configurado pero la sesión no está activa.
 * Al desbloquear exitosamente:
 *   1. Establece clave AES en sesión (módulo session.js)
 *   2. Carga las credenciales en memoria
 *   3. Navega a #/vault
 */

import { desbloquearVault, cargarVaultDescifrado, guardarVaultCifrado } from '../../crypto/engine.js'
import { normalizarCredenciales, requiereConvergenciaTotp } from '../../schema/credential-schema.js'
import { establecerClave, establecerCredenciales, limpiarSesion } from '../../storage/session.js'
import { navegar } from '../router.js'
import { idbStorage } from '../../storage/indexeddb-adapter.js'
import * as autoLock from '../../auto-lock/auto-lock-manager.js'
import { t } from '../../i18n/i18n.js'

/** Monta la vista de desbloqueo en el contenedor dado */
export async function montar(contenedor) {
  contenedor.innerHTML = `
    <div class="vista--centrada">
      <div class="tarjeta tarjeta--unlock">
        <div class="unlock__logo">🔐</div>
        <h1 class="unlock__titulo">${t('auth.unlock.title')}</h1>
        <p class="unlock__subtitulo">${t('auth.unlock.subtitle')}</p>

        <form class="unlock__form" id="form-unlock" novalidate>
          <div class="campo">
            <label for="unlock-password">${t('auth.unlock.placeholder')}</label>
            <div class="campo__wrapper">
              <input type="password"
                     id="unlock-password"
                     class="input"
                     placeholder="${t('auth.unlock.placeholder.full')}"
                     autocomplete="current-password"
                     autofocus>
              <button type="button" class="campo__toggle" id="toggle-pass"
                      aria-label="${t('auth.unlock.aria.toggle')}">👁️</button>
            </div>
          </div>

          <div class="unlock__error oculto" id="unlock-error" role="alert"></div>

          <button type="submit" class="btn btn--primario btn--completo" id="btn-desbloquear">
            ${t('auth.unlock.btn')}
          </button>
        </form>

        <p class="unlock__olvide-link" id="link-olvide">${t('auth.forgot.link')}</p>

        <div class="unlock__olvide-panel oculto" id="panel-olvide">
          <p class="unlock__olvide-aviso">${t('auth.forgot.warning')}</p>
          <div class="unlock__olvide-acciones">
            <button class="btn btn--secundario btn--sm" id="btn-olvide-cancelar">${t('common.cancel')}</button>
            <button class="btn btn--peligro btn--sm" id="btn-olvide-confirmar">${t('auth.forgot.btn.confirm')}</button>
          </div>
        </div>

        <p class="auth__nota-pie">${t('common.zk.footer')}</p>
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
    btnDesbloq.textContent = t('auth.unlock.btn.loading')

    try {
      const clave = await desbloquearVault(password)

      if (!clave) {
        _mostrarError(errorEl, t('auth.unlock.error.incorrect'))
        inputPass.value        = ''
        inputPass.focus()
        btnDesbloq.disabled    = false
        btnDesbloq.textContent = t('auth.unlock.btn')
        return
      }

      // Sesión exitosa: guardar clave y cargar credenciales en memoria.
      // Normalizar al schema canónico (v0.5.1): migra `claveTotp` → `totp`
      // en vaults sincronizados desde la Extension legacy.
      establecerClave(clave)
      const credsRaw = await cargarVaultDescifrado(clave)
      const _convergerTotp = requiereConvergenciaTotp(credsRaw)
      const credenciales = normalizarCredenciales(credsRaw)
      establecerCredenciales(credenciales)

      // Convergencia lazy (B2, v0.5.1): si el vault traía `claveTotp` legacy,
      // persistir el schema canónico una sola vez. Idempotente.
      if (_convergerTotp) {
        try { await guardarVaultCifrado(credenciales, clave) } catch (_) {}
      }

      // Iniciar auto-lock (F5-A)
      const { config: cfg } = await idbStorage.get(['config'])
      autoLock.init({
        limitMinutos: cfg?.autoLock ?? 5,
        onLock: () => { limpiarSesion(); navegar('#/unlock') },
      })

      await navegar('#/vault')

    } catch (error) {
      if (error.message?.startsWith('VAULT_VERSION_INCOMPATIBLE')) {
        _mostrarError(errorEl, t('auth.unlock.error.version'))
      } else {
        console.error('Error al desbloquear:', error)
        _mostrarError(errorEl, t('auth.unlock.error.generic'))
      }
      btnDesbloq.disabled    = false
      btnDesbloq.textContent = t('auth.unlock.btn')
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
