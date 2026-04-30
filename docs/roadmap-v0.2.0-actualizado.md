# 🗺️ Roadmap — Dacmos Password Manager v0.2.0

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**
**Documento generado:** Abril 2026
**Versión base:** 0.1.1
**Versión objetivo:** 0.2.0 ✅ COMPLETADA — Abril 30, 2026

---

## Estado final

Todos los features de v0.2.0 completados y mergeados a `main`.
PR #2 mergeado el 30 de abril de 2026.
Enviado a revisión en Chrome Web Store el 30 de abril de 2026.

---

## Criterios de completitud — TODOS CUMPLIDOS ✅

- [x] F1.1 — Importación desde CSV (Google PM, Bitwarden, LastPass, 1Password, genérico)
- [x] F1.2 — TOTP integrado con cuenta regresiva y copia rápida
- [x] F1.3 — Health reports: débiles + reutilizadas + HIBP k-anonymity
- [x] F1.4 — Exportar en CSV genérico y CSV Bitwarden
- [x] F1.5 — Tipos de credencial: Tarjeta de crédito e Identidad
- [x] F1.6 — URL matching mejorado con dominio base y wildcards
- [x] Versión bumpeada a 0.2.0 en manifest.json
- [x] PR mergeado a main con descripción completa
- [x] Enviado a Chrome Web Store para revisión

---

## Resumen técnico de entregas

### F1.1 — Importar credenciales desde CSV

**Archivos creados:**
- `src/import/csv-importer.js` (~328 líneas) — parser RFC 4180 puro
- `src/ui/settings/import-wizard.js` (~405 líneas) — UI orquestación

**Archivos modificados:**
- `src/ui/settings/settings.html` — sección de importación
- `src/ui/settings/settings.js` — event listeners
- `src/ui/settings/settings.css` — estilos del wizard

**Decisiones clave:**
- Parser propio RFC 4180 — sin PapaParse ni librerías externas
- Fingerprinting automático de headers para detectar el gestor origen
- Deduplicación por clave canónica URL+usuario con re-filtrado en confirmación
- Clave AES liberada en bloque `finally` — sin fugas de memoria

---

### F1.2 — Generador TOTP integrado

**Archivos creados:**
- `src/crypto/totp.js` (~96 líneas) — motor TOTP autónomo

**Archivos modificados:**
- `src/ui/vault/vault.html` — campo inputTotp en modal
- `src/ui/vault/vault.js` — CRUD + badge + countdown
- `src/ui/vault/vault.css` — estilos badge TOTP

**Decisiones clave:**
- HMAC-SHA1 via `crypto.subtle` — RFC 6238 correcto
- Decodificador Base32 propio (~20 líneas de aritmética de bits)
- Validación `esBase32Valido()` antes de persistir
- `setInterval` de 1s solo para UI — `crypto.subtle` llamado cada 30s

---

### F1.3 — Password Health Reports

**Archivos creados:**
- `src/health/password-health.js` (~152 líneas) — motor de análisis
- `src/ui/health/health.html` (~108 líneas) — dashboard
- `src/ui/health/health.js` (~287 líneas) — lógica del dashboard
- `src/ui/health/health.css` (~395 líneas) — estilos

**Archivos modificados:**
- `src/ui/vault/vault.js` — botón Health Check + filtro de tipos
- `src/ui/vault/vault.html` — botón en header
- `src/ui/vault/vault.css` — badges de advertencia

**Decisiones clave:**
- SHA-256 para deduplicación (nunca comparar passwords en texto plano)
- k-anonymity HIBP con header `Add-Padding: true`
- Manejo de HTTP 429 (rate limit) con detención del bucle
- `healthReport` en `chrome.storage.session` eliminado al cargarlo

---

### F1.4 — Exportar en múltiples formatos

**Archivos creados:**
- `src/export/csv-exporter.js` (~60 líneas) — generador CSV puro

**Archivos modificados:**
- `src/ui/settings/settings.html` — 2 nuevas filas de exportación
- `src/ui/settings/settings.js` — handlers + descargarArchivo()
- `src/ui/settings/settings.css` — estilos `.export-ack`

**Decisiones clave:**
- `escaparCampo()` RFC 4180 con regex `/[",\n\r]/`
- Doble barrera: checkbox + contraseña maestra antes de generar
- `generarCSVBitwarden()` incluye `login_totp` para migración completa

---

### F1.5 — Tipos de credencial: Tarjeta e Identidad

**Archivos creados:**
- `src/ui/vault/credential-types.js` (~378 líneas) — módulo central de tipos

**Archivos modificados:**
- `src/ui/vault/vault.html` — selector de tabs + formContainer dinámico
- `src/ui/vault/vault.js` — modal multi-tipo, CRUD, health filtrado
- `src/ui/vault/vault.css` — estilos tabs, tarjeta enmascarada, revelar
- `src/content/autofill.js` — detección checkout e identidad
- `src/background/service-worker.js` — filtrado por tipo en SOLICITAR_AUTOCOMPLETADO

**Decisiones clave:**
- `tipo: undefined === 'login'` — backward compatible sin migración
- `escapeHtmlInterno()` propio en credential-types.js
- Revelado temporal con `_timerRevelado` y auto-reocultado a 5s
- Prioridad detección: checkout > identidad > login

---

### F1.6 — URL Matching mejorado

**Archivos creados:**
- `src/utils/url-matcher.js` (~237 líneas) — módulo eTLD+1 + scoring

**Archivos modificados:**
- `src/background/service-worker.js` — 8 líneas: import + eliminar filtrarPorDominio + 3 call sites

**Decisiones clave:**
- Corrección bug de seguridad: `includes()` → comparación exacta de eTLD+1
- Lista TLD_MULTIPART con foco LATAM: `.com.pa`, `.gob.pa`, `.com.br`...
- Sistema de puntuación: exacto(100) > base(80) > wildcard(50) > sitio(30)
- `*.empresa.com` excluye deliberadamente el apex `empresa.com`

---

## Contexto estratégico (referencia para v0.3.0)

La v0.2.0 alcanzó paridad competitiva mínima con gestores gratuitos
como Bitwarden y Proton Pass. Los 6 features cubren las razones
principales por las que usuarios no adoptan un nuevo gestor:

| Barrera eliminada | Feature |
|---|---|
| "Tengo todas mis contraseñas en Bitwarden" | F1.1 — Importación |
| "Necesito 2FA" | F1.2 — TOTP |
| "¿Cómo sé si mis contraseñas son seguras?" | F1.3 — Health |
| "¿Puedo exportar si quiero cambiarme?" | F1.4 — Exportación |
| "Guardo más que contraseñas" | F1.5 — Tipos |
| "No reconoce todos mis sitios" | F1.6 — URL matching |

El siguiente paso es eliminar la barrera más importante:
**"Solo funciona en mi PC"** → v0.3.0 Sync BYOC.

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
> *Datos · Nube · Movilidad · Seguridad*
