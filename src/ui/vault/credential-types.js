// ============================================================
// Dacmos Password Manager — Módulo de Tipos de Credencial
// F1.5: Login · Tarjeta de crédito · Identidad
// ============================================================

// ── Constantes de tipo ──
export const TIPO_LOGIN     = 'login'
export const TIPO_TARJETA   = 'tarjeta'
export const TIPO_IDENTIDAD = 'identidad'

// Resuelve el tipo de una credencial; undefined o ausente → login
export function resolverTipo(cred) {
  return cred.tipo || TIPO_LOGIN
}

// ── Icono para el avatar en la lista ──
export function obtenerIconoTipo(cred) {
  const tipo = resolverTipo(cred)
  if (tipo === TIPO_TARJETA)   return '💳'
  if (tipo === TIPO_IDENTIDAD) return '👤'
  // Login: heurística por nombre de sitio
  const n = (cred.sitio || '').toLowerCase()
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

// ── Título y subtítulo para la fila de la lista ──
export function obtenerTituloLista(cred) {
  const tipo = resolverTipo(cred)
  if (tipo === TIPO_TARJETA)   return cred.alias   || 'Tarjeta sin nombre'
  if (tipo === TIPO_IDENTIDAD) return cred.nombre  || 'Identidad sin nombre'
  return cred.sitio || 'Sin nombre'
}

export function obtenerSubtituloLista(cred) {
  const tipo = resolverTipo(cred)
  if (tipo === TIPO_TARJETA)   return cred.titular || ''
  if (tipo === TIPO_IDENTIDAD) return cred.email   || ''
  return cred.usuario || ''
}

// ── Enmascaramiento del número de tarjeta ──
// Muestra solo los últimos 4 dígitos; el resto con asteriscos agrupados.
export function enmascararNumero(numero) {
  if (!numero) return '**** **** **** ****'
  const solo = numero.replace(/\D/g, '')
  const ultimos = solo.slice(-4).padStart(4, '*')
  return `**** **** **** ${ultimos}`
}

// ── Generación de HTML del formulario por tipo ──

export function renderFormularioLogin() {
  return `
    <div class="form-group">
      <label class="form-label">Sitio / Servicio *</label>
      <input type="text" id="inputSitio" class="input"
        placeholder="ej. Gmail, Netflix, GitHub" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">URL (opcional)</label>
      <input type="url" id="inputUrl" class="input"
        placeholder="https://ejemplo.com" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">Usuario / Email *</label>
      <input type="text" id="inputUsuario" class="input"
        placeholder="tu@email.com" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">Contraseña *</label>
      <div class="input-group">
        <input type="password" id="inputPassword" class="input"
          placeholder="Contraseña" autocomplete="off"/>
        <button class="btn-icon" id="btnTogglePass" title="Mostrar/ocultar">👁</button>
        <button class="btn-icon" id="btnGenerarPass" title="Generar contraseña segura">⚡</button>
      </div>
      <div class="strength-bar">
        <div class="strength-fill" id="strengthFill"></div>
      </div>
      <span class="strength-label" id="strengthLabel"></span>
    </div>
    <div class="form-group">
      <label class="form-label">Notas (opcional)</label>
      <textarea id="inputNotas" class="input textarea"
        placeholder="Notas adicionales..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Clave TOTP (2FA) — opcional</label>
      <div class="input-group">
        <input type="password" id="inputTotp" class="input"
          placeholder="ej. JBSWY3DPEHPK3PXP" autocomplete="off"/>
        <button class="btn-icon" id="btnToggleTotp" title="Mostrar/ocultar clave">👁</button>
      </div>
      <span class="form-hint">Clave Base32 de tu autenticador 2FA (solo la clave, no la URL)</span>
    </div>
  `
}

export function renderFormularioTarjeta() {
  return `
    <div class="form-group">
      <label class="form-label">Alias de la tarjeta *</label>
      <input type="text" id="inputAlias" class="input"
        placeholder="ej. Visa Banco General, Mastercard Personal" autocomplete="off"/>
      <span class="form-hint">Nombre para identificar esta tarjeta en tu vault</span>
    </div>
    <div class="form-group">
      <label class="form-label">Titular *</label>
      <input type="text" id="inputTitular" class="input"
        placeholder="Nombre tal como aparece en la tarjeta" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">Número de tarjeta *</label>
      <div class="input-group">
        <input type="password" id="inputNumero" class="input"
          placeholder="XXXX XXXX XXXX XXXX" autocomplete="off"
          inputmode="numeric" maxlength="19"/>
        <button class="btn-icon" id="btnToggleNumero" title="Mostrar/ocultar número">👁</button>
      </div>
    </div>
    <div class="form-row-2">
      <div class="form-group">
        <label class="form-label">Vencimiento *</label>
        <input type="text" id="inputVencimiento" class="input"
          placeholder="MM/AA" autocomplete="off" maxlength="5"/>
      </div>
      <div class="form-group">
        <label class="form-label">CVV *</label>
        <div class="input-group">
          <input type="password" id="inputCvv" class="input"
            placeholder="XXX" autocomplete="off"
            inputmode="numeric" maxlength="4"/>
          <button class="btn-icon" id="btnToggleCvv" title="Mostrar/ocultar CVV">👁</button>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Banco (opcional)</label>
      <input type="text" id="inputBanco" class="input"
        placeholder="ej. Banco General, BAC, Banistmo" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">Notas (opcional)</label>
      <textarea id="inputNotas" class="input textarea"
        placeholder="Notas adicionales..."></textarea>
    </div>
  `
}

export function renderFormularioIdentidad() {
  return `
    <div class="form-group">
      <label class="form-label">Nombre completo *</label>
      <input type="text" id="inputNombre" class="input"
        placeholder="Juan Pérez García" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">Email *</label>
      <input type="email" id="inputEmail" class="input"
        placeholder="tu@email.com" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">Teléfono</label>
      <input type="tel" id="inputTelefono" class="input"
        placeholder="+507 6000-0000" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">Dirección</label>
      <input type="text" id="inputDireccion" class="input"
        placeholder="Calle, número, apto..." autocomplete="off"/>
    </div>
    <div class="form-row-2">
      <div class="form-group">
        <label class="form-label">Ciudad</label>
        <input type="text" id="inputCiudad" class="input"
          placeholder="Ciudad de Panamá" autocomplete="off"/>
      </div>
      <div class="form-group">
        <label class="form-label">País</label>
        <input type="text" id="inputPais" class="input"
          placeholder="Panamá" autocomplete="off"/>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notas (opcional)</label>
      <textarea id="inputNotas" class="input textarea"
        placeholder="Notas adicionales..."></textarea>
    </div>
  `
}

// ── Leer datos del formulario según tipo ──
// Retorna el objeto de datos de la credencial (sin id/creado/modificado).

export function leerFormularioLogin(esBase32Valido) {
  const sitio    = document.getElementById('inputSitio')?.value.trim()    || ''
  const url      = document.getElementById('inputUrl')?.value.trim()      || ''
  const usuario  = document.getElementById('inputUsuario')?.value.trim()  || ''
  const password = document.getElementById('inputPassword')?.value        || ''
  const notas    = document.getElementById('inputNotas')?.value.trim()    || ''
  const totpRaw  = document.getElementById('inputTotp')?.value.trim()     || ''

  // Validaciones
  if (!sitio)    return { error: 'El nombre del sitio es obligatorio' }
  if (!usuario)  return { error: 'El usuario o email es obligatorio' }
  if (!password) return { error: 'La contraseña es obligatoria' }
  if (totpRaw && !esBase32Valido(totpRaw)) {
    return { error: 'La clave TOTP no parece ser Base32 válido. Verifica que copiaste solo la clave.' }
  }

  const claveTotp = totpRaw
    ? totpRaw.toUpperCase().replace(/[\s=]/g, '')
    : undefined

  return { tipo: TIPO_LOGIN, sitio, url, usuario, password, notas, claveTotp }
}

export function leerFormularioTarjeta() {
  const alias       = document.getElementById('inputAlias')?.value.trim()      || ''
  const titular     = document.getElementById('inputTitular')?.value.trim()    || ''
  const numero      = document.getElementById('inputNumero')?.value.replace(/\s/g, '') || ''
  const vencimiento = document.getElementById('inputVencimiento')?.value.trim() || ''
  const cvv         = document.getElementById('inputCvv')?.value.trim()        || ''
  const banco       = document.getElementById('inputBanco')?.value.trim()      || ''
  const notas       = document.getElementById('inputNotas')?.value.trim()      || ''

  if (!alias)       return { error: 'El alias de la tarjeta es obligatorio' }
  if (!titular)     return { error: 'El titular es obligatorio' }
  if (!numero)      return { error: 'El número de tarjeta es obligatorio' }
  if (!/^\d{13,19}$/.test(numero)) return { error: 'El número de tarjeta debe tener entre 13 y 19 dígitos' }
  if (!vencimiento) return { error: 'El vencimiento es obligatorio' }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(vencimiento)) return { error: 'El vencimiento debe tener formato MM/AA' }
  if (!cvv)         return { error: 'El CVV es obligatorio' }
  if (!/^\d{3,4}$/.test(cvv)) return { error: 'El CVV debe tener 3 o 4 dígitos' }

  return { tipo: TIPO_TARJETA, alias, titular, numero, vencimiento, cvv, banco, notas }
}

