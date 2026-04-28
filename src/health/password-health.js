// ============================================
// Dacmos Password Manager — Motor de Salud
// F1.3: Password Health Reports
// ============================================

// Umbral de entropía en bits para clasificar una contraseña como débil.
// NIST SP 800-63B considera < 50 bits insuficiente para cuentas de alto valor.
const UMBRAL_ENTROPIA_BITS = 50

// ── Utilidades criptográficas internas ──

// Convierte texto a hash SHA-256 en hexadecimal minúsculas.
// Usado para agrupar contraseñas reutilizadas sin comparar en texto plano.
async function sha256Hex(texto) {
  const buffer     = new TextEncoder().encode(texto)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray  = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Convierte texto a hash SHA-1 en hexadecimal mayúsculas.
// Usado exclusivamente para el protocolo k-anonymity de HIBP — no para seguridad.
async function sha1Hex(texto) {
  const buffer     = new TextEncoder().encode(texto)
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer)
  const hashArray  = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ── API pública ──

// Calcula la entropía estimada en bits de una contraseña.
// Infiere el tamaño del alfabeto a partir de los tipos de caracteres presentes,
// luego aplica H = L × log₂(N) donde L = longitud y N = tamaño del alfabeto.
export function calcularEntropia(password) {
  if (!password || password.length === 0) return 0

  let charset = 0
  if (/[a-z]/.test(password))            charset += 26  // minúsculas
  if (/[A-Z]/.test(password))            charset += 26  // mayúsculas
  if (/[0-9]/.test(password))            charset += 10  // dígitos
  if (/[^a-zA-Z0-9]/.test(password))    charset += 32  // símbolos comunes

  if (charset === 0) return 0
  return Math.floor(password.length * Math.log2(charset))
}

// Detecta contraseñas reutilizadas agrupando por hash SHA-256.
//
// GARANTÍA DE SEGURIDAD: La contraseña en texto plano NUNCA se almacena
// en el mapa de agrupación. El Map contiene únicamente:
//   clave  → hash SHA-256 (opaco)
//   valor  → array de IDs de credenciales (no datos sensibles)
// Las contraseñas en texto plano no se comparan directamente entre sí.
//
// Retorna un Set con los IDs de credenciales que comparten contraseña
// con al menos una otra credencial del vault.
export async function detectarReutilizadas(credenciales) {
  const mapaHash = new Map()  // hash SHA-256 → [id, id, ...]

  for (const cred of credenciales) {
    if (!cred.password) continue
    const hash = await sha256Hex(cred.password)
    if (!mapaHash.has(hash)) mapaHash.set(hash, [])
    mapaHash.get(hash).push(cred.id)
  }

  // Grupos con más de un ID indican reutilización
  const idsReutilizados = new Set()
  for (const ids of mapaHash.values()) {
    if (ids.length > 1) ids.forEach(id => idsReutilizados.add(id))
  }

  return idsReutilizados
}

// Verifica una contraseña contra Have I Been Pwned usando k-anonymity.
//
// PROTOCOLO K-ANONYMITY:
//   1. Computa SHA-1 del password localmente
//   2. Envía solo los primeros 5 caracteres hexadecimales (prefijo) a la API
//   3. Recibe ~800 sufijos con sus conteos de apariciones
//   4. Compara el sufijo local (35 chars) contra la lista recibida
//   5. La contraseña en texto plano nunca abandona el dispositivo
//
// Retorna: { comprometida: bool, conteo: Number, error: bool }
export async function verificarHIBP(password) {
  const hash    = await sha1Hex(password)
  const prefijo = hash.slice(0, 5)   // Solo esto viaja a la red
  const sufijo  = hash.slice(5)      // Comparado localmente, nunca enviado

  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefijo}`,
      {
        cache: 'no-store',
        headers: { 'Add-Padding': 'true' },  // Previene análisis de tráfico por tamaño de respuesta
      }
    )

    if (!response.ok) {
      return { comprometida: false, conteo: 0, error: true, codigoHttp: response.status }
    }

    const texto = await response.text()
    // Cada línea tiene formato "SUFIJO:CONTEO\r\n" — comparamos solo el sufijo local
    const linea = texto.split('\n').find(l =>
      l.trimEnd().split(':')[0].toUpperCase() === sufijo
    )
    const conteo = linea ? parseInt(linea.split(':')[1], 10) : 0

    return { comprometida: conteo > 0, conteo, error: false }

  } catch (_) {
    // Sin red o timeout — retorna "desconocido", no falla el análisis
    return { comprometida: false, conteo: 0, error: true }
  }
}

// Ejecuta el análisis local completo: entropía + reutilización.
// No realiza llamadas de red — siempre funciona offline.
//
// El reporte retornado NO incluye contraseñas en texto plano:
// solo IDs, nombres de sitio, métricas derivadas y flags booleanos.
// El campo hibp se rellena de forma progresiva en el dashboard.
export async function analizarSaludLocal(credenciales) {
  const idsReutilizados = await detectarReutilizadas(credenciales)

  const items = credenciales.map(cred => {
    const entropia      = calcularEntropia(cred.password || '')
    const esDebil       = entropia < UMBRAL_ENTROPIA_BITS
    const esReutilizada = idsReutilizados.has(cred.id)

    return {
      id:           cred.id,
      sitio:        cred.sitio,
      usuario:      cred.usuario,
      entropia,
      esDebil,
      esReutilizada,
      hibp: null,  // Completado progresivamente por el dashboard
    }
  })

  return {
    total:         items.length,
    debiles:       items.filter(i => i.esDebil).length,
    reutilizadas:  items.filter(i => i.esReutilizada).length,
    comprometidas: 0,  // Actualizado progresivamente vía HIBP
    items,
  }
}
