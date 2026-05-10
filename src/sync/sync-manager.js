// ================================================
// Dacmos Password Manager — Sync Manager
// F2.1–F2.2: Orquestador de sincronización BYOC
// ================================================
// DECISIÓN DE SEGURIDAD: sync-manager opera exclusivamente sobre
// el blob cifrado (vaultCifrado) de chrome.storage.local.
// Nunca descifra ni accede a credenciales en texto claro.
// La clave AES permanece únicamente en el contexto de UI (popup/vault).
//
// GUARDIA ANTI-LOOP:
// Cuando sync descarga de Drive, escribe { vaultCifrado, _syncTs } juntos.
// El onChanged listener en service-worker.js detecta _syncTs en los cambios
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
    // Archivo no existe en Drive — primera subida
    await adapter.guardar(vaultCifrado)

  } else if (modRemoto > ultimaSync) {
    // Drive tiene datos más recientes — descargar y reemplazar local
    // _syncTs se escribe junto con vaultCifrado en el mismo set() para que
    // onChanged lo detecte como escritura interna del sync y no redispare.
    const vaultRemoto = await adapter.cargar()
    if (vaultRemoto) {
      await new Promise(resolve =>
        chrome.storage.local.set({ vaultCifrado: vaultRemoto, _syncTs: Date.now() }, resolve)
      )
    }

  } else {
    // Local es más reciente o igual — subir a Drive
    await adapter.guardar(vaultCifrado)
  }

  const configActual = await obtenerSyncConfig()
  await new Promise(resolve =>
    chrome.storage.local.set({
      syncConfig: { ...configActual, ultimaSincronizacion: new Date().toISOString() },
    }, resolve)
  )
  await actualizarEstado('sincronizado')
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
