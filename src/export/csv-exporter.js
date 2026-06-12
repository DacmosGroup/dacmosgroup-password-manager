// ============================================================
// Dacmos Password Manager — Exportador CSV (F1.4)
// Genera CSV en formato genérico y Bitwarden sin librerías.
// Implementa RFC 4180 para escape correcto de campos.
// ============================================================

// Escapa un campo según RFC 4180.
// Encierra en comillas dobles si contiene: coma, comilla doble o salto de línea.
// Las comillas dobles internas se duplican → "" representa una " dentro del campo.
function escaparCampo(valor) {
  let str = String(valor ?? '')
  // Neutralizar CSV formula injection (OWASP, M-2): los gestores de hojas de
  // cálculo interpretan como fórmula cualquier campo que empiece con = + - @
  // tab o CR. Prefijar comilla simple desactiva la evaluación; el parser
  // RFC 4180 al re-importar trata el prefijo como dato (no rompe la carga).
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str
  if (/[",\n\r]/.test(str)) return '"' + str.replace(/"/g, '""') + '"'
  return str
}

// Convierte un array de valores en una línea CSV correctamente formateada.
function construirFila(campos) {
  return campos.map(escaparCampo).join(',')
}

// Genera un string CSV genérico de 5 columnas.
// Compatible con la mayoría de gestores de contraseñas y hojas de cálculo.
// Columnas: name, url, username, password, notes
export function generarCSVGenerico(credenciales) {
  const encabezado = construirFila(['name', 'url', 'username', 'password', 'notes'])
  const filas = credenciales.map(c => construirFila([
    c.sitio    ?? '',
    c.url      ?? '',
    c.usuario  ?? '',
    c.password ?? '',
    c.notas    ?? '',
  ]))
  return [encabezado, ...filas].join('\r\n')
}

// Genera un string CSV de 11 columnas compatible con Bitwarden.
// Permite importar directamente en Bitwarden u otros gestores con el mismo esquema.
// Columnas: folder, favorite, type, name, notes, fields, reprompt,
//           login_uri, login_username, login_password, login_totp
export function generarCSVBitwarden(credenciales) {
  const encabezado = construirFila([
    'folder', 'favorite', 'type', 'name', 'notes',
    'fields', 'reprompt', 'login_uri', 'login_username',
    'login_password', 'login_totp',
  ])
  const filas = credenciales.map(c => construirFila([
    '',                 // folder — sin carpetas en v0.2.0
    '0',                // favorite
    'login',            // type
    c.sitio    ?? '',
    c.notas    ?? '',
    '',                 // fields — sin campos personalizados
    '0',                // reprompt
    c.url      ?? '',
    c.usuario  ?? '',
    c.password ?? '',
    // Campo canónico `totp` (v0.5.1); fallback a `claveTotp` legacy durante
    // la ventana de migración. Vacío si la credencial no tiene 2FA.
    c.totp ?? c.claveTotp ?? '',
  ]))
  return [encabezado, ...filas].join('\r\n')
}
