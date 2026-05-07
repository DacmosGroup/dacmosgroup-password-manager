// ================================================
// Dacmos Password Manager — Settings Logic
// E1.10: Export/Import vault cifrado
// F1.4:  Exportar en múltiples formatos (CSV)
// ================================================

import {
  configurarVault,
  cambiarMasterPassword,
  exportarVaultBackup,
  importarVaultBackup,
  desbloquearVault,
  cargarVaultDescifrado,
} from '../../crypto/engine.js'

import { generarCSVGenerico, generarCSVBitwarden } from '../../export/csv-exporter.js'

import { inicializarWizardImport } from './import-wizard.js'

// ── Referencias al DOM ──
const inputNuevaMaster     = document.getElementById('inputNuevaMaster')
const inputConfirmarMaster = document.getElementById('inputConfirmarMaster')
const errorMaster          = document.getElementById('errorMaster')
const successMaster        = document.getElementById('successMaster')
const strengthFill         = document.getElementById('strengthFill')
const strengthLabel        = document.getElementById('strengthLabel')
const selectAutoLock       = document.getElementById('selectAutoLock')
const selectClipboard      = document.getElementById('selectClipboard')
const successSeguridad     = document.getElementById('successSeguridad')
const panelConfigurar      = document.getElementById('panelConfigurar')
const panelCambiar         = document.getElementById('panelCambiar')

// ── Sincronización Google Drive (F2.1 — F2.3) ──

const SYNC_BADGE = {
  desconectado:  { texto: 'Desconectado',  cls: 'sync-badge-off'  },
  sincronizando: { texto: 'Sincronizando…', cls: 'sync-badge-sync' },
  sincronizado:  { texto: 'Sincronizado',   cls: 'sync-badge-ok'   },
  pendiente:     { texto: 'Pendiente',      cls: 'sync-badge-warn' },
  error:         { texto: 'Error',          cls: 'sync-badge-err'  },
}

