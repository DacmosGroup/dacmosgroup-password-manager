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
