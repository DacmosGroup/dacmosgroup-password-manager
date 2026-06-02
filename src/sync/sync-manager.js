// ================================================
// Dacmos Password Manager — Sync Manager
// F2.1–F2.2: Orquestador de sincronización BYOC
// v0.4.2: Sync defensivo con rollback (H-1) y
//         enriquecimiento de blob con sales (BUG-3)
// ================================================
// DECISIÓN DE SEGURIDAD: sync-manager opera exclusivamente sobre
// el blob cifrado (vaultCifrado) de chrome.storage.local.
// Nunca descifra ni accede a credenciales en texto claro.
// La clave AES permanece únicamente en el contexto de UI (popup/vault).
//
// ENRIQUECIMIENTO DE BLOB (BUG-3):
// Cada upload incluye sal, sal2 y tokenVerificacion junto al vault.
// Al descargar, se extraen esos campos y se actualizan en local storage,
// permitiendo que otros dispositivos (PWA/Extension) deriven la misma
// clave AES con la misma contraseña maestra.
// Formato plano: { ...vaultCifrado, sal, sal2, tokenVerificacion }
// Detección: blob.sal existe → enriquecido; sin sal → legacy (backward compat).
//
// VERIFICACIÓN DEFENSIVA (H-1):
// Al descargar, se compara sal_remoto vs sal_local:
//   · Sal igual o sin sal local: escribe vault + sales (idempotente).
//   · Sal distinta + sesión activa: NO escribe — error visible al usuario.
//   · Sal distinta + sin sesión: escribe todo, invalida sesión, notifica.
// En todos los casos, si adapter.cargar() falla o retorna null, no se
// escribe nada (rollback implícito).
//
// GUARDIA ANTI-LOOP:
// Cuando sync descarga de Drive, escribe { ..., _syncTs } en el mismo
// set(). El onChanged listener en service-worker.js detecta _syncTs
// y omite disparar sync — previene el ciclo descarga → onChanged → subida.
// El flag sincronizandoAhora cubre re-entrada concurrente adicional.

import { GoogleDriveAdapter } from './google-drive-adapter.js'

let sincronizandoAhora = false

// ── Helpers de storage ──

async function obtenerSyncConfig() {
  return new Promise(resolve =>
    chrome.storage.local.get(['syncConfig'], r => resolve(r.syncConfig || {}))
  )
}

async function actualizarEstado(estado, mensaje = '') {
  const patch = { estado, mensaje }
  if (estado === 'sincronizado') patch.ultimaSync = new Date().toISOString()
  await new Promise(resolve =>
    chrome.storage.local.set({ syncEstado: patch }, resolve)
  )
}

// Persiste la marca de tiempo de la última sincronización exitosa.
// Separado de actualizarEstado() porque el upload y el download lo llaman
// en distintos momentos del flujo.
async function _actualizarUltimaSync() {
  const configActual = await obtenerSyncConfig()
  await new Promise(resolve =>
    chrome.storage.local.set({
      syncConfig: { ...configActual, ultimaSincronizacion: new Date().toISOString() },
    }, resolve)
  )
}

// ── Enriquecimiento del blob para upload (BUG-3) ──

// Añade sal, sal2 y tokenVerificacion al vault antes de subirlo al proveedor.
// Los campos extra permiten a otros dispositivos derivar la clave AES
// correcta usando solo la contraseña maestra — resuelve BUG-3.
// Formato resultante: { ...vaultCifrado, sal, sal2, tokenVerificacion }
async function _enriquecerBlob(vaultCifrado) {
  const { sal, sal2, tokenVerificacion } = await new Promise(resolve =>
    chrome.storage.local.get(['sal', 'sal2', 'tokenVerificacion'], resolve)
  )
  return { ...vaultCifrado, sal, sal2, tokenVerificacion }
}

// ── Descarga defensiva (H-1 + BUG-3) ──

