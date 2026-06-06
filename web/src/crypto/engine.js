// ============================================================
// Dacmos Password Manager — Motor de Cifrado (PWA)
// Fork de src/crypto/engine.js para la Progressive Web App.
// Única diferencia respecto al original: las llamadas a
// chrome.storage.local se reemplazan por idbStorage (IndexedDB).
// Lógica de cifrado y constantes de seguridad: idénticas.
// Estándar: AES-256-GCM + PBKDF2-SHA256 (OWASP 2024)
// Motor: Web Crypto API nativa — sin librerías de terceros
// ============================================================

import { idbStorage } from '../storage/indexeddb-adapter.js'

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

// ── Constantes de versión del blob ──
// BLOB_VERSION identifica el formato activo del outer envelope.
// Incrementar solo al cambiar el KDF o sus parámetros de seguridad.
// v0 (sin campo)  = legacy PBKDF2-SHA256×600k (v0.3.1 y anteriores)
// v1              = PBKDF2-SHA256×600k + AAD en AES-GCM (desde v0.4.0)
// v2 (reservado)  = Argon2id (v0.7.0)
const BLOB_VERSION = 1;
const BLOB_KDF     = 'PBKDF2-SHA256';

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

// ── L1: CIFRADO AES-256-GCM (primitivo interno) ──
// Primitivo sin metadatos de versión ni AAD. Solo para uso interno
// como backend de descifrarConVersion() en blobs legacy (v0).
// Para crear nuevos blobs, usar cifrarConVersion().
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

// ── L1: DESCIFRADO AES-256-GCM (primitivo interno) ──
// Primitivo sin AAD. Solo para blobs legacy v0 (sin campo __version).
// Para descifrar blobs v1+, usar descifrarConVersion().
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

// ── L2: SERIALIZACIÓN CANÓNICA DEL AAD ──
// CONTRATO CRÍTICO: template literal explícito — el orden de los campos
// debe ser idéntico en cifrado y descifrado, en Chrome Extension, PWA
// y Capacitor, hoy y en todas las versiones futuras del proyecto.
// NO usar JSON.stringify({...}): el orden de keys depende del motor JS
// y puede cambiar si se refactoriza el objeto literal — rompería todos
// los vaults existentes sin ningún error en tiempo de desarrollo.
// AAD canónico v1: {"__version":1,"kdf":"PBKDF2-SHA256","kdfIterations":600000}
function serializarAAD(version, kdf, kdfIterations) {
  return new TextEncoder().encode(
    `{"__version":${version},"kdf":${JSON.stringify(kdf)},"kdfIterations":${kdfIterations}}`
  );
}

// ── L2: DETECCIÓN DE VERSIÓN DEL BLOB ──
// Retorna 0 para blobs legacy sin __version (v0.3.1 y anteriores).
// Exportada para que sync-manager pueda inspeccionar versiones remotas.
function detectarVersionBlob(blob) {
  return blob.__version ?? 0;
}

// ── L2: CIFRADO CON VERSIÓN ──
// Cifra datos e incluye metadatos KDF en el outer envelope + AAD.
// Reemplaza a cifrar() en todos los usos de L3 desde v0.4.0.
// DECISIÓN DE SEGURIDAD: los metadatos __version, kdf, kdfIterations se
// autentican via AAD en AES-GCM. Un atacante que modifique esos campos
// en el blob almacenado (ej. reducir kdfIterations para facilitar
// brute-force) invalida el auth tag — el descifrado falla inmediatamente.
async function cifrarConVersion(datos, clave) {
  const iv  = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const aad = serializarAAD(BLOB_VERSION, BLOB_KDF, PBKDF2_ITERACIONES);

  const datosCifrados = await crypto.subtle.encrypt(
    {
      name:           AES_ALGORITMO,
      iv:             iv,
      additionalData: aad,
    },
    clave,
    stringABuffer(JSON.stringify(datos))
  );

  return {
    __version:     BLOB_VERSION,
    kdf:           BLOB_KDF,
    kdfIterations: PBKDF2_ITERACIONES,
    iv:            bufferABase64(iv.buffer),
    datos:         bufferABase64(datosCifrados),
  };
}

