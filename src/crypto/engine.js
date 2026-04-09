// ============================================================
// Dacmos Password Manager — Motor de Cifrado
// Estándar: AES-256-GCM + PBKDF2-SHA256 (OWASP 2024)
// Motor: Web Crypto API nativa — sin librerías de terceros
// ============================================================

// ── Constantes de seguridad ──
// DECISIÓN DE SEGURIDAD: 600,000 iteraciones PBKDF2 según OWASP 2024.
// Cada iteración adicional aumenta el costo de un ataque de fuerza bruta.
// En hardware moderno, esto toma ~1 segundo — aceptable para el usuario,
// devastador para un atacante que prueba millones de contraseñas.
const PBKDF2_ITERACIONES = 600_000;
const PBKDF2_HASH        = 'SHA-256';
const AES_ALGORITMO      = 'AES-GCM';
const AES_BITS           = 256;
const SALT_BYTES         = 32;  // 256 bits de sal aleatoria
const IV_BYTES           = 12;  // 96 bits — recomendado por NIST para GCM

// ── UTILIDADES DE CODIFICACIÓN ──

// Convierte un string UTF-8 a ArrayBuffer (requerido por Web Crypto API)
function stringABuffer(str) {
  return new TextEncoder().encode(str);
}

// Convierte ArrayBuffer a string UTF-8
function bufferAString(buffer) {
  return new TextDecoder().decode(buffer);
}

// Convierte ArrayBuffer a Base64 (para almacenar en JSON)
// NOTA: Se procesa en chunks de 8192 bytes para evitar stack overflow
// con el spread operator en vaults grandes.
function bufferABase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(result);
}

