// ================================================
// Dacmos Password Manager — Importador CSV
// F1.1: Soporte para CSV genérico (RFC 4180),
//       Google Password Manager, Bitwarden,
//       LastPass y 1Password.
//
// Módulo puro — sin acceso a chrome.* ni engine.js.
// Sin dependencias externas: parser RFC 4180 propio.
// ================================================

// ── Definición de formatos conocidos ──
// Cada formato declara:
//   headersRequeridos — columnas que deben estar presentes para la detección
//   columnas          — mapeo campo interno → nombre de columna en el CSV
//   filtrarFila       — (opcional) función para descartar filas no importables
const FORMATOS = {
  google: {
    nombre:             'Google Password Manager',
    // Google exporta exactamente estas cuatro columnas en minúsculas
    headersRequeridos:  ['name', 'url', 'username', 'password'],
    columnas: {
      sitio:    'name',
      url:      'url',
      usuario:  'username',
      password: 'password',
      notas:    null,
    },
  },

  bitwarden: {
    nombre:             'Bitwarden',
    // Bitwarden usa prefijo 'login_' para los campos de credenciales
    headersRequeridos:  ['name', 'login_uri', 'login_username', 'login_password'],
    columnas: {
      sitio:    'name',
      url:      'login_uri',
      usuario:  'login_username',
      password: 'login_password',
      notas:    'notes',
    },
    // Bitwarden exporta tarjetas, identidades y notas además de logins —
    // solo importamos entradas de tipo 'login'
    filtrarFila: (fila, indiceType) => {
      if (indiceType === -1) return true; // sin columna type → aceptar todo
      const tipo = (fila[indiceType] || '').toLowerCase().trim();
      return tipo === 'login' || tipo === '';
    },
  },

  lastpass: {
    nombre:             'LastPass',
    headersRequeridos:  ['url', 'username', 'password', 'name'],
    columnas: {
      sitio:    'name',
      url:      'url',
      usuario:  'username',
      password: 'password',
      notas:    'extra',
    },
  },

  '1password': {
    nombre:             '1Password',
    // 1Password exporta con Title Case
    headersRequeridos:  ['Title', 'Website', 'Username', 'Password'],
    columnas: {
      sitio:    'Title',
      url:      'Website',
      usuario:  'Username',
      password: 'Password',
      notas:    'Notes',
    },
    // 1Password exporta entradas de tipo Login, Contraseña, Nota segura, etc.
    // Solo importamos las que tienen Type = 'Login' o 'Password'
    filtrarFila: (fila, indiceType) => {
      if (indiceType === -1) return true;
      const tipo = (fila[indiceType] || '').toLowerCase().trim();
      return tipo === 'login' || tipo === 'password' || tipo === '';
    },
  },
};

// ── Candidatos de columnas para formato genérico ──
// Lista de nombres comunes (insensibles a mayúsculas) para cada campo interno.
const COLUMNAS_GENERICAS = {
  sitio:    ['name', 'title', 'site', 'sitio', 'website', 'nombre', 'servicio', 'service', 'label'],
  url:      ['url', 'uri', 'website', 'web', 'login_uri', 'link', 'address', 'domain'],
  usuario:  ['username', 'user', 'login', 'email', 'usuario', 'correo', 'login_username', 'account', 'userid', 'user_name'],
  password: ['password', 'pass', 'contraseña', 'clave', 'login_password', 'passwd', 'secret'],
  notas:    ['notes', 'notas', 'extra', 'comment', 'comentario', 'note', 'remarks'],
};

