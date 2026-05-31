// ============================================================
// Dacmos Password Manager — Adaptador IndexedDB (PWA)
// Reemplaza chrome.storage.local con IndexedDB para la PWA.
// Expone la misma API que chrome.storage.local para facilitar
// la reutilización del motor de cifrado sin cambios de lógica.
// ============================================================

// ── Configuración de la base de datos ──
const DB_NOMBRE   = 'dacmos-pm'
const DB_VERSION  = 1
const STORE_VAULT = 'vault'

// ── Singleton de conexión ──
// DECISIÓN TÉCNICA: cacheamos la promesa de apertura para evitar
// que llamadas concurrentes intenten abrir la BD simultáneamente,
// lo que causaría múltiples eventos onupgradeneeded en versión 1.
let _dbPromesa = null

// Abre la conexión a IndexedDB y la retorna (o retorna la existente)
function abrirDB() {
  if (_dbPromesa) return _dbPromesa

  _dbPromesa = new Promise((resolve, reject) => {
    const peticion = indexedDB.open(DB_NOMBRE, DB_VERSION)

    // Creación del schema — se ejecuta solo en primera apertura o upgrade
    peticion.onupgradeneeded = (evento) => {
      const db = evento.target.result
      // Cada registro tiene la forma: { clave: string, valor: any }
      if (!db.objectStoreNames.contains(STORE_VAULT)) {
        db.createObjectStore(STORE_VAULT, { keyPath: 'clave' })
      }
    }

    peticion.onsuccess = (evento) => resolve(evento.target.result)

    peticion.onerror = (evento) => {
      _dbPromesa = null // permite reintento si la apertura falló
      reject(evento.target.error)
    }
  })

  return _dbPromesa
}

// ── set(items) ──
// Guarda uno o varios pares clave-valor en una sola transacción readwrite.
// DECISIÓN DE SEGURIDAD: una sola transacción garantiza atomicidad —
// si falla cualquier put(), IndexedDB hace rollback automático y el
// vault queda en su estado previo completo (crítico para cambiarMasterPassword,
// que escribe sal + sal2 + tokenVerificacion + vaultCifrado en un solo paso).
async function set(items) {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_VAULT, 'readwrite')
    const store = tx.objectStore(STORE_VAULT)

    for (const [clave, valor] of Object.entries(items)) {
      store.put({ clave, valor })
    }

    tx.oncomplete = () => resolve()
    tx.onerror    = (e) => reject(e.target.error)
    tx.onabort    = (e) => reject(e.target.error)
  })
}

// ── get(claves) ──
// Lee las claves especificadas. Las claves inexistentes se omiten del
// resultado — comportamiento idéntico a chrome.storage.local.get().
async function get(claves) {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx        = db.transaction(STORE_VAULT, 'readonly')
    const store     = tx.objectStore(STORE_VAULT)
    const resultado = {}

    for (const clave of claves) {
      const peticion = store.get(clave)
      peticion.onsuccess = (e) => {
        if (e.target.result !== undefined) {
          resultado[clave] = e.target.result.valor
        }
      }
      // Los errores individuales burbujean a tx.onerror — no se tragan silenciosamente
    }

    // Resolvemos en oncomplete — garantiza que todos los gets finalizaron
    tx.oncomplete = () => resolve(resultado)
    tx.onerror    = (e) => reject(e.target.error)
    tx.onabort    = (e) => reject(e.target.error)
  })
}

// ── remove(claves) ──
// Elimina las claves especificadas del store.
async function remove(claves) {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_VAULT, 'readwrite')
    const store = tx.objectStore(STORE_VAULT)

    for (const clave of claves) {
      store.delete(clave)
    }

    tx.oncomplete = () => resolve()
    tx.onerror    = (e) => reject(e.target.error)
    tx.onabort    = (e) => reject(e.target.error)
  })
}

// ── clear() ──
// Borra todos los registros del store (equivale a resetear el vault local).
async function clear() {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_VAULT, 'readwrite')
    const store = tx.objectStore(STORE_VAULT)

    store.clear()

    tx.oncomplete = () => resolve()
    tx.onerror    = (e) => reject(e.target.error)
    tx.onabort    = (e) => reject(e.target.error)
  })
}

// ── API pública ──
export const idbStorage = { set, get, remove, clear }