// Convierte Base64 a ArrayBuffer
function base64ABuffer(base64) {
  const binary = atob(base64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ── GENERACIÓN DE SAL ──
// DECISIÓN DE SEGURIDAD: La sal es aleatoria y única por cada vault.
// Impide ataques de diccionario y rainbow tables — dos usuarios con
// la misma contraseña tendrán claves completamente diferentes.
function generarSal() {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

// ── DERIVACIÓN DE CLAVE MAESTRA (PBKDF2) ──
// Convierte la contraseña maestra del usuario en una clave AES-256
// DECISIÓN DE SEGURIDAD: Nunca almacenamos la contraseña en texto plano
// ni su hash simple. Usamos PBKDF2 que es un KDF (Key Derivation Function)
// diseñado específicamente para contraseñas.
async function derivarClave(password, sal) {
  // Paso 1: Importar la contraseña como material de clave base
  const materialClave = await crypto.subtle.importKey(
    'raw',
    stringABuffer(password),
    { name: 'PBKDF2' },
    false, // No exportable — la clave base nunca sale de Web Crypto
    ['deriveKey']
  );

  // Paso 2: Derivar la clave AES-256 usando PBKDF2
  const clave = await crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt:       sal,
      iterations: PBKDF2_ITERACIONES,
      hash:       PBKDF2_HASH,
    },
    materialClave,
    {
      name:   AES_ALGORITMO,
      length: AES_BITS,
    },
    false, // No exportable — la clave derivada nunca sale de Web Crypto
    ['encrypt', 'decrypt']
  );

  return clave;
}

// ── CIFRADO AES-256-GCM ──
// Cifra datos arbitrarios con la clave derivada
// DECISIÓN DE SEGURIDAD: Cada operación de cifrado usa un IV único.
// Reutilizar un IV con la misma clave rompe la seguridad de GCM — nunca
// hardcodear ni reutilizar IVs.
async function cifrar(datos, clave) {
  // Generar IV único para esta operación
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  // Cifrar con AES-256-GCM
  const datosCifrados = await crypto.subtle.encrypt(
    {
      name: AES_ALGORITMO,
      iv:   iv,
    },
    clave,
    stringABuffer(JSON.stringify(datos))
  );

  // Empaquetar IV + datos cifrados en Base64 para almacenamiento
  // El IV no es secreto — debe guardarse junto al cifrado para descifrar
  return {
    iv:     bufferABase64(iv.buffer),
    datos:  bufferABase64(datosCifrados),
  };
}

// ── DESCIFRADO AES-256-GCM ──
// DECISIÓN DE SEGURIDAD: AES-GCM incluye autenticación (AEAD).
// Si el vault fue manipulado o la contraseña es incorrecta,
// el descifrado lanza un error — nunca devuelve datos corruptos silenciosamente.
async function descifrar(paquete, clave) {
  const iv     = base64ABuffer(paquete.iv);
  const datos  = base64ABuffer(paquete.datos);

  const datosDescifrados = await crypto.subtle.decrypt(
    {
      name: AES_ALGORITMO,
      iv:   iv,
    },
    clave,
    datos
  );

  return JSON.parse(bufferAString(datosDescifrados));
}

// ── GENERACIÓN DE HASH DE VERIFICACIÓN ──
// Para verificar la contraseña maestra sin almacenarla ni su clave derivada.
// DECISIÓN DE SEGURIDAD: Derivamos una segunda clave con una sal diferente
// solo para verificación. La clave de cifrado y la de verificación son
// independientes — comprometer una no compromete la otra.
async function generarHashVerificacion(password, sal) {
  const claveVerif = await derivarClave(password, sal);

  // Ciframos un token conocido para verificación
  const token = { verificacion: 'DACMOSGROUP_VAULT_OK', version: '1.0' };
  return await cifrar(token, claveVerif);
}

// ── API PÚBLICA DEL MOTOR ──

// Configura el vault por primera vez con una nueva contraseña maestra
async function configurarVault(passwordMaestra) {
  // Generar sal única para este vault — se guarda en storage
  const sal = generarSal();

  // Derivar la clave de cifrado
  const clave = await derivarClave(passwordMaestra, sal);

  // Generar token de verificación (para validar la password en futuros unlocks)
  const sal2 = generarSal(); // Segunda sal independiente para verificación
  const tokenVerificacion = await generarHashVerificacion(passwordMaestra, sal2);

  // Vault vacío cifrado inicialmente
  const vaultVacio = await cifrar({ credenciales: [] }, clave);

  // Guardar en chrome.storage.local
  await new Promise((resolve) => {
    chrome.storage.local.set({
      vaultConfigurado:    true,
      sal:                 bufferABase64(sal.buffer),
      sal2:                bufferABase64(sal2.buffer),
      tokenVerificacion,
      vaultCifrado:        vaultVacio,
    }, resolve);
  });

  return clave; // Retorna la clave en memoria para la sesión activa
}

// Desbloquea el vault verificando la contraseña maestra
// Retorna la clave si es correcta, null si es incorrecta
async function desbloquearVault(passwordMaestra) {
  const datos = await new Promise((resolve) => {
    chrome.storage.local.get(
      ['sal', 'sal2', 'tokenVerificacion'],
      resolve
    );
  });

  if (!datos.sal) return null; // Vault no configurado

  try {
    const sal2  = new Uint8Array(base64ABuffer(datos.sal2));
    const claveVerif = await derivarClave(passwordMaestra, sal2);

    // Intentar descifrar el token de verificación
    // Si la contraseña es incorrecta, esto lanzará un error
    const token = await descifrar(datos.tokenVerificacion, claveVerif);

    if (token.verificacion !== 'DACMOSGROUP_VAULT_OK') return null;

    // Contraseña correcta — derivar la clave real de cifrado
    const sal   = new Uint8Array(base64ABuffer(datos.sal));
    const clave = await derivarClave(passwordMaestra, sal);

    return clave;

  } catch (error) {
    // AES-GCM lanza error si la contraseña es incorrecta — comportamiento esperado
    return null;
  }
}

// Cifra y guarda el vault completo en storage
async function guardarVaultCifrado(credenciales, clave) {
  const vaultCifrado = await cifrar({ credenciales }, clave);
  await new Promise((resolve) => {
    chrome.storage.local.set({ vaultCifrado }, resolve);
  });
}

// Descifra y retorna las credenciales del vault
async function cargarVaultDescifrado(clave) {
  const datos = await new Promise((resolve) => {
    chrome.storage.local.get(['vaultCifrado'], resolve);
  });

  if (!datos.vaultCifrado) return [];

  const vault = await descifrar(datos.vaultCifrado, clave);
  return vault.credenciales || [];
}

// ── CAMBIAR CONTRASEÑA MAESTRA ──
// Re-cifra todo el vault con una nueva contraseña maestra
// DECISIÓN DE SEGURIDAD: El proceso completo ocurre en memoria.
async function cambiarMasterPassword(passwordActual, passwordNueva) {
  // Paso 1: Verificar contraseña actual
  const claveActual = await desbloquearVault(passwordActual);
  if (!claveActual) {
    throw new Error('PASSWORD_INCORRECTA');
  }

  // Paso 2: Descifrar vault actual en memoria
  const credenciales = await cargarVaultDescifrado(claveActual);

  // Paso 3: Generar nuevas sales — nunca reutilizar sales anteriores
  const salNueva  = generarSal();
  const sal2Nueva = generarSal();

  // Paso 4: Derivar nueva clave con PBKDF2
  const claveNueva = await derivarClave(passwordNueva, salNueva);

  // Paso 5: Generar nuevo token de verificación
  const tokenNuevo = await generarHashVerificacion(passwordNueva, sal2Nueva);

  // Paso 6: Re-cifrar vault con nueva clave
  const vaultNuevo = await cifrar({ credenciales }, claveNueva);

  // Paso 7: Guardar todo atómicamente
  await new Promise((resolve) => {
    chrome.storage.local.set({
      sal:               bufferABase64(salNueva.buffer),
      sal2:              bufferABase64(sal2Nueva.buffer),
      tokenVerificacion: tokenNuevo,
      vaultCifrado:      vaultNuevo,
    }, resolve);
  });

  return claveNueva;
}

// ── EXPORTAR VAULT COMO BACKUP CIFRADO ──
// DECISIÓN DE SEGURIDAD: El backup incluye el vault ya cifrado
// con AES-256-GCM. Las sales y el token de verificación viajan
// junto al backup — sin ellos no se puede descifrar.
// El archivo resultante es inútil sin la contraseña maestra.
async function exportarVaultBackup(passwordMaestra) {
  // Verificar contraseña antes de exportar
  const clave = await desbloquearVault(passwordMaestra);
  if (!clave) throw new Error('PASSWORD_INCORRECTA');

  // Obtener todos los datos del vault
  const datos = await new Promise((resolve) => {
    chrome.storage.local.get(
      ['sal', 'sal2', 'tokenVerificacion', 'vaultCifrado'],
      resolve
    );
  });

  // Construir el objeto de backup
  const backup = {
    version:           '1.0',
    app:               'Dacmos Password Manager',
    fecha:             new Date().toISOString(),
    cifrado:           'AES-256-GCM',
    kdf:               'PBKDF2-SHA256-600000',
    sal:               datos.sal,
    sal2:              datos.sal2,
    tokenVerificacion: datos.tokenVerificacion,
    vaultCifrado:      datos.vaultCifrado,
  };

  return backup;
}

// ── IMPORTAR VAULT DESDE BACKUP ──
// DECISIÓN DE SEGURIDAD: Verificamos la contraseña maestra contra
// el backup ANTES de importar. Si la verificación falla, el backup
// es inválido o la contraseña es incorrecta.
async function importarVaultBackup(backup, passwordMaestra) {
  // Validar estructura del backup
  if (!backup.sal || !backup.sal2 || !backup.tokenVerificacion || !backup.vaultCifrado) {
    throw new Error('BACKUP_INVALIDO');
  }

  if (backup.app !== 'Dacmos Password Manager') {
    throw new Error('BACKUP_INVALIDO');
  }

  // Verificar contraseña contra el backup
  try {
    const sal2   = new Uint8Array(base64ABuffer(backup.sal2));
    const claveVerif = await derivarClave(passwordMaestra, sal2);
    const token  = await descifrar(backup.tokenVerificacion, claveVerif);

    if (token.verificacion !== 'DACMOSGROUP_VAULT_OK') {
      throw new Error('PASSWORD_INCORRECTA');
    }
  } catch (error) {
    if (error.message === 'PASSWORD_INCORRECTA') throw error;
    throw new Error('PASSWORD_INCORRECTA');
  }

  // Descifrar vault del backup
  const sal      = new Uint8Array(base64ABuffer(backup.sal));
  const claveNew = await derivarClave(passwordMaestra, sal);
  const vaultBackup = await descifrar(backup.vaultCifrado, claveNew);

  // Obtener credenciales actuales para fusionar
  const datosActuales = await new Promise((resolve) => {
    chrome.storage.local.get(['sal', 'vaultCifrado'], resolve);
  });

  let credencialesFinales = vaultBackup.credenciales || [];

  // Fusionar con vault actual si existe
  if (datosActuales.vaultCifrado && datosActuales.sal) {
    try {
      const salActual   = new Uint8Array(base64ABuffer(datosActuales.sal));
      const claveActual = await derivarClave(passwordMaestra, salActual);
      const vaultActual = await descifrar(datosActuales.vaultCifrado, claveActual);
      const credActuales = vaultActual.credenciales || [];

      // Fusionar — evitar duplicados por ID
      const idsBackup = new Set(credencialesFinales.map(c => c.id));
      const nuevas    = credActuales.filter(c => !idsBackup.has(c.id));
      credencialesFinales = [...credencialesFinales, ...nuevas];
    } catch (_) {
      // Si no se puede descifrar el vault actual, usar solo el backup
    }
  }

  // Guardar vault importado con las credenciales fusionadas
  const claveActualParaGuardar = await desbloquearVault(passwordMaestra);
  if (claveActualParaGuardar) {
    await guardarVaultCifrado(credencialesFinales, claveActualParaGuardar);
  }

  return credencialesFinales.length;
}

// ── EXPORTAR FUNCIONES PÚBLICAS ──
export {
  configurarVault,
  desbloquearVault,
  guardarVaultCifrado,
  cargarVaultDescifrado,
  cambiarMasterPassword,
  exportarVaultBackup,
  importarVaultBackup,
  generarSal,
  bufferABase64,
  base64ABuffer,
};