// ── L2: DESCIFRADO CON DISPATCH POR VERSIÓN ──
// v0 (sin __version): path legacy sin AAD — backward compat con v0.3.1.
// v1: reconstruye AAD desde los campos del blob con el mismo orden canónico
//     que se usó en cifrarConVersion() — cualquier tampering invalida el auth tag.
// v2+: lanza VAULT_VERSION_INCOMPATIBLE. Los callers capturan este error
//      y muestran al usuario: "Este vault fue creado con una versión más
//      reciente de Dacmos Password Manager. Actualiza la aplicación para abrirlo."
async function descifrarConVersion(blob, clave) {
  const version = detectarVersionBlob(blob);

  switch (version) {
    case 0:
      // Blob legacy (v0.3.1 y anteriores) — sin AAD, backward compat garantizada.
      return await descifrar(blob, clave);

    case 1: {
      // Reconstruir AAD en el mismo orden canónico que en cifrarConVersion().
      const aad   = serializarAAD(blob.__version, blob.kdf, blob.kdfIterations);
      const iv    = base64ABuffer(blob.iv);
      const datos = base64ABuffer(blob.datos);

      const datosDescifrados = await crypto.subtle.decrypt(
        {
          name:           AES_ALGORITMO,
          iv:             iv,
          additionalData: aad,
        },
        clave,
        datos
      );

      return JSON.parse(bufferAString(datosDescifrados));
    }

    default:
      // Versión futura (ej. v2 = Argon2id, v0.7.0) — la app debe actualizarse.
      throw new Error(`VAULT_VERSION_INCOMPATIBLE:${version}`);
  }
}

// ── GENERACIÓN DE HASH DE VERIFICACIÓN ──
// Para verificar la contraseña maestra sin almacenarla ni su clave derivada.
// DECISIÓN DE SEGURIDAD: Derivamos una segunda clave con una sal diferente
// solo para verificación. La clave de cifrado y la de verificación son
// independientes — comprometer una no compromete la otra.
async function generarHashVerificacion(password, sal) {
  const claveVerif = await derivarClave(password, sal);

  // Ciframos un token conocido para verificación (blob v1 con AAD)
  const token = { verificacion: 'DACMOSGROUP_VAULT_OK', version: '1.0' };
  return await cifrarConVersion(token, claveVerif);
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

  // Vault vacío cifrado inicialmente (blob v1 con AAD)
  const vaultVacio = await cifrarConVersion({ credenciales: [] }, clave);

  // Guardar en IndexedDB (PWA)
  await idbStorage.set({
    vaultConfigurado:    true,
    sal:                 bufferABase64(sal.buffer),
    sal2:                bufferABase64(sal2.buffer),
    tokenVerificacion,
    vaultCifrado:        vaultVacio,
  });

  return clave; // Retorna la clave en memoria para la sesión activa
}

// Desbloquea el vault verificando la contraseña maestra.
// Retorna la clave si es correcta, null si es incorrecta.
// Propaga VAULT_VERSION_INCOMPATIBLE sin convertirla a null — el caller
// debe mostrar: "Actualiza la aplicación para abrir este vault."
async function desbloquearVault(passwordMaestra) {
  const datos = await idbStorage.get(['sal', 'sal2', 'tokenVerificacion']);

  if (!datos.sal) return null; // Vault no configurado

  try {
    const sal2       = new Uint8Array(base64ABuffer(datos.sal2));
    const claveVerif = await derivarClave(passwordMaestra, sal2);

    // Intentar descifrar el token de verificación con dispatch por versión.
    // Si la contraseña es incorrecta, esto lanzará un error.
    const token = await descifrarConVersion(datos.tokenVerificacion, claveVerif);

    if (token.verificacion !== 'DACMOSGROUP_VAULT_OK') return null;

    // Contraseña correcta — derivar la clave real de cifrado
    const sal   = new Uint8Array(base64ABuffer(datos.sal));
    const clave = await derivarClave(passwordMaestra, sal);

    return clave;

  } catch (error) {
    // VAULT_VERSION_INCOMPATIBLE no es contraseña incorrecta — propagar al caller.
    if (error.message?.startsWith('VAULT_VERSION_INCOMPATIBLE')) throw error;
    // AES-GCM lanza error si la contraseña es incorrecta — comportamiento esperado.
    return null;
  }
}

