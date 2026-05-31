/**
 * setup.js — Vista de configuración inicial del vault (F4.4 + F4.5)
 *
 * Se muestra cuando el vault no está configurado (primera visita).
 * Flujo al guardar:
 *   1. configurarVault(password)    — crea el vault en IndexedDB
 *   2. solicitarPersistencia()      — solicita persistencia al browser (F4.5)
 *   3. Guardar estado en idbStorage — 'persistenciaEstado'
 *   4. navegar('#/vault')           — ir a la vista principal
 */

import { configurarVault }      from '../../crypto/engine.js'
import { idbStorage }           from '../../storage/indexeddb-adapter.js'
import { solicitarPersistencia } from '../../storage/persistence-manager.js'
import { establecerClave, establecerCredenciales } from '../../storage/session.js'
import { navegar }              from '../router.js'
import { calcularEntropia }     from '../../health/password-health.js'

/** Monta la vista de setup en el contenedor dado */
export async function montar(contenedor) {
  contenedor.innerHTML = `
    <div class="vista--centrada">
      <div class="tarjeta tarjeta--setup">
        <div class="setup__logo">🔐</div>
        <h1 class="setup__titulo">Dacmos Password Manager</h1>
        <p class="setup__subtitulo">Crea tu contraseña maestra para proteger tu vault</p>

        <form class="setup__form" id="form-setup" novalidate>
          <div class="campo">
            <label for="setup-password">Contraseña maestra</label>
            <div class="campo__wrapper">
              <input type="password"
                     id="setup-password"
                     class="input"
                     placeholder="Mínimo 8 caracteres"
                     autocomplete="new-password"
                     autofocus
                     minlength="8">
              <button type="button" class="campo__toggle" id="toggle-pass1" aria-label="Mostrar contraseña">👁️</button>
            </div>
            <!-- Indicador de fortaleza -->
            <div class="fuerza-password" id="fuerza-container">
              <div class="fuerza-password__barra">
                <div class="fuerza-password__relleno" id="fuerza-barra"></div>
              </div>
              <span class="fuerza-password__etiqueta" id="fuerza-etiqueta"></span>
            </div>
          </div>

          <div class="campo">
            <label for="setup-confirmar">Confirmar contraseña</label>
            <div class="campo__wrapper">
              <input type="password"
                     id="setup-confirmar"
                     class="input"
                     placeholder="Repite la contraseña"
                     autocomplete="new-password">
              <button type="button" class="campo__toggle" id="toggle-pass2" aria-label="Mostrar confirmación">👁️</button>
            </div>
          </div>

          <div class="unlock__error oculto" id="setup-error" role="alert"></div>

          <button type="submit" class="btn btn--primario btn--completo" id="btn-crear">
            Crear vault
          </button>
        </form>

        <p class="auth__nota-pie">
          Zero-Knowledge · AES-256-GCM · Local-first
        </p>
      </div>
    </div>`

  // ── Referencias DOM ──
  const form        = contenedor.querySelector('#form-setup')
  const inputPass   = contenedor.querySelector('#setup-password')
  const inputConf   = contenedor.querySelector('#setup-confirmar')
  const btnCrear    = contenedor.querySelector('#btn-crear')
  const errorEl     = contenedor.querySelector('#setup-error')
  const fuerzaBarra = contenedor.querySelector('#fuerza-barra')
  const fuerzaLabel = contenedor.querySelector('#fuerza-etiqueta')

  // ── Toggle de visibilidad ──
  contenedor.querySelector('#toggle-pass1').addEventListener('click', () => {
    inputPass.type = inputPass.type === 'password' ? 'text' : 'password'
  })
  contenedor.querySelector('#toggle-pass2').addEventListener('click', () => {
    inputConf.type = inputConf.type === 'password' ? 'text' : 'password'
  })

  // ── Indicador de fortaleza ──
  inputPass.addEventListener('input', () => {
    const password = inputPass.value
    const bits     = calcularEntropia(password)
    _actualizarFuerza(bits, fuerzaBarra, fuerzaLabel)
  })

  // ── Submit del formulario ──
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    _ocultarError(errorEl)

    const password  = inputPass.value
    const confirmar = inputConf.value

    // Validaciones básicas
    if (password.length < 8) {
      _mostrarError(errorEl, 'La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmar) {
      _mostrarError(errorEl, 'Las contraseñas no coinciden.')
      return
    }

    // Bloquear el formulario durante la operación (PBKDF2 ~1s)
    btnCrear.disabled    = true
    btnCrear.textContent = 'Creando vault...'

    try {
      // 1. Crear vault cifrado (PBKDF2 + AES-256-GCM)
      const clave = await configurarVault(password)

      // 2. Establecer sesión en memoria
      establecerClave(clave)
      establecerCredenciales([])

      // 3. Solicitar persistencia al browser (F4.5)
      //    Llamamos desde el event handler para cumplir el gesture requirement
      const { concedida, soportada } = await solicitarPersistencia()

      // 4. Guardar estado de persistencia para el banner y settings
      const estadoPersistencia = !soportada
        ? 'no-soportada'
        : concedida ? 'concedida' : 'rechazada'

      await idbStorage.set({ persistenciaEstado: estadoPersistencia })

      // 5. Navegar al vault
      await navegar('#/vault')

    } catch (error) {
      console.error('Error al crear vault:', error)
      _mostrarError(errorEl, 'Error al crear el vault. Intenta de nuevo.')
      btnCrear.disabled    = false
      btnCrear.textContent = 'Crear vault'
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

/** Actualiza el indicador visual de fortaleza de contraseña */
function _actualizarFuerza(bits, barra, etiqueta) {
  let porcentaje, color, texto

  if (bits === 0) {
    porcentaje = 0; color = 'var(--color-border)'; texto = ''
  } else if (bits < 40) {
    porcentaje = 20; color = 'var(--color-danger)';  texto = 'Muy débil'
  } else if (bits < 60) {
    porcentaje = 40; color = 'var(--color-warning)'; texto = 'Débil'
  } else if (bits < 80) {
    porcentaje = 65; color = 'var(--color-warning)'; texto = 'Moderada'
  } else if (bits < 100) {
    porcentaje = 85; color = 'var(--color-success)'; texto = 'Fuerte'
  } else {
    porcentaje = 100; color = 'var(--color-success)'; texto = 'Muy fuerte'
  }

  barra.style.width      = `${porcentaje}%`
  barra.style.background = color
  etiqueta.textContent   = texto ? `${texto} (${bits} bits)` : ''
  etiqueta.style.color   = color
}
