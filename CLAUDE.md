# CLAUDE.md — Dacmos Password Manager
# Ruta: C:\DacmosGroup\04_Dev\PasswordManager\dacmosgroup-password-manager\CLAUDE.md
# Última actualización: 2026-06-12
# PREREQUISITO: C:\Users\dacmo\.claude\CLAUDE.md (L0) + C:\DacmosGroup\CLAUDE.md (L1)
# Este archivo asume que ya leíste ambos. No repite convenciones globales ni mandato de seguridad.

---

## Project Overview

Dacmos Password Manager is a **Chrome Extension (Manifest V3)** built with vanilla JavaScript — no build step, no bundler, no npm. All code runs directly in the browser. It is a local-first, zero-knowledge password manager.

---

## Development Setup

There is no build step. Load the extension directly into Chrome:

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the repo root folder

After editing any JS/HTML/CSS file, go to `chrome://extensions/` and click the reload button for the extension. For service worker changes, also click "Service Worker" link to inspect it.

---

## Testing the Extension

There is no test suite. Testing is manual:

- **Popup**: Click the extension icon in Chrome toolbar
- **Vault**: Opens as a full tab (`src/ui/vault/vault.html`)
- **Generator**: Opens as a full tab (`src/ui/generator/generator.html`)
- **Settings**: Opens as a full tab (`src/ui/settings/settings.html`)
- **Content script**: Navigate to any site with a login form — the 🔐 icon should appear in the fields
- **Service worker logs**: `chrome://extensions/` → click "Service Worker" → Console tab

---

## Architecture

### Module System

All UI JS files use **ES modules** (`type="module"` is implied by the import syntax used in HTML). The service worker is declared as `"type": "module"` in `manifest.json`. The content script (`autofill.js`) does **not** use ES modules — it runs in page context and uses globals.

### Chrome Storage Split

| Storage | What lives there |
|---|---|
| `chrome.storage.local` | Encrypted vault (`vaultCifrado`), salts (`sal`, `sal2`), verification token, config, session flags |
| `chrome.storage.session` | Decrypted credentials (`credencialesSesion`) — cleared when browser closes or vault locks |

Decrypted credential data **never** writes to `chrome.storage.local`. The AES key (`claveSesion`) stays only in JS memory within the page/popup context — it is never stored anywhere.

### Message Passing (Content Script ↔ Service Worker ↔ UI)

All cross-context communication uses `chrome.runtime.sendMessage`. Key message types:

| `tipo` | Direction | Purpose |
|---|---|---|
| `VAULT_DESBLOQUEADO` | UI → SW | After unlock; sends decrypted credentials to SW session storage |
| `BLOQUEAR_VAULT` | UI → SW | Manual lock |
| `OBTENER_ESTADO` | UI → SW | Get `vaultConfigurado` + `sesionActiva` |
| `ACTIVIDAD_USUARIO` | Content → SW | Resets auto-lock timer |
| `CAMPOS_LOGIN_DETECTADOS` | Content → SW | Updates badge count |
| `SOLICITAR_AUTOCOMPLETADO` | Content → SW | Returns filtered credentials for current domain |
| `VAULT_BLOQUEADO` | SW → Content | Clears injected icons, shows lock notification |

### Auto-lock Timer

Uses `chrome.alarms` (not `setTimeout`) because MV3 service workers suspend after ~30 seconds, which cancels `setTimeout`. The alarm named `'autoLock'` survives service worker sleep.

### Crypto Engine (`src/crypto/engine.js`)

The single source of truth for all cryptographic operations. Exports:

- `configurarVault(password)` — first-time setup, generates salts, creates empty encrypted vault
- `desbloquearVault(password)` — verifies password via PBKDF2 + AES-GCM token, returns the AES `CryptoKey`
- `guardarVaultCifrado(credenciales, clave)` — encrypts and persists credentials
- `cargarVaultDescifrado(clave)` — decrypts and returns credential array
- `cambiarMasterPassword(actual, nueva)` — re-encrypts entire vault with new key
- `exportarVaultBackup(password)` / `importarVaultBackup(backup, password)` — backup/restore

Security constants: PBKDF2 with 600,000 iterations (OWASP 2024), AES-256-GCM, 32-byte salt, 12-byte IV per operation. Uses only the native **Web Crypto API** — no third-party crypto libraries.

Two independent salts per vault:
- `sal` — derives the actual encryption key
- `sal2` — derives a separate verification key used only to check the master password at unlock time

### Content Script (`src/content/autofill.js`)

