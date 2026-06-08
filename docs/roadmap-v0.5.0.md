# 🗺️ Roadmap — Dacmos Password Manager v0.5.0

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**
**Documento generado:** Mayo 2026 · **Actualizado:** 2026-06-08
**Versión base:** 0.4.3 (v0.4.x completo ✅)
**Versión objetivo:** 0.5.0

> ✅ **Alcance confirmado (2026-06-08):** La publicación de la Extension en CWS
> desencadenó una revisión estratégica. v0.5.0 contiene exactamente dos features:
> **F5-A:** Auto-lock timer en PWA (paridad con Chrome Extension)
> **F5-B:** Internacionalización (i18n) ES / EN / PT-BR (Extension + PWA)
>
> Capacitor/biometría/Play Store se mueven a v0.6.0. Referencia arquitectural:
> `docs/documento-tecnico.md §24` · `docs/decisions/ADR-001-stack-mobile.md`

---

## Contexto estratégico

La Extension publicada en CWS (2026-06-08) expande el perfil de audiencia a
descubrimiento global potencial. Publicar una app nativa monolingüe en español
en Play Store desperdiciaría el primer listing. v0.5.0 prioriza i18n primero;
Capacitor hereda ese trabajo sin costo adicional en v0.6.0.

---

## Principios que NO cambian en v0.5.0

- Zero-Knowledge local-first
- AES-256-GCM + PBKDF2-SHA256 × 600,000 iteraciones
- Sin dependencias externas de crypto — `crypto.subtle`
- Sin servidores propios — BYOC (Google Drive / OneDrive)
- Compatibilidad bit-exacta del vault (Chrome Extension ↔ PWA)

---

## Features v0.5.0

### F5-A — Auto-lock timer en PWA

**Problema:** La Chrome Extension usa `chrome.alarms` para auto-lock (sobrevive al
sleep del service worker MV3). La PWA no tiene `chrome.alarms` — la implementación
usa exclusivamente Web APIs estándar.

**Comportamiento:**
- Timer configurable: 1 min / 5 min / 15 min / 30 min / 1 hora / Nunca
- Paridad exacta con los valores de la Chrome Extension
- Se resetea con cualquier interacción del usuario (tap, scroll, input, keydown)
- Al ir a background (`visibilitychange → hidden`): timer se cancela (setTimeout es
  poco fiable en background mobile)
- Al volver a foreground: si `Date.now() - _tsLastActivity >= limitMs` → bloqueo
  inmediato; si no → timer reanuda con tiempo restante
- Al dispararse: `limpiarSesion()` + `navegar('#/unlock')` (misma secuencia que
  el botón "Bloquear vault" manual ya existente)
- `config.autoLock` (integer, minutos) persiste en IndexedDB — mismo nombre de campo
  que `chrome.storage.local.config.autoLock` en la Extension

**Módulo nuevo:** `web/src/auto-lock/auto-lock-manager.js`

```javascript
export function init({ limitMinutos, onLock }) { ... }  // 0 = "Nunca"
export function reset()   { ... }  // resetea _tsLastActivity + setTimeout
export function destroy() { ... }  // idempotente — safe para llamar N veces
```

**Integración:**
- `web/src/ui/views/unlock.js` — `init()` post-desbloqueo exitoso
- `web/src/ui/views/settings.js` — selector UI + `destroy()` antes de re-init
  + `destroy()` en bloqueo manual existente

---

### F5-B — Internacionalización (i18n) ES / EN / PT-BR

**Audit previo (D5):** ~350–400 strings dispersos en Extension; ~100–110 en PWA.
Ambas plataformas requieren centralización previa antes de crear los archivos de
traducción. El contrato de keys se valida con el arquitecto antes de Commit 3 y 4.

**Idiomas:**
| Código | Idioma | Razón |
|---|---|---|
| es | Español | Idioma primario — identidad de marca DacmosGroup |
| en | Inglés | Fallback universal — máxima cobertura CWS |
| pt-BR | Portugués Brasil | Mercado más grande de LATAM |

**Fallback chain:** idioma del usuario → ES → EN.

#### Chrome Extension — `chrome.i18n` nativo MV3

