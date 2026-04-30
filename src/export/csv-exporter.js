// ============================================================
// Dacmos Password Manager — Exportador CSV (F1.4)
// Genera CSV en formato genérico y Bitwarden sin librerías.
// Implementa RFC 4180 para escape correcto de campos.
// ============================================================

// Escapa un campo según RFC 4180.
// Encierra en comillas dobles si contiene: coma, comilla doble o salto de línea.
// Las comillas dobles internas se duplican → "" representa una " dentro del campo.
function escaparCampo(valor) {
  const str = String(valor ?? '')
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
    c.claveTotp ?? '',  // secreto TOTP Base32 — vacío si la credencial no tiene 2FA
  ]))
  return [encabezado, ...filas].join('\r\n')
}