Injected into all URLs at `document_idle`. Detects login forms by heuristic (presence of `input[type="password"]`), injects a 🔐 button, and handles the autofill overlay UI. Uses `MutationObserver` to handle SPAs. Triggers `focus`/`input`/`change`/`blur` events when filling fields for compatibility with React/Vue controlled inputs. Calls `escapeHtml()` on all user-supplied data before inserting into innerHTML to prevent XSS.

### Credential Data Shape

```js
{
  id: crypto.randomUUID(),
  tipo: 'login' | 'tarjeta' | 'identidad',
  sitio: string,
  url: string,
  usuario: string,
  password: string,
  totp: string,   // secreto TOTP Base32 (RFC 6238) — campo canónico, opcional (v0.5.1)
  notas: string,
  creado: ISO8601,
  modificado: ISO8601,
}
```

> **Schema canónico TOTP (v0.5.1):** el campo es `totp` en ambas superficies.
> Vaults de la Extension pre-v0.5.1 podían usar `claveTotp`; `src/schema/credential-schema.js`
> normaliza al cargar (convergencia lazy, sin bump de `BLOB_VERSION`). Ver documento-tecnico §28.

### CSP Constraint

`manifest.json` enforces `script-src 'self'` — no inline scripts, no `eval`, no external scripts. All JS must be in files loaded by the extension itself.

---

## PWA — web/ (v0.4.0+)

The PWA lives entirely in `web/`. It coexists with the Chrome Extension — the extension source (`src/`, `manifest.json`) is never modified by PWA work.

### Files added in v0.4.2

| File | Purpose |
|---|---|
| `web/src/storage/indexeddb-adapter.js` | Drop-in replacement for `chrome.storage.local`. Exposes `idbStorage.set/get/remove/clear`. DB: `dacmos-pm`, store: `vault`, keyPath: `clave`. |
| `web/src/crypto/engine.js` | Fork of `src/crypto/engine.js`. Identical crypto logic — only difference is the 7 `chrome.storage.local` calls replaced by `idbStorage`. |

### Key architectural rules for PWA work

- `web/src/crypto/engine.js` is a **fork**, not a symlink. Changes to `src/crypto/engine.js` do NOT automatically apply to the PWA fork — must be ported manually.
- The AES `CryptoKey` never enters IndexedDB. Only encrypted blobs `{ iv, datos }` are persisted.
- Session state (`claveSesion`, `credencialesSesion`) lives in JS module memory only.
- `idbStorage.set()` uses a single `readwrite` transaction for atomicity (critical in `cambiarMasterPassword`).

### Testing the PWA locally

```bash
# Option A — Python
python -m http.server 8080 --directory web

# Option B — npx
npx serve web
```

Open `http://localhost:8080`. Service Worker requires HTTPS in production (Cloudflare Pages handles this).

---

## Versioning Strategy

Per-platform independent versioning:

| Platform | Manifest | Estado |
|---|---|---|
| Chrome Extension | `manifest.json` | v0.5.1 · v0.5.0 PUBLICADA en CWS ✅ · **v0.5.1 pendiente de empaquetar/subir a CWS** |
| PWA | `web/manifest.json` | v0.5.1 LIVE en dpm.dacmosgroup.co ✅ (incluye UX-LOCK-NAV) |
| Android (Capacitor) | `android/` · `app-release.aab` | **v0.6.0 COMPLETADO 2026-06-12** ✅ · bundleRelease firmado · Play Store: cuenta activa, verificación identidad pendiente |

**Estado auditoría:** Fases 1–4 completas (commit `4970463`, merge `01c8623`). Branch `fix/auditoria-remediaciones` cerrada.
**Testing completado 2026-06-06:** Bloques 1–8 APROBADOS — sync round-trip Extension ↔ PWA en ambas direcciones.

