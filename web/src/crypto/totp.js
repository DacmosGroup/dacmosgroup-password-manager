// ============================================================
// Dacmos Password Manager — Motor TOTP (PWA)
// Fork de src/crypto/totp.js para la Progressive Web App.
// Sin cambios de lógica — módulo puro Web Crypto, sin dependencias
// de chrome.* ni de storage. Incorporado al protocolo de forks
// (verify-crypto-sync.sh) desde v0.5.1.
// Estándar: RFC 6238 (TOTP) + RFC 4226 (HOTP) + RFC 4648 (Base32)
// ============================================================

// Alfabeto Base32 según RFC 4648 §6: 26 letras + dígitos 2-7
const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// Período TOTP estándar en segundos (RFC 6238 §4.1)
const PERIODO = 30

// ── Decodificador Base32 ──
// Convierte un string Base32 a Uint8Array de bytes crudos.
// Cada carácter Base32 representa 5 bits; se acumulan hasta completar bytes.
function decodeBase32(str) {
  str = str.toUpperCase().replace(/[\s=]/g, '')

  let bits        = 0
  let acumulador  = 0
  const bytes     = []

  for (const char of str) {
    const idx = ALFABETO_BASE32.indexOf(char)
    if (idx === -1) continue         // carácter fuera del alfabeto: ignorar
    acumulador = (acumulador << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((acumulador >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return new Uint8Array(bytes)
}

// ── Validador de formato Base32 ──
// Acepta A-Z (insensible a mayúsculas), 2-7, espacios y = (padding).
// Rechaza cualquier carácter fuera de ese conjunto: URLs, QR payloads, etc.
export function esBase32Valido(str) {
  const normalizado = str.trim()
  if (!normalizado) return false
  return /^[A-Za-z2-7\s=]+$/.test(normalizado)
}

// ── Segundos restantes en el período TOTP actual ──
// Útil para sincronizar la cuenta regresiva con el período real.
export function segundosRestantes() {
  return PERIODO - (Math.floor(Date.now() / 1000) % PERIODO)
}

// ── Generador de código TOTP de 6 dígitos ──
// Implementa RFC 6238 (TOTP) sobre RFC 4226 (HOTP) usando HMAC-SHA1.
// Usa exclusivamente Web Crypto API nativa — cero dependencias externas.
export async function generarCodigo(claveBase32) {
  const secreto = decodeBase32(claveBase32)
  if (secreto.length === 0) throw new Error('Clave Base32 inválida o vacía')

  // Contador T: número de intervalos de 30 s transcurridos desde epoch Unix
  const T = Math.floor(Date.now() / 1000 / PERIODO)

  // RFC 4226 §5.3: el contador se codifica como 8 bytes big-endian
  const counter = new Uint8Array(8)
  let t = T
  for (let i = 7; i >= 0; i--) {
    counter[i] = t & 0xff
    t >>>= 8
  }

  // Importar el secreto como clave HMAC-SHA1 para Web Crypto API
  const clave = await crypto.subtle.importKey(
    'raw',
    secreto,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,      // no exportable
    ['sign']
  )

  // HMAC-SHA1(clave, counter) → firma de 20 bytes
  const firma = new Uint8Array(
    await crypto.subtle.sign('HMAC', clave, counter)
  )

  // Truncación dinámica (RFC 4226 §5.4):
  // offset = últimos 4 bits del byte 19 (el último de SHA-1)
  const offset = firma[19] & 0x0f

  // Extraer 4 bytes desde offset y descartar el bit de signo más significativo
  const binCode =
    ((firma[offset]     & 0x7f) << 24) |
    ((firma[offset + 1] & 0xff) << 16) |
    ((firma[offset + 2] & 0xff) <<  8) |
    ((firma[offset + 3] & 0xff))

  // Código de 6 dígitos con cero-padding a la izquierda
  return String(binCode % 1_000_000).padStart(6, '0')
}
