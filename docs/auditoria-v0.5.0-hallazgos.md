# Auditoría Interna v0.5.0 — Hallazgos

**Fecha:** 2026-06-11
**Tipo:** Solo lectura + diagnóstico. Cero cambios de código en este ciclo.
**Auditor:** Claude Code (Fable 5)
**Destinatario:** Arquitectura v0.6.0 (Capacitor) — chat del proyecto DPM
**Alcance:** Chrome Extension (`src/`) + PWA (`web/src/`) en estado publicado v0.5.0
**Base de comparación:** §10 (superficie de ataque), §21 (auditoría v0.4.1/v0.4.2), §25 (F5-A), §26 (F5-B)

> Regla de evidencia: cada hallazgo referencia `archivo:línea` o comportamiento verificable.
> Inferencias sin respaldo de código se marcan `[Suposición]`. Construido sobre §21 —
> no se redescubre lo ya documentado y resuelto.

---

## Resumen ejecutivo

| Severidad | Nuevos | Detalle |
|---|---|---|
| **Crítico** | 0 | El core criptográfico está intacto — Zero-Knowledge preservado, AAD autenticado, clave AES nunca expuesta |
| **Alto** | 2 | A-1 divergencia de schema TOTP entre superficies · A-2 PWA sin motor TOTP |
| **Medio** | 5 | M-1 BUG-SYNC-404 (Extension) · M-2 CSV formula injection · M-3 export TOTP roto en PWA · M-4 catálogos i18n sin paridad · M-5 schema de credencial no documentado |
| **Bajo** | 4 | B-1 refresh_token OneDrive en storage · B-2 strings hardcoded en import-wizard · B-3 heurística getAttribute · B-4 deuda Drive marcada resuelta sin serlo |
| **Info** | 3 | I-1 MSAL sin tracking de CVE · I-2 auto-lock sin defecto · I-3 forks crypto bit-exactos |

