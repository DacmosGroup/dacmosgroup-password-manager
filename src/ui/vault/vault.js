// ============================================
// Dacmos Password Manager — Vault Logic
// E1.5: CRUD completo de credenciales cifradas
// F1.2: Generador TOTP integrado (RFC 6238)
// F1.3: Password Health Reports
// ============================================

import { desbloquearVault, guardarVaultCifrado, cargarVaultDescifrado } from '../../crypto/engine.js'
import { generarCodigo, esBase32Valido, segundosRestantes } from '../../crypto/totp.js'
import { analizarSaludLocal } from '../../health/password-health.js'

// ── Referencias al DOM ──
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
const strengthFill       = document.getElementById('strengthFill')
const strengthLabel      = document.getElementById('strengthLabel')
const inputTotp          = document.getElementById('inputTotp')
const btnToggleTotp      = document.getElementById('btnToggleTotp')

// ── Estado local ──
let credenciales       = []
let credencialEditando = null
let claveSesion        = null   // Clave AES en memoria — nunca va a storage
let reporteSalud       = null   // Último reporte de salud local (sin contraseñas)

// ── Estado del countdown TOTP ──
let intervalCountdown = null
let periodoUltimo     = -1      // Último período procesado; -1 fuerza generación inicial

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

    // DECISIÓN DE SEGURIDAD: credenciales viajan en memoria, nunca en disco
    chrome.runtime.sendMessage({
      tipo:         'VAULT_DESBLOQUEADO',
      credenciales: credenciales,
    })

    unlockOverlay.classList.add('hidden')
    vaultWrapper.classList.remove('hidden')
    btnNuevaCredencial.classList.remove('hidden')

    renderizarLista(credenciales)

    // Análisis de salud en background — no bloquea la UI de desbloqueo
    programarAnalisisSalud(credenciales)

    if (window._abrirModalAlDesbloquear) {
      abrirModal()
      window._abrirModalAlDesbloquear = false
    }

  } catch (error) {
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

  // Iniciar countdown si alguna credencial (del set total) tiene TOTP configurado
  if (credenciales.some(c => c.claveTotp)) iniciarCountdown()
  else detenerCountdown()
}

