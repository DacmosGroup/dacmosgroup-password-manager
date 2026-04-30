// ================================================
// Dacmos Password Manager — Content Script
// E1.7: Autodetección de campos de login
// F1.5: Detección de checkout (tarjeta) y registro (identidad)
// Se inyecta en todas las páginas web
// ================================================

// ── Constantes de detección de login ──
const SELECTORES_USUARIO = [
  'input[type="email"]',
  'input[type="text"][name*="user"]',
  'input[type="text"][name*="email"]',
  'input[type="text"][name*="login"]',
  'input[type="text"][id*="user"]',
  'input[type="text"][id*="email"]',
  'input[type="text"][id*="login"]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
]

const SELECTORES_PASSWORD = [
  'input[type="password"]',
]

const PALABRAS_LOGIN = [
  'login', 'signin', 'sign-in', 'log-in',
  'iniciar', 'acceder', 'entrar', 'ingresar',
  'auth', 'authenticate',
]

// ── Constantes de detección de checkout (tarjeta) ──
// Atributos autocomplete estándar (señales primarias)
const AUTOCOMPLETE_TARJETA = ['cc-number', 'cc-exp', 'cc-exp-month', 'cc-exp-year', 'cc-csc', 'cc-name']

// Heurísticas de name/id (señales secundarias)
const PATRONES_NUMERO_TARJETA = ['card', 'credit', 'numero', 'number', 'pan', 'tarjeta', 'cardnum']
const PATRONES_CVV            = ['cvv', 'cvc', 'security', 'csc', 'codigo-seg', 'cvv2']
const PATRONES_VENCIMIENTO    = ['expir', 'vencim', 'exp-month', 'exp-year', 'expdate', 'exp']

// ── Constantes de detección de identidad / registro ──
const AUTOCOMPLETE_IDENTIDAD = [
  'name', 'given-name', 'family-name', 'additional-name',
  'tel', 'street-address', 'address-line1', 'postal-code',
  'country', 'country-name',
]

// ── Estado del content script ──
let camposDetectados = {
  // Login
  usuario:    null,
  password:   null,
  formulario: null,
  // Tarjeta de crédito
  numeroTarjeta: null,
  titular:       null,
  vencimiento:   null,
  cvv:           null,
  // Identidad
  nombre:    null,
  email:     null,
  telefono:  null,
  direccion: null,
  ciudad:    null,
  pais:      null,
}

// Tipo de formulario actualmente detectado en la página
let tipoFormularioDetectado = 'login'

let iconosInyectados = []

// ── Función principal de detección ──
function detectarFormularios() {
  // Prioridad: checkout > identidad > login
  if (detectarFormularioTarjeta()) return
  if (detectarFormularioIdentidad()) return
  detectarCamposLogin()
}

// ── Detección de formulario de login ──
function detectarCamposLogin() {
  const camposPassword = document.querySelectorAll(SELECTORES_PASSWORD.join(','))
  if (camposPassword.length === 0) return

  camposPassword.forEach(campoPass => {
    const form = campoPass.closest('form')
    const campoUsuario = encontrarCampoUsuario(form, campoPass)
    if (!esFormularioLogin(form, campoPass)) return

    tipoFormularioDetectado = 'login'
    camposDetectados.usuario    = campoUsuario
    camposDetectados.password   = campoPass
    camposDetectados.formulario = form

    if (campoUsuario) inyectarIcono(campoUsuario, 'usuario')
    inyectarIcono(campoPass, 'password')
    notificarDeteccion('login')
  })
}

function encontrarCampoUsuario(form, campoPassword) {
  if (form) {
    for (const selector of SELECTORES_USUARIO) {
      const campo = form.querySelector(selector)
      if (campo && campo !== campoPassword) return campo
    }
  }
  for (const selector of SELECTORES_USUARIO) {
    const campos = document.querySelectorAll(selector)
    for (const campo of campos) {
      if (campo !== campoPassword) return campo
    }
  }
  return null
}

