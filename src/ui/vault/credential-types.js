// ============================================================
// Dacmos Password Manager — Módulo de Tipos de Credencial
// F1.5: Login · Tarjeta de crédito · Identidad
// ============================================================

import { t } from '../../i18n/t.js'

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
  if (tipo === TIPO_TARJETA)   return cred.alias  || t('cred.fallback_card')
  if (tipo === TIPO_IDENTIDAD) return cred.nombre || t('cred.fallback_identity')
  return cred.sitio || t('cred.fallback_login')
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
      <label class="form-label">${t('cred.login_label_site')}</label>
      <input type="text" id="inputSitio" class="input"
        placeholder="${t('cred.login_placeholder_site')}" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.login_label_url')}</label>
      <input type="url" id="inputUrl" class="input"
        placeholder="${t('cred.login_placeholder_url')}" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.login_label_user')}</label>
      <input type="text" id="inputUsuario" class="input"
        placeholder="${t('cred.login_placeholder_user')}" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.login_label_password')}</label>
      <div class="input-group">
        <input type="password" id="inputPassword" class="input"
          placeholder="${t('cred.login_placeholder_pass')}" autocomplete="off"/>
        <button class="btn-icon" id="btnTogglePass" title="${t('common.aria_toggle_pass')}">👁</button>
        <button class="btn-icon" id="btnGenerarPass" title="⚡">⚡</button>
      </div>
      <div class="strength-bar">
        <div class="strength-fill" id="strengthFill"></div>
      </div>
      <span class="strength-label" id="strengthLabel"></span>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.login_label_notes')}</label>
      <textarea id="inputNotas" class="input textarea"
        placeholder="${t('cred.login_placeholder_notes')}"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.login_label_totp')}</label>
      <div class="input-group">
        <input type="password" id="inputTotp" class="input"
          placeholder="${t('cred.login_placeholder_totp')}" autocomplete="off"/>
        <button class="btn-icon" id="btnToggleTotp" title="${t('common.aria_toggle_pass')}">👁</button>
      </div>
      <span class="form-hint">${t('cred.login_hint_totp')}</span>
    </div>
  `
}

export function renderFormularioTarjeta() {
  return `
    <div class="form-group">
      <label class="form-label">${t('cred.card_label_alias')}</label>
      <input type="text" id="inputAlias" class="input"
        placeholder="${t('cred.card_placeholder_alias')}" autocomplete="off"/>
      <span class="form-hint">${t('cred.card_hint_alias')}</span>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.card_label_holder')}</label>
      <input type="text" id="inputTitular" class="input"
        placeholder="${t('cred.card_placeholder_holder')}" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.card_label_number')}</label>
      <div class="input-group">
        <input type="password" id="inputNumero" class="input"
          placeholder="XXXX XXXX XXXX XXXX" autocomplete="off"
          inputmode="numeric" maxlength="19"/>
        <button class="btn-icon" id="btnToggleNumero" title="${t('common.aria_toggle_pass')}">👁</button>
      </div>
    </div>
    <div class="form-row-2">
      <div class="form-group">
        <label class="form-label">${t('cred.card_label_expiry')}</label>
        <input type="text" id="inputVencimiento" class="input"
          placeholder="MM/AA" autocomplete="off" maxlength="5"/>
      </div>
      <div class="form-group">
        <label class="form-label">${t('cred.card_label_cvv')}</label>
        <div class="input-group">
          <input type="password" id="inputCvv" class="input"
            placeholder="XXX" autocomplete="off"
            inputmode="numeric" maxlength="4"/>
          <button class="btn-icon" id="btnToggleCvv" title="${t('common.aria_toggle_pass')}">👁</button>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.card_label_bank')}</label>
      <input type="text" id="inputBanco" class="input"
        placeholder="${t('cred.card_placeholder_bank')}" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.card_label_notes')}</label>
      <textarea id="inputNotas" class="input textarea"
        placeholder="${t('cred.login_placeholder_notes')}"></textarea>
    </div>
  `
}

export function renderFormularioIdentidad() {
  return `
    <div class="form-group">
      <label class="form-label">${t('cred.identity_label_name')}</label>
      <input type="text" id="inputNombre" class="input"
        placeholder="${t('cred.identity_placeholder_name')}" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.identity_label_email')}</label>
      <input type="email" id="inputEmail" class="input"
        placeholder="${t('cred.login_placeholder_user')}" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.identity_label_phone')}</label>
      <input type="tel" id="inputTelefono" class="input"
        placeholder="${t('cred.identity_placeholder_phone')}" autocomplete="off"/>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.identity_label_address')}</label>
      <input type="text" id="inputDireccion" class="input"
        placeholder="${t('cred.identity_placeholder_addr')}" autocomplete="off"/>
    </div>
    <div class="form-row-2">
      <div class="form-group">
        <label class="form-label">${t('cred.identity_label_city')}</label>
        <input type="text" id="inputCiudad" class="input"
          placeholder="${t('cred.identity_placeholder_city')}" autocomplete="off"/>
      </div>
      <div class="form-group">
        <label class="form-label">${t('cred.identity_label_country')}</label>
        <input type="text" id="inputPais" class="input"
          placeholder="${t('cred.identity_placeholder_ctry')}" autocomplete="off"/>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">${t('cred.identity_label_notes')}</label>
      <textarea id="inputNotas" class="input textarea"
        placeholder="${t('cred.login_placeholder_notes')}"></textarea>
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

  if (!sitio)    return { error: t('cred.login_error_no_site') }
  if (!usuario)  return { error: t('cred.login_error_no_user') }
  if (!password) return { error: t('cred.login_error_no_pass') }
  if (totpRaw && !esBase32Valido(totpRaw)) {
    return { error: t('cred.login_error_totp') }
  }

  // Campo canónico `totp` (v0.5.1). La Extension dejó de escribir `claveTotp`.
  const totp = totpRaw
    ? totpRaw.toUpperCase().replace(/[\s=]/g, '')
    : undefined

  return { tipo: TIPO_LOGIN, sitio, url, usuario, password, notas, totp }
}

