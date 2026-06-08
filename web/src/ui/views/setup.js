/**
 * setup.js — Vista de configuración inicial del vault (F4.4 + F4.5)
 *
 * Dos caminos:
 *   A) Crear vault nuevo  — genera salts locales, crea vault en IDB, navega a #/vault
 *   B) Restaurar desde tu nube — descarga vault (con salts) desde Google Drive u OneDrive,
 *      marca vaultConfigurado, navega a #/unlock para que el usuario desbloquee
 *
 * Flujo A al guardar:
 *   1. configurarVault(password)    — crea el vault en IndexedDB
 *   2. solicitarPersistencia()      — solicita persistencia al browser (F4.5)
 *   3. Guardar estado en idbStorage — 'persistenciaEstado'
 *   4. navegar('#/vault')           — ir a la vista principal
 *
 * Flujo B (restaurar):
 *   1. Autenticar con el proveedor elegido (Google Drive / OneDrive)
 *   2. sincronizar(adapter)         — descarga vault + salts a IDB (D2: sin vault local,
 *                                     el proveedor siempre gana)
 *   3. idbStorage.set({ vaultConfigurado: true, syncConfig: { proveedor } })
 *   4. navegar('#/unlock')          — el usuario desbloquea con su contraseña maestra
 */

import { configurarVault }      from '../../crypto/engine.js'
import { idbStorage }           from '../../storage/indexeddb-adapter.js'
import { solicitarPersistencia } from '../../storage/persistence-manager.js'
import { establecerClave, establecerCredenciales } from '../../storage/session.js'
import { navegar }              from '../router.js'
import { calcularEntropia }     from '../../health/password-health.js'
import { conectar as conectarGoogle }              from '../../auth/google-auth.js'
import { conectar as conectarMicrosoft }           from '../../auth/microsoft-auth.js'
import { GoogleDriveAdapter }   from '../../sync/google-drive-adapter.js'
import { OneDriveAdapter }      from '../../sync/onedrive-adapter.js'
import { sincronizar }          from '../../sync/sync-manager.js'
import { t }                    from '../../i18n/i18n.js'

/** Monta la vista de setup en el contenedor dado */
export async function montar(contenedor) {
  _montarEleccion(contenedor)
}

// ── Fase 1: Pantalla de elección ─────────────────────────────────────────────

function _montarEleccion(contenedor) {
  contenedor.innerHTML = `
    <div class="vista--centrada">
      <div class="tarjeta tarjeta--setup">
        <div class="setup__logo">🔐</div>
        <h1 class="setup__titulo">${t('auth.unlock.title')}</h1>
        <p class="setup__subtitulo">${t('auth.setup.choose.subtitle')}</p>

        <div class="setup__opciones">
          <button class="btn btn--primario btn--completo" id="btn-crear-nuevo">
            ${t('auth.setup.btn.create')}
          </button>

          <div class="setup__divisor">
            <span>${t('auth.setup.restore.hint')}</span>
          </div>

          <button class="btn btn--secundario btn--completo" id="btn-restaurar">
            ${t('auth.setup.btn.restore')}
          </button>
        </div>

        <p class="auth__nota-pie">${t('common.zk.footer')}</p>
      </div>
    </div>`

  contenedor.querySelector('#btn-crear-nuevo').addEventListener('click', () => {
    _montarCrear(contenedor)
  })

  contenedor.querySelector('#btn-restaurar').addEventListener('click', () => {
    _montarRestaurar(contenedor)
  })
}

// ── Fase 2A: Crear vault nuevo ────────────────────────────────────────────────