// ── PARSER CSV RFC 4180 ──
//
// Implementación de máquina de estados carácter a carácter.
// No usa split(',') — incorrecto con comas internas.
//
// Casos cubiertos:
//   • BOM UTF-8 (0xFEFF) al inicio del archivo → eliminado
//   • Campos con comas internas:   campo,"valor,con,comas",otro
//   • Comillas escapadas (doubled): "valor ""con"" comillas"
//   • Saltos de línea en campos:   "linea1\nlinea2"
//   • CRLF (\r\n) y LF (\n) como terminadores de fila
//   • Líneas vacías al final       → ignoradas
//
// Retorna: array de arrays de strings  [ [col1, col2, ...], [...], ... ]
function parsearCSV(texto) {
  // Eliminar BOM UTF-8 si está presente
  if (texto.charCodeAt(0) === 0xFEFF) {
    texto = texto.slice(1);
  }

  const filas = [];
  let fila    = [];
  let campo   = '';
  let citado  = false; // ¿estamos dentro de un campo entre comillas dobles?
  let i       = 0;
  const n     = texto.length;

  while (i < n) {
    const c = texto[i];

    if (citado) {
      // Dentro de campo citado: solo la comilla doble tiene significado especial
      if (c === '"') {
        if (i + 1 < n && texto[i + 1] === '"') {
          // Comilla escapada: "" → literal "
          campo += '"';
          i += 2;
        } else {
          // Cierre del campo citado
          citado = false;
          i++;
        }
      } else {
        // Cualquier otro carácter — incluyendo \n, \r, , — es literal
        campo += c;
        i++;
      }
    } else {
      // Fuera de campo citado
      if (c === '"' && campo.length === 0) {
        // Apertura de campo citado — solo válida al inicio del campo (RFC 4180)
        citado = true;
        i++;
      } else if (c === ',') {
        // Fin del campo actual
        fila.push(campo);
        campo = '';
        i++;
      } else if (c === '\r') {
        // Fin de fila — soporta CRLF y CR sólo
        fila.push(campo);
        campo = '';
        filas.push(fila);
        fila = [];
        if (i + 1 < n && texto[i + 1] === '\n') i++; // consumir \n del CRLF
        i++;
      } else if (c === '\n') {
        // Fin de fila — LF sólo
        fila.push(campo);
        campo = '';
        filas.push(fila);
        fila = [];
        i++;
      } else {
        campo += c;
        i++;
      }
    }
  }

  // Agregar último campo y última fila si el archivo no termina en newline
  fila.push(campo);
  // Ignorar fila final si está completamente vacía (trailing newline)
  if (fila.some(c => c.trim() !== '')) {
    filas.push(fila);
  }

  return filas;
}

// ── DETECCIÓN AUTOMÁTICA DE FORMATO ──
//
// Compara los encabezados del CSV contra los headersRequeridos de cada formato.
// Primero intenta coincidencia exacta (respeta capitalización de 1Password),
// luego insensible a mayúsculas (para exportaciones con variantes).
//
// Retorna la clave del formato ('google'|'bitwarden'|'lastpass'|'1password'|'generico')
// o null si el CSV no tiene suficientes columnas para importar.
function detectarFormato(headers) {
  const headersSet      = new Set(headers.map(h => h.trim()));
  const headersLowerSet = new Set(headers.map(h => h.trim().toLowerCase()));

  // Paso 1 — coincidencia exacta (respeta capitalización)
  for (const [clave, def] of Object.entries(FORMATOS)) {
    const coincide = def.headersRequeridos.every(h => headersSet.has(h));
    if (coincide) return clave;
  }

  // Paso 2 — coincidencia insensible a mayúsculas
  for (const [clave, def] of Object.entries(FORMATOS)) {
    const coincide = def.headersRequeridos.every(
      h => headersLowerSet.has(h.toLowerCase())
    );
    if (coincide) return clave;
  }

  // Paso 3 — verificar si es CSV genérico con suficientes campos conocidos.
  // Requisito mínimo: tener al menos usuario O password reconocibles.
  const tieneUsuario  = COLUMNAS_GENERICAS.usuario.some(c => headersLowerSet.has(c));
  const tienePassword = COLUMNAS_GENERICAS.password.some(c => headersLowerSet.has(c));

  if (tieneUsuario && tienePassword) return 'generico';

  // No se puede identificar el formato
  return null;
}

