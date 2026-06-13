import { idbStorage } from './indexeddb-adapter.js'

/**
 * Retorna el identificador opaco de instalación, creándolo si no existe.
 * El deviceId se persiste en IDB y nunca cambia para esta instalación.
 * Uso: incluirlo en el vault cifrado para identificación de origen en sync
 * (H-5 — observabilidad diferida a v0.7.0 con H-9).
 */
export async function obtenerDeviceId() {
  const datos = await idbStorage.get(['deviceId'])
  if (datos.deviceId) return datos.deviceId
  const id = crypto.randomUUID()
  await idbStorage.set({ deviceId: id })
  return id
}
