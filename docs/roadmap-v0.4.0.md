# 🗺️ Roadmap — Dacmos Password Manager v0.4.0

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**
**Documento generado:** Mayo 2026
**Versión base:** 0.3.1 (en revisión Chrome Web Store)
**Versión objetivo:** 0.4.0

> ⚠️ **Este roadmap reemplaza completamente al roadmap-v0.4.0.md original.**
> El plan anterior (React Native + Expo) fue descartado por decisión arquitectural
> documentada en `docs/decisions/ADR-001-stack-mobile.md`.

---

## Contexto estratégico

v0.4.0 es el primer paso de la expansión mobile de Dacmos Password Manager.
No lanza una app nativa — lanza una **Progressive Web App (PWA)** que convierte
el vault en accesible desde cualquier dispositivo móvil sin instalación en
stores y sin inversión en infraestructura.

**La barrera que elimina:**
> *"Solo funciona en mi computadora"*

Con v0.3.0 el vault ya viaja cifrado en la nube del usuario (BYOC).
v0.4.0 añade el cliente mobile que lo consume: funciona en el navegador
de cualquier smartphone, se puede agregar al Home Screen, y trabaja offline.

**¿Por qué PWA antes de app nativa?**

La secuencia PWA → Capacitor (v0.5.0) → Autofill nativo (v0.6.0) es
deliberada y está respaldada por `ADR-001-stack-mobile.md`:

- Reutiliza >90% del código JS actual (engine.js, totp.js, adaptadores sync)
- Compatibilidad bit-exacta del vault con Chrome Extension — sin capa de traducción
- PBKDF2-SHA256 600k nativo via `crypto.subtle` — sin dependencias externas de crypto
- Costo total año 1: $10–15 (solo dominio) — sin Apple Developer, sin Play Console
- No requiere macOS — desarrollo completo en Windows

---

## Referencia arquitectural

Esta versión opera bajo los lineamientos de:

```
docs/decisions/ADR-001-stack-mobile.md
```

Toda decisión técnica de v0.4.0 que contradiga el ADR requiere
un ADR nuevo antes de implementarse.

---

## Principios que NO cambian en v0.4.0

- Zero-Knowledge local-first
- AES-256-GCM + PBKDF2-SHA256 × 600,000 iteraciones — idénticos a la extensión Chrome
- Sin dependencias externas de crypto — `crypto.subtle` nativa del navegador
- Sin servidores propios — BYOC (Google Drive / OneDrive)
- Código comentado en español
- Compatibilidad bit-exacta del vault Chrome Extension ↔ PWA

---

## Stack tecnológico — PWA

```
├── Plataforma:     Progressive Web App — navegador mobile y desktop
├── Lenguaje:       JavaScript ES Modules (mismo que la extensión Chrome)
├── Crypto:         Web Crypto API nativa (crypto.subtle) — sin cambios
├── Almacenamiento: IndexedDB (reemplazo de chrome.storage.local)
├── Sesión:         sessionStorage in-memory (reemplazo de chrome.storage.session)
├── OAuth:          Google Identity Services JS + MSAL.js v3 con PKCE S256
├── Service Worker: Workbox (caché offline, cache-first para assets)
├── Despliegue:     Cloudflare Pages (tier free) bajo dominio dacmosgroup.co
└── Distribución Android: APK via TWA (Trusted Web Activity) + GitHub Releases
```

**Archivos que se reutilizan sin modificaciones:**
- `src/crypto/engine.js` — motor AES-256-GCM + PBKDF2 (intacto)
- `src/crypto/totp.js` — motor TOTP RFC 6238 (intacto)
- `src/sync/storage-adapter.js` — interfaz base (intacta)
- `src/sync/google-drive-adapter.js` — adaptador Google Drive (adaptación menor OAuth)
- `src/sync/onedrive-adapter.js` — adaptador OneDrive (adaptación menor OAuth)
- `src/utils/url-matcher.js` — eTLD+1 matching (intacto)
- `src/import/csv-importer.js` — parser CSV (intacto)
- `src/export/csv-exporter.js` — exportador CSV (intacto)
- `src/health/password-health.js` — motor de salud (intacto)

