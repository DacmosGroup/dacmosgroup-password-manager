/**
 * credential-form.js — Vista para añadir o editar una credencial (F4.4)
 *
 * Modo añadir: router.obtenerEstado() === null
 * Modo editar: router.obtenerEstado() === { credencial: { id, sitio, ... } }
 *
 * Condición 2 (aprobada): al "Guardar" o "Cancelar" siempre llama atras(),
 * que garantiza el retorno a #/vault.
 *
 * Tabs disponibles: Login / Tarjeta / Identidad
 *   Login: funcional en v0.4.0
 *   Tarjeta / Identidad: placeholders para versiones futuras
 */

import { guardarVaultCifrado }  from '../../crypto/engine.js'
import {
  obtenerClave, obtenerCredenciales, establecerCredenciales,
  sesionActiva,
} from '../../storage/session.js'
import { navegar, atras, obtenerEstado } from '../router.js'

// ── Generador de contraseñas inline ──
// Sin dependencias externas. Rejection sampling para eliminar sesgo estadístico.
const CHARS_MAYUS   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'   // sin I, O (ambiguos)
const CHARS_MINUS   = 'abcdefghjkmnpqrstuvwxyz'     // sin i, l, o (ambiguos)
const CHARS_NUMEROS = '23456789'                     // sin 0, 1 (ambiguos)
const CHARS_SIMBOLOS = '!@#$%^&*()-_=+[]{}|;:,.<>?'

function _generarPassword(longitud = 16) {
  let alfabeto = CHARS_MAYUS + CHARS_MINUS + CHARS_NUMEROS
  const fuentes = [CHARS_MAYUS, CHARS_MINUS, CHARS_NUMEROS]

  // Añadir símbolos si la longitud lo permite
  if (longitud >= 10) {
    alfabeto += CHARS_SIMBOLOS
    fuentes.push(CHARS_SIMBOLOS)
  }

  // Rejection sampling
  const limite    = 256 - (256 % alfabeto.length)
  const resultado = []

  while (resultado.length < longitud) {
    const bytes = crypto.getRandomValues(new Uint8Array(longitud * 2))
    for (const byte of bytes) {
      if (resultado.length >= longitud) break
      if (byte < limite) resultado.push(alfabeto[byte % alfabeto.length])
    }
  }

  // Garantizar un carácter de cada fuente
  for (let i = 0; i < Math.min(fuentes.length, longitud); i++) {
    const f  = fuentes[i]
    const b  = crypto.getRandomValues(new Uint8Array(1))[0]
    const l2 = 256 - (256 % f.length)
    resultado[i] = b < l2 ? f[b % f.length] : f[0]
  }

  // Fisher-Yates con crypto.getRandomValues
  for (let i = resultado.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint8Array(1))[0] % (i + 1)
    ;[resultado[i], resultado[j]] = [resultado[j], resultado[i]]
  }

  return resultado.join('')
}

