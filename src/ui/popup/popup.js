// ============================================
// Dacmos Password Manager — Popup Logic
// Conectado al motor de cifrado AES-256-GCM
// ============================================

import { desbloquearVault } from '../../crypto/engine.js'
import { t, walkI18n } from '../../i18n/t.js'

// ── Referencias al DOM ──
const viewSetup    = document.getElementById('viewSetup')
const viewLocked   = document.getElementById('viewLocked')
const viewUnlocked = document.getElementById('viewUnlocked')
const statusBadge  = document.getElementById('statusBadge')
const statusDot    = statusBadge.querySelector('.status-dot')
const statusLabel  = statusBadge.querySelector('.status-label')
const errorMsg     = document.getElementById('errorMsg')
const navBar       = document.getElementById('navBar')

walkI18n()

// ── Funciones de navegación ──
function mostrarVista(vista) {
  [viewSetup, viewLocked, viewUnlocked].forEach(v => v.classList.add('hidden'))
  vista.classList.remove('hidden')
}

function actualizarEstado(desbloqueado) {
  if (desbloqueado) {
    statusDot.className     = 'status-dot unlocked'
    statusLabel.textContent = t('popup.status_unlocked')
    navBar.style.display    = 'flex'
  } else {
    statusDot.className     = 'status-dot locked'
    statusLabel.textContent = t('popup.status_locked')
    navBar.style.display    = 'none'
  }
}

// ── Indicador de estado de sync (F2.4) ──

const SYNC_UI = {
  desconectado: { icon: '',   label: '',                          class: '' },
  sincronizando:{ icon: '🔄', label: t('popup.sync_syncing'),     class: 'sync-syncing' },
  sincronizado: { icon: '✅', label: t('sync.badge_synced'),      class: 'sync-ok' },
  pendiente:    { icon: '⚠️', label: t('popup.sync_pending'),     class: 'sync-warn' },
  error:        { icon: '❌', label: t('popup.sync_error'),       class: 'sync-error' },
}

async function actualizarIndicadorSync() {
  const syncRow   = document.getElementById('syncRow')
  const syncIcon  = document.getElementById('syncIcon')
  const syncLabel = document.getElementById('syncLabel')
  if (!syncRow) return

  const estado = await new Promise(resolve =>
    chrome.runtime.sendMessage({ tipo: 'SYNC_OBTENER_ESTADO' }, resolve)
  )
  const ui = SYNC_UI[estado?.estado] ?? SYNC_UI.desconectado

  if (!ui.label) {
    syncRow.classList.add('hidden')
    return
  }

  syncIcon.textContent  = ui.icon
  syncLabel.textContent = estado?.estado === 'sincronizado' && estado.ultimaSync
    ? t('popup.sync_synced_time', { time: formatearTiempoRelativo(estado.ultimaSync) })
    : ui.label

  syncRow.className = `sync-row ${ui.class}`
}

function formatearTiempoRelativo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  if (diff < 60_000)   return t('popup.sync_just_now')
  if (diff < 3600_000) return t('popup.sync_minutes_ago', { n: Math.floor(diff / 60_000) })
  return t('popup.sync_hours_ago', { n: Math.floor(diff / 3600_000) })
}

// ── Inicialización ──
async function inicializar() {
  const { vaultConfigurado, sesionActiva } = await obtenerEstado()

  if (!vaultConfigurado) {
    mostrarVista(viewSetup)
    actualizarEstado(false)
  } else if (sesionActiva) {
    mostrarVista(viewUnlocked)
    actualizarEstado(true)
    cargarConteoCredenciales()
    actualizarIndicadorSync()
  } else {
    mostrarVista(viewLocked)
    actualizarEstado(false)
  }
}

async function obtenerEstado() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['vaultConfigurado', 'sesionActiva'], (result) => {
      resolve({
        vaultConfigurado: result.vaultConfigurado || false,
        sesionActiva:     result.sesionActiva     || false,
      })
    })
  })
}

async function cargarConteoCredenciales() {
  return new Promise((resolve) => {
    chrome.storage.session.get(['credencialesSesion'], (result) => {
      const conteo = result.credencialesSesion ? result.credencialesSesion.length : 0
      const el = document.getElementById('credentialCount')
      if (el) el.textContent = conteo !== 1
        ? t('popup.unlocked_creds_other', { count: conteo })
        : t('popup.unlocked_creds_one',   { count: conteo })
      resolve(conteo)
    })
  })
}

// ── Event Listeners ──

document.getElementById('btnGoSetup').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/settings/settings.html') })
})