// Descarga el vault de Drive y lo persiste en chrome.storage.local.
// Implementa verificación defensiva para detectar incompatibilidad entre
// vaults de distintos orígenes antes de sobrescribir el estado local.
//
// Escenarios según el blob descargado:
//   · Legacy (sin campo sal): backward compat — escribe solo vaultCifrado.
//   · Sal igual a la local: escribe vault y sales (actualización normal).
//   · Sal distinta + sesión activa: NO escribe — la clave AES en sesión
//     no puede descifrar el vault remoto. Error visible, estado intacto.
//   · Sal distinta + sin sesión: escribe todas las sales y el vault,
//     invalida la sesión y notifica al usuario para que re-autentique.
async function _descargar(adapter) {
  const blobRemoto = await adapter.cargar()

  // cargar() retorna null si el archivo desapareció entre ultimaModificacion()
  // y cargar(). No tocar estado local.
  if (!blobRemoto) return

  // ── Blob legacy (sin campo sal) — backward compat ──
  if (!blobRemoto.sal) {
    await new Promise(resolve =>
      chrome.storage.local.set({ vaultCifrado: blobRemoto, _syncTs: Date.now() }, resolve)
    )
    await _actualizarUltimaSync()
    await actualizarEstado('sincronizado')
    return
  }

  // ── Blob enriquecido — extraer vault y sales ──
  // El spread destructuring separa las sales del vault para persistirlos
  // en las claves correctas de chrome.storage.local.
  const { sal: salRemoto, sal2: sal2Remoto, tokenVerificacion: tokenRemoto, ...vaultCifradoRemoto } = blobRemoto

  // Leer sal local y estado de sesión para verificación defensiva
  const { sal: salLocal, sesionActiva } = await new Promise(resolve =>
    chrome.storage.local.get(['sal', 'sesionActiva'], resolve)
  )

  // salCambia es true solo si ya existe una sal local Y es diferente a la remota.
  // Si no hay sal local (vault no configurado), salCambia = false → escribir todo.
  const salCambia = !!salLocal && salRemoto !== salLocal

  if (salCambia && sesionActiva) {
    // El vault del proveedor fue configurado en otro dispositivo.
    // La clave AES en sesión fue derivada de la sal anterior — no puede
    // descifrar el vault remoto. No sobreescribir para preservar integridad.
    await actualizarEstado('error',
      'El vault del proveedor fue configurado en otro dispositivo. ' +
      'Bloquea el vault y vuelve a sincronizar para actualizar.'
    )
    return
  }

  // Construir patch atómico — _syncTs en el mismo set() evita re-trigger
  // del onChanged listener en service-worker.js (guardia anti-loop).
  const patch = {
    vaultCifrado:      vaultCifradoRemoto,
    sal:               salRemoto,
    sal2:              sal2Remoto,
    tokenVerificacion: tokenRemoto,
    _syncTs:           Date.now(),
  }

  if (salCambia) {
    // Sin sesión activa pero las sales cambian: limpiar el estado de sesión
    // antes de que el usuario intente desbloquear con las nuevas sales.
    patch.sesionActiva = false
    await new Promise(resolve => chrome.storage.session.clear(resolve))
  }

  await new Promise(resolve => chrome.storage.local.set(patch, resolve))
  await _actualizarUltimaSync()

  // Notificar solo si las sales cambiaron — en ese caso el usuario debe
  // volver a desbloquear para que el engine derive la clave con la nueva sal.
  const mensajeEstado = salCambia
    ? 'Vault actualizado desde otro dispositivo — desbloquéalo de nuevo para acceder.'
    : ''
  await actualizarEstado('sincronizado', mensajeEstado)
}

// ── Lógica principal (Last Write Wins por timestamp) ──

async function sincronizar() {
  const config = await obtenerSyncConfig()
  if (config.proveedor !== 'google-drive') return

  const adapter = new GoogleDriveAdapter()
  await actualizarEstado('sincronizando')

  const { vaultCifrado } = await new Promise(resolve =>
    chrome.storage.local.get(['vaultCifrado'], resolve)
  )
  if (!vaultCifrado) {
    await actualizarEstado('error', 'No hay vault local')
    return
  }

  // Obtener timestamp del archivo en Drive (puede fallar si hay sin conexión)
  let modRemoto
  try {
    modRemoto = await adapter.ultimaModificacion()
  } catch (err) {
    const sinToken = err.message === 'TOKEN_NO_DISPONIBLE' || /oauth|auth/i.test(err.message)
    await actualizarEstado('pendiente', sinToken ? 'Sin conexión con Google' : err.message)
    return
  }

  const ultimaSync = config.ultimaSincronizacion
    ? new Date(config.ultimaSincronizacion).getTime()
    : 0

  if (modRemoto === null) {
    // Archivo no existe en Drive — primera subida con blob enriquecido
    const blobEnriquecido = await _enriquecerBlob(vaultCifrado)
    await adapter.guardar(blobEnriquecido)
    await _actualizarUltimaSync()
    await actualizarEstado('sincronizado')

  } else if (modRemoto > ultimaSync) {
    // Drive tiene datos más recientes — descargar con verificación defensiva.
    // _descargar() maneja internamente el estado y la actualización de config.
    await _descargar(adapter)

  } else {
    // Local es más reciente o igual — subir blob enriquecido
    const blobEnriquecido = await _enriquecerBlob(vaultCifrado)
    await adapter.guardar(blobEnriquecido)
    await _actualizarUltimaSync()
    await actualizarEstado('sincronizado')
  }
}

// ── API pública ──

export async function sincronizarTrasEscritura() {
  if (sincronizandoAhora) return
  sincronizandoAhora = true
  try {
    await sincronizar()
  } catch (err) {
    console.error('DacmosSync:', err.message)
    await actualizarEstado('error', err.message || 'Error de sincronización').catch(() => {})
  } finally {
    sincronizandoAhora = false
  }
}

export async function conectarGoogleDrive() {
  const adapter = new GoogleDriveAdapter()
  // interactive=true: abre el selector de cuenta Google (requiere acción del usuario)
  await adapter.obtenerToken(true)

  await new Promise(resolve =>
    chrome.storage.local.set({
      syncConfig: { proveedor: 'google-drive', fileId: null, ultimaSincronizacion: null },
      syncEstado: { estado: 'sincronizando', mensaje: '' },
    }, resolve)
  )

  await sincronizarTrasEscritura()
}

export async function desconectarGoogleDrive() {
  const adapter = new GoogleDriveAdapter()
  await adapter.desconectar()
  await new Promise(resolve =>
    chrome.storage.local.set({
      syncConfig: { proveedor: null, fileId: null, ultimaSincronizacion: null },
      syncEstado: { estado: 'desconectado', mensaje: '' },
    }, resolve)
  )
}

export async function obtenerEstadoSync() {
  return new Promise(resolve =>
    chrome.storage.local.get(['syncEstado', 'syncConfig'], r => resolve({
      estado:     r.syncEstado?.estado    ?? 'desconectado',
      mensaje:    r.syncEstado?.mensaje   ?? '',
      ultimaSync: r.syncEstado?.ultimaSync ?? null,
      proveedor:  r.syncConfig?.proveedor  ?? null,
    }))
  )
}
