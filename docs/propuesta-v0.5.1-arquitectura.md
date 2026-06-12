# Propuesta de Arquitectura — v0.5.1 (Saneamiento pre-v0.6.0)

**Fecha:** 2026-06-11
**Autor:** Claude Code (implementador)
**Estado:** PROPUESTA — pendiente de validación del arquitecto antes de tocar código
**Origen:** `docs/auditoria-v0.5.0-hallazgos.md` + decisiones del arquitecto (2026-06-11)
**Naturaleza:** Ciclo de saneamiento. Ambas superficies → **0.5.1**. Sin features nuevas; corrige paridad y deuda antes de que Capacitor (v0.6.0) herede el bundle PWA.

> Este documento se entrega para validación. No se ha modificado ningún archivo de
> código ni `documento-tecnico.md`. Al aprobarse, el arquitecto genera
> `docs/f5.1-decisiones-temp.md` con las decisiones, que Code consumirá en el commit
> de documentación (protocolo §Captura de decisiones de sesión).

---

## Decisiones del arquitecto incorporadas (base de esta propuesta)

1. **Campo canónico TOTP:** `totp`. La Extension migra; la PWA ya lo usa.
2. **Migración:** convergencia lazy — leer `claveTotp ?? totp`, escribir siempre `totp`. Sin bump de versión.
3. **Motor PWA:** port directo de `totp.js` al fork PWA + countdown, paridad UX con la Extension.

**Confirmación criptográfica:** el campo TOTP vive **dentro del array `credenciales`** del blob descifrado, no en el envelope (`{ __version, kdf, kdfIterations, iv, datos }`). Por tanto **`BLOB_VERSION` permanece en 1** y `serializarAAD()` no cambia. La migración es normalización a nivel de aplicación — no toca la capa AEAD. Riesgo de corrupción de vault: nulo por diseño.

---

## F5.1-A — Schema canónico TOTP + shim de lectura dual

### Contrato del shim

Función pura de normalización, aplicada a cada credencial al cargar el vault descifrado:

```javascript
// Normaliza el campo TOTP al nombre canónico 'totp'.
// Acepta credenciales legacy de la Extension (claveTotp) y de la PWA (totp).
// Idempotente: una credencial ya canónica pasa sin cambios.
function normalizarTOTP(cred) {
  // Precedencia: si por algún path coexisten ambos, gana el canónico 'totp'.
  const secreto = cred.totp ?? cred.claveTotp ?? ''
  const { claveTotp, ...resto } = cred       // descarta la key legacy
  return secreto ? { ...resto, totp: secreto } : resto
}

function normalizarCredenciales(creds) {
  return Array.isArray(creds) ? creds.map(normalizarTOTP) : []
}
```

**Regla de precedencia (caso borde — credencial con AMBOS campos):** gana `totp` (canónico). Justificación: una credencial solo puede tener ambos si fue editada en ambas superficies antes de la migración; el canónico es la fuente de verdad hacia adelante. `[Decisión a confirmar por el arquitecto — alternativa: preferir el no-vacío más reciente, pero no hay timestamp por-campo, así que precedencia fija es lo determinista.]`

### Ubicación — fuera del engine de crypto

`normalizarCredenciales()` **no va dentro de `engine.js`** — el engine es la única fuente de verdad de *cifrado*, no de *schema de credencial*. Mantener la pureza del engine evita acoplar la lógica de migración a la capa criptográfica (principio del protocolo: engine = solo crypto).

Propuesta: nuevo módulo puro `src/schema/credential-schema.js` (+ fork PWA `web/src/schema/credential-schema.js`), aplicado en el **único chokepoint de carga** de cada superficie:

| Superficie | Chokepoint | Acción |
|---|---|---|
| Extension | `src/ui/vault/vault.js` — tras `cargarVaultDescifrado()`, antes de poblar sesión / enviar `VAULT_DESBLOQUEADO` | `normalizarCredenciales(creds)` |
| PWA | `web/src/ui/views/unlock.js` + `setup.js` — tras `cargarVaultDescifrado()`, antes de `establecerCredenciales()` | `normalizarCredenciales(creds)` |

Normalizar una vez en el chokepoint (un solo `map`) es más limpio que esparcir `?? cred.claveTotp` en los ~6 sitios de lectura de la Extension (`vault.js:148,169,206,326,343,390`).

### Criterio de convergencia — cuándo se persiste `totp`