---

## Features v0.4.0

### F4.1 — Setup PWA + infraestructura de despliegue ✅ COMPLETADO

**Alcance:**
- Estructura de carpetas `web/` en el repo (coexiste con `src/` de la extensión)
- Web App Manifest: nombre, íconos DacmosGroup, tema de colores, `display: standalone`
- Service Worker con Workbox: cache-first para assets, network-first para documentos
- CSP equivalente a Chrome Extension MV3 + `script-src storage.googleapis.com` (Workbox)
- Builds reproducibles via GitHub Actions → Cloudflare Pages

**Despliegue:**
- Cloudflare Pages (free tier) — URL activa: `https://dacmos-pm-pwa.pages.dev`
- HTTPS provisto automáticamente por Cloudflare

**Criterios de completitud:**
- ✅ Estructura `web/` completa (manifest, SW, index, offline, _headers, _redirects)
- ✅ Web App Manifest con todos los campos requeridos y JSON válido
- ✅ `index.html` con meta tags PWA y link al manifest
- ✅ Service Worker Workbox 7.0.0: CacheFirst assets, NetworkFirst HTML
- ✅ `offline.html` precacheado en el SW
- ✅ CSP con `script-src 'self' https://storage.googleapis.com` y `worker-src`
- ✅ `_redirects` con regla SPA `/* /index.html 200`
- ✅ 5 íconos SVG placeholder en `web/assets/icons/`
- ✅ `.github/workflows/deploy-pwa.yml` configurado
- ✅ Todo el código comentado en español
- ✅ `src/` y `manifest.json` de la Chrome Extension no modificados
- ✅ Deploy activo en Cloudflare Pages

**Fixes aplicados post-deploy (commits `4b4b1e1` → `bc1fe52`):**
- `script-src` ampliado a `https://storage.googleapis.com` — `importScripts()` en
  Service Workers es gobernado por `script-src`, no por `worker-src` (causa raíz del
  error "ServiceWorker script evaluation failed")
- `manifest.json`: atributo `sizes` cambiado de `"192x192"`/`"512x512"` a `"any"`
  para íconos SVG — SVG es vectorial y las dimensiones fijas causaban error de
  validación en el navegador
- Meta tags `apple-mobile-web-app-capable` y `apple-mobile-web-app-status-bar-style`
  eliminadas de `index.html` — deprecadas en Safari 17 / iOS 17; el modo standalone
  lo gestiona `display: standalone` en el manifest

**Pendiente para producción (fuera de scope F4.1):**
- Convertir `icon-180.svg` → `icon-180.png` para `apple-touch-icon` en iOS Safari
- Configurar secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en GitHub
- URL de producción personalizada: `dpm.dacmosgroup.co`

---

### F4.2 — Migración a IndexedDB (reemplazo de chrome.storage) ✅ COMPLETADO

**El único cambio de almacenamiento del proyecto.** El vault cifrado
viaja en el mismo formato `{ iv, datos }` — solo cambia el mecanismo
que lo persiste.

**Equivalencias:**

| Extensión Chrome | PWA |
|-----------------|-----|
| `chrome.storage.local` | IndexedDB (database: `dacmos-pm`, store: `vault`) |
| `chrome.storage.session` | sessionStorage + objeto in-memory en JS |
| `chrome.runtime.getManifest().version` | `fetch('/manifest.json').then(r => r.json())` |

**Archivos nuevos:**
- `web/src/storage/indexeddb-adapter.js` — capa de abstracción sobre IndexedDB
  con la misma API que `chrome.storage.local` para facilitar reutilización

**Decisiones técnicas:**

- La clave AES nunca va a IndexedDB — solo el blob cifrado `{ iv, datos }`
- `sessionStorage` se comporta igual que `chrome.storage.session`: se borra
  al cerrar la pestaña y no persiste entre sesiones
- El formato del blob incorpora el campo `__version` desde este release
  (ver sección "Versionado del blob")