async function cargarEstadoSync() {
  const estado = await new Promise(resolve =>
    chrome.runtime.sendMessage({ tipo: 'SYNC_OBTENER_ESTADO' }, resolve)
  )

  const badge     = document.getElementById('syncBadgeGoogle')
  const btnCon    = document.getElementById('btnConectarGoogle')
  const btnDes    = document.getElementById('btnDesconectarGoogle')
  const btnSync   = document.getElementById('btnSyncAhora')
  const lastTime  = document.getElementById('syncLastTime')

  if (!badge) return

  const ui = SYNC_BADGE[estado?.estado] ?? SYNC_BADGE.desconectado
  badge.textContent = ui.texto
  badge.className   = `sync-badge ${ui.cls}`

  const conectado = estado?.proveedor === 'google-drive'
  btnCon.classList.toggle('hidden',  conectado)
  btnDes.classList.toggle('hidden', !conectado)
  btnSync.classList.toggle('hidden', !conectado)

  if (conectado && estado.ultimaSync) {
    const fecha = new Date(estado.ultimaSync).toLocaleString('es', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    lastTime.textContent = `Última sync: ${fecha}`
  } else {
    lastTime.textContent = ''
  }
}

async function conectarGoogle() {
  const btnCon = document.getElementById('btnConectarGoogle')
  const errorEl   = document.getElementById('errorSync')
  const successEl = document.getElementById('successSync')
  errorEl.classList.add('hidden')
  successEl.classList.add('hidden')

  btnCon.textContent = 'Conectando…'
  btnCon.disabled    = true

  const resp = await new Promise(resolve =>
    chrome.runtime.sendMessage({ tipo: 'SYNC_CONECTAR' }, resolve)
  )

  btnCon.textContent = 'Conectar con Google'
  btnCon.disabled    = false

  if (resp?.ok) {
    mostrarExito(successEl, '✅ Google Drive conectado — vault sincronizando')
    await cargarEstadoSync()
  } else {
    mostrarError(errorEl, resp?.error || 'Error al conectar con Google')
  }
}

async function desconectarGoogle() {
  if (!confirm('¿Desconectar Google Drive? Tu vault local no se borra.')) return

  const errorEl   = document.getElementById('errorSync')
  const successEl = document.getElementById('successSync')
  errorEl.classList.add('hidden')
  successEl.classList.add('hidden')

  const resp = await new Promise(resolve =>
    chrome.runtime.sendMessage({ tipo: 'SYNC_DESCONECTAR' }, resolve)
  )

  if (resp?.ok) {
    mostrarExito(successEl, '✅ Google Drive desconectado')
    await cargarEstadoSync()
  } else {
    mostrarError(errorEl, resp?.error || 'Error al desconectar')
  }
}

async function syncAhora() {
  const btnSync   = document.getElementById('btnSyncAhora')
  const errorEl   = document.getElementById('errorSync')
  const successEl = document.getElementById('successSync')
  errorEl.classList.add('hidden')
  successEl.classList.add('hidden')

  btnSync.textContent = 'Sincronizando…'
  btnSync.disabled    = true

  const resp = await new Promise(resolve =>
    chrome.runtime.sendMessage({ tipo: 'SYNC_SINCRONIZAR' }, resolve)
  )

  btnSync.textContent = 'Sincronizar ahora'
  btnSync.disabled    = false

  if (resp?.ok) {
    mostrarExito(successEl, '✅ Vault sincronizado')
    await cargarEstadoSync()
  } else {
    mostrarError(errorEl, resp?.error || 'Error al sincronizar')
  }
}

// ── Inicialización ──
async function inicializar() {
  await cargarConfiguracion()
  await determinarPanel()
  await cargarEstadoSync()
}

async function determinarPanel() {
  const { vaultConfigurado } = await new Promise((resolve) => {
    chrome.storage.local.get(['vaultConfigurado'], resolve)
  })

  if (vaultConfigurado) {
    panelConfigurar.classList.add('hidden')
    panelCambiar.classList.remove('hidden')
  } else {
    panelConfigurar.classList.remove('hidden')
    panelCambiar.classList.add('hidden')
  }
}

async function cargarConfiguracion() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['config'], (result) => {
      const config = result.config || {}
      if (config.autoLock  !== undefined) selectAutoLock.value  = config.autoLock
      if (config.clipboard !== undefined) selectClipboard.value = config.clipboard
      resolve()
    })
  })
}

// ── Evaluador de fortaleza ──
function evaluarFortaleza(password, fillEl, labelEl) {
  let puntos = 0
  if (password.length >= 8)            puntos++
  if (password.length >= 12)           puntos++
  if (/[A-Z]/.test(password))         puntos++
  if (/[0-9]/.test(password))         puntos++
  if (/[^A-Za-z0-9]/.test(password)) puntos++

  const niveles = [
    { label: '',           color: 'transparent', ancho: '0%'   },
    { label: 'Muy débil',  color: '#e74c3c',     ancho: '20%'  },
    { label: 'Débil',      color: '#e67e22',     ancho: '40%'  },
    { label: 'Regular',    color: '#f39c12',     ancho: '60%'  },
    { label: 'Fuerte',     color: '#2ecc71',     ancho: '80%'  },
    { label: 'Muy fuerte', color: '#00d4ff',     ancho: '100%' },
  ]

  const nivel = niveles[puntos] || niveles[0]
  fillEl.style.width           = nivel.ancho
  fillEl.style.backgroundColor = nivel.color
  labelEl.textContent          = nivel.label
  labelEl.style.color          = nivel.color
  return puntos
}

