// =============================================================
// tests/h5-verify.mjs — verificación funcional de H-5
// (_deviceId embebido en el payload cifrado del vault)
//
// Script temporal (protocolo: se elimina tras uso). Corre en Node
// (crypto global = Web Crypto). Stubbea el storage de cada superficie:
//   - Extension: globalThis.chrome.storage.local (objeto en memoria)
//   - PWA:       indexeddb-adapter.js interceptado vía module hooks
//
// Uso:  node tests/h5-verify.mjs
// Salida: exit 0 = todo verde · exit 1 = alguna aserción falló
// =============================================================

import { registerHooks } from 'node:module'
import assert from 'node:assert/strict'

// ── Stub in-memory de idbStorage (misma API que el adapter real) ──
const STUB_ADAPTER = `
let mem = {}
export const idbStorage = {
  async get(keys) {
    const k = Array.isArray(keys) ? keys : [keys]
    const out = {}
    for (const key of k) if (key in mem) out[key] = mem[key]
    return out
  },
  async set(obj) { Object.assign(mem, obj) },
  async remove(keys) { const k = Array.isArray(keys) ? keys : [keys]; for (const key of k) delete mem[key] },
  async clear() { mem = {} },
  __dump: () => ({ ...mem }),
}
`

registerHooks({
  resolve(spec, ctx, next) {
    if (spec.endsWith('indexeddb-adapter.js')) {
      return { url: 'stub:idb-adapter', shortCircuit: true }
    }
    return next(spec, ctx)
  },
  load(url, ctx, next) {
    if (url === 'stub:idb-adapter') {
      return { format: 'module', source: STUB_ADAPTER, shortCircuit: true }
    }
    // El repo no tiene package.json (sin npm): Node trata los .js como CJS.
    // Los módulos del proyecto usan sintaxis ESM — forzar el formato.
    if (url.startsWith('file:') && url.endsWith('.js') && (url.includes('/src/') || url.includes('/web/'))) {
      const r = next(url, { ...ctx, format: 'module' })
      return r
    }
    return next(url, ctx)
  },
})

// ── Helpers ──
const b64ToBuf = (b64) => {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

// Descifra el payload del blob v1 reconstruyendo el AAD canónico.
// Replica descifrarConVersion() case 1 para inspeccionar la forma real
// del contenido cifrado (que cargarVaultDescifrado deliberadamente aplana).
async function descifrarPayload(blob, clave) {
  const aad = new TextEncoder().encode(
    `{"__version":${blob.__version},"kdf":${JSON.stringify(blob.kdf)},"kdfIterations":${blob.kdfIterations}}`,
  )
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(blob.iv), additionalData: aad },
    clave,
    b64ToBuf(blob.datos),
  )
  return JSON.parse(new TextDecoder().decode(pt))
}

const CREDS = [
  { id: crypto.randomUUID(), tipo: 'login', sitio: 'ejemplo.com', url: 'https://ejemplo.com', usuario: 'u', password: 'p', totp: '', notas: '', creado: '2026-09-06T00:00:00Z', modificado: '2026-09-06T00:00:00Z' },
]

let fallos = 0
const ok  = (msg) => console.log(`  ✅ ${msg}`)
const bad = (msg, e) => { fallos++; console.log(`  ❌ ${msg}\n     ${e?.message ?? e}`) }
async function check(msg, fn) { try { await fn(); ok(msg) } catch (e) { bad(msg, e) } }

// ═══════════════════════════════════════════════
// 1. Extension — src/crypto/engine.js
// ═══════════════════════════════════════════════
console.log('\n[1/2] Chrome Extension — src/crypto/engine.js')

globalThis.chrome = {
  storage: {
    local: (() => {
      let mem = {}
      return {
        get: (keys, cb) => {
          const k = Array.isArray(keys) ? keys : [keys]
          const out = {}
          for (const key of k) if (key in mem) out[key] = mem[key]
          cb(out)
        },
        set: (obj, cb) => { Object.assign(mem, obj); cb && cb() },
        __dump: () => ({ ...mem }),
      }
    })(),
  },
}

