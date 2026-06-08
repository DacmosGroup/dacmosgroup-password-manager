/**
 * auto-lock-manager.js — Gestor de auto-lock para la PWA (F5-A)
 *
 * La Chrome Extension usa chrome.alarms (persiste aunque el SW esté dormido).
 * La PWA no tiene chrome.alarms — este módulo implementa el mismo comportamiento
 * usando solo Web APIs estándar:
 *   - setTimeout para el timer en foreground
 *   - visibilitychange + Date.now() para detectar tiempo transcurrido en background
 *
 * API pública:
 *   init({ limitMinutos, onLock })  — inicia el manager; 0 = "Nunca" (no-op)
 *   reset()                         — resetea el timer; llamar en cada evento de usuario
 *   destroy()                       — idempotente; elimina listeners y cancela timers
 */

let _limitMs        = 0
let _timerHandle    = null
let _tsLastActivity = 0
let _onLock         = null
let _bound          = {}
let _activo         = false

export function init({ limitMinutos, onLock }) {
  destroy()

  if (limitMinutos === 0) return

  _limitMs        = limitMinutos * 60_000
  _onLock         = onLock
  _tsLastActivity = Date.now()
  _activo         = true

  _bindEvents()
  _startTimer()
}

export function reset() {
  if (!_activo) return
  _tsLastActivity = Date.now()
  _startTimer()
}

export function destroy() {
  _activo = false
  clearTimeout(_timerHandle)
  _timerHandle = null
  _unbindEvents()
  _onLock = null
}

// ── Privados ──

function _startTimer() {
  clearTimeout(_timerHandle)
  _timerHandle = setTimeout(_fireLock, _limitMs)
}

function _fireLock() {
  _timerHandle = null
  const cb = _onLock
  destroy()
  if (cb) cb()
}

function _onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    // App va a background — cancelar setTimeout (poco fiable en background mobile)
    clearTimeout(_timerHandle)
    _timerHandle = null
  } else {
    // App vuelve a foreground — verificar tiempo transcurrido vs límite
    const elapsed = Date.now() - _tsLastActivity
    if (elapsed >= _limitMs) {
      _fireLock()
    } else {
      _timerHandle = setTimeout(_fireLock, _limitMs - elapsed)
    }
  }
}

function _onActivity() {
  reset()
}

function _bindEvents() {
  _bound.visibility = _onVisibilityChange
  _bound.activity   = _onActivity

  document.addEventListener('visibilitychange', _bound.visibility)
  ;['click', 'keydown', 'touchstart', 'scroll'].forEach(evt =>
    document.addEventListener(evt, _bound.activity, { passive: true })
  )
}

function _unbindEvents() {
  if (_bound.visibility) {
    document.removeEventListener('visibilitychange', _bound.visibility)
  }
  if (_bound.activity) {
    ;['click', 'keydown', 'touchstart', 'scroll'].forEach(evt =>
      document.removeEventListener(evt, _bound.activity)
    )
  }
  _bound = {}
}