// Cifra y guarda el vault completo en storage
async function guardarVaultCifrado(credenciales, clave) {
  const vaultCifrado = await cifrarConVersion({ credenciales }, clave);
  await idbStorage.set({ vaultCifrado });
}

// Descifra y retorna las credenciales del vault
async function cargarVaultDescifrado(clave) {
  const datos = await idbStorage.get(['vaultCifrado']);

  if (!datos.vaultCifrado) return [];

  const vault = await descifrarConVersion(datos.vaultCifrado, clave);
  return vault.credenciales || [];
}

// ── CAMBIAR CONTRASEÑA MAESTRA ──
// Re-cifra todo el vault con una nueva contraseña maestra
// DECISIÓN DE SEGURIDAD: El proceso completo ocurre en memoria.
let _cambioEnProgreso = false
async function cambiarMasterPassword(passwordActual, passwordNueva) {
  if (_cambioEnProgreso) throw new Error('CAMBIO_EN_PROGRESO')
  _cambioEnProgreso = true
  try {
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

  // Paso 5: Generar nuevo token de verificación (blob v1 con AAD)
  const tokenNuevo = await generarHashVerificacion(passwordNueva, sal2Nueva);

  // Paso 6: Re-cifrar vault con nueva clave (blob v1 con AAD)
  const vaultNuevo = await cifrarConVersion({ credenciales }, claveNueva);

  // Paso 7: Guardar todo atómicamente
  await idbStorage.set({
    sal:               bufferABase64(salNueva.buffer),
    sal2:              bufferABase64(sal2Nueva.buffer),
    tokenVerificacion: tokenNuevo,
    vaultCifrado:      vaultNuevo,
  });

  return claveNueva;
  } finally {
    _cambioEnProgreso = false
  }
}

