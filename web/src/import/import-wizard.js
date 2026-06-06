// ================================================
// Dacmos Password Manager — Wizard de Importación CSV (PWA)
// Adaptación de src/ui/settings/import-wizard.js para la PWA.
//
// Diferencias respecto a la versión Extension:
//   - Sin campo de contraseña: la sesión ya está activa cuando el usuario
//     accede a Settings. Se usa obtenerClave() en lugar de desbloquearVault().
//   - Acepta un parámetro `contenedor` para resolver referencias al DOM
//     dentro del contexto renderizado por settings.js.
//   - Importa desde web/src/ (crypto/engine, storage/session, import/csv-importer).
//
// Flujo: seleccionar CSV → detectar formato → previsualizar → confirmar importación
// ================================================

import {
  cargarVaultDescifrado,
  guardarVaultCifrado,
} from '../crypto/engine.js'

import { obtenerClave } from '../storage/session.js'

import {
  parsearCSV,
  detectarFormato,
  normalizarCredenciales,
  FORMATOS,
} from './csv-importer.js'

// ── Estado interno del wizard ──
// Vive en memoria solo durante el flujo activo; se limpia en cancelar/resetear.
let _filasCSV       = null
let _formatoActual  = null
let _credAImportar  = []
let _credDuplicadas = []

// ── Referencias al DOM ──
// Resueltas por inicializarWizardImportCSV() dentro del contenedor dado.
let elBtnAbrir, elPanel, elInputArchivo
let elGrupoFormato, elBadgeFormato, elSelectFormato
let elGrupoAcciones, elBtnPrevisualizar, elBtnCancelar
let elErrorMsg, elPanelPreview, elResumen, elTbody
let elBtnConfirmar, elSuccessMsg

// ── Punto de entrada — llamado desde settings.js tras renderizar el HTML ──
// Registra todos los event listeners del wizard dentro del contenedor dado.
export function inicializarWizardImportCSV(contenedor) {
  elBtnAbrir         = contenedor.querySelector('#btnAbrirImportarCSV')
  elPanel            = contenedor.querySelector('#panelImportarCSV')
  elInputArchivo     = contenedor.querySelector('#inputArchivoCSV')
  elGrupoFormato     = contenedor.querySelector('#grupoFormatoCSV')
  elBadgeFormato     = contenedor.querySelector('#badgeFormatoCSV')
  elSelectFormato    = contenedor.querySelector('#selectFormatoCSV')
  elGrupoAcciones    = contenedor.querySelector('#grupoAccionesCSV')
  elBtnPrevisualizar = contenedor.querySelector('#btnPrevisualizarCSV')
  elBtnCancelar      = contenedor.querySelector('#btnCancelarImportarCSV')
  elErrorMsg         = contenedor.querySelector('#errorImportarCSV')
  elPanelPreview     = contenedor.querySelector('#panelPreviewCSV')
  elResumen          = contenedor.querySelector('#resumenPreviewCSV')
  elTbody            = contenedor.querySelector('#tbodyPreviewCSV')
  elBtnConfirmar     = contenedor.querySelector('#btnConfirmarImportarCSV')
  elSuccessMsg       = contenedor.querySelector('#successImportarCSV')

  elBtnAbrir.addEventListener('click',         alternarPanel)
  elInputArchivo.addEventListener('change',    manejarArchivoSeleccionado)
  elSelectFormato.addEventListener('change',   manejarCambioFormatoManual)
  elBtnPrevisualizar.addEventListener('click', previsualizarImportacion)
  elBtnCancelar.addEventListener('click',      cancelarImportacion)
  elBtnConfirmar.addEventListener('click',     confirmarImportacion)
}

// ── Abrir / cerrar el panel del wizard ──
function alternarPanel() {
  const estaOculto = elPanel.classList.contains('hidden')
  if (estaOculto) {
    resetearWizard()
    elPanel.classList.remove('hidden')
    elInputArchivo.focus()
  } else {
    elPanel.classList.add('hidden')
    resetearWizard()
  }
}

// ── Resetear todo el estado del wizard a su condición inicial ──
function resetearWizard() {
  _filasCSV       = null
  _formatoActual  = null
  _credAImportar  = []
  _credDuplicadas = []

  elInputArchivo.value          = ''
  elSelectFormato.value         = ''
  elGrupoFormato.style.display  = 'none'
  elGrupoAcciones.style.display = 'none'
  elPanelPreview.classList.add('hidden')
  elSuccessMsg.classList.add('hidden')
  elErrorMsg.classList.add('hidden')
  elTbody.innerHTML             = ''
}