**v0.5.0 COMPLETO (2026-06-08):**
- F5-A: Auto-lock timer en PWA (visibilitychange + Date.now())
- F5-B: i18n ES/EN/PT-BR — Extension (chrome.i18n MV3, sigue idioma de Chrome, SIN selector) + PWA (módulo custom `web/src/i18n/` CON selector en Settings)
- ZIP CWS v0.5.0 generado: `dacmos-pm-v0.5.0-cws.zip` (144KB, 60 files, commit `03600f2`)
- Builds empaquetados (todos los ZIP/CRX subidos a stores): `..\..\releases\` — carpeta local fuera del repo, ver su README (consolidados 2026-06-10)

**Submission CWS v0.5.0 (2026-06-10):** ZIP + 5 screenshots 1280×800 + listing trilingüe — **APROBADA y PUBLICADA 2026-06-11** ✅.
- Assets del store versionados en `docs/cws-assets/` (capturas crudas + finales, `make-composites.ps1`, `listing/{es,en,pt_BR}.md`) — regla: editar ahí ANTES de pegar en el dashboard
- Post-aprobación: tablas de estado actualizadas 2026-06-11 ✅ · vault de la cuenta de pruebas `carjes2795@gmail.com` borrado 2026-06-11 ✅ (load-unpacked desinstalada del perfil de pruebas; reinstalada la versión CWS oficial — nunca tuvo sync a Drive)

**v0.5.1 COMPLETO (2026-06-11) — saneamiento pre-v0.6.0:**
- F5.1-A: schema canónico TOTP (`totp`) + shim de lectura dual + convergencia lazy (migra `claveTotp`, sin bump de `BLOB_VERSION`)
- F5.1-B: motor TOTP en la PWA (port `totp.js`) + código en vivo + countdown — resuelve A-2 (la PWA solo almacenaba el secreto)
- F5.1-C: fix BUG-SYNC-404 en el adapter Drive de la Extension + 4 adapters al protocolo de forks
- F5.1-D: CSV formula injection neutralizada (ambas superficies) + columna TOTP canónica
- F5.1-E: i18n del wizard de import (29 keys ES/EN/PT-BR)
- F5.1-F: docs (§6 schema, §10 fileId/B-1, §26 i18n, §28 decisiones) · roadmap-v0.5.1.md
- Origen: `docs/auditoria-v0.5.0-hallazgos.md` · branch `feature/v0.5.1` · verify-crypto-sync.sh exit 0 (5 secciones)
- **Pendiente de publicación:** empaquetar Extension v0.5.1 → CWS · deploy PWA → Cloudflare Pages

**v0.6.0 COMPLETADO (2026-06-12):**
- UX-LOCK-NAV: botón "Bloquear" en nav-bottom PWA · deploy Cloudflare Pages ✅
- Shell Capacitor v8: `android/` + `ios/` stub · `capacitor.config.ts` ✅
- DpmKeyPlugin (Kotlin): `BiometricPrompt.CryptoObject` + Android Keystore · `wrap/unwrap/wrapToken/unwrapToken/deleteKey` ✅
- `biometric-bridge.js`: puente JS↔DpmKeyPlugin · `configurarBiometria()` + `desbloquearConBiometria()` ✅
- `exportarClaveRaw()` añadida a AMBOS forks de `engine.js` (verify-crypto-sync.sh exit 0) ✅
- UI biométrica: botón en unlock-view + toggle en settings (ES/EN/PT-BR) ✅
- `bundleRelease` firmado con keystore `keys/dacmos-pm-release.keystore` ✅
- Play Store: cuenta activa (dacmosgroup@gmail.com) · verificación identidad en proceso ✅
- Backlog diferido a v0.7.0: H-5 (deviceId en vault), H-9 (sync logging), B-1 (OneDrive token migration via MSAL), M-4 (i18n unification)

**Próximo hito — v0.7.0:**
- Android Autofill Service nativo
- iOS Credential Provider (requiere macOS + Apple Developer $99)
- H-5: embed `_deviceId` en vault cifrado
- H-9: logging de eventos sync
- Ver `docs/roadmap-v0.7.0.md`

**Nota:** `client_id` en manifest.json es un identificador público OAuth2 — no es un secret. Su presencia en el repo es intencional.

---

## Fork Sync Protocol

Estos archivos son forks manuales de sus contrapartes en la extensión (verificados por `verify-crypto-sync.sh`):

| Original (Extension) | Fork (PWA) | Nivel verificado |
|---|---|---|
| `src/crypto/engine.js` | `web/src/crypto/engine.js` | constantes + API surface |
| `src/health/password-health.js` | `web/src/health/password-health.js` | constantes + API surface |
| `src/crypto/totp.js` | `web/src/crypto/totp.js` | constantes + API surface (v0.5.1) |
| `src/schema/credential-schema.js` | `web/src/schema/credential-schema.js` | API surface (v0.5.1) |
| `src/sync/google-drive-adapter.js` | `web/src/sync/google-drive-adapter.js` | contrato StorageAdapter + fix 404 (v0.5.1) |
| `src/sync/onedrive-adapter.js` | `web/src/sync/onedrive-adapter.js` | contrato StorageAdapter (v0.5.1) |

Al modificar cualquier archivo fuente:

1. Portar el mismo cambio al fork correspondiente en `web/src/`.
2. Ejecutar `bash scripts/verify-crypto-sync.sh` y confirmar exit 0.
3. Incluir ambos archivos en el mismo commit.

Nunca commitear cambios a un original sin verificar que el fork PWA queda en sync. Un drift en crypto/schema produce vaults incompatibles entre plataformas; un drift en los adapters reintroduce bugs como BUG-SYNC-404.