export function leerFormularioIdentidad() {
  const nombre    = document.getElementById('inputNombre')?.value.trim()    || ''
  const email     = document.getElementById('inputEmail')?.value.trim()     || ''
  const telefono  = document.getElementById('inputTelefono')?.value.trim()  || ''
  const direccion = document.getElementById('inputDireccion')?.value.trim() || ''
  const ciudad    = document.getElementById('inputCiudad')?.value.trim()    || ''
  const pais      = document.getElementById('inputPais')?.value.trim()      || ''
  const notas     = document.getElementById('inputNotas')?.value.trim()     || ''

  if (!nombre) return { error: 'El nombre completo es obligatorio' }
  if (!email)  return { error: 'El email es obligatorio' }

  return { tipo: TIPO_IDENTIDAD, nombre, email, telefono, direccion, ciudad, pais, notas }
}

// ── Rellenar formulario en modo edición ──

export function llenarFormularioLogin(cred) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || '' }
  set('inputSitio',    cred.sitio)
  set('inputUrl',      cred.url)
  set('inputUsuario',  cred.usuario)
  set('inputPassword', cred.password)
  set('inputNotas',    cred.notas)
  const totpEl = document.getElementById('inputTotp')
  if (totpEl) {
    totpEl.value = cred.claveTotp || ''
    totpEl.type  = 'password'
  }
}