// ── Configurar vault ──
async function guardarMasterPassword() {
  const nueva     = inputNuevaMaster.value
  const confirmar = inputConfirmarMaster.value

  errorMaster.classList.add('hidden')
  successMaster.classList.add('hidden')

  if (!nueva || !confirmar) { mostrarError(errorMaster, 'Completa ambos campos'); return }
  if (nueva.length < 12)    { mostrarError(errorMaster, 'Mínimo 12 caracteres'); return }
  if (nueva !== confirmar)  { mostrarError(errorMaster, 'Las contraseñas no coinciden'); return }

  const fortaleza = evaluarFortaleza(nueva, strengthFill, strengthLabel)
  if (fortaleza < 3) {
    mostrarError(errorMaster, 'Contraseña muy débil — usa mayúsculas, números y símbolos')
    return
  }

  const btnGuardar = document.getElementById('btnGuardarMaster')
  btnGuardar.textContent = 'Configurando vault seguro...'
  btnGuardar.disabled    = true

  try {
    await configurarVault(nueva)
    await new Promise((resolve) => chrome.storage.local.set({ sesionActiva: true }, resolve))

    inputNuevaMaster.value     = ''
    inputConfirmarMaster.value = ''
    strengthFill.style.width   = '0%'
    strengthLabel.textContent  = ''

    mostrarExito(successMaster, '✅ Vault configurado con AES-256-GCM + PBKDF2-SHA256')
    setTimeout(() => {
      panelConfigurar.classList.add('hidden')
      panelCambiar.classList.remove('hidden')
    }, 2000)
  } catch (error) {
    mostrarError(errorMaster, 'Error al configurar el vault — intenta de nuevo')
  } finally {
    btnGuardar.textContent = 'Guardar contraseña maestra'
    btnGuardar.disabled    = false
  }
}

// ── Cambiar contraseña maestra ──
async function cambiarPassword() {
  const actual    = document.getElementById('inputActualMaster').value
  const nueva     = document.getElementById('inputNuevaCambio').value
  const confirmar = document.getElementById('inputConfirmarCambio').value
  const errorEl   = document.getElementById('errorCambio')
  const successEl = document.getElementById('successCambio')
  const fillEl    = document.getElementById('strengthFillCambio')
  const labelEl   = document.getElementById('strengthLabelCambio')

  errorEl.classList.add('hidden')
  successEl.classList.add('hidden')

  if (!actual || !nueva || !confirmar) { mostrarError(errorEl, 'Completa todos los campos'); return }
  if (nueva.length < 12)  { mostrarError(errorEl, 'Mínimo 12 caracteres'); return }
  if (nueva !== confirmar) { mostrarError(errorEl, 'Las contraseñas no coinciden'); return }
  if (actual === nueva)    { mostrarError(errorEl, 'La nueva debe ser diferente a la actual'); return }

  const fortaleza = evaluarFortaleza(nueva, fillEl, labelEl)
  if (fortaleza < 3) { mostrarError(errorEl, 'Contraseña muy débil'); return }

  const btnCambiar = document.getElementById('btnCambiarMaster')
  btnCambiar.textContent = 'Re-cifrando vault...'
  btnCambiar.disabled    = true

  try {
    await cambiarMasterPassword(actual, nueva)
    document.getElementById('inputActualMaster').value    = ''
    document.getElementById('inputNuevaCambio').value     = ''
    document.getElementById('inputConfirmarCambio').value = ''
    fillEl.style.width  = '0%'
    labelEl.textContent = ''
    mostrarExito(successEl, '✅ Contraseña cambiada — vault re-cifrado con nuevas claves')
  } catch (error) {
    if (error.message === 'PASSWORD_INCORRECTA') {
      mostrarError(errorEl, 'La contraseña actual es incorrecta')
    } else {
      mostrarError(errorEl, 'Error al cambiar la contraseña — intenta de nuevo')
    }
  } finally {
    btnCambiar.textContent = 'Cambiar contraseña maestra'
    btnCambiar.disabled    = false
  }
}

// ── Guardar configuración de seguridad ──
async function guardarConfigSeguridad() {
  const config = {
    autoLock:  parseInt(selectAutoLock.value),
    clipboard: parseInt(selectClipboard.value),
  }
  await new Promise((resolve) => chrome.storage.local.set({ config }, resolve))
  mostrarExito(successSeguridad, '✅ Guardado')
}