**Comparación vs §21 (auditoría #3, 31 mayo):** aquella cerró 4 Críticos + 4 Altos del incidente de sync. Esta auditoría **no encuentra nuevos Críticos** — la remediación de v0.4.2 se sostiene en código vivo (ver "Estado de hallazgos previos"). Los hallazgos nuevos se concentran en **paridad Extension↔PWA**, no en el core de cifrado. El cluster TOTP (A-1, A-2, M-3, M-5) es el de mayor impacto para v0.6.0 porque Capacitor hereda el bundle PWA.

**Lectura para el arquitecto en una frase:** el cifrado es sólido y no hay regresiones de v0.4.2; el trabajo de v0.6.0 debe priorizar unificar el contrato de datos y de i18n entre superficies antes de envolver con Capacitor, porque el wrapper amplifica cada divergencia que hoy existe en `web/src/`.

---

## Hallazgos nuevos

### A-1 [ALTO — Availability/Integrity] Divergencia de schema TOTP entre Extension y PWA

**Módulos:** `src/ui/vault/credential-types.js:226`, `src/ui/vault/vault.js:343` vs `web/src/ui/views/credential-form.js:294,308`, `web/src/ui/views/vault.js:150`

La Extension persiste el secreto TOTP en el campo **`claveTotp`**; la PWA lo persiste en **`totp`**. Es la misma credencial, distinta propiedad:

- Extension: `credential-types.js:226` construye `{ ...password, notas, claveTotp }`; `vault.js:343` lee `cred.claveTotp` para generar el código.
- PWA: `credential-form.js:294` guarda `totp: inputTotp.value.trim()`; `vault.js:150` lee `cred.totp` para el badge.

**Consecuencia:** el blob cifrado viaja fiel por sync (sync-manager opera sobre `vaultCifrado` opaco, sin tocar el contenido), pero **cada superficie lee una propiedad distinta**. Un TOTP configurado en la Extension es invisible en la PWA y viceversa. El secreto 2FA no hace round-trip entre superficies aunque el vault se sincronice perfectamente.

**Evidencia observable:** crear credencial con TOTP en Extension → sincronizar → abrir en PWA → el campo TOTP aparece vacío (la PWA busca `totp`, el dato está en `claveTotp`).

**Relevancia v0.6.0:** Capacitor envuelve el bundle PWA → hereda `totp`. Cualquier usuario que migre de la Extension a la app nativa pierde la visibilidad de sus secretos 2FA. **Debe resolverse con una decisión de schema canónico + migración no destructiva** (el formato versionado del blob, §13/F4.7, es el mecanismo para hacerlo sin romper vaults existentes).

---

### A-2 [ALTO — Paridad funcional] La PWA no tiene motor TOTP — solo almacena el secreto

**Módulos:** `src/crypto/totp.js` (existe), `web/src/crypto/totp.js` (**no existe**)

`generarCodigo()` y el motor RFC 6238 viven **únicamente** en la Extension (`grep generarCodigo` → solo `src/crypto/totp.js` y `src/ui/vault/vault.js`). La PWA:
- Ofrece el campo de entrada TOTP en el formulario (`credential-form.js:169-177`).
- Muestra un badge "TOTP" en la lista (`vault.js:150`).
- **Nunca genera el código de 6 dígitos** — no hay `totp.js` ni `generarCodigo()` en `web/src/`.

El TOTP es una feature funcional viva en la Extension (código + cuenta regresiva) y un **campo muerto de solo-almacenamiento en la PWA**.

**Relevancia v0.6.0:** Capacitor hereda la PWA → la app nativa tampoco generará códigos TOTP. Si el 2FA in-app es un objetivo de v0.6.0, requiere portar `totp.js` al fork PWA (es un módulo puro Web Crypto, sin dependencias de `chrome.*` — el port es directo). Relación con A-1: al portarlo, fijar primero el nombre de campo canónico.

---

### M-1 [MEDIO — Availability] BUG-SYNC-404: la Extension carece de la invalidación de fileId que la PWA sí tiene

**Módulos:** `src/sync/google-drive-adapter.js` (sin fix) vs `web/src/sync/google-drive-adapter.js:85-87,108,149,163-166` (con fix)

Hallado en campo hoy (2026-06-11): tras borrar los datos ocultos de la app en Drive, el sync de la Extension queda atascado en `DRIVE_404` porque el `fileId` cacheado en `syncConfig` quedó huérfano y nunca se invalida.

- **PWA**: tiene `_invalidarFileId()` y lo llama ante 404 en `guardar()`, `cargar()` y `ultimaModificacion()` → autocorrige.
- **Extension**: `_buscarFileId()` usa el caché sin invalidar; `ultimaModificacion()`/`cargar()`/`guardar()` lanzan `DRIVE_${status}` sin tratar el 404 → el caché huérfano persiste indefinidamente. Workaround manual: Desconectar → Conectar (resetea `fileId` a null).

Es un **drift de fork invertido**: el fix existe en el fork (PWA) y falta en el original (Extension). El protocolo de sync de forks (§Protocolo de sync de forks) solo cubre `engine.js` y `password-health.js` — los adapters de sync no están bajo ese protocolo, por eso el drift pasó sin detección.

**OneDrive es inmune** (ambas superficies): direcciona por path (`approot:/dacmos-vault.bin:/content`), no por fileId cacheado — un 404 simplemente significa "no existe" y retorna null limpiamente (`src/sync/onedrive-adapter.js:180,190`).

**Relevancia v0.6.0:** Capacitor hereda la PWA (que ya tiene el fix). El riesgo es solo de la Extension. Sin embargo, conviene **incorporar los 4 adapters de sync al protocolo de forks** para evitar futuros drifts.

---

### M-2 [MEDIO — Integrity] CSV formula injection en el exportador (ambas superficies)

**Módulos:** `src/export/csv-exporter.js:10-14`, `web/src/export/csv-exporter.js` (fork, misma lógica)

`escaparCampo()` aplica correctamente el quoting RFC 4180 (comas, comillas, saltos de línea) pero **no neutraliza caracteres de fórmula iniciales** (`=`, `+`, `-`, `@`, tab, CR). Una credencial cuyo campo (ej. `notas`, `sitio`) empiece con `=HYPERLINK(...)` o `=cmd|...` se exporta tal cual; al abrir el CSV en Excel / LibreOffice / Google Sheets, la fórmula se ejecuta (OWASP CSV Injection).

**Mitigación estándar:** prefijar con comilla simple `'` o tab los campos que empiezan con esos caracteres, antes del quoting RFC 4180.

**Probabilidad:** moderada — requiere que el dato malicioso ya esté en el vault del propio usuario y que éste exporte y abra en una hoja de cálculo. Por eso Medio, no Alto.

**Relevancia v0.6.0:** Capacitor hereda el exportador PWA → mismo vector en la app nativa.

---

### M-3 [MEDIO — Availability] El export Bitwarden de la PWA descarta siempre el TOTP

**Módulo:** `web/src/export/csv-exporter.js:59`

El exportador lee `c.claveTotp` para la columna `login_totp`, pero la PWA almacena el secreto en `totp` (ver A-1). Resultado: **la columna TOTP del CSV Bitwarden exportado desde la PWA siempre sale vacía** — el usuario pierde sus secretos 2FA al migrar vía CSV. En la Extension el mismo código es correcto (allí el campo sí es `claveTotp`).

Es la manifestación concreta de A-1 en el path de export. Se resuelve con la misma decisión de schema canónico.

---

### M-4 [MEDIO — Paridad/Documentación] Los catálogos i18n no tienen paridad de keys; §26 lo afirma incorrectamente

**Módulos:** `_locales/{es,en,pt_BR}/messages.json` (349 keys c/u) vs `web/src/i18n/strings.{es,en,pt_BR}.js` (234 keys c/u)

§26 afirma: *"Las keys son las mismas semánticamente en ambas plataformas; la diferencia es solo el separador."* La verificación contradice esto:

- **Paridad intra-superficie: perfecta** ✅ — los 3 idiomas de la Extension tienen keys idénticas entre sí (349/349/349), y los 3 de la PWA también (234/234/234). No hay keys faltantes por idioma → sin riesgo de UI rota por traducción ausente.
- **Paridad cross-superficie: inexistente** ❌ — convirtiendo las keys PWA de punto a underscore, **179 de 234 keys de la PWA no tienen equivalente en el locale de la Extension** (ej. `auth_setup_restore_*`, `auth_unlock_subtitle`, `common_zk_footer`). Los conteos divergen (349 vs 234). Los dos sistemas usan **vocabularios de keys distintos**, no solo separadores distintos.

Parte de la divergencia es legítima (la PWA tiene pantallas que la Extension no, como restore-desde-Drive en setup), pero la afirmación de §26 es inexacta y **no existe un contrato de keys compartido ni verificación de paridad**.

**Relevancia v0.6.0:** Capacitor hereda el catálogo de 234 keys de la PWA, no el de 349 de la Extension. Cualquier diseño de v0.6.0 que asuma keys compartidas entre superficies parte de una premisa falsa.

---

### M-5 [MEDIO — Documentación] El campo TOTP del schema de credencial no está documentado en ningún lado

**Módulos:** `docs/documento-tecnico.md` §6/§13, `CLAUDE.md` (repo) sección "Credential Data Shape"

El schema de credencial documentado es `{ id, sitio, url, usuario, password, notas, creado, modificado }` — **sin campo TOTP**. Las únicas menciones de TOTP en el doc-técnico son la referencia RFC 6238 (§27) y "engine.js y totp.js intactos" (§). El resultado: el campo se implementó con **dos nombres distintos** (`claveTotp`/`totp`) sin que ningún documento fije cuál es canónico — causa raíz documental de A-1.

**Acción para v0.6.0:** documentar el schema completo de credencial (incluido TOTP y los tipos `tarjeta`/`identidad` que ya existen en `autofill.js`) como contrato único antes de tocar código.

---

### B-1 [BAJO — Confidentiality] refresh_token de OneDrive persistido sin cifrar en chrome.storage.local

**Módulo:** `src/sync/onedrive-adapter.js:41-52`

`_guardarTokens()` persiste `accessToken` **y `refreshToken`** en `chrome.storage.local`. El refresh_token es de larga vida (con `offline_access`) y **sobrevive al reinicio del browser**, otorgando acceso prolongado al AppFolder de OneDrive del usuario. La tabla de amenazas §10 solo contempla "Tokens OAuth en sessionStorage (PWA)" — **no menciona el refresh_token de la Extension en storage local**.

Mitigación existente: `chrome.storage.local` está aislado por extensión (MV3). Riesgo residual: sin cifrar en disco dentro del perfil. Bajo, pero debe añadirse a la tabla §10 para completitud. Contraste de diseño: el adapter Google (`google-auth.js` PWA y `chrome.identity` Extension) mantiene el token solo en memoria — OneDrive es la excepción por necesitar refresh_token.

---

### B-2 [BAJO — Paridad i18n] Strings hardcoded en español en el wizard de import PWA

**Módulo:** `web/src/import/import-wizard.js:252,265` (y alrededores)

Strings como `"... y N credenciales más (no mostradas en preview)"` y `"La sesión expiró. Bloquea y desbloquea..."` están hardcoded en español, sin pasar por `t()`. F5-B internacionalizó las vistas principales pero el wizard de import quedó parcialmente fuera. Cosmético en EN/PT-BR (texto en español), sin impacto de seguridad. Solo PWA.

---

### B-3 [BAJO — Robustez] Heurística de detección login concatena getAttribute() nullable

**Módulo:** `src/content/autofill.js:122-127`

`esFormularioLogin()` hace `form.innerHTML + form.getAttribute('action') + form.getAttribute('id') + form.getAttribute('class')`. Cuando un atributo no existe, `getAttribute` retorna `null`, que se stringifica como `"null"` en la concatenación. Sin impacto de seguridad (solo afecta el matching de keywords en la heurística), pero podría producir falsos positivos si un atributo legítimamente contuviera la subcadena. Cosmético.

---

### B-4 [BAJO — Documentación] §10 y README marcan resuelta la deuda de fileId Drive sin notar que la Extension sigue sin el fix

**Módulos:** `docs/documento-tecnico.md` §10 (tabla de deudas), `README.md:84`

§10 lista: *"`ultimaModificacion()` sin invalidación de fileId ... ✅ Resuelto en BUG-1 — commit 071391d"* y README:84 lista *"fileId cache Drive (B-2) ✅"*. Ambos implican resolución global, pero el fix **solo está en el fork PWA** — la Extension sigue vulnerable (ver M-1). La documentación debe distinguir resolución por superficie.

---

### I-1 [INFO — Supply chain] MSAL vendoreado sin tracking automatizado de CVE

**Módulo:** `web/libs/msal-browser.esm.min.js` (≈312 KB)

Versión detectada: `@azure/msal-browser` **3.30.0** (con `msal-common` 14.16.1 embebido). Está vendoreado como archivo minificado único, sin `package.json`/lockfile → **sin `npm audit` ni tracking automatizado de advisories**. Es la única dependencia de terceros del proyecto (el resto es Web Crypto nativa). Recomendación: registrar la versión y revisar periódicamente GHSA/advisories de `@azure/msal-browser`; documentar el procedimiento de actualización del vendor. Sin CVE conocida pendiente al momento de esta auditoría `[Suposición — no verificado contra la base de CVE en este ciclo read-only]`.

---

### I-2 [INFO — Confirmación] auto-lock-manager: idempotente y sin doble-disparo (responde Q1)

**Módulo:** `web/src/auto-lock/auto-lock-manager.js`

`destroy()` es idempotente (`:43-49`) y `_fireLock()` (`:58-63`) captura el callback **antes** de que `destroy()` anule `_onLock`, garantizando exactamente un disparo. `reset()` está guardado por `if (!_activo) return` (`:38`) → sin resurrección tras lock. El modelo single-thread de JS hace que no exista race real entre `destroy()` y `visibilitychange` (los handlers corren hasta completarse). La aritmética de background es correcta: `_tsLastActivity` solo se actualiza con actividad real, por lo que `elapsed` siempre mide desde la última actividad, no desde el último cambio de visibilidad (`:72-77`). **Sin defecto.**

---

### I-3 [INFO — Confirmación] Forks crypto bit-exactos (responde paridad del core)

`bash scripts/verify-crypto-sync.sh` → **exit 0** (constantes PBKDF2/salt/IV/blob version/AES + API surface idénticas en engine y password-health). La lectura manual confirma que `serializarAAD()` usa el mismo template literal canónico en ambas superficies (`src/crypto/engine.js:164-168` ≡ `web/src/crypto/engine.js:170-174`) — el AAD se reconstruye byte-idéntico, condición necesaria para que un vault v1 abra en ambas superficies. La única diferencia entre forks es el backend de storage (`chrome.storage.local` vs `idbStorage`), como debe ser.

---

## Estado de hallazgos previos (§21) — re-confirmación contra código vivo

| Hallazgo §21 | Estado documentado | Verificación en v0.5.0 | Evidencia |
|---|---|---|---|
| H-1 Vault overwrite sin verificación | ✅ Resuelto v0.4.2 | **Confirmado** — verificación defensiva por sales presente y **disparó correctamente en campo hoy** | `sync-manager.js:123-132` |
| H-2 engine v1 incompatible CWS v0.3.1 | ✅ Resuelto v0.4.2 | **Confirmado** — `descifrarConVersion()` con dispatch v0/v1/v2+ | `engine.js:214-245` |
| H-3 OneDrive no enriquece blob | ✅ Resuelto v0.4.2 | **Confirmado** — enriquecimiento sal/sal2/token en sync managers | `sync-manager.js:72-77` |
| H-5 Sin deviceId opaco en blob | Deuda aceptada → v0.5.0 | **Sigue abierta** — el blob no incluye identificador de instalación | `engine.js:198-205` (sin deviceId) |
| H-6 vault.js enmascaraba errores | ✅ Resuelto v0.4.2 | **Confirmado** — `VAULT_VERSION_INCOMPATIBLE` se propaga distinto de password incorrecta | `engine.js:321-326` |
| H-7 Inconsistencia nombre proveedor | ✅ Resuelto v0.4.2 | **Confirmado** — `'google-drive'` normalizado en SW y managers | `service-worker.js:25-28` |
| H-8 sesionActiva persiste tras reinicio | Deuda → v0.5.0 | **Sigue abierta en Extension; PWA inmune** — `session.js` PWA es memory-only | `web/src/storage/session.js:13-16` |
| H-9 Sin logging de sync | Deuda → v0.5.0 | **Sigue abierta** — sin registro de eventos LWW | (ausencia en sync-manager) |
| H-10 Password en prompt() texto plano | ✅ Resuelto v0.4.2 | **Confirmado** — `_pedirContrasena()` modal con type=password | `web/src/ui/views/settings.js` (modal) |

Nota: H-5, H-8 y H-9 estaban marcadas "resolución v0.5.0" pero v0.5.0 reenfocó su alcance a auto-lock + i18n (§24). Siguen abiertas y son legítimo backlog v0.6.0 — Capacitor las hereda (especialmente H-5/H-9, relevantes para sync per-item multi-dispositivo).

---

## Respuestas a las preguntas del arquitecto

**Q1 — ¿`auto-lock-manager.js` maneja `destroy()` durante un `visibilitychange` activo? ¿Idempotente bajo race?**
Sí. Ver I-2. `destroy()` es idempotente; `_fireLock()` captura el callback antes de anularlo; el modelo single-thread de JS elimina race real. Sin defecto.

**Q2 — ¿El i18n de la PWA permite que un string externo (ej. nombre de credencial) se interprete como key de traducción?**
No hay path de inyección. `t(key, vars)` (`i18n.js:61-69`) se invoca siempre con keys literales del desarrollador. Si un string del vault llegara como `key`, el lookup `_dict[key] ?? stringsEs[key] ?? key` devolvería el string verbatim — **no se ejecuta como HTML**; los puntos de inserción aplican `escapeHtml()` sobre datos del vault (Q3). La interpolación `{var}` (`:65`) hace `String(v).replace` sin evaluar — sin `eval`, sin template injection. Seguro.

**Q3 — ¿Todos los `innerHTML` de las vistas F5-B usan `escapeHtml()` sobre datos del vault?**
Sí, verificado en las 4 vistas que insertan datos de usuario: `vault.js` (sitio/usuario/id/filtro — `:140-147`, `:132`), `credential-form.js` (todos los campos — `:121-184`), `health.js` (sitio/usuario — `:115-116`), `import-wizard.js` (sitio/url/usuario — `:236-238`, password siempre enmascarada `:239`). El patrón `t('vault.no.results', { term: escapeHtml(filtro) })` escapa **antes** de interpolar e insertar. No se encontró ningún path directo sin escapar.

**Q4 — ¿Paridad completa del contrato de keys i18n Extension↔PWA?**
No. Ver M-4. Paridad intra-superficie perfecta (3 idiomas consistentes en cada superficie), pero 179/234 keys PWA sin equivalente en la Extension y conteos divergentes (349 vs 234). La afirmación de §26 es inexacta.

**Q5 — ¿La limitación #7 (`sesionActiva` persistido) es explotable más allá de lo cosmético?**
No. La clave AES vive en `chrome.storage.session`, que **sí se limpia al reiniciar el browser**. Sin la clave, el vault permanece cifrado aunque `sesionActiva` quede en `true` — la UI puede verse "desbloqueada" pero no hay material para descifrar. Cosmético/confuso, no explotable. La PWA es inmune (sesión memory-only en `session.js`).

**Q6 — ¿Qué deudas de §10 siguen abiertas en código real vs. descritas como mitigadas?**
- **Abiertas y correctamente documentadas:** H-5 (deviceId), H-8 (sesionActiva en Extension), H-9 (logging sync).
- **Documentada como resuelta pero abierta en una superficie:** invalidación de fileId Drive — §10 la marca ✅ pero la Extension sigue sin el fix (M-1, B-4).
- **Resueltas y confirmadas:** precache revisions (BUG-2, `SW_DEPLOY_ID`), import desde setup (la PWA tiene restore-desde-Drive en setup → keys `auth_setup_restore_*`).

**Q7 (añadida) — ¿`autofill.js` mantiene `escapeHtml()` en todos los paths del overlay?**
Sí. El selector de credenciales escapa `alias/nombre/sitio` y el subtítulo antes de insertarlos (`autofill.js:381-382`); `llenarCampos()` usa `.value =` (no innerHTML) para rellenar (`:494-501`). El listener `onMessage` no valida `sender`, pero los content scripts solo reciben mensajes de la propia extensión vía `chrome.runtime` (las páginas web no pueden emitirlos sin `externally_connectable`, ausente del manifest) → sin superficie de inyección externa.

**Q8 (añadida) — ¿Los adapters de sync manejan 404/410 sobre IDs cacheados?**
Parcial. Google Drive **PWA** sí (M-1, fix presente); Google Drive **Extension** no (M-1, BUG-SYNC-404). OneDrive (ambas superficies) es inmune por direccionar por path, no por fileId cacheado.

---

## Deudas técnicas §10 — estado actual

| Deuda §10 | Estado documentado | Estado en código vivo | Relevancia v0.6.0 (Capacitor) |
|---|---|---|---|
| `ultimaModificacion()` sin invalidación fileId | ✅ Resuelto BUG-1 | **Resuelto solo en PWA**; Extension abierto (M-1) | PWA/Capacitor OK; Extension necesita port |
| Precache revision fields manuales | ✅ Resuelto BUG-2 | Confirmado (`SW_DEPLOY_ID` por CI) | Capacitor no usa SW de la misma forma — revisar |
| Import desde setup (vault vacío) | → v0.5.0 | Resuelto en PWA (flujo restore-desde-Drive en setup) | Heredado por Capacitor ✅ |
| Limitación #7 sesionActiva (Extension) | Cosmético | Abierto en Extension; PWA inmune | Capacitor (PWA) inmune ✅ |
| Limitación #8 Zona de Peligro ausente en PWA | Eleva DT-3 | **Verificar** `[Suposición]` — no auditado este ciclo | Capacitor hereda — confirmar reset UI |
| H-5 deviceId opaco | Deuda aceptada | Abierto | **Relevante** — sync per-item v0.6.0 |
| H-9 logging de sync | Deuda aceptada | Abierto | **Relevante** — Lamport clock v0.6.0 |
| **NUEVO** Schema TOTP divergente | No documentado | Abierto (A-1) | **Crítico para Capacitor** — hereda `totp` PWA |
| **NUEVO** PWA sin motor TOTP | No documentado | Abierto (A-2) | Capacitor sin TOTP funcional |
| **NUEVO** Adapters sync fuera del protocolo de forks | No documentado | Abierto (M-1) | Incorporar 4 adapters al protocolo |

---

## Recomendaciones de secuencia para v0.6.0 (no-vinculantes — decisión del arquitecto)

Estas no son tareas a ejecutar en este ciclo; son insumo de priorización:

1. **Fijar el schema canónico de credencial** (incluido TOTP y tipos tarjeta/identidad) y documentarlo en §6/§13 antes de tocar código (resuelve raíz de A-1, M-3, M-5).
2. **Unificar el nombre de campo TOTP** vía migración no destructiva sobre el blob versionado (A-1), y **portar `totp.js` al fork PWA** (A-2).
3. **Incorporar los 4 adapters de sync al protocolo de forks** y portar el fix de invalidación 404 a la Extension (M-1).
4. **Definir el contrato i18n compartido** o documentar explícitamente que son catálogos independientes por superficie (M-4).
5. **Endurecer el exportador CSV** contra formula injection (M-2) — afecta ambas superficies y la futura app nativa.

---

*Fin del informe. Generado en ciclo read-only — cero cambios de código. El único artefacto producido es este archivo.*