**Criterio de completitud:**
- Desbloquear → crear credencial → cerrar pestaña → abrir → desbloquear:
  las credenciales persisten. Round-trip completo en Chrome Android y Safari iOS.

---

### F4.3 — OAuth PKCE sin chrome.identity ✅ COMPLETADO

`chrome.identity` no existe en el contexto de una PWA. Se reemplaza por
flujos OAuth estándar con PKCE (Proof Key for Code Exchange) S256, que
es el estándar de la industria para apps públicas sin client secret.

**Google Drive:**
- Google Identity Services JS (`accounts.google.com/gsi/client`)
- Flujo: popup OAuth → `access_token` en memoria → no en localStorage
- Scope: `drive.appdata` (sin cambios respecto a v0.3.0)
- Refresh: re-auth silenciosa via `google.accounts.oauth2.initTokenClient`

**OneDrive:**
- MSAL.js v3 con PKCE S256
- Flujo: popup OAuth → token en `sessionStorage` de MSAL (encriptado)
- Scope: `Files.ReadWrite.AppFolder` (sin cambios)
- Refresh: silent token renewal via MSAL

**Archivos nuevos:**
- `web/src/auth/google-auth.js` — wrapper OAuth Google para PWA
- `web/src/auth/microsoft-auth.js` — wrapper MSAL.js v3 para PWA

**Archivos adaptados:**
- `web/src/sync/google-drive-adapter.js` — fork liviano de v0.3.0 que recibe
  `access_token` desde `google-auth.js` en lugar de `chrome.identity`
- `web/src/sync/onedrive-adapter.js` — fork liviano que usa MSAL.js

**Decisión de seguridad crítica:**
Los `access_token` de OAuth viven **solo en memoria durante la sesión**.
No se persisten en `localStorage` ni en `IndexedDB`. Al cerrar la pestaña,
el usuario debe re-autenticar en Google/Microsoft — comportamiento idéntico
al de la extensión Chrome cuando el service worker se reinicia.

**Criterio de completitud:**
- Conectar Google Drive → crear credencial en PWA → abrir extensión Chrome:
  la credencial aparece. Round-trip PWA ↔ Chrome verificado.
- Mismo test con OneDrive.

**Implementación — commit `bbddbdc` (branch `feature/v0.4.0`):**
- `web/src/auth/google-auth.js` — GIS Token Client; `_accessToken` solo en scope
  de módulo JS; `_gisListo` Promise resuelve via rAF polling cuando `window.google`
  está disponible; `invalidarToken()` para forzar renovación tras 401
- `web/src/auth/microsoft-auth.js` — MSAL.js v3.30.0 con PKCE S256 (implementado
  internamente por MSAL); `cacheLocation: 'sessionStorage'`; `acquireTokenSilent`
  con fallback a `acquireTokenPopup` en `InteractionRequiredAuthError`
- `web/libs/msal-browser.esm.min.js` — MSAL bundleado con `esbuild --bundle
  --format=esm --platform=browser` (311KB autocontenido, sin CDN, funciona offline)
- `web/src/sync/google-drive-adapter.js` — fork: `chrome.identity` → `google-auth.js`;
  `chrome.storage.local` → `idbStorage`; `_limpiarTokenCache()` eliminado
- `web/src/sync/onedrive-adapter.js` — fork: `launchWebAuthFlow` → `microsoft-auth.js`;
  `_generarPKCE()`, `_guardarTokens()`, `_refrescarToken()` eliminados (MSAL los maneja)
- `web/src/sync/storage-adapter.js` — fork literal (la PWA no puede importar fuera de `web/`)
- `web/blank.html` — página de redirect MSAL popup; llama `handleRedirectPromise()`
- `web/_headers` — CSP: `https://accounts.google.com` → `script-src`;
  `https://oauth2.googleapis.com` y `https://login.microsoftonline.com` → `connect-src`