/** Monta la vista de formulario de credencial */
export async function montar(contenedor) {
  // Redirigir si no hay sesión
  if (!sesionActiva()) {
    await navegar('#/unlock')
    return
  }

  const estado     = obtenerEstado()
  const esEdicion  = estado?.credencial != null
  const credencial = estado?.credencial ?? {}
  const titulo     = esEdicion ? 'Editar credencial' : 'Nueva credencial'

  contenedor.innerHTML = `
    <div class="vista">
      <div class="credform__header">
        <button class="btn btn--pequeño btn--secundario" id="btn-cancelar" type="button">← Volver</button>
        <h1 class="credform__titulo">${titulo}</h1>
      </div>

      <!-- Tabs: Login activo, Tarjeta e Identidad como placeholders -->
      <div class="credform__tabs" role="tablist">
        <button class="credform__tab credform__tab--activo"
                id="tab-login"
                role="tab"
                aria-selected="true"
                type="button">Login</button>
        <button class="credform__tab"
                id="tab-tarjeta"
                role="tab"
                aria-selected="false"
                title="Disponible en versión futura"
                type="button">Tarjeta</button>
        <button class="credform__tab"
                id="tab-identidad"
                role="tab"
                aria-selected="false"
                title="Disponible en versión futura"
                type="button">Identidad</button>
      </div>

      <form id="form-credencial" novalidate>
        <!-- Panel Login (funcional) -->
        <div id="panel-login" class="credform__campos">
          <div class="campo">
            <label for="cf-sitio">Nombre del sitio *</label>
            <input type="text"
                   id="cf-sitio"
                   class="input"
                   placeholder="Ej: Gmail, GitHub, Netflix"
                   value="${_escaparHtml(credencial.sitio ?? '')}"
                   autocomplete="off"
                   autofocus>
          </div>

          <div class="campo">
            <label for="cf-url">URL</label>
            <input type="url"
                   id="cf-url"
                   class="input"
                   placeholder="https://ejemplo.com"
                   value="${_escaparHtml(credencial.url ?? '')}"
                   autocomplete="off">
          </div>

          <div class="campo">
            <label for="cf-usuario">Usuario / Email</label>
            <input type="text"
                   id="cf-usuario"
                   class="input"
                   placeholder="usuario@ejemplo.com"
                   value="${_escaparHtml(credencial.usuario ?? '')}"
                   autocomplete="off">
          </div>

          <div class="campo">
            <label for="cf-password">Contraseña</label>
            <div class="campo__wrapper">
              <input type="password"
                     id="cf-password"
                     class="input"
                     placeholder="Contraseña"
                     value="${_escaparHtml(credencial.password ?? '')}"
                     autocomplete="new-password">
              <button type="button"
                      class="campo__toggle"
                      id="toggle-cf-pass"
                      aria-label="Mostrar contraseña">👁️</button>
              <!-- Botón generar contraseña inline (⚡) -->
              <button type="button"
                      class="credform__generar credform__generar--con-toggle"
                      id="btn-generar"
                      title="Generar contraseña segura"
                      aria-label="Generar contraseña">⚡</button>
            </div>
          </div>

          <div class="campo">
            <label for="cf-totp">Clave TOTP (opcional)</label>
            <input type="text"
                   id="cf-totp"
                   class="input"
                   placeholder="Clave secreta Base32 (opcional)"
                   value="${_escaparHtml(credencial.totp ?? '')}"
                   autocomplete="off"
                   spellcheck="false">
          </div>

          <div class="campo">
            <label for="cf-notas">Notas</label>
            <textarea id="cf-notas"
                      class="input"
                      placeholder="Notas adicionales (no se muestran en autofill)"
                      rows="3">${_escaparHtml(credencial.notas ?? '')}</textarea>
          </div>
        </div>

        <!-- Panels Tarjeta e Identidad (placeholders) -->
        <div id="panel-tarjeta" class="credform__campos oculto">
          <div class="lista-vacia">
            <div class="lista-vacia__icono">💳</div>
            <p class="lista-vacia__texto">Tipo "Tarjeta" disponible en versión futura.</p>
          </div>
        </div>
        <div id="panel-identidad" class="credform__campos oculto">
          <div class="lista-vacia">
            <div class="lista-vacia__icono">🪪</div>
            <p class="lista-vacia__texto">Tipo "Identidad" disponible en versión futura.</p>
          </div>
        </div>

        <div class="unlock__error oculto" id="credform-error" role="alert"></div>

        <div class="credform__acciones">
          <button type="submit" class="btn btn--primario" id="btn-guardar">
            ${esEdicion ? 'Guardar cambios' : 'Añadir credencial'}
          </button>
          <button type="button" class="btn btn--secundario" id="btn-cancelar2">
            Cancelar
          </button>
        </div>
      </form>
    </div>`

  // ── Referencias DOM ──
  const form         = contenedor.querySelector('#form-credencial')
  const inputSitio   = contenedor.querySelector('#cf-sitio')
  const inputUrl     = contenedor.querySelector('#cf-url')
  const inputUsuario = contenedor.querySelector('#cf-usuario')
  const inputPass    = contenedor.querySelector('#cf-password')
  const inputTotp    = contenedor.querySelector('#cf-totp')
  const inputNotas   = contenedor.querySelector('#cf-notas')
  const btnGuardar   = contenedor.querySelector('#btn-guardar')
  const errorEl      = contenedor.querySelector('#credform-error')

  // ── Toggle visibilidad de password ──
  contenedor.querySelector('#toggle-cf-pass').addEventListener('click', () => {
    inputPass.type = inputPass.type === 'password' ? 'text' : 'password'
  })

  // ── Generador inline (⚡) ──
  contenedor.querySelector('#btn-generar').addEventListener('click', () => {
    inputPass.value = _generarPassword(20)
    inputPass.type  = 'text'  // mostrar la contraseña generada
  })

  // ── Tabs ──
  const tabs = ['login', 'tarjeta', 'identidad']
  tabs.forEach(nombre => {
    contenedor.querySelector(`#tab-${nombre}`).addEventListener('click', () => {
      tabs.forEach(t => {
        const tab   = contenedor.querySelector(`#tab-${t}`)
        const panel = contenedor.querySelector(`#panel-${t}`)
        const activo = t === nombre
        tab.classList.toggle('credform__tab--activo', activo)
        tab.setAttribute('aria-selected', String(activo))
        panel.classList.toggle('oculto', !activo)
      })
    })
  })

  // ── Cancelar (ambos botones) ──
  const cancelar = () => atras()
  contenedor.querySelector('#btn-cancelar').addEventListener('click', cancelar)
  contenedor.querySelector('#btn-cancelar2').addEventListener('click', cancelar)

  // ── Guardar ──
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errorEl.classList.add('oculto')

    const sitio = inputSitio.value.trim()
    if (!sitio) {
      errorEl.textContent = 'El nombre del sitio es obligatorio.'
      errorEl.classList.remove('oculto')
      inputSitio.focus()
      return
    }

    const clave = obtenerClave()
    if (!clave) {
      await navegar('#/unlock')
      return
    }

    btnGuardar.disabled    = true
    btnGuardar.textContent = 'Guardando...'

    try {
      const ahora      = new Date().toISOString()
      const credActual = obtenerCredenciales()

      let nuevas
      if (esEdicion) {
        // Actualizar la credencial existente
        nuevas = credActual.map(c =>
          c.id === credencial.id
            ? {
                ...c,
                sitio:    sitio,
                url:      inputUrl.value.trim(),
                usuario:  inputUsuario.value.trim(),
                password: inputPass.value,
                totp:     inputTotp.value.trim(),
                notas:    inputNotas.value.trim(),
                modificado: ahora,
              }
            : c
        )
      } else {
        // Añadir nueva credencial
        const nueva = {
          id:         crypto.randomUUID(),
          sitio:      sitio,
          url:        inputUrl.value.trim(),
          usuario:    inputUsuario.value.trim(),
          password:   inputPass.value,
          totp:       inputTotp.value.trim(),
          notas:      inputNotas.value.trim(),
          creado:     ahora,
          modificado: ahora,
        }
        nuevas = [...credActual, nueva]
      }

      await guardarVaultCifrado(nuevas, clave)
      establecerCredenciales(nuevas)

      // Siempre volver a vault (Condición 2)
      await atras()

    } catch (error) {
      console.error('Error al guardar credencial:', error)
      errorEl.textContent = 'Error al guardar. Intenta de nuevo.'
      errorEl.classList.remove('oculto')
      btnGuardar.disabled    = false
      btnGuardar.textContent = esEdicion ? 'Guardar cambios' : 'Añadir credencial'
    }
  })
}

/** Escapa HTML para prevenir XSS en valores insertados via innerHTML */
function _escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
