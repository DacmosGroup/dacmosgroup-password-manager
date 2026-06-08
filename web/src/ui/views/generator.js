/**
 * generator.js — Vista de generador de contraseñas (F4.4)
 *
 * Controles:
 *   - Longitud: 8–64 caracteres
 *   - Mayúsculas, minúsculas, números, símbolos (toggles)
 *   - Excluir caracteres ambiguos (0,O,o,I,l,1)
 *
 * Indicador de entropía en bits (H = L × log₂(N)).
 * Historial de las últimas 5 contraseñas generadas en sesión (en memoria).
 * Botón 📋 para copiar al portapapeles.
 *
 * Generación: rejection sampling con crypto.getRandomValues() — sin sesgo.
 */

import { escapeHtml } from '../../utils/escape.js'
import { t }          from '../../i18n/i18n.js'

// Historial en memoria de módulo — persiste mientras la vista no se destruye
// pero se pierde al cerrar la pestaña (no es material sensible — solo conveniencia)
const _historial = []

// ── Conjuntos de caracteres ──
const CHARS_AMBIGUOS = 'I1lO0o'
const SETS = {
  mayusculas: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  minusculas: 'abcdefghijklmnopqrstuvwxyz',
  numeros:    '0123456789',
  simbolos:   '!@#$%^&*()-_=+[]{}|;:,.<>?',
}

/** Genera una contraseña segura con las opciones dadas */
function _generar(opciones) {
  const { longitud, mayusculas, minusculas, numeros, simbolos, excluirAmbiguos } = opciones

  let alfabeto = ''
  const fuentes = []

  const filtrar = (chars) => excluirAmbiguos
    ? chars.split('').filter(c => !CHARS_AMBIGUOS.includes(c)).join('')
    : chars

  if (mayusculas) { const s = filtrar(SETS.mayusculas); if (s) { alfabeto += s; fuentes.push(s) } }
  if (minusculas) { const s = filtrar(SETS.minusculas); if (s) { alfabeto += s; fuentes.push(s) } }
  if (numeros)    { const s = filtrar(SETS.numeros);    if (s) { alfabeto += s; fuentes.push(s) } }
  if (simbolos)   { alfabeto += SETS.simbolos; fuentes.push(SETS.simbolos) }

  if (!alfabeto) return { password: '', entropia: 0 }

  // Rejection sampling — elimina sesgo estadístico del módulo
  const limite    = 256 - (256 % alfabeto.length)
  const resultado = []

  while (resultado.length < longitud) {
    const bytes = crypto.getRandomValues(new Uint8Array(longitud * 3))
    for (const byte of bytes) {
      if (resultado.length >= longitud) break
      if (byte < limite) resultado.push(alfabeto[byte % alfabeto.length])
    }
  }

  // Garantizar al menos un carácter de cada tipo activado
  for (let i = 0; i < Math.min(fuentes.length, longitud); i++) {
    const f   = fuentes[i]
    const lim = 256 - (256 % f.length)
    const b   = crypto.getRandomValues(new Uint8Array(1))[0]
    resultado[i] = b < lim ? f[b % f.length] : f[0]
  }

  // Fisher-Yates shuffle con crypto.getRandomValues
  for (let i = resultado.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint8Array(1))[0] % (i + 1)
    ;[resultado[i], resultado[j]] = [resultado[j], resultado[i]]
  }

  const password = resultado.join('')
  const entropia = Math.floor(longitud * Math.log2(alfabeto.length))
  return { password, entropia }
}

