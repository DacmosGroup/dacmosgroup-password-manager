# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dacmos Password Manager is a **Chrome Extension (Manifest V3)** built with vanilla JavaScript — no build step, no bundler, no npm. All code runs directly in the browser. It is a local-first, zero-knowledge password manager.

## Development Setup

There is no build step. Load the extension directly into Chrome:

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the repo root folder

After editing any JS/HTML/CSS file, go to `chrome://extensions/` and click the reload button for the extension. For service worker changes, also click "Service Worker" link to inspect it.

## Testing the Extension

There is no test suite. Testing is manual:

- **Popup**: Click the extension icon in Chrome toolbar
- **Vault**: Opens as a full tab (`src/ui/vault/vault.html`)
- **Generator**: Opens as a full tab (`src/ui/generator/generator.html`)
- **Settings**: Opens as a full tab (`src/ui/settings/settings.html`)
- **Content script**: Navigate to any site with a login form — the 🔐 icon should appear in the fields
- **Service worker logs**: `chrome://extensions/` → click "Service Worker" → Console tab

## Architecture

### Module System

All UI JS files use **ES modules** (`type="module"` is implied by the import syntax used in HTML). The service worker is declared as `"type": "module"` in `manifest.json`. The content script (`autofill.js`) does **not** use ES modules — it runs in page context and uses globals.

### Chrome Storage Split

| Storage | What lives there |
|---------|-----------------|
| `chrome.storage.local` | Encrypted vault (`vaultCifrado`), salts (`sal`, `sal2`), verification token, config, session flags |
| `chrome.storage.session` | Decrypted credentials (`credencialesSesion`) — cleared when browser closes or vault locks |

Decrypted credential data **never** writes to `chrome.storage.local`. The AES key (`claveSesion`) stays only in JS memory within the page/popup context — it is never stored anywhere.

### Message Passing (Content Script ↔ Service Worker ↔ UI)

All cross-context communication uses `chrome.runtime.sendMessage`. Key message types:

| `tipo` | Direction | Purpose |
|--------|-----------|---------|
| `VAULT_DESBLOQUEADO` | UI → SW | After unlock; sends decrypted credentials to SW session storage |
| `BLOQUEAR_VAULT` | UI → SW | Manual lock |
| `OBTENER_ESTADO` | UI → SW | Get `vaultConfigurado` + `sesionActiva` |
| `ACTIVIDAD_USUARIO` | Content → SW | Resets auto-lock timer |
| `CAMPOS_LOGIN_DETECTADOS` | Content → SW | Updates badge count |
| `SOLICITAR_AUTOCOMPLETADO` | Content → SW | Returns filtered credentials for current domain |
| `VAULT_BLOQUEADO` | SW → Content | Clears injected icons, shows lock notification |

### Auto-lock Timer

Uses `chrome.alarms` (not `setTimeout`) because MV3 service workers suspend after ~30 seconds, which cancels `setTimeout`. The alarm named `'autoLock'` survives service worker sleep.

### Crypto Engine ([src/crypto/engine.js](src/crypto/engine.js))

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

### Content Script ([src/content/autofill.js](src/content/autofill.js))

Injected into all URLs at `document_idle`. Detects login forms by heuristic (presence of `input[type="password"]`), injects a 🔐 button, and handles the autofill overlay UI. Uses `MutationObserver` to handle SPAs. Triggers `focus`/`input`/`change`/`blur` events when filling fields for compatibility with React/Vue controlled inputs. Calls `escapeHtml()` on all user-supplied data before inserting into innerHTML to prevent XSS.

### Credential Data Shape

```js
{
  id: crypto.randomUUID(),
  sitio: string,
  url: string,
  usuario: string,
  password: string,
  notas: string,
  creado: ISO8601,
  modificado: ISO8601,
}
```

### CSP Constraint

`manifest.json` enforces `script-src 'self'` — no inline scripts, no `eval`, no external scripts. All JS must be in files loaded by the extension itself.

---

