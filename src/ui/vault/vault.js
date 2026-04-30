// ============================================
// Dacmos Password Manager — Vault Logic
// E1.5: CRUD completo de credenciales cifradas
// F1.2: Generador TOTP integrado (RFC 6238)
// F1.3: Password Health Reports
// F1.5: Tipos de credencial (Login · Tarjeta · Identidad)
// ============================================

import { desbloquearVault, guardarVaultCifrado, cargarVaultDescifrado } from '../../crypto/engine.js'
import { generarCodigo, esBase32Valido, segundosRestantes } from '../../crypto/totp.js'
import { analizarSaludLocal } from '../../health/password-health.js'
import {
  TIPO_LOGIN, TIPO_TARJETA, TIPO_IDENTIDAD,
  resolverTipo,
  obtenerIconoTipo, obtenerTituloLista, obtenerSubtituloLista,
  renderFormularioLogin, renderFormularioTarjeta, renderFormularioIdentidad,
  leerFormularioLogin, leerFormularioTarjeta, leerFormularioIdentidad,
  llenarFormularioLogin, llenarFormularioTarjeta, llenarFormularioIdentidad,
  htmlExtraTarjeta, revelarCampoTarjeta,
} from './credential-types.js'

// ── Referencias al DOM (estáticas — no incluyen campos del formulario dinámico) ──
const unlockOverlay      = document.getElementById('unlockOverlay')
const vaultWrapper       = document.getElementById('vaultWrapper')
const unlockInput        = document.getElementById('unlockInput')
const unlockError        = document.getElementById('unlockError')
const btnDesbloquear     = document.getElementById('btnDesbloquear')
const credentialList     = document.getElementById('credentialList')
const credentialCounter  = document.getElementById('credentialCounter')
const emptyState         = document.getElementById('emptyState')
const searchInput        = document.getElementById('searchInput')
const modalOverlay       = document.getElementById('modalOverlay')
const modalTitle         = document.getElementById('modalTitle')
const modalError         = document.getElementById('modalError')
const btnNuevaCredencial = document.getElementById('btnNuevaCredencial')
const btnHealth          = document.getElementById('btnHealth')
const btnAgregarPrimero  = document.getElementById('btnAgregarPrimero')
const btnCerrarModal     = document.getElementById('btnCerrarModal')
const btnCancelar        = document.getElementById('btnCancelar')
const btnGuardar         = document.getElementById('btnGuardar')
const typeSelector       = document.getElementById('typeSelector')
const formContainer      = document.getElementById('formContainer')

// ── Estado local ──
let credenciales       = []
let credencialEditando = null
let claveSesion        = null   // Clave AES en memoria — nunca va a storage
let reporteSalud       = null   // Último reporte de salud local (sin contraseñas)
let tipoActivo         = TIPO_LOGIN  // Tipo seleccionado en el modal

// ── Estado del countdown TOTP ──
let intervalCountdown = null
let periodoUltimo     = -1

// ── Inicialización ──
async function inicializar() {
  await new Promise(resolve => chrome.storage.local.get(['sesionActiva'], resolve))
  unlockInput.focus()

  const params = new URLSearchParams(window.location.search)
  if (params.get('action') === 'new') {
    window._abrirModalAlDesbloquear = true
  }
}

// ── Desbloquear vault ──
async function desbloquear() {
  const password = unlockInput.value
  if (!password) {
    mostrarErrorUnlock('Ingresa tu contraseña maestra')
    return
  }

  btnDesbloquear.textContent = 'Verificando...'
  btnDesbloquear.disabled    = true
  unlockError.classList.add('hidden')

  try {
    claveSesion = await desbloquearVault(password)
    if (!claveSesion) {
      mostrarErrorUnlock('Contraseña incorrecta')
      unlockInput.value = ''
      unlockInput.focus()
      return
    }

    credenciales = await cargarVaultDescifrado(claveSesion)

    chrome.runtime.sendMessage({
      tipo:         'VAULT_DESBLOQUEADO',
      credenciales: credenciales,
    })

    unlockOverlay.classList.add('hidden')
    vaultWrapper.classList.remove('hidden')
    btnNuevaCredencial.classList.remove('hidden')

    renderizarLista(credenciales)
    programarAnalisisSalud(credenciales)

    if (window._abrirModalAlDesbloquear) {
      abrirModal()
      window._abrirModalAlDesbloquear = false
    }

  } catch (_) {
    mostrarErrorUnlock('Error al desbloquear — intenta de nuevo')
  } finally {
    btnDesbloquear.textContent = 'Desbloquear Vault'
    btnDesbloquear.disabled    = false
  }
}