/** Monta la vista del generador en el contenedor dado */
export async function montar(contenedor) {
  // Opciones iniciales
  const opciones = {
    longitud:        16,
    mayusculas:      true,
    minusculas:      true,
    numeros:         true,
    simbolos:        true,
    excluirAmbiguos: false,
  }

  contenedor.innerHTML = `
    <div class="vista">
      <h1 class="generator__titulo">${t('generator.titulo')}</h1>

      <!-- Output -->
      <div class="generator__output">
        <span class="generator__password monospace" id="gen-output"
              data-has-password="false">
          ${t('generator.initial.text')}
        </span>
        <button class="btn btn--pequeño btn--secundario" id="btn-copiar" type="button"
                title="${t('generator.copy.title')}">
          📋
        </button>
      </div>
      <div class="generator__entropia-fila">
        <span id="gen-entropia" class="generator__entropia"></span>
      </div>

      <!-- Controles -->
      <div class="generator__controles">
        <!-- Longitud -->
        <div class="generator__control">
          <span class="generator__control-label">${t('generator.control.length')}</span>
          <div class="generator__longitud">
            <input type="range" id="gen-longitud" min="8" max="64" value="16"
                   aria-label="${t('generator.control.length')}">
            <span class="generator__longitud-valor" id="gen-longitud-valor">16</span>
          </div>
        </div>

        <!-- Mayúsculas -->
        <div class="generator__control">
          <span class="generator__control-label">${t('generator.control.uppercase')}</span>
          <label class="toggle">
            <input type="checkbox" id="gen-mayus" checked
                   aria-label="${t('generator.control.uppercase.aria')}">
            <span class="toggle__slider"></span>
          </label>
        </div>

        <!-- Minúsculas -->
        <div class="generator__control">
          <span class="generator__control-label">${t('generator.control.lowercase')}</span>
          <label class="toggle">
            <input type="checkbox" id="gen-minus" checked
                   aria-label="${t('generator.control.lowercase.aria')}">
            <span class="toggle__slider"></span>
          </label>
        </div>

        <!-- Números -->
        <div class="generator__control">
          <span class="generator__control-label">${t('generator.control.numbers')}</span>
          <label class="toggle">
            <input type="checkbox" id="gen-numeros" checked
                   aria-label="${t('generator.control.numbers.aria')}">
            <span class="toggle__slider"></span>
          </label>
        </div>

        <!-- Símbolos -->
        <div class="generator__control">
          <span class="generator__control-label">${t('generator.control.symbols')}</span>
          <label class="toggle">
            <input type="checkbox" id="gen-simbolos" checked
                   aria-label="${t('generator.control.symbols.aria')}">
            <span class="toggle__slider"></span>
          </label>
        </div>

        <!-- Excluir ambiguos -->
        <div class="generator__control">
          <span class="generator__control-label"
                title="${t('generator.control.ambiguous.title')}">
            ${t('generator.control.ambiguous')}
          </span>
          <label class="toggle">
            <input type="checkbox" id="gen-ambiguos"
                   aria-label="${t('generator.control.ambiguous.aria')}">
            <span class="toggle__slider"></span>
          </label>
        </div>
      </div>

      <button class="btn btn--primario btn--completo" id="btn-generar" type="button">
        ${t('generator.btn.generate')}
      </button>

      <!-- Historial de sesión -->
      <div class="generator__historial ${_historial.length ? '' : 'oculto'}" id="historial-contenedor">
        <div class="generator__historial-titulo">${t('generator.history.title')}</div>
        <div id="historial-lista">
          ${_renderHistorial()}
        </div>
      </div>
    </div>`

  // ── Referencias DOM ──
  const outputEl    = contenedor.querySelector('#gen-output')
  const entropiaEl  = contenedor.querySelector('#gen-entropia')
  const longitudEl  = contenedor.querySelector('#gen-longitud')
  const longValorEl = contenedor.querySelector('#gen-longitud-valor')
  const btnGenerar  = contenedor.querySelector('#btn-generar')
  const btnCopiar   = contenedor.querySelector('#btn-copiar')
  const histCont    = contenedor.querySelector('#historial-contenedor')
  const histLista   = contenedor.querySelector('#historial-lista')

  // ── Actualizar valor del slider ──
  longitudEl.addEventListener('input', () => {
    opciones.longitud = parseInt(longitudEl.value, 10)
    longValorEl.textContent = opciones.longitud
  })

  // ── Checkboxes ──
  const checkboxes = {
    'gen-mayus':    'mayusculas',
    'gen-minus':    'minusculas',
    'gen-numeros':  'numeros',
    'gen-simbolos': 'simbolos',
    'gen-ambiguos': 'excluirAmbiguos',
  }
  Object.entries(checkboxes).forEach(([id, prop]) => {
    contenedor.querySelector(`#${id}`).addEventListener('change', (e) => {
      opciones[prop] = e.target.checked
    })
  })

  // ── Generar contraseña ──
  function generarYMostrar() {
    const { password, entropia } = _generar(opciones)
    if (!password) {
      outputEl.textContent = t('generator.error.no.charset')
      outputEl.dataset.hasPassword = 'false'
      entropiaEl.textContent = ''
      return
    }

    outputEl.textContent  = password
    outputEl.dataset.hasPassword = 'true'
    entropiaEl.textContent = t('generator.entropy', { bits: entropia })

    // Añadir al historial (máximo 5 últimas)
    _historial.unshift(password)
    if (_historial.length > 5) _historial.pop()

    // Actualizar historial en pantalla
    histLista.innerHTML = _renderHistorial()
    histCont.classList.remove('oculto')
  }

  btnGenerar.addEventListener('click', generarYMostrar)

  // ── Copiar al portapapeles ──
  btnCopiar.addEventListener('click', async () => {
    // data-has-password evita copiar el texto placeholder (idioma-agnóstico)
    if (outputEl.dataset.hasPassword !== 'true') return

    const texto = outputEl.textContent.trim()
    try {
      await navigator.clipboard.writeText(texto)
      const original = btnCopiar.textContent
      btnCopiar.textContent = '✓'
      setTimeout(() => { btnCopiar.textContent = original }, 1500)
    } catch (_) {
      // Fallback para browsers sin Clipboard API
      const rango = document.createRange()
      rango.selectNode(outputEl)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(rango)
    }
  })

  // ── Copiar desde el historial ──
  histLista.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copiar]')
    if (!btn) return
    try {
      await navigator.clipboard.writeText(btn.dataset.copiar)
      const orig = btn.textContent
      btn.textContent = '✓'
      setTimeout(() => { btn.textContent = orig }, 1200)
    } catch (_) { /* silenciar */ }
  })
}

/** Genera el HTML del historial de sesión */
function _renderHistorial() {
  if (_historial.length === 0) return ''
  return _historial.map(p => `
    <div class="generator__historial-item">
      <span class="generator__historial-pass monospace">${escapeHtml(p)}</span>
      <button class="btn btn--pequeño btn--secundario"
              data-copiar="${escapeHtml(p)}"
              type="button"
              aria-label="${t('generator.copy.aria')}">📋</button>
    </div>`).join('')
}