Dos opciones; recomiendo **B2** (coincide con "se sana en el siguiente unlock" que aprobó el arquitecto):

- **B1 — Pasiva (menor toque):** la normalización es solo en memoria. El `claveTotp` en storage persiste hasta que el usuario edita/agrega/elimina cualquier credencial (cualquier `guardarVaultCifrado` re-cifra el array completo ya normalizado → converge). Riesgo: si el usuario nunca escribe, el storage conserva `claveTotp` indefinidamente (sin impacto funcional — el shim lo lee igual).

- **B2 — Activa en unlock (recomendada):** tras normalizar al cargar, si **algún** credencial traía `claveTotp`, disparar un único `guardarVaultCifrado(credsNormalizadas, clave)` de convergencia. El vault se sana en storage en el primer unlock post-actualización. Costo: una escritura extra (que además dispara sync — deseable, propaga el vault saneado a la nube).

**Trade-off de B2 + sync:** la escritura de convergencia dispara `onChanged → dispararSync`. Es correcto (propaga el vault canónico), pero conviene que la convergencia ocurra **una sola vez**. Como tras converger ningún credencial tiene ya `claveTotp`, el siguiente unlock no re-dispara. Idempotente. ✅

### Archivos afectados por F5.1-A

| Archivo | Cambio |
|---|---|
| `src/schema/credential-schema.js` (NUEVO) | `normalizarTOTP` + `normalizarCredenciales` |
| `web/src/schema/credential-schema.js` (NUEVO, fork) | idéntico — incorporar al protocolo de forks |
| `src/ui/vault/vault.js` | normalizar tras cargar; lecturas TOTP pasan a `cred.totp`; (B2) re-save de convergencia |
| `src/ui/vault/credential-types.js` | el form **escribe `totp`** (no `claveTotp`); al poblar el form leer `cred.totp` |
| `web/src/ui/views/unlock.js` + `setup.js` | normalizar tras cargar |
| (PWA `credential-form.js`/`vault.js` ya usan `totp` — sin cambio de campo) | — |

---

## F5.1-B — Motor TOTP en la PWA (resuelve A-2)

- **NUEVO** `web/src/crypto/totp.js` — port directo de `src/crypto/totp.js` (módulo puro Web Crypto, sin `chrome.*`). Bit-exacto salvo que no hay diferencias de storage (no las usa).
- `web/src/ui/views/vault.js` — render del código de 6 dígitos + countdown (`segundosRestantes()`), paridad con el comportamiento de `src/ui/vault/vault.js`. Reusa `generarCodigo()` y `segundosRestantes()` del módulo portado.
- **Incorporar `totp.js` al protocolo de forks** (`verify-crypto-sync.sh`) — hoy el script solo cubre `engine.js` y `password-health.js`.

---

## F5.1-C — BUG-SYNC-404: port del fix a la Extension (resuelve M-1)

- `src/sync/google-drive-adapter.js` — portar de `web/src/sync/google-drive-adapter.js`: método `_invalidarFileId()` + invalidación ante 404 en `guardar()`, `cargar()`, `ultimaModificacion()`.
- **Ampliar el protocolo de forks** para incluir los 4 adapters de sync (`google-drive-adapter.js` y `onedrive-adapter.js` × 2 superficies), evitando futuros drifts invertidos como éste.
- OneDrive no requiere cambios (direcciona por path, inmune).

---

## F5.1-D — CSV formula injection (resuelve M-2)

- `src/export/csv-exporter.js` + fork PWA — en `escaparCampo()`, antes del quoting RFC 4180, neutralizar campos que empiezan con `=`, `+`, `-`, `@`, tab o CR prefijando comilla simple `'` (mitigación OWASP CSV Injection estándar). Mantiene compatibilidad de re-importación (el parser RFC 4180 ya tolera el prefijo como dato).
- La PWA exporter además corrige M-3 de gracia: leer `c.totp` (canónico) en la columna `login_totp` en lugar de `c.claveTotp`.

---

## F5.1-E — i18n del wizard de import (resuelve B-2)

- `web/src/import/import-wizard.js` — mover los strings hardcoded en español (`:252`, `:265`, etc.) a `t()`. Añadir las keys correspondientes a `web/src/i18n/strings.{es,en,pt_BR}.js` (las 3, manteniendo la paridad intra-superficie que hoy es perfecta).

---