function mostrarErrorUnlock(mensaje) {
  unlockError.textContent = mensaje
  unlockError.classList.remove('hidden')
}

// ── Renderizar lista ──
function renderizarLista(lista) {
  credentialList.innerHTML = ''

  const total = credenciales.length
  credentialCounter.textContent = total > 0
    ? `${lista.length} de ${total} credencial${total !== 1 ? 'es' : ''}`
    : ''

  if (lista.length === 0) {
    emptyState.classList.remove('hidden')
    credentialList.classList.add('hidden')
    detenerCountdown()
    return
  }

  emptyState.classList.add('hidden')
  credentialList.classList.remove('hidden')
  lista.forEach(cred => credentialList.appendChild(crearItemCredencial(cred)))

  if (credenciales.some(c => c.claveTotp)) iniciarCountdown()
  else detenerCountdown()
}

function crearItemCredencial(cred) {
  const tipo = resolverTipo(cred)
  if (tipo === TIPO_TARJETA)   return crearItemTarjeta(cred)
  if (tipo === TIPO_IDENTIDAD) return crearItemIdentidad(cred)
  return crearItemLogin(cred)
}

// ── Item de tipo Login ──
function crearItemLogin(cred) {
  const li      = document.createElement('li')
  li.className  = 'credential-item'
  li.dataset.id = cred.id

  const fecha = new Date(cred.modificado).toLocaleDateString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const badgeTotp = cred.claveTotp ? `
    <div class="totp-badge" id="totp-badge-${cred.id}">
      <span class="totp-etiqueta">2FA</span>
      <span class="totp-codigo" id="totp-codigo-${cred.id}">······</span>
      <div class="totp-barra-wrap">
        <div class="totp-barra" id="totp-barra-${cred.id}"></div>
      </div>
      <span class="totp-timer" id="totp-timer-${cred.id}">--s</span>
      <button class="btn-icon btn-copiar-totp" data-id="${cred.id}" title="Copiar código 2FA">📋</button>
    </div>` : ''

  const itemSalud   = reporteSalud?.items.find(i => i.id === cred.id)
  const htmlSalud   = itemSalud ? htmlBadgesSaludVault(itemSalud) : ''
  const badgesSalud = htmlSalud
    ? `<div class="health-badge-row">${htmlSalud}</div>`
    : `<div class="health-badge-row hidden" id="health-row-${cred.id}"></div>`

  li.innerHTML = `
    <div class="credential-avatar">${escapeHtml(obtenerIconoTipo(cred))}</div>
    <div class="credential-info">
      <div class="credential-site">${escapeHtml(obtenerTituloLista(cred))}</div>
      <div class="credential-user">${escapeHtml(obtenerSubtituloLista(cred))}</div>
      <div class="credential-date">Modificado: ${fecha}</div>
      ${badgesSalud}
      ${badgeTotp}
    </div>
    <div class="credential-actions">
      <button class="btn-icon btn-copiar"   data-id="${cred.id}" title="Copiar contraseña">📋</button>
      <button class="btn-icon btn-editar"   data-id="${cred.id}" title="Editar">✏️</button>
      <button class="btn-icon btn-eliminar" data-id="${cred.id}" title="Eliminar">🗑️</button>
    </div>
  `

  li.querySelector('.btn-copiar').addEventListener('click',   e => { e.stopPropagation(); copiarPassword(cred.id) })
  li.querySelector('.btn-editar').addEventListener('click',   e => { e.stopPropagation(); abrirModalEdicion(cred.id) })
  li.querySelector('.btn-eliminar').addEventListener('click', e => { e.stopPropagation(); eliminarCredencial(cred.id) })

  if (cred.claveTotp) {
    li.querySelector('.btn-copiar-totp').addEventListener('click', e => {
      e.stopPropagation()
      copiarTotp(cred.id)
    })
  }

  return li
}