- `web/src/app.js` — `import inicializarMsal`; `await inicializarMsal()` en evento `load`
- `web/libs/versions.json` — registro de versión fija: `msal-browser: 3.30.0`
- `docs/f4.3-oauth-setup.md` — checklist de prerequisitos: Google Cloud Console (Client ID
  tipo "Aplicación web") y Azure Portal (redirect URIs tipo "Single Page Application")

---

### F4.4 — UI responsive y mobile-first ✅ COMPLETADO

La UI de la extensión Chrome fue diseñada para popup (380px) y pestañas
completas desktop. La PWA debe funcionar en pantallas de 360px a 1440px.

**Alcance:**

- Viewport meta correcto en todos los HTML: `width=device-width, initial-scale=1`
- Touch targets mínimo 44×44px (WCAG 2.5.5)
- Gestos: swipe para revelar acciones en cards del vault (editar, eliminar)
- Navegación: barra inferior mobile (Vault / Health / Generator / Settings)
  en viewports < 768px. En desktop se mantiene la barra lateral actual.
- Onboarding específico PWA: pantalla "Agregar al Home Screen" con
  instrucciones por plataforma (iOS Safari vs Chrome Android)
- Sin dependencia del popup de la extensión Chrome — el punto de entrada
  es la URL directa

**Archivos nuevos:**
- `web/src/ui/layout/` — componentes de layout responsive
- `web/src/ui/onboarding/pwa-install.js` — lógica de "Add to Home Screen"

**Archivos adaptados:**
- CSS de cada vista (vault, health, generator, settings) —
  añadir breakpoints mobile sin tocar la lógica JS

**Criterio de completitud:**
- Lighthouse Accessibility ≥ 90 en mobile
- Navegación completa (login → vault → nueva credencial → health → settings)
  funciona en iPhone Safari y Chrome Android sin scroll horizontal

---

### F4.5 — Persistencia robusta: manejo de eviction iOS Safari ✅ COMPLETADO

**El riesgo más importante de la PWA en iOS.**

Safari puede evictar los datos de origen (IndexedDB incluida) después de
7 días sin que el usuario visite la PWA instalada. Esto significa pérdida
del vault local — un escenario inaceptable para un gestor de contraseñas.

**Mitigaciones implementadas:**

1. **`navigator.storage.persist()`** — solicitado en el primer setup.
   Si el usuario acepta, Safari garantiza que el origen no se evicta.
   En Chrome Android y Firefox, `persist()` se otorga automáticamente
   si la PWA está instalada en el Home Screen.

2. **UX educativa** — si el navegador rechaza la persistencia
   (Safari suele pedir confirmación explícita), mostrar un banner claro:
   > "Tu vault local puede borrarse si no abres la app por 7+ días.
   > Activa la sincronización con Google Drive o OneDrive para protegerlo."

3. **Sincronización como red de seguridad** — promover activamente la
   configuración del sync BYOC durante el onboarding en iOS.
   El vault en Drive/OneDrive actúa como backup automático.

4. **Indicador de estado de persistencia** en Settings → sección
   "Almacenamiento": muestra si el origen tiene persistencia garantizada
   o está en modo evictable.

**Archivos nuevos:**
- `web/src/storage/persistence-manager.js` — wrapper sobre
  `navigator.storage.persist()` y `navigator.storage.estimate()`

**Criterio de completitud:**
- En Safari iOS: setup → Add to Home Screen → solicitar persistencia →
  UX correcta según la respuesta del browser
- En Chrome Android: persistencia garantizada automáticamente tras instalar

---

### F4.6 — Distribución: web + APK Android via TWA ✅ COMPLETADO

**Canales de distribución para v0.4.0:**

| Canal | Plataforma | Inversión | Estado |
|-------|------------|-----------|--------|
| URL directa (dpm.dacmosgroup.co) | iOS + Android + Desktop | $10–15/año (dominio) | ✅ Principal |
| APK via GitHub Releases | Android | $0 | ✅ v0.4.0 |
| IzzyOnDroid | Android | $0 | ✅ v0.4.0 |
| F-Droid | Android | $0 (review ~1 mes) | 🔄 v0.4.x |
| Google Play Store | Android | $25 vitalicio | ⏳ v0.5.0 |
| Apple App Store | iOS | $99/año | ⏳ v0.6.0 |

