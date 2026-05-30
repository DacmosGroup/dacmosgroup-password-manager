// ================================================
// Dacmos Password Manager — StorageAdapter (PWA)
// Fork literal de src/sync/storage-adapter.js.
// Sin cambios de lógica — idéntico al original.
// Necesario como archivo local porque la PWA se sirve
// desde web/ y no puede importar fuera de ese directorio.
// ================================================

export class StorageAdapter {
  // Guarda el vault cifrado en el proveedor
  async guardar(vaultCifrado) { throw new Error('No implementado') }

  // Carga el vault cifrado desde el proveedor
  async cargar() { throw new Error('No implementado') }

  // Retorna el timestamp (ms) de la última modificación en el proveedor
  async ultimaModificacion() { throw new Error('No implementado') }

  // Verifica conectividad sin prompt interactivo
  async verificarConexion() { throw new Error('No implementado') }

  // Nombre del proveedor para mostrar en UI
  nombreProveedor() { throw new Error('No implementado') }
}
