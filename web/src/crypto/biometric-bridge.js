/**
 * biometric-bridge.js — Puente JS ↔ DpmKeyPlugin (Capacitor)
 *
 * Módulo PWA/Capacitor exclusivo — no tiene par en src/crypto/ de la Extension.
 *
 * Patrón de seguridad (DA-2, documento-tecnico.md §5):
 *   - La wrap_key reside en Android Keystore / iOS Secure Enclave
 *   - JS recibe solo { iv, ciphertext } del vault_key envuelto
 *   - Al desbloquear: DpmKeyPlugin devuelve vault_key → se importa como
 *     CryptoKey no exportable → nunca se serializa ni sale de Web Crypto
 */

import { exportarClaveRaw } from './engine.js'
import { idbStorage }       from '../storage/indexeddb-adapter.js'

const IDB_KEY_BIOMETRIC = 'biometricWrappedKey'

// ── Plugin access ─────────────────────────────────────────────────────────────

function _plugin() {
  return window.Capacitor?.Plugins?.DpmKey ?? null
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Comprueba si el dispositivo tiene biometría disponible y enrollada.
 * Retorna false en PWA (navegador puro, sin DpmKeyPlugin).
 */
export async function esBiometriaDisponible() {
  const p = _plugin()
  if (!p) return false
  try {
    const { available } = await p.isAvailable()
    return !!available
  } catch {
    return false
  }
}

/**
 * Comprueba si la biometría está configurada para este vault
 * (el blob envuelto existe en IDB).
 */
export async function hayBiometriaConfigurada() {
  const datos = await idbStorage.get([IDB_KEY_BIOMETRIC])
  return !!datos[IDB_KEY_BIOMETRIC]
}

/**
 * Configura el desbloqueo biométrico para esta instalación.
 *
 * @param {string} masterPassword — contraseña maestra actual (se verifica)
 * @returns {boolean} true si se configuró correctamente, null si contraseña incorrecta
 * @throws si DpmKeyPlugin no disponible o falla el hardware
 */
export async function configurarBiometria(masterPassword) {
  const p = _plugin()
  if (!p) throw new Error('BIOMETRIC_PLUGIN_NOT_AVAILABLE')

  const rawBytes = await exportarClaveRaw(masterPassword)
  if (!rawBytes) return null

  const vaultKeyB64 = _bytesToBase64(rawBytes)
  const wrappedKey  = await p.wrap({ vaultKey: vaultKeyB64 })

  await idbStorage.set({ [IDB_KEY_BIOMETRIC]: wrappedKey })
  return true
}

/**
 * Desbloquea el vault usando biometría.
 * Muestra el prompt nativo; el usuario tiene 3 intentos antes de fallback.
 *
 * @returns {CryptoKey} clave AES-256 no exportable, idéntica a la de desbloquearVault()
 * @throws 'USER_CANCELED' | 'KEY_INVALIDATED' | 'BIOMETRIC_NOT_CONFIGURED' | otros
 */
export async function desbloquearConBiometria() {
  const p = _plugin()
  if (!p) throw new Error('BIOMETRIC_PLUGIN_NOT_AVAILABLE')

  const datos = await idbStorage.get([IDB_KEY_BIOMETRIC])
  const wrappedKey = datos[IDB_KEY_BIOMETRIC]
  if (!wrappedKey) throw new Error('BIOMETRIC_NOT_CONFIGURED')

  let vaultKeyB64
  try {
    const resultado = await p.unwrap(wrappedKey)
    vaultKeyB64     = resultado.vaultKey
  } catch (e) {
    if (e.message === 'KEY_INVALIDATED') {
      await _limpiarBiometria()
    }
    throw e
  }

  const rawBytes = _base64ToBytes(vaultKeyB64)
  return await crypto.subtle.importKey(
    'raw',
    rawBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Desactiva el desbloqueo biométrico: elimina el blob de IDB
 * y borra la clave del Keystore/Keychain.
 */
export async function desactivarBiometria() {
  await _limpiarBiometria()
  try { _plugin()?.deleteKey() } catch { /* best-effort */ }
}

// ── Helpers privados ──────────────────────────────────────────────────────────

async function _limpiarBiometria() {
  await idbStorage.remove([IDB_KEY_BIOMETRIC])
}

function _bytesToBase64(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function _base64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