**APK via Trusted Web Activity (TWA):**

Una TWA es un shell Android nativo que sirve la PWA a pantalla completa
sin la barra de URL del navegador. No es Capacitor — es un APK mínimo
(~100KB) generado con `bubblewrap` (herramienta de Google, gratuita).
Se firma con un Android keystore generado localmente en Windows.

```bash
# Herramientas (gratuitas, se instalan en Windows)
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://dpm.dacmosgroup.co/manifest.json
bubblewrap build   # genera dacmos-pm.apk
```

**Android Developer Console (CRÍTICO — antes de septiembre 2026):**

Google exige verificación de identidad para distribución de APKs fuera
de Play Store a partir de septiembre 2026 en LATAM (Brasil primero).
El registro en la **Android Developer Console gratuita** (distinta de
Play Console) debe hacerse antes de esa fecha para no perder distribución
en el mercado primario.

- URL: `play.google.com/console/about/` → "Crear cuenta gratuita"
- No requiere los $25 de Play Console
- Solo verificación de identidad (documento + selfie)

**Criterio de completitud:**
- APK firmado descargable desde GitHub Releases v0.4.0
- APK instalable en Android sin Play Store (sideloading)
- TWA muestra la PWA a pantalla completa, sin barra de URL
- Formulario de submisión a IzzyOnDroid completado

**Implementación — branch `feature/v0.4.0`:**
- `.gitignore`: `*.keystore` y `*.jks` añadidos antes de generar el keystore
- `web/manifest.json`: campo `id: "/"` añadido; íconos PNG 192×192 y 512×512 añadidos
- `web/.well-known/assetlinks.json`: Digital Asset Links creado con fingerprint real
- `web/_headers`: regla `Content-Type: application/json` para `assetlinks.json`
- `web/_redirects`: regla `/.well-known/*` antes de la catch-all SPA
- `twa-manifest.json`: configuración bubblewrap con `package_name: co.dacmosgroup.dpm`
- `docs/f4.6-keystore.md`: documentación operativa del keystore (SÍ en repo)
- `dacmos-release.keystore`: archivo binario excluido por `.gitignore` (NO en repo)
- Dominio: `app.dacmosgroup.co` → `dpm.dacmosgroup.co` en todo el repo
- SHA-256 del keystore: `B0:A1:FC:98:88:FB:8B:EE:F1:34:49:F8:FE:49:92:7C:E6:D2:4D:2E:FD:D0:0C:17:75:A0:E7:33:8F:8E:DE:0D`

---

### F4.7 — Versionado del blob desde v0.4.0 ✅ COMPLETADO

**Este es el cambio técnico más importante del release para la sostenibilidad
futura del proyecto.** Sin él, añadir Argon2id en v0.7.0 requiere una
migración destructiva que rompe la compatibilidad con vaults v0.3.x.

El vault cifrado actualmente tiene el formato:

```json
{ "iv": "<base64>", "datos": "<base64>" }
```

Este formato no incluye ninguna indicación de qué algoritmo o parámetros
se usaron para cifrarlo. Es suficiente mientras solo existe un algoritmo,
pero se vuelve un problema cuando se quiere migrar a Argon2id o cambiar
el número de iteraciones.

**Nuevo formato con versión embebida:**

```json
{
  "__version": 1,
  "kdf": "PBKDF2-SHA256",
  "kdfIterations": 600000,
  "iv": "<base64>",
  "datos": "<base64>"
}
```

**Reglas de compatibilidad:**

| Escenario | Comportamiento |
|-----------|---------------|
| Vault sin `__version` (v0.3.x y anteriores) | Tratado como `__version: 1` (backward compat) |
| Vault con `__version: 1` | PBKDF2-SHA256 × 600,000 iter. — path actual |
| Vault con `__version: 2` (v0.7.0+) | Argon2id — detectado y procesado diferente |