// ── Item de tipo Tarjeta ──
function crearItemTarjeta(cred) {
  const li      = document.createElement('li')
  li.className  = 'credential-item'
  li.dataset.id = cred.id

  const fecha = new Date(cred.modificado).toLocaleDateString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  li.innerHTML = `
    <div class="credential-avatar">${escapeHtml(obtenerIconoTipo(cred))}</div>
    <div class="credential-info">
      <div class="credential-site">${escapeHtml(obtenerTituloLista(cred))}</div>
      <div class="credential-user">${escapeHtml(obtenerSubtituloLista(cred))}</div>
      ${htmlExtraTarjeta(cred)}
      <div class="credential-date">Modificado: ${fecha}</div>
    </div>
    <div class="credential-actions">
      <button class="btn-icon btn-copiar-num" data-id="${cred.id}" title="Copiar número">📋</button>
      <button class="btn-icon btn-editar"     data-id="${cred.id}" title="Editar">✏️</button>
      <button class="btn-icon btn-eliminar"   data-id="${cred.id}" title="Eliminar">🗑️</button>
    </div>
  `

  // Revelar número al hacer clic en el botón de ojo
  li.querySelectorAll('.btn-revelar').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      revelarCampoTarjeta(cred, btn.dataset.campo)
    })
  })

  // Copiar número completo al portapapeles
  li.querySelector('.btn-copiar-num').addEventListener('click', e => {
    e.stopPropagation()
    copiarAlPortapapeles(cred.numero, li.querySelector('.btn-copiar-num'), 'Copiar número')
  })

  li.querySelector('.btn-editar').addEventListener('click',   e => { e.stopPropagation(); abrirModalEdicion(cred.id) })
  li.querySelector('.btn-eliminar').addEventListener('click', e => { e.stopPropagation(); eliminarCredencial(cred.id) })

  return li
}

// ── Item de tipo Identidad ──
function crearItemIdentidad(cred) {
  const li      = document.createElement('li')
  li.className  = 'credential-item'
  li.dataset.id = cred.id

  const fecha = new Date(cred.modificado).toLocaleDateString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const telefono = cred.telefono
    ? `<div class="credential-user">${escapeHtml(cred.telefono)}</div>`
    : ''

  li.innerHTML = `
    <div class="credential-avatar">${escapeHtml(obtenerIconoTipo(cred))}</div>
    <div class="credential-info">
      <div class="credential-site">${escapeHtml(obtenerTituloLista(cred))}</div>
      <div class="credential-user">${escapeHtml(obtenerSubtituloLista(cred))}</div>
      ${telefono}
      <div class="credential-date">Modificado: ${fecha}</div>
    </div>
    <div class="credential-actions">
      <button class="btn-icon btn-editar"   data-id="${cred.id}" title="Editar">✏️</button>
      <button class="btn-icon btn-eliminar" data-id="${cred.id}" title="Eliminar">🗑️</button>
    </div>
  `

  li.querySelector('.btn-editar').addEventListener('click',   e => { e.stopPropagation(); abrirModalEdicion(cred.id) })
  li.querySelector('.btn-eliminar').addEventListener('click', e => { e.stopPropagation(); eliminarCredencial(cred.id) })

  return li
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = String(str || '')
  return div.innerHTML
}

// ── TOTP: Countdown y actualización en tiempo real ──

function iniciarCountdown() {
  detenerCountdown()
  periodoUltimo = -1
  actualizarBadgesTotp()
  intervalCountdown = setInterval(actualizarBadgesTotp, 1000)
}

function detenerCountdown() {
  if (intervalCountdown !== null) {
    clearInterval(intervalCountdown)
    intervalCountdown = null
  }
}