## F5.1-F — Correcciones de documentación (resuelve M-4/§26, B-4, M-5)

Vía `docs/f5.1-decisiones-temp.md` (lo genera el arquitecto; Code lo inserta en `documento-tecnico.md` y lo elimina en el commit de docs):

- **§26** — corregir la afirmación "las keys son las mismas, solo cambia el separador". Reemplazar por la realidad: catálogos independientes por superficie (349 Extension / 234 PWA), paridad intra-superficie garantizada, sin contrato cross-superficie. Documentar la decisión de si v0.6.0 unifica o mantiene catálogos separados.
- **§10 + B-4** — desglosar por superficie la deuda de invalidación fileId Drive: resuelto en PWA, resuelto en Extension a partir de v0.5.1 (F5.1-C).
- **§6/§13 + M-5** — documentar el schema completo de credencial incluyendo el campo canónico `totp` y los tipos `tarjeta`/`identidad`. Añadir nota de la migración lazy `claveTotp → totp`.
- **§10** — añadir a la tabla de amenazas el refresh_token de OneDrive en `chrome.storage.local` (B-1, queda como ítem documentado; evaluación de Keychain en v0.6.0).

---

## Orden de implementación y estructura de commits

Protocolo: commits de código y documentación **siempre separados**.

1. `feat(schema): campo canónico TOTP + shim de lectura dual` — F5.1-A (incluye normalizer + chokepoints + convergencia B2)
2. `feat(pwa): motor TOTP + countdown` — F5.1-B
3. `fix(sync): invalidación de fileId 404 en adapter Drive de la Extension` — F5.1-C
4. `fix(export): neutralizar CSV formula injection + columna TOTP canónica` — F5.1-D
5. `feat(i18n): completar strings del wizard de import` — F5.1-E
6. `chore(version): bump 0.5.1 en ambos manifests` — tras verificación
7. `docs: auditoría v0.5.0, schema TOTP, corrección §26/§10, propuesta v0.5.1` — F5.1-F + consumo de `f5.1-decisiones-temp.md`

Bump de versión: `manifest.json` y `web/manifest.json` → `0.5.1`.

---

## Plan de verificación (protocolo §Verificación funcional — desktop mouse + mobile touch)

| Feature | Criterio de aceptación (todos los contextos) |
|---|---|
| F5.1-A migración | Crear TOTP en Extension (legacy `claveTotp`) → sync → abrir en PWA → **el código TOTP se genera**. Editar en PWA → re-sync → Extension lo lee. Verificar en storage que `claveTotp` desaparece tras la convergencia (B2). |
| F5.1-A idempotencia | Segundo unlock no re-dispara convergencia (no hay `claveTotp` residual). |
| F5.1-B motor PWA | Código de 6 dígitos correcto vs RFC 6238 (comparar contra Extension con el mismo secreto). Countdown sincronizado. Desktop mouse + mobile touch (Pixel 5 hasTouch). |
| F5.1-C sync 404 | Borrar archivo remoto en Drive → sync Extension → autocorrige a primera subida (no queda atascado en DRIVE_404). |
| F5.1-D CSV | Exportar credencial con `notas` = `=HYPERLINK(...)` → abrir CSV en hoja de cálculo → no ejecuta fórmula. Re-importar el CSV → dato íntegro. |
| F5.1-E i18n | Wizard de import en EN y PT-BR sin strings en español. |
| Regresión crypto | `bash scripts/verify-crypto-sync.sh` exit 0 (ahora cubriendo también `totp.js` y los 4 adapters de sync). |

---

## Preguntas abiertas para el arquitecto

1. **Convergencia B1 (pasiva) vs B2 (activa en unlock)** — recomiendo B2; confirmar.
2. **Precedencia en credencial con ambos campos** — propongo que gane `totp`; confirmar.
3. **Módulo `credential-schema.js` nuevo (forked)** — ¿se aprueba crear el módulo + sumarlo al protocolo de forks, o se prefiere read-compat inline en los sitios de lectura? (Recomiendo el módulo: un solo chokepoint, menos superficie de error.)
4. **§26 en v0.6.0** — la corrección documenta el estado actual; la *decisión* de si v0.6.0 unifica catálogos i18n o los mantiene separados queda para la arquitectura de v0.6.0, no para v0.5.1. Confirmar que ese diferimiento es correcto.

---

*Fin de la propuesta. A la espera de validación del arquitecto para proceder con la implementación.*