// ── NORMALIZACIÓN DE CREDENCIALES ──
//
// Convierte las filas del CSV parseado al esquema interno del vault:
//   { sitio, url, usuario, password, notas }
//
// - Ignora filas vacías y entradas sin usuario ni contraseña.
// - Para Bitwarden y 1Password aplica el filtro de tipo de entrada.
// - Si falta 'sitio', lo deriva del hostname de la URL.
//
// Parámetros:
//   filas   — resultado de parsearCSV()
//   formato — clave devuelta por detectarFormato()
//
// Retorna: array de objetos credencial normalizados
function normalizarCredenciales(filas, formato) {
  if (!filas || filas.length < 2) return []; // sin encabezado o vacío

  const headers   = filas[0].map(h => h.trim());
  const filaDatos = filas.slice(1);

  // Índice auxiliar para buscar columna por nombre (insensible a mayús)
  function indiceColumna(nombre) {
    if (!nombre) return -1;
    return headers.findIndex(h => h.toLowerCase() === nombre.toLowerCase());
  }

  // Obtener valor de una columna por su nombre
  function obtenerValor(fila, nombreColumna) {
    const idx = indiceColumna(nombreColumna);
    return idx !== -1 ? (fila[idx] || '').trim() : '';
  }

  // Para formato genérico: recorrer lista de candidatos y devolver el primero con valor
  function resolverGenerico(fila, candidatos) {
    for (const candidato of candidatos) {
      const idx = headers.findIndex(h => h.toLowerCase() === candidato.toLowerCase());
      if (idx !== -1 && fila[idx] && fila[idx].trim()) {
        return fila[idx].trim();
      }
    }
    return '';
  }

  // Construir función de mapeo según el formato
  let mapear;

  if (formato === 'generico') {
    mapear = (fila) => ({
      sitio:    resolverGenerico(fila, COLUMNAS_GENERICAS.sitio),
      url:      resolverGenerico(fila, COLUMNAS_GENERICAS.url),
      usuario:  resolverGenerico(fila, COLUMNAS_GENERICAS.usuario),
      password: resolverGenerico(fila, COLUMNAS_GENERICAS.password),
      notas:    resolverGenerico(fila, COLUMNAS_GENERICAS.notas),
    });
  } else {
    const cols = FORMATOS[formato].columnas;
    mapear = (fila) => ({
      sitio:    obtenerValor(fila, cols.sitio),
      url:      obtenerValor(fila, cols.url),
      usuario:  obtenerValor(fila, cols.usuario),
      password: obtenerValor(fila, cols.password),
      notas:    obtenerValor(fila, cols.notas),
    });
  }

  // Preparar filtro de tipo de entrada (Bitwarden / 1Password)
  const defFormato   = FORMATOS[formato];
  const filtrarFila  = defFormato?.filtrarFila ?? null;
  const indiceType   = filtrarFila ? indiceColumna('type') : -1;

  // Procesar filas
  const credenciales = [];

  for (const fila of filaDatos) {
    // Ignorar fila completamente vacía
    if (fila.every(c => !c || !c.trim())) continue;

    // Aplicar filtro de tipo si el formato lo requiere (ej. solo logins en Bitwarden)
    if (filtrarFila && !filtrarFila(fila, indiceType)) continue;

    const cred = mapear(fila);

    // Descartar entradas sin usuario Y sin contraseña — no tienen valor para importar
    if (!cred.usuario && !cred.password) continue;

    // Si falta el nombre del sitio, derivarlo del hostname de la URL
    if (!cred.sitio && cred.url) {
      try {
        cred.sitio = new URL(cred.url).hostname.replace(/^www\./, '');
      } catch (_) {
        // URL malformada — usar la cadena tal cual como nombre
        cred.sitio = cred.url;
      }
    }

    credenciales.push(cred);
  }

  return credenciales;
}

// ── EXPORTAR API PÚBLICA ──
export {
  parsearCSV,
  detectarFormato,
  normalizarCredenciales,
  FORMATOS,
};