{
  const ext = await import('../src/crypto/engine.js')
  const clave = await ext.configurarVault('contraseña-maestra-de-prueba')

  // configurarVault() embebe _deviceId desde la creación (H-5)
  const blobInicial = chrome.storage.local.__dump().vaultCifrado
  const payloadInicial = await descifrarPayload(blobInicial, clave)
  await check('configurarVault() embebe _deviceId (null en Extension) desde la creación', () => {
    assert.ok(Object.prototype.hasOwnProperty.call(payloadInicial, '_deviceId'))
    assert.equal(payloadInicial._deviceId, null)
    assert.deepEqual(payloadInicial.credenciales, [])
  })

  await ext.guardarVaultCifrado(CREDS, clave)
  const blob = chrome.storage.local.__dump().vaultCifrado
  const payload = await descifrarPayload(blob, clave)

  await check('payload cifrado tiene la clave _deviceId', () =>
    assert.ok(Object.prototype.hasOwnProperty.call(payload, '_deviceId')))
  await check('_deviceId es null en la Extension (sin device-id.js)', () =>
    assert.equal(payload._deviceId, null))
  await check('payload.credenciales sigue siendo un array', () =>
    assert.ok(Array.isArray(payload.credenciales)))
  await check('cargarVaultDescifrado() devuelve un array plano (contrato intacto)', async () => {
    const out = await ext.cargarVaultDescifrado(clave)
    assert.ok(Array.isArray(out))
    assert.equal(out.length, 1)
    assert.equal(out[0].id, CREDS[0].id)
  })
  await check('BLOB_VERSION del blob sigue en 1', () =>
    assert.equal(blob.__version, 1))
  await check('lectura de blob legado sin _deviceId no rompe', async () => {
    // Blob { credenciales } sin _deviceId, cifrado con la misma clave+AAD
    const aad = new TextEncoder().encode(`{"__version":1,"kdf":"PBKDF2-SHA256","kdfIterations":600000}`)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad },
      clave,
      new TextEncoder().encode(JSON.stringify({ credenciales: CREDS })),
    )
    const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
    chrome.storage.local.set({
      vaultCifrado: { __version: 1, kdf: 'PBKDF2-SHA256', kdfIterations: 600000, iv: toB64(iv.buffer), datos: toB64(ct) },
    })
    const out = await ext.cargarVaultDescifrado(clave)
    assert.equal(out.length, 1)
  })
  // Último check del bloque: cambiarMasterPassword deja el storage cifrado
  // con la clave nueva — cualquier assert posterior con `clave` vieja fallaría.
  await check('cambiarMasterPassword() re-cifra preservando la clave _deviceId (no la borra)', async () => {
    const claveNueva = await ext.cambiarMasterPassword('contraseña-maestra-de-prueba', 'nueva-pw-de-prueba-456')
    const p = await descifrarPayload(chrome.storage.local.__dump().vaultCifrado, claveNueva)
    assert.ok(Object.prototype.hasOwnProperty.call(p, '_deviceId'), '_deviceId ausente tras cambio de master password')
    assert.equal(p._deviceId, null)
    assert.equal(p.credenciales.length, 1)
  })
}

// ═══════════════════════════════════════════════
// 2. PWA — web/src/crypto/engine.js
// ═══════════════════════════════════════════════
console.log('\n[2/2] PWA — web/src/crypto/engine.js')

{
  const pwa = await import('../web/src/crypto/engine.js')
  const adapter = await import('../web/src/storage/indexeddb-adapter.js')
  const clave = await pwa.configurarVault('contraseña-maestra-de-prueba')
  const deviceIdPersistido = adapter.idbStorage.__dump().deviceId

  // configurarVault() embebe _deviceId desde la creación (H-5)
  const payloadInicial = await descifrarPayload(adapter.idbStorage.__dump().vaultCifrado, clave)
  await check('configurarVault() embebe _deviceId (UUID) desde la creación', () => {
    assert.equal(payloadInicial._deviceId, deviceIdPersistido)
    assert.deepEqual(payloadInicial.credenciales, [])
  })

  await pwa.guardarVaultCifrado(CREDS, clave)
  const blob = adapter.idbStorage.__dump().vaultCifrado
  const payload = await descifrarPayload(blob, clave)

  await check('payload cifrado tiene la clave _deviceId', () =>
    assert.ok(Object.prototype.hasOwnProperty.call(payload, '_deviceId')))
  await check('_deviceId es un UUID v4', () =>
    assert.match(payload._deviceId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i))
  await check('_deviceId del payload == deviceId persistido en IDB', () =>
    assert.equal(payload._deviceId, deviceIdPersistido))
  await check('device-id.js persiste una sola identidad estable entre guardados', async () => {
    await pwa.guardarVaultCifrado(CREDS, clave)
    const blob2 = adapter.idbStorage.__dump().vaultCifrado
    const p2 = await descifrarPayload(blob2, clave)
    assert.equal(p2._deviceId, deviceIdPersistido)
  })
  await check('payload.credenciales sigue siendo un array', () =>
    assert.ok(Array.isArray(payload.credenciales)))
  await check('cargarVaultDescifrado() devuelve un array plano (contrato intacto)', async () => {
    const out = await pwa.cargarVaultDescifrado(clave)
    assert.ok(Array.isArray(out))
    assert.equal(out[0].id, CREDS[0].id)
  })
  await check('BLOB_VERSION del blob sigue en 1', () =>
    assert.equal(blob.__version, 1))
  // Último check: cambiarMasterPassword deja el storage cifrado con la clave nueva.
  await check('cambiarMasterPassword() re-cifra preservando _deviceId (misma identidad)', async () => {
    const claveNueva = await pwa.cambiarMasterPassword('contraseña-maestra-de-prueba', 'nueva-pw-de-prueba-456')
    const p = await descifrarPayload(adapter.idbStorage.__dump().vaultCifrado, claveNueva)
    assert.equal(p._deviceId, deviceIdPersistido)
    assert.equal(p.credenciales.length, 1)
  })
}

console.log(`\n${'='.repeat(51)}`)
if (fallos === 0) {
  console.log(' ✅ H-5 verificado — _deviceId embebido, contrato de lectura intacto.')
  process.exit(0)
} else {
  console.log(` ❌ ${fallos} aserción(es) fallaron.`)
  process.exit(1)
}