function esFormularioLogin(form, campoPassword) {
  if (!form) return true
  const textoForm = (
    form.innerHTML +
    form.getAttribute('action') +
    form.getAttribute('id') +
    form.getAttribute('class')
  ).toLowerCase()

  const tieneKeyword   = PALABRAS_LOGIN.some(kw => textoForm.includes(kw))
  const numPasswords   = form.querySelectorAll('input[type="password"]').length
  return tieneKeyword || numPasswords === 1
}

// ── Detección de formulario de tarjeta (checkout) ──
function detectarFormularioTarjeta() {
  let senales = 0

  // Señales primarias: atributos autocomplete estándar
  const hayAutocomplete = AUTOCOMPLETE_TARJETA.some(ac =>
    document.querySelector(`input[autocomplete="${ac}"]`)
  )
  if (hayAutocomplete) senales += 2

  // Señales secundarias: heurísticas de name/id
  const todosInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"]'))

  const campoNumero     = buscarPorPatrones(todosInputs, PATRONES_NUMERO_TARJETA)
  const campoCvv        = buscarPorPatrones(todosInputs, PATRONES_CVV)
  const campoVencim     = buscarPorPatrones(todosInputs, PATRONES_VENCIMIENTO)
  const campoTitularCC  = document.querySelector('input[autocomplete="cc-name"]') ||
                          buscarPorPatrones(todosInputs, ['cardholder', 'card-name', 'nombre-tarjeta', 'cc-name'])

  if (campoNumero)  senales++
  if (campoCvv)     senales++
  if (campoVencim)  senales++

  if (senales < 2) return false  // No hay suficientes señales

  tipoFormularioDetectado       = 'tarjeta'
  camposDetectados.numeroTarjeta = campoNumero || document.querySelector('input[autocomplete="cc-number"]')
  camposDetectados.cvv           = campoCvv    || document.querySelector('input[autocomplete="cc-csc"]')
  camposDetectados.vencimiento   = campoVencim || document.querySelector('input[autocomplete="cc-exp"]')
  camposDetectados.titular       = campoTitularCC

  // Inyectar ícono en el campo de número de tarjeta (el más reconocible para el usuario)
  const campoIcono = camposDetectados.numeroTarjeta || camposDetectados.cvv
  if (campoIcono) inyectarIcono(campoIcono, 'tarjeta')

  notificarDeteccion('tarjeta')
  return true
}

// Busca un input cuyo name o id coincida con algún patrón
function buscarPorPatrones(inputs, patrones) {
  return inputs.find(input => {
    const nameId = `${input.name || ''} ${input.id || ''}`.toLowerCase()
    return patrones.some(p => nameId.includes(p))
  }) || null
}

// ── Detección de formulario de identidad / registro ──
function detectarFormularioIdentidad() {
  let senales = 0

  // Señales primarias: autocomplete estándar
  const camposAC = AUTOCOMPLETE_IDENTIDAD.filter(ac =>
    document.querySelector(`input[autocomplete="${ac}"]`)
  )
  senales += camposAC.length

  // Señales secundarias: cantidad de inputs text/email/tel en el mismo form
  const forms = Array.from(document.querySelectorAll('form'))
  let formCandidato = null
  for (const form of forms) {
    const conteo = form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]').length
    if (conteo >= 4) { senales += 2; formCandidato = form; break }
  }

  if (senales < 3) return false

  tipoFormularioDetectado = 'identidad'

  // Mapear campos al estado
  camposDetectados.nombre    = document.querySelector('input[autocomplete="name"]') ||
                               document.querySelector('input[autocomplete="given-name"]') ||
                               buscarEnForm(formCandidato, ['name', 'nombre', 'firstname', 'first-name'])
  camposDetectados.email     = document.querySelector('input[type="email"]') ||
                               document.querySelector('input[autocomplete="email"]')
  camposDetectados.telefono  = document.querySelector('input[autocomplete="tel"]') ||
                               document.querySelector('input[type="tel"]')
  camposDetectados.direccion = document.querySelector('input[autocomplete="street-address"]') ||
                               document.querySelector('input[autocomplete="address-line1"]') ||
                               buscarEnForm(formCandidato, ['address', 'direccion', 'street'])
  camposDetectados.ciudad    = document.querySelector('input[autocomplete="address-level2"]') ||
                               buscarEnForm(formCandidato, ['city', 'ciudad', 'locality'])
  camposDetectados.pais      = document.querySelector('input[autocomplete="country"]') ||
                               document.querySelector('input[autocomplete="country-name"]') ||
                               buscarEnForm(formCandidato, ['country', 'pais'])

  // Inyectar ícono en el campo de nombre (el primero del formulario)
  const campoIcono = camposDetectados.nombre || camposDetectados.email
  if (campoIcono) inyectarIcono(campoIcono, 'identidad')

  notificarDeteccion('identidad')
  return true
}