// ── Helper de descarga de archivos ──
// Genera un blob y lo descarga sin necesidad de backend.
function descargarArchivo(contenido, tipo, nombre) {
  const blob = new Blob([contenido], { type: tipo })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

// ── Gestión de paneles de exportación/importación ──
// Cierra todos los paneles y resetea el estado de los formularios CSV.
function cerrarTodosLosPaneles() {
  document.getElementById('formExportar').classList.add('hidden')
  document.getElementById('formImportar').classList.add('hidden')
  cerrarFormCSVGenerico()
  cerrarFormCSVBitwarden()
}

function cerrarFormCSVGenerico() {
  document.getElementById('formExportarCSVGenerico').classList.add('hidden')
  resetCSVGenerico()
}

function cerrarFormCSVBitwarden() {
  document.getElementById('formExportarCSVBitwarden').classList.add('hidden')
  resetCSVBitwarden()
}

// Resetea el estado interno del formulario CSV genérico.
function resetCSVGenerico() {
  document.getElementById('ackCSVGenerico').checked        = false
  document.getElementById('inputPassCSVGenerico').value    = ''
  document.getElementById('grupoPassCSVGenerico').style.display = 'none'
  document.getElementById('errorCSVGenerico').classList.add('hidden')
  document.getElementById('btnConfirmarCSVGenerico').disabled  = true
}

// Resetea el estado interno del formulario CSV Bitwarden.
function resetCSVBitwarden() {
  document.getElementById('ackCSVBitwarden').checked        = false
  document.getElementById('inputPassCSVBitwarden').value    = ''
  document.getElementById('grupoPassCSVBitwarden').style.display = 'none'
  document.getElementById('errorCSVBitwarden').classList.add('hidden')
  document.getElementById('btnConfirmarCSVBitwarden').disabled  = true
}

// ── EXPORTAR JSON cifrado (comportamiento original) ──
function mostrarFormExportar() {
  const target    = document.getElementById('formExportar')
  const yaAbierto = !target.classList.contains('hidden')
  cerrarTodosLosPaneles()
  if (!yaAbierto) target.classList.remove('hidden')
}

async function confirmarExportar() {
  const password = document.getElementById('inputExportarPass').value
  const errorEl  = document.getElementById('errorExportar')
  errorEl.classList.add('hidden')

  if (!password) { mostrarError(errorEl, 'Ingresa tu contraseña maestra'); return }

  const btn = document.getElementById('btnConfirmarExportar')
  btn.textContent = 'Generando backup...'
  btn.disabled    = true

  try {
    const backup = await exportarVaultBackup(password)
    const fecha  = new Date().toISOString().split('T')[0]
    descargarArchivo(
      JSON.stringify(backup, null, 2),
      'application/json',
      `dacmosgroup-vault-backup-${fecha}.json`
    )
    document.getElementById('inputExportarPass').value = ''
    document.getElementById('formExportar').classList.add('hidden')
    alert('✅ Backup exportado — guárdalo en un lugar seguro.')
  } catch (error) {
    if (error.message === 'PASSWORD_INCORRECTA') {
      mostrarError(errorEl, 'Contraseña incorrecta')
    } else {
      mostrarError(errorEl, 'Error al exportar — intenta de nuevo')
    }
  } finally {
    btn.textContent = 'Descargar backup'
    btn.disabled    = false
  }
}

// ── EXPORTAR CSV genérico ──
function mostrarFormCSVGenerico() {
  const target    = document.getElementById('formExportarCSVGenerico')
  const yaAbierto = !target.classList.contains('hidden')
  cerrarTodosLosPaneles()
  if (!yaAbierto) target.classList.remove('hidden')
}

// Habilita el botón de descarga solo cuando checkbox está marcado Y hay contraseña.
function actualizarBtnCSVGenerico() {
  const ack  = document.getElementById('ackCSVGenerico').checked
  const pass = document.getElementById('inputPassCSVGenerico').value
  document.getElementById('btnConfirmarCSVGenerico').disabled = !(ack && pass)
}

async function confirmarExportarCSVGenerico() {
  const password = document.getElementById('inputPassCSVGenerico').value
  const errorEl  = document.getElementById('errorCSVGenerico')
  errorEl.classList.add('hidden')

  if (!password) { mostrarError(errorEl, 'Ingresa tu contraseña maestra'); return }

  const btn = document.getElementById('btnConfirmarCSVGenerico')
  btn.textContent = 'Generando...'
  btn.disabled    = true

  try {
    const clave = await desbloquearVault(password)
    if (!clave) throw new Error('PASSWORD_INCORRECTA')

    const credenciales = await cargarVaultDescifrado(clave)
    const contenido    = generarCSVGenerico(credenciales)
    const fecha        = new Date().toISOString().split('T')[0]
    descargarArchivo(contenido, 'text/csv;charset=utf-8;', `dacmos-export-${fecha}.csv`)

    cerrarFormCSVGenerico()
  } catch (error) {
    if (error.message === 'PASSWORD_INCORRECTA') {
      mostrarError(errorEl, 'Contraseña incorrecta')
    } else {
      mostrarError(errorEl, 'Error al exportar — intenta de nuevo')
    }
    // Restaurar el botón preservando el estado del checkbox
    btn.textContent = 'Descargar CSV'
    actualizarBtnCSVGenerico()
  }
}

// ── EXPORTAR CSV Bitwarden ──
function mostrarFormCSVBitwarden() {
  const target    = document.getElementById('formExportarCSVBitwarden')
  const yaAbierto = !target.classList.contains('hidden')
  cerrarTodosLosPaneles()
  if (!yaAbierto) target.classList.remove('hidden')
}

// Habilita el botón de descarga solo cuando checkbox está marcado Y hay contraseña.
function actualizarBtnCSVBitwarden() {
  const ack  = document.getElementById('ackCSVBitwarden').checked
  const pass = document.getElementById('inputPassCSVBitwarden').value
  document.getElementById('btnConfirmarCSVBitwarden').disabled = !(ack && pass)
}

async function confirmarExportarCSVBitwarden() {
  const password = document.getElementById('inputPassCSVBitwarden').value
  const errorEl  = document.getElementById('errorCSVBitwarden')
  errorEl.classList.add('hidden')

  if (!password) { mostrarError(errorEl, 'Ingresa tu contraseña maestra'); return }

  const btn = document.getElementById('btnConfirmarCSVBitwarden')
  btn.textContent = 'Generando...'
  btn.disabled    = true

  try {
    const clave = await desbloquearVault(password)
    if (!clave) throw new Error('PASSWORD_INCORRECTA')

    const credenciales = await cargarVaultDescifrado(clave)
    const contenido    = generarCSVBitwarden(credenciales)
    const fecha        = new Date().toISOString().split('T')[0]
    descargarArchivo(contenido, 'text/csv;charset=utf-8;', `dacmos-bitwarden-${fecha}.csv`)

    cerrarFormCSVBitwarden()
  } catch (error) {
    if (error.message === 'PASSWORD_INCORRECTA') {
      mostrarError(errorEl, 'Contraseña incorrecta')
    } else {
      mostrarError(errorEl, 'Error al exportar — intenta de nuevo')
    }
    btn.textContent = 'Descargar CSV'
    actualizarBtnCSVBitwarden()
  }
}

// ── IMPORTAR vault ──
function mostrarFormImportar() {
  const target    = document.getElementById('formImportar')
  const yaAbierto = !target.classList.contains('hidden')
  cerrarTodosLosPaneles()
  if (!yaAbierto) target.classList.remove('hidden')
}

async function confirmarImportar() {
  const archivo   = document.getElementById('inputArchivoBackup').files[0]
  const password  = document.getElementById('inputImportarPass').value
  const errorEl   = document.getElementById('errorImportar')
  const successEl = document.getElementById('successImportar')

  errorEl.classList.add('hidden')
  successEl.classList.add('hidden')

  if (!archivo)  { mostrarError(errorEl, 'Selecciona un archivo de backup'); return }
  if (!password) { mostrarError(errorEl, 'Ingresa la contraseña maestra'); return }

  const btn = document.getElementById('btnConfirmarImportar')
  btn.textContent = 'Importando...'
  btn.disabled    = true

  try {
    const texto  = await archivo.text()
    const backup = JSON.parse(texto)

    const totalCredenciales = await importarVaultBackup(backup, password)

    document.getElementById('inputArchivoBackup').value = ''
    document.getElementById('inputImportarPass').value  = ''

    mostrarExito(successEl, `✅ ${totalCredenciales} credenciales importadas correctamente`)

    setTimeout(() => {
      document.getElementById('formImportar').classList.add('hidden')
    }, 3000)
  } catch (error) {
    if (error.message === 'PASSWORD_INCORRECTA') {
      mostrarError(errorEl, 'Contraseña incorrecta o backup de otro vault')
    } else if (error.message === 'BACKUP_INVALIDO') {
      mostrarError(errorEl, 'Archivo inválido — no es un backup de DacmosGroup')
    } else {
      mostrarError(errorEl, 'Error al importar — verifica el archivo')
    }
  } finally {
    btn.textContent = 'Importar credenciales'
    btn.disabled    = false
  }
}

// ── Borrar todo ──
async function borrarTodo() {
  if (!confirm('⚠️ ¿Eliminar TODAS las credenciales permanentemente?')) return
  if (!confirm('⚠️ Última advertencia — esta acción NO se puede deshacer.')) return
  await new Promise((resolve) => chrome.storage.local.clear(resolve))
  alert('✅ Vault borrado completamente')
  window.location.reload()
}

// ── Helpers UI ──
function mostrarError(elemento, mensaje) {
  elemento.textContent = mensaje
  elemento.classList.remove('hidden')
}

function mostrarExito(elemento, mensaje) {
  elemento.textContent = mensaje
  elemento.classList.remove('hidden')
  setTimeout(() => elemento.classList.add('hidden'), 4000)
}

// ══════════════════════════════════════════
// Event Listeners
// ══════════════════════════════════════════

// ── Panel Configurar ──
inputNuevaMaster.addEventListener('input', (e) => {
  evaluarFortaleza(e.target.value, strengthFill, strengthLabel)
})

document.getElementById('btnToggleNueva').addEventListener('click', () => {
  inputNuevaMaster.type = inputNuevaMaster.type === 'password' ? 'text' : 'password'
})

document.getElementById('btnToggleConfirmar').addEventListener('click', () => {
  inputConfirmarMaster.type = inputConfirmarMaster.type === 'password' ? 'text' : 'password'
})

document.getElementById('btnGuardarMaster').addEventListener('click', guardarMasterPassword)

// ── Panel Cambiar ──
document.getElementById('inputNuevaCambio').addEventListener('input', (e) => {
  evaluarFortaleza(
    e.target.value,
    document.getElementById('strengthFillCambio'),
    document.getElementById('strengthLabelCambio')
  )
})

document.getElementById('btnToggleActual').addEventListener('click', () => {
  const el = document.getElementById('inputActualMaster')
  el.type  = el.type === 'password' ? 'text' : 'password'
})

document.getElementById('btnToggleNuevaCambio').addEventListener('click', () => {
  const el = document.getElementById('inputNuevaCambio')
  el.type  = el.type === 'password' ? 'text' : 'password'
})

document.getElementById('btnToggleConfirmarCambio').addEventListener('click', () => {
  const el = document.getElementById('inputConfirmarCambio')
  el.type  = el.type === 'password' ? 'text' : 'password'
})

document.getElementById('btnCambiarMaster').addEventListener('click', cambiarPassword)

// ── Seguridad ──
document.getElementById('btnGuardarSeguridad').addEventListener('click', guardarConfigSeguridad)

// ── Backup — Exportar JSON ──
document.getElementById('btnExportar').addEventListener('click', mostrarFormExportar)
document.getElementById('btnCancelarExportar').addEventListener('click', () => {
  document.getElementById('formExportar').classList.add('hidden')
})
document.getElementById('btnConfirmarExportar').addEventListener('click', confirmarExportar)
document.getElementById('btnToggleExportarPass').addEventListener('click', () => {
  const el = document.getElementById('inputExportarPass')
  el.type  = el.type === 'password' ? 'text' : 'password'
})

// ── Backup — Exportar CSV genérico ──
document.getElementById('btnExportarCSVGenerico').addEventListener('click', mostrarFormCSVGenerico)
document.getElementById('btnCancelarCSVGenerico').addEventListener('click', cerrarFormCSVGenerico)
document.getElementById('btnConfirmarCSVGenerico').addEventListener('click', confirmarExportarCSVGenerico)

// Checkbox: muestra el campo de contraseña y actualiza el estado del botón
document.getElementById('ackCSVGenerico').addEventListener('change', (e) => {
  document.getElementById('grupoPassCSVGenerico').style.display = e.target.checked ? '' : 'none'
  if (!e.target.checked) document.getElementById('inputPassCSVGenerico').value = ''
  actualizarBtnCSVGenerico()
})

// Contraseña: habilita el botón si checkbox está marcado y hay contraseña
document.getElementById('inputPassCSVGenerico').addEventListener('input', actualizarBtnCSVGenerico)

document.getElementById('btnTogglePassCSVGenerico').addEventListener('click', () => {
  const el = document.getElementById('inputPassCSVGenerico')
  el.type  = el.type === 'password' ? 'text' : 'password'
})

// ── Backup — Exportar CSV Bitwarden ──
document.getElementById('btnExportarCSVBitwarden').addEventListener('click', mostrarFormCSVBitwarden)
document.getElementById('btnCancelarCSVBitwarden').addEventListener('click', cerrarFormCSVBitwarden)
document.getElementById('btnConfirmarCSVBitwarden').addEventListener('click', confirmarExportarCSVBitwarden)

// Checkbox: muestra el campo de contraseña y actualiza el estado del botón
document.getElementById('ackCSVBitwarden').addEventListener('change', (e) => {
  document.getElementById('grupoPassCSVBitwarden').style.display = e.target.checked ? '' : 'none'
  if (!e.target.checked) document.getElementById('inputPassCSVBitwarden').value = ''
  actualizarBtnCSVBitwarden()
})

// Contraseña: habilita el botón si checkbox está marcado y hay contraseña
document.getElementById('inputPassCSVBitwarden').addEventListener('input', actualizarBtnCSVBitwarden)

document.getElementById('btnTogglePassCSVBitwarden').addEventListener('click', () => {
  const el = document.getElementById('inputPassCSVBitwarden')
  el.type  = el.type === 'password' ? 'text' : 'password'
})

// ── Backup — Importar vault ──
document.getElementById('btnImportar').addEventListener('click', mostrarFormImportar)
document.getElementById('btnCancelarImportar').addEventListener('click', () => {
  document.getElementById('formImportar').classList.add('hidden')
})
document.getElementById('btnConfirmarImportar').addEventListener('click', confirmarImportar)
document.getElementById('btnToggleImportarPass').addEventListener('click', () => {
  const el = document.getElementById('inputImportarPass')
  el.type  = el.type === 'password' ? 'text' : 'password'
})

// ── Sincronización ──
document.getElementById('btnConectarGoogle').addEventListener('click', conectarGoogle)
document.getElementById('btnDesconectarGoogle').addEventListener('click', desconectarGoogle)
document.getElementById('btnSyncAhora').addEventListener('click', syncAhora)

// ── Zona de peligro ──
document.getElementById('btnBorrarTodo').addEventListener('click', borrarTodo)

// ── Inicializar wizard de importación CSV (F1.1) ──
inicializarWizardImport()

// ── Arrancar ──
inicializar()