export function leerFormularioTarjeta() {
  const alias       = document.getElementById('inputAlias')?.value.trim()      || ''
  const titular     = document.getElementById('inputTitular')?.value.trim()    || ''
  const numero      = document.getElementById('inputNumero')?.value.replace(/\s/g, '') || ''
  const vencimiento = document.getElementById('inputVencimiento')?.value.trim() || ''
  const cvv         = document.getElementById('inputCvv')?.value.trim()        || ''
  const banco       = document.getElementById('inputBanco')?.value.trim()      || ''
  const notas       = document.getElementById('inputNotas')?.value.trim()      || ''

  if (!alias)       return { error: t('cred.card_error_no_alias') }
  if (!titular)     return { error: t('cred.card_error_no_holder') }
  if (!numero)      return { error: t('cred.card_error_no_number') }
  if (!/^\d{13,19}$/.test(numero)) return { error: t('cred.card_error_number_fmt') }
  if (!vencimiento) return { error: t('cred.card_error_no_expiry') }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(vencimiento)) return { error: t('cred.card_error_expiry_fmt') }
  if (!cvv)         return { error: t('cred.card_error_no_cvv') }
  if (!/^\d{3,4}$/.test(cvv)) return { error: t('cred.card_error_cvv_fmt') }

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

  if (!nombre) return { error: t('cred.identity_error_no_name') }
  if (!email)  return { error: t('cred.identity_error_no_email') }

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
    totpEl.value = cred.totp || ''
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
        title="👁">👁</button>
    </div>
    <div class="card-meta-row">
      <span class="card-venc">${t('cred.card_expires_label', { date: escapeHtmlInterno(cred.vencimiento || '--/--') })}</span>
      <span class="card-cvv-mask" id="card-cvv-${cred.id}">${t('cred.card_cvv_hidden')}</span>
      <button class="btn-revelar btn-revelar-cvv" data-id="${cred.id}" data-campo="cvv"
        title="👁">👁</button>
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
      el.textContent = t('cred.card_cvv_hidden')
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