## PWA — web/ (v0.4.0+)

The PWA lives entirely in `web/`. It coexists with the Chrome Extension — the extension source (`src/`, `manifest.json`) is never modified by PWA work.

### New files added in F4.2

| File | Purpose |
|------|---------|
| `web/src/storage/indexeddb-adapter.js` | Drop-in replacement for `chrome.storage.local`. Exposes `idbStorage.set/get/remove/clear`. DB: `dacmos-pm`, store: `vault`, keyPath: `clave`. |
| `web/src/crypto/engine.js` | Fork of `src/crypto/engine.js`. Identical crypto logic — only difference is the 7 `chrome.storage.local` calls replaced by `idbStorage`. Import path: `../storage/indexeddb-adapter.js`. |

### Key architectural rules for PWA work

- `web/src/crypto/engine.js` is a **fork**, not a symlink. Changes to `src/crypto/engine.js` (Chrome Extension) do NOT automatically apply to the PWA fork — they must be ported manually.
- The AES `CryptoKey` never enters IndexedDB. Only encrypted blobs `{ iv, datos }` are persisted.
- Session state (`claveSesion`, `credencialesSesion`) lives in JS module memory only — no `sessionStorage` write for crypto material.
- `idbStorage.set()` uses a single `readwrite` transaction for all keys — this is intentional for atomicity (critical in `cambiarMasterPassword`).

### Testing the PWA locally

The PWA is deployed to Cloudflare Pages. To test locally, serve `web/` with any static server:

```bash
# Option A — Python
python -m http.server 8080 --directory web

# Option B — npx
npx serve web
```

Then open `http://localhost:8080`. Service Worker requires HTTPS in production (Cloudflare Pages handles this automatically).

### F4.2 completion criterion

Round-trip: unlock → create credential → close tab → reopen → unlock → credential persists. Must pass on Chrome Android and Safari iOS.

---

## Versioning Strategy

This project uses **per-platform independent versioning** — each platform tracks its own release cadence and feature milestones:

| Platform | Manifest | Code (main) | CWS / Store | Estado |
|----------|----------|-------------|-------------|--------|
| Chrome Extension | `manifest.json` | `0.4.0` | `0.4.0` en review CWS (submitted 2026-06-06, PUBLIC) | En revisión — aprobación esperada 1–3 días hábiles |
| PWA | `web/manifest.json` | `0.4.2` | `0.4.2` en Cloudflare Pages | En producción |
| APK Android (TWA) | GitHub Releases | `0.4.2` | IzzyOnDroid | En producción |

**Estado auditoría:** Fases 1–4 completas (commit `4970463`, merge `01c8623`). Branch `fix/auditoria-remediaciones` cerrada.

**Testing completado (2026-06-06):** Bloques 1–8 APROBADOS — incluyendo sync round-trip Extension ↔ PWA en ambas direcciones.

**Próximo hito — v0.5.0:**
- Auto-lock timer funcional en PWA
- Monetización $1–1.50/mes vía Stripe
- Actualizar screenshots en CWS

**Design decision:** v0.4.x unifica ambas plataformas en la misma familia de versiones a partir de la próxima submission CWS. Do NOT bump version numbers just for alignment — only bump when the platform ships new features.

**Google OAuth Client ID in manifest.json:** The `client_id` field is a public OAuth2 client identifier — not a secret. Its presence in the public repository is intentional. Protection comes from: (a) authorized redirect URIs in Google Cloud Console, (b) Chrome Web Store signing for the Extension distribution.

## Fork Sync Protocol

`web/src/crypto/engine.js` and `web/src/health/password-health.js` are manual forks of their Extension counterparts. When modifying either source file:

1. Port the same change to the corresponding fork in `web/src/`.
2. Run `bash scripts/verify-crypto-sync.sh` and confirm exit 0.
3. Include both files in the same commit.

Never commit changes to `src/crypto/engine.js` without verifying the PWA fork remains in sync. A drift here produces incompatible vaults between platforms.
