// ================================================
// Dacmos Password Manager — Módulo de URL Matching
// F1.6: Matching por dominio base, subdominios y paths
// Módulo puro — sin APIs de Chrome, sin DOM
// ================================================

// TLDs de dos partes para mercados LATAM y globales relevantes.
// Necesario para extraer correctamente el eTLD+1 sin librerías externas.
const TLD_MULTIPART = new Set([
  'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br',  // Brasil
  'com.mx', 'net.mx', 'org.mx', 'gob.mx', 'edu.mx',  // México
  'com.co', 'net.co', 'org.co', 'gov.co', 'edu.co',  // Colombia
  'com.ar', 'net.ar', 'org.ar', 'gov.ar', 'edu.ar',  // Argentina
  'com.pa', 'net.pa', 'org.pa', 'gob.pa', 'edu.pa',  // Panamá
  'com.pe', 'net.pe', 'org.pe', 'gob.pe', 'edu.pe',  // Perú
  'com.cl', 'net.cl', 'org.cl', 'gov.cl', 'edu.cl',  // Chile
  'co.uk',  'org.uk', 'me.uk',  'net.uk', 'gov.uk',  // Reino Unido
  'com.au', 'net.au', 'org.au', 'gov.au', 'edu.au',  // Australia
  'co.jp',  'co.kr',  'co.nz',                        // Asia / Pacífico
])

// Puntuaciones de coincidencia (mayor = más específico)
const PUNTUACION_EXACTA   = 100  // Hostname idéntico
const PUNTUACION_BASE     = 80   // Mismo dominio base, distinto subdominio
const PUNTUACION_WILDCARD = 50   // Patrón *.empresa.com
const PUNTUACION_SITIO    = 30   // Solo coincidencia por nombre de sitio (sin URL)
const BONUS_PATH          = 10   // La credencial tiene un path específico que coincide

/**
 * Extrae el dominio registrable (eTLD+1) de una URL o hostname.
 * Retorna null para IPs, localhost y entradas inválidas:
 * no tienen jerarquía de subdominios, se deben comparar de forma exacta.
 *
 * @param {string} entrada - URL completa ('https://mail.google.com/path') u hostname plano ('mail.google.com')
 * @returns {string|null} - ej: 'google.com', 'bancogeneral.com.pa', null
 */
export function extraerDominioBase(entrada) {
  if (!entrada || typeof entrada !== 'string') return null

  let hostname
  try {
    hostname = entrada.includes('://')
      ? new URL(entrada).hostname
      : new URL('https://' + entrada).hostname
  } catch (_) {
    return null
  }

  // Limpiar puerto residual y normalizar
  hostname = hostname.split(':')[0].toLowerCase().trim()
  if (!hostname) return null

  // IP v4: no tiene jerarquía de dominios
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null

  // Hostname plano sin punto (localhost, nombres de intranet)
  if (!hostname.includes('.')) return null

  const partes = hostname.split('.')
  const candidatoMulti = partes.slice(-2).join('.')

  if (TLD_MULTIPART.has(candidatoMulti)) {
    // eTLD+1 requiere al menos 3 partes: nombre.tld1.tld2
    if (partes.length < 3) return null
    return partes.slice(-3).join('.')
  }

  // Caso general: eTLD+1 = últimos dos segmentos
  return partes.slice(-2).join('.')
}

// ── Funciones internas ──────────────────────────────────────────

function _extraerHostname(entrada) {
  if (!entrada || typeof entrada !== 'string') return null
  try {
    const url = entrada.includes('://')
      ? new URL(entrada)
      : new URL('https://' + entrada)
    return url.hostname.toLowerCase()
  } catch (_) {
    return null
  }
}

function _extraerPath(urlStr) {
  try {
    return new URL(urlStr).pathname
  } catch (_) {
    return ''
  }
}

// ── API pública ─────────────────────────────────────────────────

/**
 * Evalúa si la URL almacenada en una credencial coincide con el hostname de la página activa.
 * Soporta URLs completas, hostnames planos y patrones wildcard (*.empresa.com).
 *
 * @param {string} urlCredencial  - URL de la credencial; puede ser '*.dominio.com'
 * @param {string} hostnameActual - Hostname de la página activa (sin protocolo ni path)
 * @returns {{ coincide: boolean, puntuacion: number }}
 */