function crearItemCredencial(cred) {
  const li      = document.createElement('li')
  li.className  = 'credential-item'
  li.dataset.id = cred.id

  const fecha = new Date(cred.modificado).toLocaleDateString('es', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  // Badge TOTP: solo renderizado si la credencial tiene clave TOTP configurada.
  // El código de 6 dígitos se carga de forma asíncrona en el primer tick del countdown.
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

  // Badges de salud: si el reporte ya está disponible (re-render posterior al análisis),
  // los inyectamos directamente; si no, dejamos un placeholder vacío que se rellena async.
  const itemSalud   = reporteSalud?.items.find(i => i.id === cred.id)
  const htmlSalud   = itemSalud ? htmlBadgesSaludVault(itemSalud) : ''
  const badgesSalud = htmlSalud
    ? `<div class="health-badge-row">${htmlSalud}</div>`
    : `<div class="health-badge-row hidden" id="health-row-${cred.id}"></div>`

  li.innerHTML = `
    <div class="credential-avatar">${obtenerIcono(cred.sitio)}</div>
    <div class="credential-info">
      <div class="credential-site">${escapeHtml(cred.sitio)}</div>
      <div class="credential-user">${escapeHtml(cred.usuario)}</div>
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

  li.querySelector('.btn-copiar').addEventListener('click',   (e) => { e.stopPropagation(); copiarPassword(cred.id) })
  li.querySelector('.btn-editar').addEventListener('click',   (e) => { e.stopPropagation(); abrirModalEdicion(cred.id) })
  li.querySelector('.btn-eliminar').addEventListener('click', (e) => { e.stopPropagation(); eliminarCredencial(cred.id) })

  if (cred.claveTotp) {
    li.querySelector('.btn-copiar-totp').addEventListener('click', (e) => {
      e.stopPropagation()
      copiarTotp(cred.id)
    })
  }

  return li
}

function obtenerIcono(sitio) {
  const n = sitio.toLowerCase()
  if (n.includes('google') || n.includes('gmail')) return '🔵'
  if (n.includes('github'))   return '⚫'
  if (n.includes('facebook')) return '🔷'
  if (n.includes('twitter') || n.includes('x.com')) return '🐦'
  if (n.includes('netflix'))  return '🔴'
  if (n.includes('amazon'))   return '📦'
  if (n.includes('banco') || n.includes('bank')) return '🏦'
  if (n.includes('linkedin')) return '💼'
  if (n.includes('microsoft') || n.includes('outlook')) return '🪟'
  if (n.includes('apple'))    return '🍎'
  return '🔐'
}

// Prevenir XSS al mostrar datos del usuario en el DOM
function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

// ── TOTP: Countdown y actualización en tiempo real ──

function iniciarCountdown() {
  detenerCountdown()
  periodoUltimo = -1        // Forzar generación de código en el primer tick
  actualizarBadgesTotp()    // Actualización inmediata sin esperar 1 segundo
  intervalCountdown = setInterval(actualizarBadgesTotp, 1000)
}

function detenerCountdown() {
  if (intervalCountdown !== null) {
    clearInterval(intervalCountdown)
    intervalCountdown = null
  }
}

// Actualiza todos los badges TOTP visibles en el DOM.
// Se ejecuta cada segundo. La regeneración del código TOTP (async)
// solo ocurre al inicio y en cada cambio de período (cada 30 s).
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

    // El badge puede no estar en el DOM si la credencial fue filtrada
    if (!barraEl || !timerEl || !codigoEl) continue

    // Actualizar barra de progreso (ancho proporcional al tiempo restante)
    barraEl.style.width = `${(restantes / 30) * 100}%`
    timerEl.textContent = `${restantes}s`

    // Indicador visual de expiración inminente (≤ 5 segundos)
    const expirando = restantes <= 5
    barraEl.classList.toggle('totp-barra-expirando', expirando)
    timerEl.classList.toggle('totp-timer-expirando',  expirando)

    // Regenerar el código TOTP en el primer tick o al cambiar de período
    if (periodoNuevo || codigoEl.textContent === '······') {
      try {
        const codigo = await generarCodigo(cred.claveTotp)
        // Formatear como "123 456" para facilitar lectura visual
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

  await navigator.clipboard.writeText(cred.password)

  const { config } = await new Promise(r => chrome.storage.local.get(['config'], r))
  const segundos = config?.clipboard ?? 30
  if (segundos > 0) {
    setTimeout(async () => {
      try { await navigator.clipboard.writeText('') } catch (_) {}
    }, segundos * 1000)
  }

  const btn = document.querySelector(`.btn-copiar[data-id="${id}"]`)
  if (btn) {
    const textoOriginal = btn.textContent
    btn.textContent = '✅'
    btn.title = 'Copiado!'
    setTimeout(() => {
      btn.textContent = textoOriginal
      btn.title = 'Copiar contraseña'
    }, 2000)
  }
}

// Copia el código TOTP actualmente vigente al portapapeles
async function copiarTotp(id) {
  const cred = credenciales.find(c => c.id === id)
  if (!cred?.claveTotp) return

  try {
    const codigo = await generarCodigo(cred.claveTotp)
    await navigator.clipboard.writeText(codigo)

    const { config } = await new Promise(r => chrome.storage.local.get(['config'], r))
    const segundos = config?.clipboard ?? 30
    if (segundos > 0) {
      setTimeout(async () => {
        try { await navigator.clipboard.writeText('') } catch (_) {}
      }, segundos * 1000)
    }

    const btn = document.querySelector(`.btn-copiar-totp[data-id="${id}"]`)
    if (btn) {
      const textoOriginal = btn.textContent
      btn.textContent = '✅'
      btn.title = 'Copiado!'
      setTimeout(() => {
        btn.textContent = textoOriginal
        btn.title = 'Copiar código 2FA'
      }, 2000)
    }
  } catch (_) {
    // Error silencioso en runtime (clave TOTP inválida ya fue bloqueada al guardar)
  }
}

async function eliminarCredencial(id) {
  const cred = credenciales.find(c => c.id === id)
  if (!confirm(`¿Eliminar credencial de "${cred?.sitio}"?`)) return

  credenciales = credenciales.filter(c => c.id !== id)
  await guardarVaultCifrado(credenciales, claveSesion)
  renderizarLista(credenciales)
}

// ── Modal ──

function abrirModal() {
  credencialEditando = null
  modalTitle.textContent = '+ Nueva Credencial'
  modalError.classList.add('hidden')
  limpiarFormulario()
  modalOverlay.classList.remove('hidden')
  document.getElementById('inputSitio').focus()
}

function abrirModalEdicion(id) {
  const cred = credenciales.find(c => c.id === id)
  if (!cred) return

  credencialEditando = id
  modalTitle.textContent = `✏️ Editar — ${cred.sitio}`
  modalError.classList.add('hidden')

  document.getElementById('inputSitio').value    = cred.sitio    || ''
  document.getElementById('inputUrl').value      = cred.url      || ''
  document.getElementById('inputUsuario').value  = cred.usuario  || ''
  document.getElementById('inputPassword').value = cred.password || ''
  document.getElementById('inputNotas').value    = cred.notas    || ''
  inputTotp.value = cred.claveTotp || ''
  inputTotp.type  = 'password'    // Ocultar la clave al abrir edición

  evaluarFortaleza(cred.password || '')
  modalOverlay.classList.remove('hidden')
}

function limpiarFormulario() {
  ;['inputSitio', 'inputUrl', 'inputUsuario', 'inputPassword', 'inputNotas']
    .forEach(id => document.getElementById(id).value = '')
  inputTotp.value = ''
  inputTotp.type  = 'password'
  strengthFill.style.width  = '0%'
  strengthLabel.textContent = ''
}

function cerrarModal() {
  modalOverlay.classList.add('hidden')
  credencialEditando = null
  limpiarFormulario()
}

// GUARDAR credencial (crear o actualizar)
async function guardarCredencial() {
  const sitio    = document.getElementById('inputSitio').value.trim()
  const url      = document.getElementById('inputUrl').value.trim()
  const usuario  = document.getElementById('inputUsuario').value.trim()
  const password = document.getElementById('inputPassword').value
  const notas    = document.getElementById('inputNotas').value.trim()
  const totpRaw  = inputTotp.value.trim()

  modalError.classList.add('hidden')
  if (!sitio)    { mostrarErrorModal('El nombre del sitio es obligatorio'); return }
  if (!usuario)  { mostrarErrorModal('El usuario o email es obligatorio');  return }
  if (!password) { mostrarErrorModal('La contraseña es obligatoria');       return }

  // Validar formato Base32 antes de persistir la clave TOTP
  if (totpRaw && !esBase32Valido(totpRaw)) {
    mostrarErrorModal(
      'La clave ingresada no parece ser Base32 válido. Verifica que copiaste solo la clave, no la URL completa.'
    )
    return
  }

  // Normalizar: mayúsculas, sin espacios ni padding.
  // undefined si el campo está vacío → JSON.stringify lo omite al cifrar.
  const claveTotp = totpRaw
    ? totpRaw.toUpperCase().replace(/[\s=]/g, '')
    : undefined

  const ahora = new Date().toISOString()

  if (credencialEditando) {
    const idx = credenciales.findIndex(c => c.id === credencialEditando)
    if (idx !== -1) {
      credenciales[idx] = {
        ...credenciales[idx],
        sitio, url, usuario, password, notas, claveTotp,
        modificado: ahora,
      }
    }
  } else {
    credenciales.push({
      id:    crypto.randomUUID(),
      sitio, url, usuario, password, notas, claveTotp,
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
    // Re-analizar salud tras cualquier cambio en el vault
    programarAnalisisSalud(credenciales)
  } catch (error) {
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

// Genera el HTML de los badges de salud para una credencial.
// Solo se muestran problemas detectados en el análisis local (sin HIBP).
function htmlBadgesSaludVault(item) {
  const badges = []
  if (item.esDebil)       badges.push(`<span class="vault-hbadge badge-debil" title="Entropía baja: ${item.entropia} bits — usa contraseña más larga y variada">⚠ ${item.entropia}b</span>`)
  if (item.esReutilizada) badges.push(`<span class="vault-hbadge badge-reutilizada" title="Misma contraseña en múltiples sitios">🔁</span>`)
  return badges.join('')
}

// Ejecuta el análisis local de salud en background (no bloquea la UI).
// Actualiza los badges en el DOM cuando el análisis termina.
// Si el reporte ya estaba disponible al renderizar, los badges ya habrán aparecido
// en crearItemCredencial(); esta función solo actualiza los placeholders vacíos.
async function programarAnalisisSalud(creds) {
  if (!creds.length) return
  try {
    reporteSalud = await analizarSaludLocal(creds)

    // Mostrar el botón Health ahora que hay reporte disponible
    btnHealth.classList.remove('hidden')

    // Inyectar badges en los placeholders del DOM actual
    for (const item of reporteSalud.items) {
      const placeholder = document.getElementById(`health-row-${item.id}`)
      if (!placeholder) continue  // El ítem puede estar filtrado por búsqueda
      const html = htmlBadgesSaludVault(item)
      if (html) {
        placeholder.innerHTML = html
        placeholder.classList.remove('hidden')
      }
    }
  } catch (_) {
    // Error silencioso — los badges no aparecen, lo que es seguro
  }
}

// Abre el dashboard de salud: guarda el reporte en session y abre la página.
async function abrirHealthDashboard() {
  if (!credenciales.length || !reporteSalud) return

  btnHealth.textContent = 'Analizando...'
  btnHealth.disabled    = true

  try {
    // Guardar el reporte en session (sin contraseñas en texto plano)
    await new Promise(r => chrome.storage.session.set({ healthReport: reporteSalud }, r))
    chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/health/health.html') })
  } finally {
    btnHealth.textContent = '🛡 Health'
    btnHealth.disabled    = false
  }
}

// ── Evaluador de fortaleza ──
function evaluarFortaleza(password) {
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
  strengthFill.style.width           = nivel.ancho
  strengthFill.style.backgroundColor = nivel.color
  strengthLabel.textContent          = nivel.label
  strengthLabel.style.color          = nivel.color
}

// ── Event Listeners ──

// Desbloqueo
btnDesbloquear.addEventListener('click', desbloquear)
unlockInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') desbloquear()
})
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

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) cerrarModal()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
    cerrarModal()
  }
})

// Mostrar/ocultar contraseña
document.getElementById('btnTogglePass').addEventListener('click', () => {
  const input = document.getElementById('inputPassword')
  input.type  = input.type === 'password' ? 'text' : 'password'
})

// Mostrar/ocultar clave TOTP
btnToggleTotp.addEventListener('click', () => {
  inputTotp.type = inputTotp.type === 'password' ? 'text' : 'password'
})

// Generar contraseña segura
document.getElementById('btnGenerarPass').addEventListener('click', () => {
  const chars    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const array    = new Uint8Array(16)
  crypto.getRandomValues(array)
  const password = Array.from(array).map(b => chars[b % chars.length]).join('')
  document.getElementById('inputPassword').value = password
  document.getElementById('inputPassword').type  = 'text'
  evaluarFortaleza(password)
})

// Evaluar fortaleza al escribir
document.getElementById('inputPassword').addEventListener('input', (e) => {
  evaluarFortaleza(e.target.value)
})

// Búsqueda en tiempo real
searchInput.addEventListener('input', (e) => {
  const termino   = e.target.value.toLowerCase()
  const filtradas = credenciales.filter(c =>
    c.sitio.toLowerCase().includes(termino)   ||
    c.usuario.toLowerCase().includes(termino) ||
    (c.url && c.url.toLowerCase().includes(termino))
  )
  renderizarLista(filtradas)
})

// ── Arrancar ──
inicializar()