async function actualizarBadgesTotp() {
  const ahora         = Math.floor(Date.now() / 1000)
  const periodoActual = Math.floor(ahora / 30)
  const restantes     = segundosRestantes()
  const periodoNuevo  = periodoActual !== periodoUltimo

  if (periodoNuevo) periodoUltimo = periodoActual

  for (const cred of credenciales) {
    if (!cred.claveTotp) continue

    const barraEl  = document.getElementById(`totp-barra-${cred.id}`)
    const timerEl  = document.getElementById(`totp-timer-${cred.id}`)
    const codigoEl = document.getElementById(`totp-codigo-${cred.id}`)

    if (!barraEl || !timerEl || !codigoEl) continue

    barraEl.style.width = `${(restantes / 30) * 100}%`
    timerEl.textContent = `${restantes}s`

    const expirando = restantes <= 5
    barraEl.classList.toggle('totp-barra-expirando', expirando)
    timerEl.classList.toggle('totp-timer-expirando',  expirando)

    if (periodoNuevo || codigoEl.textContent === '······') {
      try {
        const codigo = await generarCodigo(cred.claveTotp)
        codigoEl.textContent = `${codigo.slice(0, 3)} ${codigo.slice(3)}`
      } catch (_) {
        codigoEl.textContent = 'ERROR'
      }
    }
  }
}

// ── CRUD ──

async function copiarPassword(id) {
  const cred = credenciales.find(c => c.id === id)
  if (!cred) return
  await copiarAlPortapapeles(
    cred.password,
    document.querySelector(`.btn-copiar[data-id="${id}"]`),
    'Copiar contraseña',
  )
}

// Función genérica de copia al portapapeles con feedback visual
async function copiarAlPortapapeles(texto, btn, tituloOriginal) {
  if (!texto) return
  await navigator.clipboard.writeText(texto)

  const { config } = await new Promise(r => chrome.storage.local.get(['config'], r))
  const segundos = config?.clipboard ?? 30
  if (segundos > 0) {
    setTimeout(async () => {
      try { await navigator.clipboard.writeText('') } catch (_) {}
    }, segundos * 1000)
  }

  if (btn) {
    const textoOriginal = btn.textContent
    btn.textContent = '✅'
    btn.title = 'Copiado!'
    setTimeout(() => {
      btn.textContent = textoOriginal
      btn.title = tituloOriginal
    }, 2000)
  }
}

async function copiarTotp(id) {
  const cred = credenciales.find(c => c.id === id)
  if (!cred?.claveTotp) return

  try {
    const codigo = await generarCodigo(cred.claveTotp)
    await copiarAlPortapapeles(
      codigo,
      document.querySelector(`.btn-copiar-totp[data-id="${id}"]`),
      'Copiar código 2FA',
    )
  } catch (_) {}
}

async function eliminarCredencial(id) {
  const cred = credenciales.find(c => c.id === id)
  if (!confirm(`¿Eliminar credencial de "${obtenerTituloLista(cred)}"?`)) return

  credenciales = credenciales.filter(c => c.id !== id)
  await guardarVaultCifrado(credenciales, claveSesion)
  renderizarLista(credenciales)
}

// ── Modal ──

function activarTab(tipo) {
  tipoActivo = tipo
  typeSelector.querySelectorAll('.type-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tipo === tipo)
  })
  inyectarFormulario(tipo)
}

function inyectarFormulario(tipo) {
  if (tipo === TIPO_TARJETA) {
    formContainer.innerHTML = renderFormularioTarjeta()
    registrarToggle('inputNumero', 'btnToggleNumero')
    registrarToggle('inputCvv',    'btnToggleCvv')
    // Formateo automático MM/AA en el campo de vencimiento
    const vencEl = document.getElementById('inputVencimiento')
    if (vencEl) {
      vencEl.addEventListener('input', () => {
        let v = vencEl.value.replace(/\D/g, '')
        if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2, 4)
        vencEl.value = v
      })
    }
  } else if (tipo === TIPO_IDENTIDAD) {
    formContainer.innerHTML = renderFormularioIdentidad()
  } else {
    formContainer.innerHTML = renderFormularioLogin()
    registrarToggle('inputPassword', 'btnTogglePass')
    // Generador rápido de contraseña
    const btnGen = document.getElementById('btnGenerarPass')
    if (btnGen) {
      btnGen.addEventListener('click', () => {
        const chars    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
        const array    = new Uint8Array(16)
        crypto.getRandomValues(array)
        const pwd = Array.from(array).map(b => chars[b % chars.length]).join('')
        document.getElementById('inputPassword').value = pwd
        document.getElementById('inputPassword').type  = 'text'
        evaluarFortaleza(pwd)
      })
    }
    // Evaluador de fortaleza
    const passEl = document.getElementById('inputPassword')
    if (passEl) passEl.addEventListener('input', e => evaluarFortaleza(e.target.value))
    // Toggle TOTP
    registrarToggle('inputTotp', 'btnToggleTotp')
  }
}