// Busca un input cuyo name/id coincida dentro de un form (o de todo el doc)
function buscarEnForm(form, patrones) {
  const contenedor = form || document
  const inputs = Array.from(contenedor.querySelectorAll('input[type="text"]'))
  return buscarPorPatrones(inputs, patrones)
}

// ── Inyectar ícono 🔐 junto al campo ──
function inyectarIcono(campo, tipo) {
  if (campo.dataset.dacmosIcono) return
  const padre = campo.parentElement
  if (padre && padre.querySelector('.dacmos-autofill-icon')) return
  campo.dataset.dacmosIcono = 'true'

  if (!padre) return

  const estiloActual = window.getComputedStyle(padre).position
  if (estiloActual === 'static') padre.style.position = 'relative'

  const icono = document.createElement('button')
  icono.className    = 'dacmos-autofill-icon'
  icono.textContent  = '🔐'
  icono.title        = 'DacmosGroup — Autocompletar'
  icono.type         = 'button'
  icono.dataset.tipo = tipo

  Object.assign(icono.style, {
    position:   'absolute',
    right:      '8px',
    top:        '50%',
    transform:  'translateY(-50%)',
    background: 'transparent',
    border:     'none',
    cursor:     'pointer',
    fontSize:   '16px',
    zIndex:     '999999',
    padding:    '2px',
    lineHeight: '1',
    opacity:    '0.7',
    transition: 'opacity 0.2s',
  })

  icono.addEventListener('mouseenter', () => icono.style.opacity = '1')
  icono.addEventListener('mouseleave', () => icono.style.opacity = '0.7')
  icono.addEventListener('click', e => {
    e.preventDefault()
    e.stopPropagation()
    solicitarAutocompletado()
  })

  padre.appendChild(icono)
  iconosInyectados.push(icono)

  const paddingActual = parseInt(window.getComputedStyle(campo).paddingRight) || 0
  campo.style.paddingRight = Math.max(paddingActual, 32) + 'px'
}

// ── Notificar detección al service worker ──
function notificarDeteccion(tipo) {
  try {
    chrome.runtime.sendMessage({
      tipo:            'CAMPOS_LOGIN_DETECTADOS',
      tipoFormulario:  tipo,
      dominio:         window.location.hostname,
      url:             window.location.href,
    })
  } catch (_) {}
}

// ── Solicitar autocompletado ──
function solicitarAutocompletado() {
  try {
    chrome.runtime.sendMessage({
      tipo:           'SOLICITAR_AUTOCOMPLETADO',
      tipoFormulario: tipoFormularioDetectado,
      dominio:        window.location.hostname,
      url:            window.location.href,
    }, (respuesta) => {
      if (respuesta?.credenciales?.length > 0) {
        mostrarSelectorCredenciales(respuesta.credenciales)
      } else {
        mostrarMensajeSinCredenciales()
      }
    })
  } catch (_) {
    console.log('DacmosGroup: extensión no disponible')
  }
}

// ── Escapar HTML para prevenir XSS ──
function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Etiqueta de subtítulo en el selector según tipo ──
function subtituloCredencial(c) {
  if (c.tipo === 'tarjeta')   return c.titular || ''
  if (c.tipo === 'identidad') return c.email   || ''
  return c.usuario || ''
}