// ── PASO 1: El usuario seleccionó un archivo CSV ──
// Parsea el CSV, detecta el formato y muestra el selector de formato.
async function manejarArchivoSeleccionado(e) {
  const archivo = e.target.files[0]
  if (!archivo) return

  ocultarError()
  elGrupoFormato.style.display  = 'none'
  elGrupoAcciones.style.display = 'none'
  elPanelPreview.classList.add('hidden')
  elSuccessMsg.classList.add('hidden')

  try {
    const texto = await archivo.text()
    _filasCSV   = parsearCSV(texto)

    if (_filasCSV.length < 2) {
      mostrarError('El archivo CSV está vacío o no contiene filas de datos.')
      return
    }

    const headers   = _filasCSV[0].map(h => h.trim())
    const detectado = detectarFormato(headers)
    _formatoActual  = detectado

    elGrupoFormato.style.display = 'block'

    if (detectado && detectado !== 'generico') {
      const nombre = FORMATOS[detectado]?.nombre ?? detectado
      elBadgeFormato.textContent = `✅ Detectado: ${nombre}`
      elBadgeFormato.className   = 'import-format-badge badge-detected'
      elSelectFormato.value      = detectado
    } else if (detectado === 'generico') {
      elBadgeFormato.textContent = '⚠️ Formato genérico'
      elBadgeFormato.className   = 'import-format-badge badge-generic'
      elSelectFormato.value      = 'generico'
    } else {
      elBadgeFormato.textContent = '❓ No detectado — selecciona manualmente'
      elBadgeFormato.className   = 'import-format-badge badge-unknown'
      elSelectFormato.value      = ''
    }

    elGrupoAcciones.style.display = 'block'

  } catch (_err) {
    mostrarError('Error al leer el archivo. Verifica que sea un CSV válido y vuelve a intentarlo.')
  }
}

// ── Cambio manual del formato por el usuario ──
function manejarCambioFormatoManual(e) {
  _formatoActual = e.target.value || null
  elPanelPreview.classList.add('hidden')
  ocultarError()
}

// ── PASO 2: Previsualizar la importación ──
// Deduplica contra el vault actual y renderiza la tabla de preview.
// No pide contraseña — usa la sesión ya activa (el usuario desbloqueó para llegar a Settings).
async function previsualizarImportacion() {
  ocultarError()
  elPanelPreview.classList.add('hidden')

  if (!_formatoActual)                       { mostrarError('Selecciona el formato del archivo CSV.'); return }
  if (!_filasCSV || _filasCSV.length < 2)   { mostrarError('No hay datos para importar.'); return }

  const claveSesion = obtenerClave()
  if (!claveSesion) {
    mostrarError('La sesión expiró. Bloquea y desbloquea el vault para continuar.')
    return
  }

  elBtnPrevisualizar.textContent = 'Analizando...'
  elBtnPrevisualizar.disabled    = true

  try {
    const candidatas = normalizarCredenciales(_filasCSV, _formatoActual)
    if (candidatas.length === 0) {
      mostrarError('No se encontraron credenciales válidas en el archivo. Verifica el formato seleccionado.')
      return
    }

    const credActuales     = await cargarVaultDescifrado(claveSesion)
    const clavesExistentes = new Set(credActuales.map(claveDedup))

    _credAImportar  = candidatas.filter(c => !clavesExistentes.has(claveDedup(c)))
    _credDuplicadas = candidatas.filter(c =>  clavesExistentes.has(claveDedup(c)))

    renderizarPreview(candidatas)

    if (_credAImportar.length > 0) {
      const s = _credAImportar.length !== 1 ? 'es' : ''
      elBtnConfirmar.textContent = `Importar ${_credAImportar.length} credencial${s}`
      elBtnConfirmar.disabled    = false
    } else {
      elBtnConfirmar.textContent = 'Sin credenciales nuevas'
      elBtnConfirmar.disabled    = true
    }

    elPanelPreview.classList.remove('hidden')

  } catch (_err) {
    mostrarError('Error al analizar el archivo. Intenta de nuevo.')
  } finally {
    elBtnPrevisualizar.textContent = 'Previsualizar importación'
    elBtnPrevisualizar.disabled    = false
  }
}