// Registra el toggle mostrar/ocultar para un par input+botón
function registrarToggle(inputId, btnId) {
  const input = document.getElementById(inputId)
  const btn   = document.getElementById(btnId)
  if (input && btn) {
    btn.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password'
    })
  }
}

function abrirModal() {
  credencialEditando = null
  modalTitle.textContent = '+ Nueva Credencial'
  modalError.classList.add('hidden')
  // Bloquear selector de tipo en nueva credencial (el usuario elige antes de guardar)
  typeSelector.querySelectorAll('.type-tab').forEach(btn => btn.disabled = false)
  activarTab(TIPO_LOGIN)
  modalOverlay.classList.remove('hidden')
  // Foco en el primer campo del formulario inyectado
  setTimeout(() => formContainer.querySelector('input')?.focus(), 50)
}

function abrirModalEdicion(id) {
  const cred = credenciales.find(c => c.id === id)
  if (!cred) return

  const tipo = resolverTipo(cred)
  credencialEditando = id
  modalTitle.textContent = `✏️ Editar — ${obtenerTituloLista(cred)}`
  modalError.classList.add('hidden')

  // Bloquear cambio de tipo al editar para preservar integridad de la credencial
  activarTab(tipo)
  typeSelector.querySelectorAll('.type-tab').forEach(btn => btn.disabled = true)

  // Rellenar el formulario con los datos actuales
  if (tipo === TIPO_TARJETA)        llenarFormularioTarjeta(cred)
  else if (tipo === TIPO_IDENTIDAD) llenarFormularioIdentidad(cred)
  else {
    llenarFormularioLogin(cred)
    evaluarFortaleza(cred.password || '')
  }

  modalOverlay.classList.remove('hidden')
}

function cerrarModal() {
  modalOverlay.classList.add('hidden')
  credencialEditando = null
  // Desbloquear tabs para la próxima apertura
  typeSelector.querySelectorAll('.type-tab').forEach(btn => btn.disabled = false)
}

// ── GUARDAR credencial (crear o actualizar) ──
async function guardarCredencial() {
  modalError.classList.add('hidden')

  // Leer datos según el tipo activo
  let datos
  if (tipoActivo === TIPO_TARJETA) {
    datos = leerFormularioTarjeta()
  } else if (tipoActivo === TIPO_IDENTIDAD) {
    datos = leerFormularioIdentidad()
  } else {
    datos = leerFormularioLogin(esBase32Valido)
  }

  if (datos.error) {
    mostrarErrorModal(datos.error)
    return
  }

  const ahora = new Date().toISOString()

  if (credencialEditando) {
    const idx = credenciales.findIndex(c => c.id === credencialEditando)
    if (idx !== -1) {
      credenciales[idx] = {
        ...credenciales[idx],
        ...datos,
        modificado: ahora,
      }
    }
  } else {
    credenciales.push({
      id:         crypto.randomUUID(),
      ...datos,
      creado:     ahora,
      modificado: ahora,
    })
  }

  btnGuardar.textContent = 'Guardando...'
  btnGuardar.disabled    = true

  try {
    await guardarVaultCifrado(credenciales, claveSesion)
    cerrarModal()
    renderizarLista(credenciales)
    programarAnalisisSalud(credenciales)
  } catch (_) {
    mostrarErrorModal('Error al guardar — intenta de nuevo')
  } finally {
    btnGuardar.textContent = 'Guardar'
    btnGuardar.disabled    = false
  }
}

function mostrarErrorModal(mensaje) {
  modalError.textContent = mensaje
  modalError.classList.remove('hidden')
}

// ── F1.3: Salud de contraseñas ──
// Solo se analizan credenciales de tipo login (las únicas con contraseña).

function htmlBadgesSaludVault(item) {
  const badges = []
  if (item.esDebil)       badges.push(`<span class="vault-hbadge badge-debil" title="Entropía baja: ${item.entropia} bits">⚠ ${item.entropia}b</span>`)
  if (item.esReutilizada) badges.push(`<span class="vault-hbadge badge-reutilizada" title="Misma contraseña en múltiples sitios">🔁</span>`)
  return badges.join('')
}