function _montarCrear(contenedor) {
  contenedor.innerHTML = `
    <div class="vista--centrada">
      <div class="tarjeta tarjeta--setup">
        <div class="setup__logo">🔐</div>
        <h1 class="setup__titulo">${t('auth.unlock.title')}</h1>
        <p class="setup__subtitulo">${t('auth.setup.create.subtitle')}</p>

        <form class="setup__form" id="form-setup" novalidate>
          <div class="campo">
            <label for="setup-password">${t('auth.setup.create.label.pass')}</label>
            <div class="campo__wrapper">
              <input type="password"
                     id="setup-password"
                     class="input"
                     placeholder="${t('auth.setup.create.placeholder.pass')}"
                     autocomplete="new-password"
                     autofocus
                     minlength="8">
              <button type="button" class="campo__toggle" id="toggle-pass1"
                      aria-label="${t('auth.setup.create.aria.toggle.pass')}">👁️</button>
            </div>
            <div class="fuerza-password" id="fuerza-container">
              <div class="fuerza-password__barra">
                <div class="fuerza-password__relleno" id="fuerza-barra"></div>
              </div>
              <span class="fuerza-password__etiqueta" id="fuerza-etiqueta"></span>
            </div>
          </div>

          <div class="campo">
            <label for="setup-confirmar">${t('auth.setup.create.label.confirm')}</label>
            <div class="campo__wrapper">
              <input type="password"
                     id="setup-confirmar"
                     class="input"
                     placeholder="${t('auth.setup.create.placeholder.confirm')}"
                     autocomplete="new-password">
              <button type="button" class="campo__toggle" id="toggle-pass2"
                      aria-label="${t('auth.setup.create.aria.toggle.confirm')}">👁️</button>
            </div>
          </div>

          <div class="unlock__error oculto" id="setup-error" role="alert"></div>

          <button type="submit" class="btn btn--primario btn--completo" id="btn-crear">
            ${t('auth.setup.create.btn')}
          </button>
        </form>

        <button class="btn btn--ghost btn--completo" id="btn-volver" style="margin-top:8px">
          ${t('auth.setup.btn.back')}
        </button>

        <p class="auth__nota-pie">${t('common.zk.footer')}</p>
      </div>
    </div>`

  const form        = contenedor.querySelector('#form-setup')
  const inputPass   = contenedor.querySelector('#setup-password')
  const inputConf   = contenedor.querySelector('#setup-confirmar')
  const btnCrear    = contenedor.querySelector('#btn-crear')
  const errorEl     = contenedor.querySelector('#setup-error')
  const fuerzaBarra = contenedor.querySelector('#fuerza-barra')
  const fuerzaLabel = contenedor.querySelector('#fuerza-etiqueta')

  contenedor.querySelector('#toggle-pass1').addEventListener('click', () => {
    inputPass.type = inputPass.type === 'password' ? 'text' : 'password'
  })
  contenedor.querySelector('#toggle-pass2').addEventListener('click', () => {
    inputConf.type = inputConf.type === 'password' ? 'text' : 'password'
  })
  contenedor.querySelector('#btn-volver').addEventListener('click', () => {
    _montarEleccion(contenedor)
  })

  inputPass.addEventListener('input', () => {
    _actualizarFuerza(calcularEntropia(inputPass.value), fuerzaBarra, fuerzaLabel)
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    _ocultarError(errorEl)

    const password  = inputPass.value
    const confirmar = inputConf.value

    if (password.length < 8) {
      _mostrarError(errorEl, t('auth.setup.create.error.min'))
      return
    }
    if (password !== confirmar) {
      _mostrarError(errorEl, t('auth.setup.create.error.mismatch'))
      return
    }

    btnCrear.disabled    = true
    btnCrear.textContent = t('auth.setup.create.btn.loading')

    try {
      const clave = await configurarVault(password)
      establecerClave(clave)
      establecerCredenciales([])

      const { concedida, soportada } = await solicitarPersistencia()
      const estadoPersistencia = !soportada
        ? 'no-soportada'
        : concedida ? 'concedida' : 'rechazada'

      await idbStorage.set({ persistenciaEstado: estadoPersistencia })
      await navegar('#/vault')

    } catch (error) {
      console.error('Error al crear vault:', error)
      _mostrarError(errorEl, t('auth.setup.create.error.generic'))
      btnCrear.disabled    = false
      btnCrear.textContent = t('auth.setup.create.btn')
    }
  })
}

// ── Fase 2B: Restaurar desde tu nube ─────────────────────────────────────────

function _montarRestaurar(contenedor) {
  contenedor.innerHTML = `
    <div class="vista--centrada">
      <div class="tarjeta tarjeta--setup">
        <div class="setup__logo">☁️</div>
        <h1 class="setup__titulo">${t('auth.setup.restore.title')}</h1>

        <div class="setup__aviso" id="aviso-sync">
          <p>${t('auth.setup.restore.warning')}</p>
        </div>

        <p class="setup__subtitulo">${t('auth.setup.restore.provider.subtitle')}</p>

        <div class="setup__opciones">
          <button class="btn btn--primario btn--completo" id="btn-restore-google">
            ${t('settings.sync.google.title')}
          </button>
          <button class="btn btn--secundario btn--completo" id="btn-restore-onedrive">
            ${t('settings.sync.onedrive.title')}
          </button>
        </div>

        <div class="unlock__error oculto" id="restore-error" role="alert"></div>
        <div class="setup__estado oculto" id="restore-estado"></div>

        <button class="btn btn--ghost btn--completo" id="btn-volver-restaurar" style="margin-top:8px">
          ${t('auth.setup.btn.back')}
        </button>

        <p class="auth__nota-pie">${t('common.zk.footer')}</p>
      </div>
    </div>`

  contenedor.querySelector('#btn-volver-restaurar').addEventListener('click', () => {
    _montarEleccion(contenedor)
  })

  contenedor.querySelector('#btn-restore-google').addEventListener('click', async () => {
    await _ejecutarRestore(contenedor, 'google-drive')
  })

  contenedor.querySelector('#btn-restore-onedrive').addEventListener('click', async () => {
    await _ejecutarRestore(contenedor, 'onedrive')
  })
}