**Archivos afectados:**
- `web/src/crypto/engine.js` — fork del engine.js de la extensión que
  añade lectura/escritura del campo `__version`
- La extensión Chrome (`src/crypto/engine.js`) se actualiza también para
  leer el campo `__version` y ser compatible con blobs PWA v0.4.0+

**Criterio de completitud:**
- Vault creado en PWA v0.4.0 descifrable en Chrome Extension v0.3.1 ✅
- Vault creado en Chrome Extension v0.3.1 descifrable en PWA v0.4.0 ✅
- Campo `__version` presente en todos los blobs nuevos ✅

**Implementación — commit `1a403aa` (branch `feature/v0.4.0`):**
- `web/src/crypto/engine.js` — constantes `BLOB_VERSION`/`BLOB_KDF`, capa L2
  (`serializarAAD`, `cifrarConVersion`, `descifrarConVersion`, `detectarVersionBlob`),
  exportación de `detectarVersionBlob`, captura de `VAULT_VERSION_INCOMPATIBLE` en
  `desbloquearVault` e `importarVaultBackup` (×3 call sites)
- `src/crypto/engine.js` — lógica idéntica para la Chrome Extension

---

## Lo que NO está en v0.4.0

| Feature | Versión estimada | Razón |
|---------|-----------------|-------|
| App nativa iOS | v0.5.0 | Requiere macOS para build (lo provee EAS/Codemagic en la nube) |
| Autofill nativo iOS | v0.6.0 | Requiere Apple Developer Program ($99) + Swift nativo |
| Autofill nativo Android | v0.6.0 | Requiere Kotlin nativo + Credential Manager API |
| Biometría (Face ID / Fingerprint) | v0.5.0 | Requiere Capacitor + módulo nativo propio |
| Google Play Store | v0.5.0 | Requiere $25 de Play Console |
| Sync per-item con Lamport ordering | v0.5.0 | Cambio de arquitectura de sync — se documenta en doc-técnico, se implementa en v0.5.0 |
| Argon2id como KDF alternativo | v0.7.0 | El versionado del blob lo habilita desde v0.4.0, la implementación es v0.7.0 |
| Monetización | v0.7.0 | Sin infraestructura de pagos ni stores todavía |

**Limitaciones conocidas que se documentan explícitamente para el usuario:**

- **iOS AutoFill no disponible en PWA**: el usuario debe copiar contraseñas
  manualmente hasta v0.6.0 con autofill nativo
- **Eviction de 7 días en iOS Safari**: mitigado con persistencia + sync,
  pero comunicado claramente durante el onboarding

---

## Criterios de completitud

- [x] F4.1 — Setup PWA: infraestructura completa desplegada en Cloudflare Pages ✅
- [x] F4.2 — IndexedDB: adaptador + fork engine.js para PWA ✅
- [x] F4.3 — OAuth PKCE: sync Google Drive + OneDrive funcionando en mobile ✅
- [x] F4.4 — UI responsive: navegación completa en 360px y 1440px sin errores ✅
- [x] F4.5 — Persistencia: `navigator.storage.persist()` + UX educativa en iOS ✅
- [x] F4.6 — Distribución: dominio dpm.dacmosgroup.co + assetlinks + APK TWA firmado ✅
- [x] F4.7 — Versionado del blob: campo `__version` en todos los blobs nuevos ✅
- [ ] Compatibilidad cruzada PWA ↔ Chrome Extension verificada (round-trip)
- [ ] Android Developer Console gratuito registrado (antes de sep 2026)
- [ ] Versión bumpeada a 0.4.0 en manifest de la extensión Y en PWA manifest
- [x] PR mergeado a main con descripción completa ✅
- [x] Desplegado en dpm.dacmosgroup.co ✅

---

## Decisiones técnicas abiertas