// ── Renderizar tabla de preview ──
// Muestra hasta MAX_PREVIEW filas para no saturar el DOM con archivos grandes.
function renderizarPreview(candidatas) {
  const MAX_PREVIEW = 200

  elResumen.innerHTML = `
    <span class="resumen-nuevas">✅ ${_credAImportar.length} nueva${_credAImportar.length !== 1 ? 's' : ''}</span>
    <span class="resumen-sep">·</span>
    <span class="resumen-dup">⊘ ${_credDuplicadas.length} duplicada${_credDuplicadas.length !== 1 ? 's' : ''} (se ignorarán)</span>
  `

  const clavesNuevas = new Set(_credAImportar.map(claveDedup))

  const mostrar  = candidatas.slice(0, MAX_PREVIEW)
  const omitidas = candidatas.length - mostrar.length

  elTbody.innerHTML = ''

  for (const cred of mostrar) {
    const esNueva = clavesNuevas.has(claveDedup(cred))
    const tr      = document.createElement('tr')
    tr.className  = esNueva ? 'fila-nueva' : 'fila-duplicada'

    // La contraseña siempre se muestra enmascarada — nunca en texto plano en el DOM
    tr.innerHTML = `
      <td>${escapeHtml(cred.sitio)}</td>
      <td class="url-cell" title="${escapeHtml(cred.url)}">${escapeHtml(cred.url)}</td>
      <td>${escapeHtml(cred.usuario)}</td>
      <td class="password-mask">••••••••</td>
      <td>${esNueva
        ? '<span class="badge-nueva">Nueva</span>'
        : '<span class="badge-dup">Duplicada</span>'
      }</td>
    `
    elTbody.appendChild(tr)
  }

  if (omitidas > 0) {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td colspan="5" class="preview-truncado">
        ... y ${omitidas} credencial${omitidas !== 1 ? 'es' : ''} más (no mostrada${omitidas !== 1 ? 's' : ''} en preview)
      </td>
    `
    elTbody.appendChild(tr)
  }
}

// ── PASO 3: Confirmar e importar al vault cifrado ──
async function confirmarImportacion() {
  if (_credAImportar.length === 0) return

  const claveSesion = obtenerClave()
  if (!claveSesion) {
    mostrarError('La sesión expiró. Bloquea y desbloquea el vault para continuar.')
    return
  }

  ocultarError()
  elBtnConfirmar.textContent = 'Importando...'
  elBtnConfirmar.disabled    = true
  elBtnCancelar.disabled     = true

  let importadas = 0

  try {
    // Recargar vault en el momento de la escritura — el vault puede haber
    // cambiado entre el preview y la confirmación.
    const credActuales     = await cargarVaultDescifrado(claveSesion)
    const clavesExistentes = new Set(credActuales.map(claveDedup))

    // Re-filtrar por si aparecieron duplicados nuevos desde el preview
    const credFinales = _credAImportar.filter(c => !clavesExistentes.has(claveDedup(c)))

    // Asignar ID único y timestamps a cada credencial importada
    const ahora  = new Date().toISOString()
    const nuevas = credFinales.map(c => ({
      id:         crypto.randomUUID(),
      sitio:      c.sitio,
      url:        c.url,
      usuario:    c.usuario,
      password:   c.password,
      notas:      c.notas || '',
      creado:     ahora,
      modificado: ahora,
    }))

    importadas = nuevas.length
    await guardarVaultCifrado([...credActuales, ...nuevas], claveSesion)

  } catch (_err) {
    mostrarError('Error al importar. Intenta de nuevo.')
    elBtnCancelar.disabled = false
    const s = _credAImportar.length !== 1 ? 'es' : ''
    elBtnConfirmar.textContent = `Importar ${_credAImportar.length} credencial${s}`
    elBtnConfirmar.disabled    = false
    return
  }

  // ── Éxito: mostrar reporte y cerrar panel ──
  const ignoradas = _credDuplicadas.length
  let msg = importadas === 1
    ? '✅ 1 credencial importada correctamente.'
    : `✅ ${importadas} credenciales importadas correctamente.`

  if (ignoradas > 0) {
    msg += ` ${ignoradas} duplicada${ignoradas !== 1 ? 's' : ''} ignorada${ignoradas !== 1 ? 's' : ''}.`
  }

  elSuccessMsg.textContent = msg
  elSuccessMsg.classList.remove('hidden')
  elPanelPreview.classList.add('hidden')
  elGrupoAcciones.style.display = 'none'
  elGrupoFormato.style.display  = 'none'

  // Cerrar panel automáticamente tras 4 segundos
  setTimeout(() => {
    elPanel.classList.add('hidden')
    resetearWizard()
  }, 4000)
}

// ── Cancelar: cerrar y limpiar ──
function cancelarImportacion() {
  elPanel.classList.add('hidden')
  resetearWizard()
}

// ── Clave canónica de deduplicación URL + usuario ──
// Normaliza: minúsculas, trailing slash eliminado, espacios recortados.
function claveDedup(cred) {
  const url = (cred.url || '').toLowerCase().replace(/\/+$/, '').trim()
  const usr = (cred.usuario || '').toLowerCase().trim()
  return `${url}|${usr}`
}

// ── Escape de HTML ──
// DECISIÓN DE SEGURIDAD: todos los datos del CSV son no confiables.
// Se escapan antes de insertarse en el DOM para prevenir XSS.
function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;')
}

// ── Helpers de mensajes ──
function mostrarError(mensaje) {
  elErrorMsg.textContent = mensaje
  elErrorMsg.classList.remove('hidden')
}

function ocultarError() {
  elErrorMsg.classList.add('hidden')
}