// ── Mostrar selector de credenciales ──
function mostrarSelectorCredenciales(credenciales) {
  eliminarSelectorExistente()

  const overlay = document.createElement('div')
  overlay.id = 'dacmos-credential-selector'

  Object.assign(overlay.style, {
    position:       'fixed',
    inset:          '0',
    background:     'rgba(0,0,0,0.5)',
    zIndex:         '2147483647',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontFamily:     "'Segoe UI', system-ui, sans-serif",
  })

  overlay.innerHTML = `
    <div style="
      background: #16213e;
      border: 1px solid #2a3a5c;
      border-radius: 10px;
      padding: 20px;
      min-width: 300px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #2a3a5c;">
        <span style="color:#00d4ff; font-weight:700; font-size:15px;">🔐 DacmosGroup</span>
        <button id="dacmos-cerrar" style="background:transparent; border:none; color:#8892a4; cursor:pointer; font-size:20px; padding:0 4px;">✕</button>
      </div>
      <p style="color:#8892a4; font-size:12px; margin-bottom:12px;">
        Selecciona una credencial para autocompletar
      </p>
      <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; max-height:240px; overflow-y:auto;">
        ${credenciales.map((c, i) => `
          <li>
            <button class="dacmos-cred-btn" data-index="${i}" style="
              width:100%; background:#0f3460;
              border:1px solid #2a3a5c; border-radius:8px;
              padding:12px 14px; color:#e8e8e8; cursor:pointer;
              text-align:left; display:flex; flex-direction:column; gap:3px;
              transition: border-color 0.2s;
            ">
              <span style="font-weight:600; font-size:13px;">${escapeHtml(c.alias || c.nombre || c.sitio || '')}</span>
              <span style="color:#8892a4; font-size:12px;">${escapeHtml(subtituloCredencial(c))}</span>
            </button>
          </li>
        `).join('')}
      </ul>
      <p style="color:#8892a4; font-size:11px; margin-top:12px; text-align:center;">
        Zero-Knowledge · AES-256-GCM
      </p>
    </div>
  `

  document.body.appendChild(overlay)

  overlay.addEventListener('click', e => {
    if (e.target === overlay) eliminarSelectorExistente()
  })
  document.getElementById('dacmos-cerrar').addEventListener('click', eliminarSelectorExistente)

  const cerrarConEsc = e => {
    if (e.key === 'Escape') {
      eliminarSelectorExistente()
      document.removeEventListener('keydown', cerrarConEsc)
    }
  }
  document.addEventListener('keydown', cerrarConEsc)

  overlay.querySelectorAll('.dacmos-cred-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#0066cc'
      btn.style.background  = '#1a3a6e'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = '#2a3a5c'
      btn.style.background  = '#0f3460'
    })
    btn.addEventListener('click', () => {
      const cred = credenciales[parseInt(btn.dataset.index)]
      llenarCampos(cred)
      eliminarSelectorExistente()
      mostrarFeedbackAutocompletado()
    })
  })
}

// ── Feedback visual al autocompletar ──
function mostrarFeedbackAutocompletado() {
  const camposAResaltar = [
    camposDetectados.usuario,
    camposDetectados.password,
    camposDetectados.numeroTarjeta,
    camposDetectados.nombre,
    camposDetectados.email,
  ]
  camposAResaltar.forEach(campo => {
    if (!campo) return
    const estiloOriginal = campo.style.outline
    campo.style.outline    = '2px solid #2ecc71'
    campo.style.transition = 'outline 0.3s'
    setTimeout(() => { campo.style.outline = estiloOriginal }, 2000)
  })
}

// ── Mostrar mensaje sin credenciales ──
function mostrarMensajeSinCredenciales() {
  eliminarSelectorExistente()
  const msg = document.createElement('div')
  msg.id = 'dacmos-credential-selector'
  msg.innerHTML = `
    <div style="
      position: fixed; bottom: 20px; right: 20px;
      background: #16213e; border: 1px solid #2a3a5c;
      border-radius: 8px; padding: 14px 18px;
      z-index: 2147483647;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #8892a4; font-size: 13px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    ">
      🔐 No hay credenciales guardadas para este formulario
    </div>
  `
  document.body.appendChild(msg)
  setTimeout(eliminarSelectorExistente, 3000)
}