| Decisión | Opciones | Criterio para resolver |
|----------|----------|----------------------|
| ¿Dominio para la PWA? | `dpm.dacmosgroup.co` vs `dacmosgroup.co/app` | `dpm.dacmosgroup.co` (subdominio limpio) si el DNS lo permite |
| ¿Cloudflare Pages vs GitHub Pages? | Cloudflare (mejor CDN, más control) vs GitHub (más simple) | Cloudflare Pages si se quiere Workers en el futuro; GitHub si simplicidad es prioridad |
| ¿Qué pasa con la extensión Chrome durante v0.4.0? | Ambas coexisten / solo PWA | Coexisten — la extensión sigue en CWS, la PWA es adicional |
| ¿La Chrome Extension actualiza su engine.js para leer `__version`? | Sí (recomendado) vs No (solo PWA) | Sí — garantiza compatibilidad bidireccional desde el primer día |

---

## Learnings anticipados — contenido educativo

| # | Learning | Aplicación en contenido |
|---|----------|------------------------|
| L1 | PWA vs App nativa: cuándo elegir cada una | Video: arquitectura de apps mobile en 2026 |
| L2 | `crypto.subtle` en mobile: por qué es suficiente | Video: criptografía web vs nativa |
| L3 | IndexedDB vs chrome.storage: las diferencias reales | Tutorial: almacenamiento seguro en el browser |
| L4 | OAuth PKCE sin backend: el flujo correcto | Tutorial: integrar Google Drive en una PWA |
| L5 | iOS Safari eviction: el problema que nadie te dice | Post: las limitaciones reales de las PWAs en iOS |
| L6 | TWA: cómo tener un APK sin Play Store | Tutorial: distribuir apps Android gratis con bubblewrap |
| L7 | Versionado de formato de datos: por qué importa desde el día uno | Post: diseñar para la migración futura |

---

## Brief para Claude Code — v0.4.0

```
Proyecto: Dacmos Password Manager
Branch de trabajo: crear rama feature/v0.4.0 desde main

Documentos de referencia (leer en este orden):
1. docs/decisions/ADR-001-stack-mobile.md
2. docs/roadmap-v0.4.0.md (este documento)
3. docs/documento-tecnico.md

Antes de iniciar cualquier desarrollo:
1. Lee los tres documentos completos
2. Confirma qué ítem vamos a desarrollar en esta sesión
3. Propón la arquitectura antes de escribir código
4. Espera mi aprobación antes de proceder

Principios no negociables:
- Zero-Knowledge — cifrado siempre en el cliente
- AES-256-GCM + PBKDF2-SHA256 × 600,000 iteraciones
- Sin librerías de crypto externas — solo crypto.subtle nativa
- engine.js y totp.js se reutilizan sin modificación de lógica
- Código comentado en español

Ítem a desarrollar en esta sesión: [ESPECIFICAR]
```

---