export function llenarFormularioTarjeta(cred) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || '' }
  set('inputAlias',       cred.alias)
  set('inputTitular',     cred.titular)
  set('inputNumero',      cred.numero)
  set('inputVencimiento', cred.vencimiento)
  set('inputCvv',         cred.cvv)
  set('inputBanco',       cred.banco)
  set('inputNotas',       cred.notas)
  // Mantener número y CVV ocultos al abrir edición
  const numEl = document.getElementById('inputNumero')
  const cvvEl = document.getElementById('inputCvv')
  if (numEl) numEl.type = 'password'
  if (cvvEl) cvvEl.type = 'password'
}

export function llenarFormularioIdentidad(cred) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || '' }
  set('inputNombre',    cred.nombre)
  set('inputEmail',     cred.email)
  set('inputTelefono',  cred.telefono)
  set('inputDireccion', cred.direccion)
  set('inputCiudad',    cred.ciudad)
  set('inputPais',      cred.pais)
  set('inputNotas',     cred.notas)
}

// ── HTML para el item de tarjeta en la lista del vault ──
// El número y el CVV se muestran enmascarados; el botón revelar
// los expone en memoria por 5 segundos y los vuelve a ocultar.
export function htmlExtraTarjeta(cred) {
  const numMask = enmascararNumero(cred.numero)
  const banco   = cred.banco ? `<span class="cred-banco">${escapeHtmlInterno(cred.banco)}</span>` : ''
  return `
    <div class="card-numero-row">
      <span class="card-numero-mask" id="card-num-${cred.id}">${escapeHtmlInterno(numMask)}</span>
      <button class="btn-revelar" data-id="${cred.id}" data-campo="numero"
        title="Revelar número (5 s)">👁</button>
    </div>
    <div class="card-meta-row">
      <span class="card-venc">Vence: ${escapeHtmlInterno(cred.vencimiento || '--/--')}</span>
      <span class="card-cvv-mask" id="card-cvv-${cred.id}">CVV: •••</span>
      <button class="btn-revelar btn-revelar-cvv" data-id="${cred.id}" data-campo="cvv"
        title="Revelar CVV (5 s)">👁</button>
      ${banco}
    </div>
  `
}

// ── Función de revelado temporal (usada desde vault.js) ──
export function revelarCampoTarjeta(cred, campo) {
  const idEl = campo === 'numero'
    ? `card-num-${cred.id}`
    : `card-cvv-${cred.id}`
  const el = document.getElementById(idEl)
  if (!el) return

  // Cancelar revelado previo si estaba activo
  if (el._timerRevelado) clearTimeout(el._timerRevelado)

  // Mostrar valor real
  if (campo === 'numero') {
    el.textContent = formatearNumeroTarjeta(cred.numero)
    el.classList.add('campo-revelado')
  } else {
    el.textContent = `CVV: ${cred.cvv}`
    el.classList.add('campo-revelado')
  }

  // Ocultar de nuevo a los 5 segundos
  el._timerRevelado = setTimeout(() => {
    if (campo === 'numero') {
      el.textContent = enmascararNumero(cred.numero)
    } else {
      el.textContent = 'CVV: •••'
    }
    el.classList.remove('campo-revelado')
    el._timerRevelado = null
  }, 5000)
}

// Formatea número de tarjeta en grupos de 4 para legibilidad
function formatearNumeroTarjeta(numero) {
  if (!numero) return ''
  const solo = numero.replace(/\D/g, '')
  return solo.replace(/(.{4})/g, '$1 ').trim()
}

// escapeHtml interno — no depende del DOM del vault
function escapeHtmlInterno(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