- `_locales/es/messages.json`, `_locales/en/messages.json`, `_locales/pt_BR/messages.json`
- API: `chrome.i18n.getMessage('key')` — wrapper `t('key')` para JS
- HTML: atributos `data-i18n="key"` + walker DOM en cada `init()`
- Detección: automática desde el idioma del browser Chrome
- Override: `config.idioma` en `chrome.storage.local`

#### PWA — módulo custom `web/src/i18n/i18n.js`

- Función `t(key, vars)` exportada
- Diccionarios: `web/src/i18n/strings.es.js`, `strings.en.js`, `strings.pt_BR.js`
- Detección: `navigator.language` → ES si empieza con 'es', PT-BR si empieza con 'pt',
  EN para el resto
- Override: `config.idioma` en IndexedDB (persiste entre sesiones)
- Toggle UI: Settings — prominente, tres opciones visibles

**Contrato de keys compartido:** mismas keys en ambas plataformas. Sincronía manual —
sin build step.

---

## Lo que NO está en v0.5.0

| Feature | Versión | Razón |
|---------|---------|-------|
| Capacitor wrapping (iOS + Android nativo) | v0.6.0 | Hereda i18n de v0.5.0 — el orden correcto es i18n primero |
| Biometría nativa | v0.6.0 | Requiere Capacitor como base |
| Play Store / App Store (público) | v0.6.0+ | Requiere Capacitor + i18n |
| AutoFill nativo iOS / Android | v0.7.0 | Requiere Capacitor (Credential Provider Extension) |
| Integración Stripe / monetización | v0.8.0 | Sin masa crítica de usuarios aún |
| Sync per-item con Lamport ordering | v0.6.0 | Scope reducido en v0.5.0 |
| Argon2id como KDF alternativo | v0.9.0 | El versionado del blob desde v0.4.0 lo habilita |

---

## Criterios de completitud

- [ ] F5-A — Auto-lock funciona en mobile: background >X min → bloqueo inmediato al volver al foreground
- [ ] F5-A — Selector en Settings guarda/carga `config.autoLock` en IndexedDB
- [ ] F5-A — `destroy()` es idempotente — no produce error si se llama N veces
- [ ] F5-B — Extension muestra todos los strings en EN al cambiar idioma del browser a inglés
- [ ] F5-B — PWA detecta automáticamente el idioma del browser (ES / EN / PT-BR)
- [ ] F5-B — Override manual en Settings persiste entre sesiones (IndexedDB)
- [ ] F5-B — Contrato de keys aprobado por arquitecto antes de crear archivos de traducción
- [ ] Versión bumpeada a 0.5.0 en `manifest.json` + `web/manifest.json`
- [ ] PR mergeado a main

---

## Learnings anticipados — contenido educativo

| # | Learning | Aplicación en contenido |
|---|----------|------------------------|
| L1 | Auto-lock sin `chrome.alarms`: `visibilitychange` + `Date.now()` | Post técnico: PWA vs Extension — diferencias reales de APIs |
| L2 | `chrome.i18n` vs módulo custom — dos sistemas, mismo contrato de keys | Video: i18n en apps multi-plataforma sin bundler |
| L3 | Audit de strings antes de i18n: el costo real del hardcoding | Post: refactor previo — por qué es obligatorio |

---

## Roadmap completo actualizado

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 ✅  UX Polish — navegación, legibilidad, fixes autofill
v0.4.0 ✅  PWA — vault en mobile via navegador, APK Android via TWA
v0.4.1 ✅  Ext: flujo "¿Olvidaste tu contraseña?" — escape hatch desde pantalla bloqueada
v0.4.2 ✅  Auditoría #3 — 4 críticos + 4 altos resueltos, sync multi-dispositivo
v0.4.3 ✅  PWA: paridad con v0.4.1 Ext — flujo "¿Olvidaste tu contraseña?"
v0.5.0 ⏳  Auto-lock PWA + i18n ES/EN/PT-BR (Extension + PWA)
v0.6.0 ⏳  Capacitor — app nativa iOS + Android (hereda i18n de v0.5.0)
v0.7.0 ⏳  Autofill nativo — iOS Credential Provider + Android Autofill Service
v0.8.0 ⏳  Monetización — lifetime $29 + Stripe (cuando haya tracción medible)
v0.9.0 ⏳  Argon2id opcional + preparación auditoría
v1.0.0 ⏳  Auditoría Cure53 + App Store + Play Store público
```

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