export function coincideURL(urlCredencial, hostnameActual) {
  if (!urlCredencial || !hostnameActual) return { coincide: false, puntuacion: 0 }

  const hostActual = hostnameActual.toLowerCase().trim()
  const urlTrim    = urlCredencial.trim()

  // Extraer hostname de la credencial.
  // '*.empresa.com' no es una URL válida para new URL(), se trata directamente.
  const hostCred = urlTrim.startsWith('*.')
    ? urlTrim
    : _extraerHostname(urlTrim)

  if (!hostCred) return { coincide: false, puntuacion: 0 }

  // ── Wildcard: *.empresa.com ──
  // Solo coincide subdominios explícitos; el apex (empresa.com) queda excluido.
  if (hostCred.startsWith('*.')) {
    const base = hostCred.slice(2)
    if (hostActual.endsWith('.' + base)) {
      return { coincide: true, puntuacion: PUNTUACION_WILDCARD }
    }
    return { coincide: false, puntuacion: 0 }
  }

  // ── Match exacto de hostname ──
  if (hostCred === hostActual) {
    return { coincide: true, puntuacion: PUNTUACION_EXACTA }
  }

  // ── Mismo dominio base (distintos subdominios) ──
  // Permite que 'mail.google.com' coincida con 'drive.google.com'.
  const baseCred   = extraerDominioBase(urlTrim)
  const baseActual = extraerDominioBase(hostActual)

  if (baseCred && baseActual && baseCred === baseActual) {
    return { coincide: true, puntuacion: PUNTUACION_BASE }
  }

  return { coincide: false, puntuacion: 0 }
}

/**
 * Evalúa si el nombre de sitio de una credencial (campo 'sitio', sin URL) coincide
 * con el hostname actual. Heurística de texto como fallback cuando no hay URL guardada.
 *
 * @param {string} nombreSitio    - Campo 'sitio' de la credencial (ej: 'GitHub Personal')
 * @param {string} hostnameActual - Hostname de la página activa
 * @returns {{ coincide: boolean, puntuacion: number }}
 */
export function coincideSitio(nombreSitio, hostnameActual) {
  if (!nombreSitio || !hostnameActual) return { coincide: false, puntuacion: 0 }

  const sitioNorm  = nombreSitio.toLowerCase().trim()
  const hostNorm   = hostnameActual.toLowerCase()
  const baseActual = extraerDominioBase(hostNorm)

  // Nombre raíz del dominio: 'google' de 'google.com', 'bancogeneral' de 'bancogeneral.com.pa'
  const nombreDominio = baseActual ? baseActual.split('.')[0] : null

  if (nombreDominio) {
    if (
      sitioNorm === nombreDominio          ||
      sitioNorm.includes(nombreDominio)    ||
      nombreDominio.includes(sitioNorm)
    ) {
      return { coincide: true, puntuacion: PUNTUACION_SITIO }
    }
  }

  // Fallback: el nombre del sitio (≥3 chars) aparece en el hostname completo
  if (sitioNorm.length >= 3 && hostNorm.includes(sitioNorm)) {
    return { coincide: true, puntuacion: PUNTUACION_SITIO }
  }

  return { coincide: false, puntuacion: 0 }
}

/**
 * Filtra credenciales de tipo login por relevancia para la URL de la página activa.
 * Las tarjetas e identidades son universales y se gestionan aparte en el service worker.
 * Retorna el array ordenado de mayor a menor puntuación (el más relevante primero).
 *
 * @param {Array}  credenciales - Array de credenciales (todas las de sesión o ya pre-filtradas)
 * @param {string} urlPagina    - URL completa de la página activa (con protocolo)
 * @returns {Array} Credenciales de login coincidentes ordenadas por relevancia
 */
export function filtrarCredenciales(credenciales, urlPagina) {
  if (!urlPagina || !credenciales?.length) return []

  let hostnameActual
  try {
    hostnameActual = urlPagina.includes('://')
      ? new URL(urlPagina).hostname.toLowerCase()
      : new URL('https://' + urlPagina).hostname.toLowerCase()
  } catch (_) {
    return []
  }

  const resultados = []

  for (const cred of credenciales) {
    // Tarjetas e identidades son universales — no se filtran por dominio
    if (cred.tipo && cred.tipo !== 'login') continue
    if (!cred.url && !cred.sitio) continue

    let puntuacion = 0

    if (cred.url) {
      const res = coincideURL(cred.url, hostnameActual)
      if (res.coincide) {
        puntuacion = res.puntuacion
        // Bonus de path: solo aplica en match exacto con path específico
        if (puntuacion === PUNTUACION_EXACTA) {
          const pathCred   = _extraerPath(cred.url)
          const pathActual = _extraerPath(urlPagina)
          if (pathCred && pathCred !== '/' && pathActual.startsWith(pathCred)) {
            puntuacion += BONUS_PATH
          }
        }
      }
    }

    // Si no hubo match por URL, intentar por nombre de sitio
    if (puntuacion === 0 && cred.sitio) {
      const res = coincideSitio(cred.sitio, hostnameActual)
      if (res.coincide) puntuacion = res.puntuacion
    }

    if (puntuacion > 0) resultados.push({ cred, puntuacion })
  }

  resultados.sort((a, b) => b.puntuacion - a.puntuacion)
  return resultados.map(r => r.cred)
}