// ── Llenar campos con la credencial seleccionada ──
function llenarCampos(credencial) {
  const tipo = credencial.tipo || 'login'

  if (tipo === 'tarjeta') {
    llenarCampoSingular(camposDetectados.numeroTarjeta, credencial.numero)
    llenarCampoSingular(camposDetectados.titular,       credencial.titular)
    llenarCampoSingular(camposDetectados.vencimiento,   credencial.vencimiento)
    llenarCampoSingular(camposDetectados.cvv,           credencial.cvv)
    return
  }

  if (tipo === 'identidad') {
    llenarCampoSingular(camposDetectados.nombre,    credencial.nombre)
    llenarCampoSingular(camposDetectados.email,     credencial.email)
    llenarCampoSingular(camposDetectados.telefono,  credencial.telefono)
    llenarCampoSingular(camposDetectados.direccion, credencial.direccion)
    llenarCampoSingular(camposDetectados.ciudad,    credencial.ciudad)
    llenarCampoSingular(camposDetectados.pais,      credencial.pais)
    return
  }

  // Login (default)
  llenarCampoSingular(camposDetectados.usuario,  credencial.usuario)
  llenarCampoSingular(camposDetectados.password, credencial.password)
}

// Llena un campo disparando los eventos necesarios para React/Vue/Angular
function llenarCampoSingular(campo, valor) {
  if (!campo || valor == null || valor === '') return
  campo.dispatchEvent(new Event('focus', { bubbles: true }))
  campo.value = valor
  campo.dispatchEvent(new Event('input',  { bubbles: true }))
  campo.dispatchEvent(new Event('change', { bubbles: true }))
  campo.dispatchEvent(new Event('blur',   { bubbles: true }))
}

// ── Limpiar selector existente ──
function eliminarSelectorExistente() {
  const existing = document.getElementById('dacmos-credential-selector')
  if (existing) existing.remove()
}

// ── Escuchar mensajes del service worker ──
chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
  if (mensaje.tipo === 'VERIFICAR_CAMPOS_LOGIN') {
    const tieneLogin = camposDetectados.password !== null
    sendResponse({ tieneLogin, dominio: window.location.hostname })
  }

  if (mensaje.tipo === 'VAULT_BLOQUEADO') {
    iconosInyectados.forEach(icono => icono.remove())
    iconosInyectados = []
    eliminarSelectorExistente()

    const aviso = document.createElement('div')
    aviso.style.cssText = `
      position: fixed; bottom: 20px; right: 20px;
      background: #16213e; border: 1px solid #e74c3c;
      border-radius: 8px; padding: 12px 16px;
      color: #e8e8e8; font-size: 13px; z-index: 2147483647;
      font-family: 'Segoe UI', system-ui, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    `
    aviso.textContent = '🔒 DacmosGroup — Vault bloqueado por inactividad'
    document.body.appendChild(aviso)
    setTimeout(() => aviso.remove(), 4000)
    sendResponse({ ok: true })
  }

  if (mensaje.tipo === 'AUTOCOMPLETAR') {
    llenarCampos(mensaje.credencial)
    sendResponse({ ok: true })
  }
})

// ── Observar cambios en el DOM (SPAs) ──
const observer = new MutationObserver(mutations => {
  const hayNuevosCampos = mutations.some(m =>
    Array.from(m.addedNodes).some(n =>
      n.nodeType === 1 && (
        n.matches?.('input') ||
        n.querySelector?.('input')
      )
    )
  )
  if (hayNuevosCampos) setTimeout(detectarFormularios, 500)
})

observer.observe(document.body, { childList: true, subtree: true })

// ── Notificar actividad del usuario al service worker ──
function notificarActividad() {
  try { chrome.runtime.sendMessage({ tipo: 'ACTIVIDAD_USUARIO' }) } catch (_) {}
}

['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evento => {
  document.addEventListener(evento, notificarActividad, { passive: true })
})

// ── Iniciar detección ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectarFormularios)
} else {
  detectarFormularios()
}
