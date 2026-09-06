import { idbStorage } from './indexeddb-adapter.js'

/**
 * Retorna el identificador opaco de instalación, creándolo si no existe.
 * El deviceId se persiste en IDB y nunca cambia para esta instalación.
 *
 * Fuente canónica única de identidad de dispositivo. Consumido por
 * engine.js (H-5): se embebe como _deviceId en el payload cifrado del
 * vault en cada guardarVaultCifrado(). H-9 (syncLog, Sprint 3) debe
 * consumir este mismo módulo — no generar una segunda identidad.
 */
export async function obtenerDeviceId() {
  const datos = await idbStorage.get(['deviceId'])
  if (datos.deviceId) return datos.deviceId
  const id = crypto.randomUUID()
  await idbStorage.set({ deviceId: id })
  return id
}