async function _ejecutarRestore(contenedor, proveedor) {
  const btnGoogle   = contenedor.querySelector('#btn-restore-google')
  const btnOneDrive = contenedor.querySelector('#btn-restore-onedrive')
  const btnVolver   = contenedor.querySelector('#btn-volver-restaurar')
  const errorEl     = contenedor.querySelector('#restore-error')
  const estadoEl    = contenedor.querySelector('#restore-estado')

  const _bloquear = () => {
    btnGoogle.disabled = btnOneDrive.disabled = btnVolver.disabled = true
  }
  const _desbloquear = () => {
    btnGoogle.disabled = btnOneDrive.disabled = btnVolver.disabled = false
  }

  _bloquear()
  _ocultarError(errorEl)
  estadoEl.classList.remove('oculto')
  estadoEl.textContent = t('auth.setup.restore.connecting')

  try {
    let adapter

    if (proveedor === 'google-drive') {
      await conectarGoogle()
      adapter = new GoogleDriveAdapter()
    } else {
      await conectarMicrosoft()
      adapter = new OneDriveAdapter()
    }

    estadoEl.textContent = t('auth.setup.restore.verifying')

    const modRemoto = await adapter.ultimaModificacion()
    if (modRemoto === null) {
      _desbloquear()
      estadoEl.classList.add('oculto')
      _mostrarError(errorEl, t('auth.setup.restore.error.not.found'))
      return
    }

    const fechaSync = new Date(modRemoto).toLocaleString('es', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    estadoEl.textContent = t('auth.setup.restore.found', { fecha: fechaSync })

    await sincronizar(adapter)

    // Marcar vault como configurado y registrar el proveedor activo
    const datosActuales = await idbStorage.get(['syncConfig'])
    await idbStorage.set({
      vaultConfigurado: true,
      syncConfig: { ...(datosActuales.syncConfig ?? {}), proveedor },
    })

    estadoEl.textContent = t('auth.setup.restore.success')
    await navegar('#/unlock')

  } catch (err) {
    console.error('Error al restaurar vault:', err)
    _desbloquear()
    estadoEl.classList.add('oculto')

    const msg = err?.message ?? ''
    if (msg.includes('GOOGLE_AUTH_ERROR') || msg.includes('popup_closed'))
      _mostrarError(errorEl, t('auth.setup.restore.error.cancelled'))
    else if (msg.includes('SYNC_MASTER_PASSWORD_MISMATCH'))
      _mostrarError(errorEl, t('auth.setup.restore.error.mismatch'))
    else if (msg.includes('MICROSOFT_POPUP_BLOQUEADO'))
      _mostrarError(errorEl, t('auth.setup.restore.error.popup'))
    else
      _mostrarError(errorEl, t('auth.setup.restore.error.generic'))
  }
}

// ── Helpers privados ──────────────────────────────────────────────────────────

function _mostrarError(el, mensaje) {
  el.textContent = mensaje
  el.classList.remove('oculto')
}

function _ocultarError(el) {
  el.classList.add('oculto')
}

function _actualizarFuerza(bits, barra, etiqueta) {
  let porcentaje, color, texto

  if (bits === 0) {
    porcentaje = 0; color = 'var(--color-border)'; texto = ''
  } else if (bits < 40) {
    porcentaje = 20; color = 'var(--color-danger)';  texto = t('common.strength.very.weak')
  } else if (bits < 60) {
    porcentaje = 40; color = 'var(--color-warning)'; texto = t('common.strength.weak')
  } else if (bits < 80) {
    porcentaje = 65; color = 'var(--color-warning)'; texto = t('common.strength.fair')
  } else if (bits < 100) {
    porcentaje = 85; color = 'var(--color-success)'; texto = t('common.strength.strong')
  } else {
    porcentaje = 100; color = 'var(--color-success)'; texto = t('common.strength.very.strong')
  }

  barra.style.width      = `${porcentaje}%`
  barra.style.background = color
  etiqueta.textContent   = texto ? `${texto} (${bits} bits)` : ''
  etiqueta.style.color   = color
}