// ── EXPORTAR VAULT COMO BACKUP CIFRADO ──
// DECISIÓN DE SEGURIDAD: El backup incluye el vault ya cifrado
// con AES-256-GCM. Las sales y el token de verificación viajan
// junto al backup — sin ellos no se puede descifrar.
// El archivo resultante es inútil sin la contraseña maestra.
async function exportarVaultBackup(passwordMaestra) {
  // Verificar contraseña antes de exportar
  // desbloquearVault propaga VAULT_VERSION_INCOMPATIBLE si es necesario
  const clave = await desbloquearVault(passwordMaestra);
  if (!clave) throw new Error('PASSWORD_INCORRECTA');

  // Obtener todos los datos del vault
  const datos = await idbStorage.get(['sal', 'sal2', 'tokenVerificacion', 'vaultCifrado']);

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
// el backup ANTES de importar. Propaga VAULT_VERSION_INCOMPATIBLE sin
// convertirla a PASSWORD_INCORRECTA — son errores semánticamente distintos.
//
// opcionesImport.onProgreso(pasoActual, totalPasos): callback opcional invocado
// antes de cada derivación PBKDF2. Permite a la UI mostrar progreso durante
// las ~1-3 segundos de freeze por derivación. totalPasos = 3 siempre.
//
// Tres casos explícitos — sin éxito falso ni descarte silencioso:
// · Caso 1 — Sin vault local: instala la estructura del backup (sal, sal2,
//   tokenVerificacion) en IDB y cifra con claveNew. Post-import: vault
//   configurado pero sin sesión activa — la UI debe rutar a #/unlock.
// · Caso 2 — Vault local + misma password: fusiona credenciales y guarda
//   con la clave derivada del vault local (claveParaGuardar).
// · Caso 3 — Vault local + password distinta: lanza IMPORT_PASSWORD_MISMATCH.
//   Sin escritura parcial — las credenciales nunca se descartan en silencio.
async function importarVaultBackup(backup, passwordMaestra, opcionesImport = {}) {
  // Validar estructura del backup
  if (!backup.sal || !backup.sal2 || !backup.tokenVerificacion || !backup.vaultCifrado) {
    throw new Error('BACKUP_INVALIDO');
  }

  if (backup.app !== 'Dacmos Password Manager') {
    throw new Error('BACKUP_INVALIDO');
  }

  // Notificador de progreso — no-op si el caller no pasa onProgreso
  const _progreso = (paso) => {
    if (typeof opcionesImport.onProgreso === 'function') {
      opcionesImport.onProgreso(paso, 3);
    }
  };

  // Call site 1: verificar contraseña contra el token del backup
  try {
    const sal2 = new Uint8Array(base64ABuffer(backup.sal2));
    _progreso(1);
    const claveVerif = await derivarClave(passwordMaestra, sal2);
    const token      = await descifrarConVersion(backup.tokenVerificacion, claveVerif);

    if (token.verificacion !== 'DACMOSGROUP_VAULT_OK') {
      throw new Error('PASSWORD_INCORRECTA');
    }
  } catch (error) {
    if (error.message === 'PASSWORD_INCORRECTA') throw error;
    // Vault de versión futura en el backup — no es contraseña incorrecta.
    if (error.message?.startsWith('VAULT_VERSION_INCOMPATIBLE')) throw error;
    throw new Error('PASSWORD_INCORRECTA');
  }

  // Call site 2: descifrar vault del backup.
  // VAULT_VERSION_INCOMPATIBLE se propaga naturalmente al caller.
  const sal = new Uint8Array(base64ABuffer(backup.sal));
  _progreso(2);
  const claveNew    = await derivarClave(passwordMaestra, sal);
  const vaultBackup = await descifrarConVersion(backup.vaultCifrado, claveNew);

  // Obtener datos del vault local para determinar el caso de importación
  const datosActuales = await idbStorage.get(['sal', 'vaultCifrado']);

  let credencialesFinales = vaultBackup.credenciales || [];
  // claveParaGuardar: se asigna solo si vault local existe Y la password coincide.
  // Permanece null si no hay vault local o si la password no coincide (Casos 1 y 3).
  let claveParaGuardar = null;

  // Call site 3: fusionar con vault local si existe y la password coincide
  if (datosActuales.vaultCifrado && datosActuales.sal) {
    try {
      const salActual = new Uint8Array(base64ABuffer(datosActuales.sal));
      _progreso(3);
      claveParaGuardar      = await derivarClave(passwordMaestra, salActual);
      const vaultActual     = await descifrarConVersion(datosActuales.vaultCifrado, claveParaGuardar);
      const credActuales    = vaultActual.credenciales || [];

      // Fusionar — evitar duplicados por ID
      const idsBackup       = new Set(credencialesFinales.map(c => c.id));
      const nuevas          = credActuales.filter(c => !idsBackup.has(c.id));
      credencialesFinales   = [...credencialesFinales, ...nuevas];
    } catch (error) {
      // VAULT_VERSION_INCOMPATIBLE en el vault local es error irrecuperable — propagar.
      if (error.message?.startsWith('VAULT_VERSION_INCOMPATIBLE')) throw error;
      // derivarClave o descifrar fallaron: la password del backup no coincide
      // con la del vault local. claveParaGuardar queda null → activa Caso 3.
      claveParaGuardar = null;
    }
  }

  // ── Persistir credenciales según el caso detectado ──

  if (!datosActuales.sal) {
    // Caso 1: sin vault local — instalar estructura del backup en IDB.
    // backup.sal/sal2/tokenVerificacion quedan como las sales y el token del vault
    // local. claveNew (derivada de backup.sal) cifra las credenciales importadas.
    await idbStorage.set({
      vaultConfigurado:  true,
      sal:               backup.sal,
      sal2:              backup.sal2,
      tokenVerificacion: backup.tokenVerificacion,
    });
    await guardarVaultCifrado(credencialesFinales, claveNew);

  } else if (claveParaGuardar) {
    // Caso 2: vault local + misma password — guardar fusión con la clave local.
    await guardarVaultCifrado(credencialesFinales, claveParaGuardar);

  } else {
    // Caso 3: vault local existe pero la password del backup no coincide con la
    // contraseña actual del vault. Error explícito — sin escritura parcial.
    throw new Error('IMPORT_PASSWORD_MISMATCH');
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
  detectarVersionBlob,
  generarSal,
  bufferABase64,
  base64ABuffer,
};