async function programarAnalisisSalud(creds) {
  // Filtrar explícitamente solo credenciales login — las de tarjeta e identidad no tienen contraseña
  const credsLogin = creds.filter(c => !c.tipo || c.tipo === TIPO_LOGIN)
  if (!credsLogin.length) return

  try {
    reporteSalud = await analizarSaludLocal(credsLogin)
    btnHealth.classList.remove('hidden')

    for (const item of reporteSalud.items) {
      const placeholder = document.getElementById(`health-row-${item.id}`)
      if (!placeholder) continue
      const html = htmlBadgesSaludVault(item)
      if (html) {
        placeholder.innerHTML = html
        placeholder.classList.remove('hidden')
      }
    }
  } catch (_) {}
}

async function abrirHealthDashboard() {
  // Filtrar explícitamente solo credenciales login antes de pasar al dashboard
  const credsLogin = credenciales.filter(c => !c.tipo || c.tipo === TIPO_LOGIN)
  if (!credsLogin.length || !reporteSalud) return

  btnHealth.textContent = 'Analizando...'
  btnHealth.disabled    = true

  try {
    await new Promise(r => chrome.storage.session.set({ healthReport: reporteSalud }, r))
    chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/health/health.html') })
  } finally {
    btnHealth.textContent = '🛡 Health'
    btnHealth.disabled    = false
  }
}

// ── Evaluador de fortaleza (solo para tipo login) ──
function evaluarFortaleza(password) {
  const fillEl  = document.getElementById('strengthFill')
  const labelEl = document.getElementById('strengthLabel')
  if (!fillEl || !labelEl) return

  let puntos = 0
  if (password.length >= 8)           puntos++
  if (password.length >= 12)          puntos++
  if (/[A-Z]/.test(password))        puntos++
  if (/[0-9]/.test(password))        puntos++
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
  fillEl.style.width            = nivel.ancho
  fillEl.style.backgroundColor  = nivel.color
  labelEl.textContent           = nivel.label
  labelEl.style.color           = nivel.color
}

// ── Event Listeners ──

// Desbloqueo
btnDesbloquear.addEventListener('click', desbloquear)
unlockInput.addEventListener('keydown', e => { if (e.key === 'Enter') desbloquear() })
document.getElementById('btnToggleUnlock').addEventListener('click', () => {
  unlockInput.type = unlockInput.type === 'password' ? 'text' : 'password'
})

// Health Dashboard
btnHealth.addEventListener('click', abrirHealthDashboard)

// Modal
btnNuevaCredencial.addEventListener('click', abrirModal)
btnAgregarPrimero.addEventListener('click',  abrirModal)
btnCerrarModal.addEventListener('click',     cerrarModal)
btnCancelar.addEventListener('click',        cerrarModal)
btnGuardar.addEventListener('click',         guardarCredencial)

// Selector de tipo — solo activo cuando el modal está en modo "nueva credencial"
typeSelector.addEventListener('click', e => {
  const tab = e.target.closest('.type-tab')
  if (!tab || tab.disabled) return
  activarTab(tab.dataset.tipo)
})

modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) cerrarModal()
})

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
    cerrarModal()
  }
})

// Búsqueda en tiempo real — compatible con todos los tipos
searchInput.addEventListener('input', e => {
  const termino = e.target.value.toLowerCase()
  const filtradas = credenciales.filter(c => {
    if (!termino) return true
    const tipo = resolverTipo(c)
    if (tipo === TIPO_TARJETA) {
      return (c.alias   || '').toLowerCase().includes(termino) ||
             (c.titular || '').toLowerCase().includes(termino) ||
             (c.banco   || '').toLowerCase().includes(termino)
    }
    if (tipo === TIPO_IDENTIDAD) {
      return (c.nombre || '').toLowerCase().includes(termino) ||
             (c.email  || '').toLowerCase().includes(termino)
    }
    // Login (default)
    return (c.sitio   || '').toLowerCase().includes(termino) ||
           (c.usuario || '').toLowerCase().includes(termino) ||
           (c.url     || '').toLowerCase().includes(termino)
  })
  renderizarLista(filtradas)
})

// ── Arrancar ──
inicializar()