document.getElementById('btnRestoreGoogle').addEventListener('click', async () => {
  const btn     = document.getElementById('btnRestoreGoogle')
  const errorEl = document.getElementById('setupRestoreError')

  btn.disabled    = true
  btn.textContent = t('auth.setup_restore_connecting')
  errorEl.classList.add('hidden')

  const resp = await new Promise(resolve =>
    chrome.runtime.sendMessage({ tipo: 'SYNC_CONECTAR' }, resolve)
  )

  if (resp?.ok) {
    const { vaultConfigurado } = await new Promise(resolve =>
      chrome.storage.local.get(['vaultConfigurado'], resolve)
    )
    if (vaultConfigurado) {
      mostrarVista(viewLocked)
      actualizarEstado(false)
    } else {
      errorEl.classList.remove('hidden')
      errorEl.textContent = t('auth.setup_restore_not_found')
      btn.disabled    = false
      btn.textContent = t('auth.setup_btn_restore_google')
    }
  } else {
    errorEl.classList.remove('hidden')
    errorEl.textContent = resp?.error || t('auth.setup_restore_error')
    btn.disabled    = false
    btn.textContent = t('auth.setup_btn_restore_google')
  }
})

document.getElementById('btnTogglePassword').addEventListener('click', () => {
  const input = document.getElementById('masterPasswordInput')
  input.type = input.type === 'password' ? 'text' : 'password'
})

// Botón desbloquear — usa el motor de cifrado real
document.getElementById('btnUnlock').addEventListener('click', async () => {
  const password = document.getElementById('masterPasswordInput').value

  if (!password) {
    errorMsg.classList.remove('hidden')
    errorMsg.textContent = t('auth.unlock_error_no_pass')
    return
  }

  // Mostrar estado de carga — PBKDF2 tarda ~1 segundo intencionalmente
  const btnUnlock = document.getElementById('btnUnlock')
  btnUnlock.textContent = t('auth.unlock_btn_loading')
  btnUnlock.disabled = true

  try {
    // Verificación criptográfica real con PBKDF2 + AES-256-GCM
    const clave = await desbloquearVault(password)

    if (clave) {
      errorMsg.classList.add('hidden')
      // Guardar sesión activa — la clave vive solo en memoria de la página
      chrome.storage.local.set({ sesionActiva: true })

      // Cargar y enviar credenciales al service worker para sesión
      const { cargarVaultDescifrado } = await import('../../crypto/engine.js')
      const credenciales = await cargarVaultDescifrado(clave)
      chrome.runtime.sendMessage({
        tipo:         'VAULT_DESBLOQUEADO',
        credenciales: credenciales,
      })

      mostrarVista(viewUnlocked)
      actualizarEstado(true)
      cargarConteoCredenciales()
      actualizarIndicadorSync()
    } else {
      errorMsg.classList.remove('hidden')
      errorMsg.textContent = t('auth.unlock_error_incorrect')
      document.getElementById('masterPasswordInput').value = ''
    }
  } catch (error) {
    errorMsg.classList.remove('hidden')
    errorMsg.textContent = t('auth.unlock_error_generic')
  } finally {
    btnUnlock.textContent = t('auth.unlock_btn')
    btnUnlock.disabled = false
  }
})

// ── Flujo "Olvidé mi contraseña" ──
document.getElementById('linkOlvide').addEventListener('click', () => {
  document.getElementById('panelOlvide').classList.remove('hidden')
  document.getElementById('linkOlvide').classList.add('hidden')
})

document.getElementById('btnOlvideCancelar').addEventListener('click', () => {
  document.getElementById('panelOlvide').classList.add('hidden')
  document.getElementById('linkOlvide').classList.remove('hidden')
})

document.getElementById('btnOlvideConfirmar').addEventListener('click', () => {
  chrome.storage.local.clear(() => window.location.reload())
})

document.getElementById('btnOpenVault').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/vault/vault.html') })
})

document.getElementById('btnAddCredential').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/vault/vault.html?action=new') })
})

document.getElementById('navLock').addEventListener('click', () => {
  chrome.storage.local.set({ sesionActiva: false })
  document.getElementById('masterPasswordInput').value = ''
  mostrarVista(viewLocked)
  actualizarEstado(false)
})

document.getElementById('navGenerator').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/generator/generator.html') })
})
document.getElementById('navSettings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/settings/settings.html') })
})

// ── Versión en footer ──
const _v = chrome.runtime.getManifest().version
const _footerEl = document.getElementById('footerVersion')
if (_footerEl) _footerEl.textContent = t('popup.footer', { version: _v })

// ── Arrancar ──
inicializar()
