// ================================================
// Dacmos Password Manager — OneDrive Sync Manager
// F2.2: Orquestador de sincronización — Microsoft OneDrive
// v0.4.2: Sync defensivo con rollback (H-1/H-3) y
//         enriquecimiento de blob con sales (BUG-3)
// ================================================
// DECISIÓN DE SEGURIDAD: opera exclusivamente sobre el blob cifrado
// (vaultCifrado) de chrome.storage.local. Nunca descifra ni accede
// a credenciales en texto claro. La clave AES permanece en el contexto UI.
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
// Cuando sync descarga de OneDrive, escribe { ..., _syncTs } en el mismo
// set(). El onChanged listener en service-worker.js detecta _syncTs
// y omite disparar sync — previene el ciclo descarga → onChanged → subida.
// El flag sincronizandoAhora cubre re-entrada concurrente adicional.

import { OneDriveAdapter } from './onedrive-adapter.js'

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
async function _actualizarUltimaSync() {
  const configActual = await obtenerSyncConfig()
  await new Promise(resolve =>
    chrome.storage.local.set({
      syncConfig: { ...configActual, ultimaSincronizacion: new Date().toISOString() },
    }, resolve)
  )
}

// ── Enriquecimiento del blob para upload (BUG-3) ──

// Añade sal, sal2 y tokenVerificacion al vault antes de subirlo a OneDrive.
// Permite que otros dispositivos deriven la clave AES correcta con solo
// la contraseña maestra — resuelve BUG-3 para el proveedor OneDrive.
async function _enriquecerBlob(vaultCifrado) {
  const { sal, sal2, tokenVerificacion } = await new Promise(resolve =>
    chrome.storage.local.get(['sal', 'sal2', 'tokenVerificacion'], resolve)
  )
  return { ...vaultCifrado, sal, sal2, tokenVerificacion }
}

// ── Descarga defensiva (H-1 + BUG-3) ──

// Descarga el vault de OneDrive y lo persiste en chrome.storage.local.
// Lógica de verificación defensiva idéntica a sync-manager.js (Google Drive).
//
// Escenarios según el blob descargado:
//   · Legacy (sin campo sal): backward compat — escribe solo vaultCifrado.
//   · Sal igual a la local: escribe vault y sales (actualización normal).
//   · Sal distinta + sesión activa: NO escribe — error visible, estado intacto.
//   · Sal distinta + sin sesión: escribe todo, invalida sesión, notifica.
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
  const { sal: salRemoto, sal2: sal2Remoto, tokenVerificacion: tokenRemoto, ...vaultCifradoRemoto } = blobRemoto

  // Leer sal local y estado de sesión para verificación defensiva
  const { sal: salLocal, sesionActiva } = await new Promise(resolve =>
    chrome.storage.local.get(['sal', 'sesionActiva'], resolve)
  )

  const salCambia = !!salLocal && salRemoto !== salLocal

  if (salCambia && sesionActiva) {
    // El vault del proveedor fue configurado en otro dispositivo.
    // No sobreescribir con sesión activa para preservar integridad.
    await actualizarEstado('error',
      'El vault del proveedor fue configurado en otro dispositivo. ' +
      'Bloquea el vault y vuelve a sincronizar para actualizar.'
    )
    return
  }

  // Patch atómico — _syncTs evita re-trigger del onChanged listener
  const patch = {
    vaultCifrado:      vaultCifradoRemoto,
    sal:               salRemoto,
    sal2:              sal2Remoto,
    tokenVerificacion: tokenRemoto,
    _syncTs:           Date.now(),
  }

  if (salCambia) {
    // Sin sesión activa pero las sales cambian: limpiar el estado de sesión.
    patch.sesionActiva = false
    await new Promise(resolve => chrome.storage.session.clear(resolve))
  }

  await new Promise(resolve => chrome.storage.local.set(patch, resolve))
  await _actualizarUltimaSync()

  const mensajeEstado = salCambia
    ? 'Vault actualizado desde otro dispositivo — desbloquéalo de nuevo para acceder.'
    : ''
  await actualizarEstado('sincronizado', mensajeEstado)
}

// ── Lógica principal (Last Write Wins por timestamp) ──

async function sincronizar() {
  const config = await obtenerSyncConfig()
  if (config.proveedor !== 'onedrive') return

  const adapter = new OneDriveAdapter()
  await actualizarEstado('sincronizando')

  const { vaultCifrado } = await new Promise(resolve =>
    chrome.storage.local.get(['vaultCifrado'], resolve)
  )
  if (!vaultCifrado) {
    await actualizarEstado('error', 'No hay vault local')
    return
  }

  // Obtener timestamp del archivo en OneDrive (puede fallar si hay sin conexión)
  let modRemoto
  try {
    modRemoto = await adapter.ultimaModificacion()
  } catch (err) {
    const sinToken = err.message === 'TOKEN_NO_DISPONIBLE' || /token|auth/i.test(err.message)
    await actualizarEstado('pendiente', sinToken ? 'Sin conexión con OneDrive' : err.message)
    return
  }

  const ultimaSync = config.ultimaSincronizacion
    ? new Date(config.ultimaSincronizacion).getTime()
    : 0

  if (modRemoto === null) {
    // Archivo no existe en OneDrive — primera subida con blob enriquecido
    const blobEnriquecido = await _enriquecerBlob(vaultCifrado)
    await adapter.guardar(blobEnriquecido)
    await _actualizarUltimaSync()
    await actualizarEstado('sincronizado')

  } else if (modRemoto > ultimaSync) {
    // OneDrive tiene datos más recientes — descargar con verificación defensiva.
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

export async function sincronizarOneDrive() {
  if (sincronizandoAhora) return
  sincronizandoAhora = true
  try {
    await sincronizar()
  } catch (err) {
    console.error('DacmosSync OneDrive:', err.message)
    await actualizarEstado('error', err.message || 'Error de sincronización').catch(() => {})
  } finally {
    sincronizandoAhora = false
  }
}

export async function conectarOneDrive() {
  const adapter = new OneDriveAdapter()
  // conectar() lanza launchWebAuthFlow — requiere acción interactiva del usuario
  await adapter.conectar()

  await new Promise(resolve =>
    chrome.storage.local.set({
      syncConfig: { proveedor: 'onedrive', ultimaSincronizacion: null },
      syncEstado: { estado: 'sincronizando', mensaje: '' },
    }, resolve)
  )

  await sincronizarOneDrive()
}

export async function desconectarOneDrive() {
  const adapter = new OneDriveAdapter()
  await adapter.desconectar()
  await new Promise(resolve =>
    chrome.storage.local.set({
      syncConfig: { proveedor: null, ultimaSincronizacion: null },
      syncEstado: { estado: 'desconectado', mensaje: '' },
    }, resolve)
  )
}
