// ============================================================
// Dacmos Password Manager — Schema de Credencial (PWA)
// Fork de src/schema/credential-schema.js para la PWA.
// Sin cambios de lógica — módulo puro, sin dependencias de
// chrome.* ni de storage. Incorporado al protocolo de forks
// (verify-crypto-sync.sh) desde v0.5.1.
//
// DECISIÓN ARQUITECTURAL (v0.5.1): el engine es la única fuente de
// verdad de *cifrado*, no de *schema de credencial*. La migración de
// schema vive aquí, separada de la capa criptográfica.
//
// Migración TOTP (cluster A-1/A-2/M-3/M-5 de la auditoría v0.5.0):
// el campo canónico del secreto TOTP es `totp`. Vaults creados en la
// Extension pre-v0.5.1 usaban `claveTotp`. Esta normalización convergente
// (lazy) acepta ambos y escribe siempre el canónico.
//
// NO toca el envelope criptográfico — BLOB_VERSION permanece en 1.
// Es normalización a nivel de schema de aplicación, sobre el array de
// credenciales ya descifrado.
// ============================================================

// Normaliza una credencial al schema canónico.
// Migración TOTP: campo canónico `totp`. Precedencia si coexisten ambos:
// gana `totp` (no hay timestamp por-campo → precedencia fija determinista).
// Idempotente: una credencial ya canónica (sin `claveTotp`) pasa sin cambios.
export function normalizarTOTP(cred) {
  if (!cred || typeof cred !== 'object') return cred
  if (!('claveTotp' in cred)) return cred  // ya canónica o sin TOTP — sin cambios

  const { claveTotp, ...resto } = cred
  const secreto = resto.totp ?? claveTotp ?? ''
  // Descarta la key legacy en todos los casos; añade `totp` solo si hay secreto.
  return secreto ? { ...resto, totp: secreto } : resto
}

// Normaliza un array completo de credenciales (map de normalizarTOTP).
export function normalizarCredenciales(creds) {
  return Array.isArray(creds) ? creds.map(normalizarTOTP) : []
}

// Indica si algún credencial del array conserva el campo legacy `claveTotp`.
// Usado para decidir la convergencia activa (B2): si retorna true, el caller
// dispara un único guardarVaultCifrado tras el unlock para sanar el storage.
export function requiereConvergenciaTotp(creds) {
  return Array.isArray(creds) &&
    creds.some(c => c && typeof c === 'object' && 'claveTotp' in c)
}