## Roadmap completo actualizado

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 ✅  UX Polish — navegación, legibilidad, fixes autofill
v0.4.0 ✅  PWA — vault en mobile via navegador, APK Android via TWA
v0.5.0 ⏳  Capacitor — app nativa iOS + Android, biometría, Play Store
v0.6.0 ⏳  Autofill nativo — iOS Credential Provider + Android Autofill Service
v0.7.0 ⏳  Argon2id opcional + preparación de auditoría
v1.0.0 ⏳  Auditoría Cure53 + listado público CWS + App Store + Play Store
```

---

## Bugs conocidos y estado

### BUG-1 — Vault vacío después de sync BYOC (Google Drive + OneDrive) ✅ RESUELTO

**Síntoma:** Al conectar Google Drive o OneDrive en la PWA y hacer sync, el vault
aparece vacío aunque el archivo exista en el proveedor. Con vault local vacío,
el sync podía sobrescribir datos en el proveedor sin advertencia.

**Causa raíz:** Los handlers de sync en `settings.js` eran upload-only — nunca
llamaban a `adapter.cargar()` ni comparaban timestamps LWW. No existía
`sync-manager.js` en la PWA (la Chrome Extension sí lo tenía desde F2.1).

**Solución:** Nuevo `web/src/sync/sync-manager.js` con lógica LWW bidireccional
para Google Drive y OneDrive. Descarga cuando el proveedor tiene datos más
recientes, sube cuando local es más reciente. Primera sync siempre descarga
(`ultimaSync = 0`). Descarga atómica con rollback si el descifrado falla por
master password distinta. También corrige deuda técnica DT-1 (`ultimaModificacion()`
sin invalidación de fileId).

**Commit:** `071391d` — `fix(sync): reemplaza upload-only por sync bidireccional LWW en PWA`

---

### BUG-2 — Service Worker sirve versión cacheada al primer load ✅ RESUELTO

**Síntoma:** Después de un deploy nuevo, el primer load puede servir la versión anterior de la app desde el caché del SW en lugar de la nueva. Requiere forzar recarga (Ctrl+Shift+R / Cmd+Shift+R) o limpiar el caché.

**Causa raíz confirmada:** `revision: '1'` hardcodeada en los 16 entries de `precacheAndRoute`. Workbox usa la revision como clave de caché — al no cambiar entre deploys, el nuevo SW reutilizaba las entradas del caché anterior y nunca refetcheaba los assets actualizados. El problema persistía incluso después de que el usuario hacía click en "Actualizar ahora".

**Nota sobre diagnóstico:** El mecanismo `skipWaiting()` + banner de "Nueva versión disponible" ya estaba implementado correctamente en `main` vía `fix/sw-update-flow`. El bug real era la invalidación de caché, no la activación del SW.

**Solución implementada:**
- `web/service-worker.js`: constante `SW_DEPLOY_ID = 'dev'` + todos los nombres de caché y `revision` la usan. Listener `activate` limpia cachés de deploys anteriores.
- `.github/workflows/deploy-pwa.yml`: paso que inyecta los primeros 7 chars del commit SHA como `SW_DEPLOY_ID` antes de cada deploy a Cloudflare Pages.

**Resultado:** Cada deploy genera nombres de caché únicos → Workbox refetchea todos los assets → usuarios reciben la versión correcta tras confirmar la actualización.

---

## Deploy activo

| Entorno | URL |
|---------|-----|
| **Preview / Staging** | https://dacmos-pm-pwa.pages.dev |
| **Producción** | https://dpm.dacmosgroup.co ✅ |

---

## Bugs conocidos post-release

### BUG-1 — Vault vacío después de sync BYOC ✅ RESUELTO

Ver sección completa arriba con causa raíz, solución y commit.

### BUG-2 — Service Worker sirve versión cacheada al primer load ✅ RESUELTO

Ver sección completa arriba con causa raíz, solución y archivos modificados.

---

### BUG-3 — Sync Chrome Extension ↔ PWA falla por sales incompatibles

**Síntoma:** Al intentar sincronizar entre la extensión Chrome y la PWA usando
Google Drive, el sync devuelve el error `SYNC_MASTER_PASSWORD_MISMATCH` aunque
la master password sea idéntica en ambas instalaciones.

**Causa probable:** Las sales (`sal` y `sal2`) son únicas por instalación y se
generan aleatoriamente en `configurarVault()`. La extensión y la PWA generan sus
propias sales al configurarse de forma independiente. PBKDF2 con la misma password
pero sales distintas produce claves AES distintas — el vault cifrado con la clave
de la extensión no puede descifrarse con la clave derivada en la PWA.

**Escenario afectado:** Usuario con extensión Chrome existente (vault configurado
y en Drive) que instala la PWA por primera vez y crea un nuevo vault desde cero.
Al conectar Drive y sincronizar, la PWA descarga el vault de la extensión e
intenta descifrarlo con su propia clave derivada — falla con
`SYNC_MASTER_PASSWORD_MISMATCH`. La operación hace rollback sin pérdida de datos.

**Impacto:** Alto — el objetivo principal de v0.4.0 (acceso multi-dispositivo
Extension↔PWA) no funciona en el escenario más común. El usuario ve el mensaje
"El vault en el proveedor fue creado con una contraseña diferente" aunque la
contraseña sea la misma.

**Estado:** Pendiente diagnóstico en próxima sesión.

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
