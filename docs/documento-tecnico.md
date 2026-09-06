# 🔐 Documento Técnico — Dacmos Password Manager

**Baseline 0.6.x · Última actualización 2026-09-06 (§30 — Backlog H-5)**
**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**

> Este documento describe las decisiones de arquitectura, estándares de seguridad
> y diseño técnico del Dacmos Password Manager. Está orientado a desarrolladores,
> auditores de seguridad y a la audiencia técnica de DacmosGroup.

---

## Tabla de Contenido

1. [Visión General](#1-visión-general)
2. [Modelo de Seguridad Zero-Knowledge](#2-modelo-de-seguridad-zero-knowledge)
3. [Arquitectura de la Extensión](#3-arquitectura-de-la-extensión)
4. [Motor de Cifrado](#4-motor-de-cifrado)
5. [Gestión de Claves](#5-gestión-de-claves)
6. [Almacenamiento y Sesiones](#6-almacenamiento-y-sesiones)
7. [Autocompletado — Arquitectura de Seguridad](#7-autocompletado)
8. [Generador de Contraseñas](#8-generador-de-contraseñas)
9. [Decisiones Técnicas Documentadas](#9-decisiones-técnicas)
10. [Superficie de Ataque y Mitigaciones](#10-superficie-de-ataque)
11. [Roadmap Técnico](#11-roadmap-técnico)
12. [Sincronización BYOC](#12-sincronización-byoc)
13. [Formato Canónico Versionado del Blob](#13-formato-canónico-versionado-del-blob)
14. [Decisiones de Implementación — F4.7](#14-decisiones-de-implementación--f47)
15. [Arquitectura Sync Per-Item](#15-arquitectura-sync-per-item)
16. [Decisiones de Implementación — F4.3](#16-decisiones-de-implementación--f43)
17. [Decisiones de Implementación — F4.4 + F4.5](#17-decisiones-de-implementación--f44--f45)
18. [Decisiones de Implementación — F4.6](#18-decisiones-de-implementación--f46)
19. [Decisiones de Implementación — BUG-1](#19-decisiones-de-implementación--bug-1)
20. [Decisiones de Implementación — BUG-2](#20-decisiones-de-implementación--bug-2)
21. [Auditoría Profunda — Hallazgos v0.4.1 / v0.4.2](#21-auditoría-profunda--hallazgos-v041--v042)
22. [Decisiones de Implementación — v0.4.2](#22-decisiones-de-implementación--v042)
23. [Versionado por superficie](#23-versionado-por-superficie)
24. [Decisiones de Sesión — v0.5.0 Replanificación Estratégica](#24-decisiones-de-sesión--v050-replanificación-estratégica)
25. [Decisiones de Implementación — F5-A (Auto-lock PWA)](#25-decisiones-de-implementación--f5-a)
26. [Decisiones de Implementación — F5-B (i18n ES/EN/PT-BR)](#26-decisiones-de-implementación--f5-b)
27. [Referencias](#27-referencias)
28. [Decisiones de Implementación — v0.5.1 (Saneamiento pre-v0.6.0)](#28-decisiones-de-implementación--v051-saneamiento-pre-v060)
29. [Decisiones de Implementación — v0.6.0 Capacitor Android-first](#29-decisiones-de-implementación--v060-capacitor-android-first)
30. [Decisiones de Implementación — H-5 (`_deviceId` en el vault, Sprint 2)](#30-decisiones-de-implementación--h-5-_deviceid-en-el-vault-sprint-2)

---

## 1. Visión General

Dacmos Password Manager es una extensión Chrome construida con **Manifest V3** que implementa un gestor de contraseñas con modelo **Zero-Knowledge local-first**. A partir de v0.4.0, el mismo vault es accesible desde mobile mediante una **Progressive Web App (PWA)**. v0.5.0 añade auto-lock timer e i18n ES/EN/PT-BR. v0.6.0 empaqueta la PWA como app nativa via Capacitor.

### Principios de diseño

| Principio | Implementación |
|-----------|---------------|
| Zero-Knowledge | Cifrado/descifrado siempre en el cliente |
| Mínimo privilegio | Permisos declarados al mínimo necesario |
| Sin dependencias externas | Web Crypto API nativa, sin librerías de crypto |
| Defensa en profundidad | Múltiples capas de protección |
| Transparencia | Código fuente completamente abierto |

### Stack tecnológico

```
Chrome Extension (v0.1.1+):
├── Plataforma:     Chrome Extension Manifest V3
├── Lenguaje:       JavaScript (ES Modules)
├── Crypto:         Web Crypto API (nativa del browser)
├── Almacenamiento: chrome.storage.local / chrome.storage.session
└── UI:             HTML5 + CSS3 (Vanilla — sin frameworks)

PWA Mobile (v0.4.0+):
├── Plataforma:     Progressive Web App
├── Lenguaje:       JavaScript (ES Modules — mismo código)
├── Crypto:         Web Crypto API (crypto.subtle — idéntica)
├── Almacenamiento: IndexedDB (reemplazo de chrome.storage.local)
└── Despliegue:     Cloudflare Pages (dpm.dacmosgroup.co)

App Nativa (v0.6.0+):
├── Plataforma:     Capacitor v8 (Android v0.6.0 · iOS v0.6.1+)
├── Crypto:         crypto.subtle en WKWebView / Chromium WebView (idéntica a PWA)
├── Seguro nativo:  DpmKeyPlugin — BiometricPrompt.CryptoObject / Secure Enclave
└── Distribución:   Google Play Store (v0.6.0) · App Store (v0.6.1+)
```

### Versiones actuales por plataforma

| Plataforma | Versión | Notas |
|------------|---------|-------|
| **PWA** (`dpm.dacmosgroup.co`) | **v0.4.2** | Versión activa — incluye remediaciones de auditoría (Fases 1 y 2) |
| **Chrome Extension** (Chrome Web Store) | **v0.3.1** | Ciclo de release independiente — próximo release será v0.4.0 CWS con remediaciones de Fase 2 |
| **APK Android** (GitHub Releases + IzzyOnDroid) | **v0.4.2** | Generado via TWA — sigue la versión de la PWA |

> **Nota:** La Chrome Extension y la PWA comparten el motor de cifrado (`engine.js`) pero tienen cadencias de release separadas. Un vault creado con la extensión v0.3.1 es plenamente compatible con la PWA v0.4.2 (backward compat garantizada — ver Sección 13).

### Decisiones técnicas F4.1

Tres hallazgos durante la implementación y deploy de F4.1 que no son obvios
y deben recordarse en features posteriores:

#### CSP: `script-src` vs `worker-src` para `importScripts()`

Las directivas CSP tienen responsabilidades distintas para Service Workers:

| Directiva | Controla |
|-----------|----------|
| `worker-src` | La URL desde la que se **registra** el SW (`navigator.serviceWorker.register()`) |
| `script-src` | Los scripts que el SW carga via **`importScripts()`** |

Consecuencia: cargar Workbox desde CDN via `importScripts()` requiere que
`https://storage.googleapis.com` esté en **`script-src`**, no solo en `worker-src`.
Un `script-src 'self'` estricto sin esta excepción provoca "ServiceWorker script
evaluation failed" aunque `worker-src` sea permisivo.

La CSP correcta para esta PWA:
```
script-src 'self' https://storage.googleapis.com;
worker-src 'self' https://storage.googleapis.com;
```

#### Íconos SVG en el Web App Manifest: usar `"sizes": "any"`

SVG es un formato vectorial — no tiene dimensiones raster fijas. Declarar
`"sizes": "192x192"` en un ícono `image/svg+xml` hace que el navegador intente
validar dimensiones de píxeles que no existen en el formato, produciendo
"resource isn't a valid image". El valor correcto para cualquier ícono SVG es:

```json
{ "sizes": "any", "type": "image/svg+xml" }
```

Para Lighthouse PWA installability score, eventualmente se requieren PNGs
(al menos 192×192). Los SVGs con `"any"` resuelven el error de validación
pero no satisfacen completamente el criterio de instalabilidad de Chrome.

#### `apple-mobile-web-app-capable` deprecada desde iOS 17

Apple deprecó `<meta name="apple-mobile-web-app-capable" content="yes">` en
Safari 17 (iOS 17, septiembre 2023). El modo standalone en iOS 15.4+ lo
gestiona el Web App Manifest con `display: standalone`.

Implicación: `apple-mobile-web-app-status-bar-style` también pierde efecto
sin la meta tag que la activa. El reemplazo moderno es `viewport-fit=cover`
en el viewport + `env(safe-area-inset-*)` en CSS para manejar el notch y la
Dynamic Island correctamente (se implementa en F4.4 con la UI real).

---

## 2. Modelo de Seguridad Zero-Knowledge

### ¿Qué es Zero-Knowledge?

En criptografía, un sistema Zero-Knowledge garantiza que el proveedor del servicio **no puede acceder a los datos del usuario**, incluso si quisiera hacerlo. La clave para descifrar los datos nunca abandona el dispositivo del usuario.

### Comparación de modelos

| Modelo | Descripción | Ejemplo |
|--------|-------------|---------|
| **Cloud con acceso** | El proveedor puede ver tus datos | Contraseñas en texto plano en servidor |
| **Cloud cifrado por servidor** | El proveedor cifra pero tiene la clave | La mayoría de gestores SaaS |
| **Zero-Knowledge** | Solo el usuario tiene la clave | DacmosGroup, Bitwarden, 1Password |
| **Local-first** | Los datos nunca salen del dispositivo | DacmosGroup v0.1.1 |

### Garantías del modelo

1. **DacmosGroup no puede leer tus contraseñas** — no existen servidores que almacenen datos
2. **Un atacante que acceda al storage** encontrará únicamente datos cifrados con AES-256-GCM
3. **Un atacante que intercepte el tráfico** no encontrará credenciales — no hay tráfico de datos
4. **La contraseña maestra nunca se almacena** — ni en texto plano ni como hash reversible

### Flujo de datos

```
[Usuario ingresa Master Password]
         │
         ▼
[PBKDF2-SHA256 × 600,000 iteraciones + Salt]
         │
         ▼
[Clave AES-256 → SOLO EN MEMORIA RAM]
         │
         ├──► [Cifrar vault] ──► [chrome.storage.local / IndexedDB ← solo datos cifrados]
         │
         └──► [Descifrar vault] ──► [Credenciales en memoria durante sesión]
                                              │
                          ┌───────────────────┴────────────────────────┐
                          ▼                                             ▼
               [Chrome Extension]                               [PWA Mobile]
         [chrome.storage.session]                     [Variables de módulo JS]
         Persiste en ciclos sleep/wake del SW;         session.js — RAM pura;
         se borra al cerrar el browser.                se borra al cerrar la tab.
         (No confundir con sessionStorage Web API)     Sin escritura en ningún storage.
```

---

## 3. Arquitectura de la Extensión

### Componentes principales

```
dacmosgroup-password-manager/
├── manifest.json              ← Declaración de permisos y puntos de entrada
├── src/                       ← Chrome Extension
│   ├── background/
│   │   └── service-worker.js  ← Gestión de estado, mensajes, autolock
│   ├── content/
│   │   └── autofill.js        ← Inyectado en páginas web — detección y autocompletado
│   ├── crypto/
│   │   └── engine.js          ← Motor AES-256-GCM + PBKDF2 (núcleo de seguridad)
│   ├── sync/
│   │   ├── storage-adapter.js       ← Interfaz base (clase abstracta)
│   │   ├── google-drive-adapter.js  ← Adaptador Google Drive
│   │   ├── onedrive-adapter.js      ← Adaptador OneDrive
│   │   └── sync-manager.js          ← Orquestador de sincronización
│   └── ui/
│       ├── popup/             ← Punto de entrada — estado del vault
│       ├── vault/             ← CRUD de credenciales
│       ├── settings/          ← Configuración y gestión de master password
│       ├── health/            ← Password Health Reports
│       └── generator/         ← Generador criptográfico de contraseñas
├── web/                       ← PWA Mobile (v0.4.0+)
│   ├── src/
│   │   ├── crypto/            ← engine.js reutilizado (sin cambios de lógica)
│   │   ├── storage/           ← IndexedDB adapter + persistence manager
│   │   ├── auth/              ← OAuth PKCE (Google + Microsoft)
│   │   ├── sync/              ← Adaptadores fork de src/sync/
│   │   └── ui/                ← UI responsive (misma lógica, CSS adaptado)
│   ├── manifest.json          ← Web App Manifest (PWA)
│   └── service-worker.js      ← Workbox — cache offline
├── docs/
│   ├── decisions/             ← Architectural Decision Records (ADRs)
│   └── *.md                   ← Documentación del proyecto
└── assets/
    └── icons/                 ← Íconos de la extensión
```

### Flujo de comunicación entre componentes

```
[Página Web]
     │  (mensajes chrome.runtime)
     ▼
[Content Script: autofill.js]
     │  (chrome.runtime.sendMessage)
     ▼
[Service Worker: service-worker.js]
     │  (chrome.storage.session)
     ▼
[Credenciales descifradas en sesión]

[UI: popup/vault/settings/health/generator]
     │  (import directo — ES Modules)
     ▼
[Motor de cifrado: engine.js]
     │  (chrome.storage.local / IndexedDB en PWA)
     ▼
[Vault cifrado en disco]
```

### Manifest V3 — Implicaciones de seguridad

Manifest V3 introduce restricciones importantes respecto a V2:

| Característica | V2 | V3 | Impacto en seguridad |
|---------------|----|----|---------------------|
| Background script | Persistente | Service Worker (efímero) | ✅ Mejor — el estado en memoria se limpia |
| Eval() | Permitido | Bloqueado | ✅ Mejor — previene inyección de código |
| Recursos remotos | Permitidos | Bloqueados | ✅ Mejor — sin carga de scripts externos |
| Content Security Policy | Flexible | Estricta | ✅ Mejor — `script-src 'self'` obligatorio |

---

## 4. Motor de Cifrado

El motor de cifrado está implementado en `src/crypto/engine.js` usando exclusivamente la **Web Crypto API nativa** del browser. No se utilizan librerías de terceros. En la PWA (v0.4.0+), el mismo motor opera via `crypto.subtle` del browser mobile — sin cambios de lógica.

### AES-256-GCM

**AES** (Advanced Encryption Standard) con clave de **256 bits** en modo **GCM** (Galois/Counter Mode).

```
Parámetros:
├── Algoritmo:   AES-GCM
├── Clave:       256 bits (32 bytes)
├── IV:          96 bits (12 bytes) — generado aleatoriamente por operación
└── Auth Tag:    128 bits (automático en GCM)
```

**¿Por qué AES-256-GCM y no otras alternativas?**

| Algoritmo | Autenticación | Rendimiento | Estado |
|-----------|--------------|-------------|--------|
| AES-256-GCM | ✅ AEAD | ✅ Muy alto | ✅ Recomendado NIST |
| AES-256-CBC | ❌ No incluida | ✅ Alto | ⚠️ Requiere MAC adicional |
| ChaCha20-Poly1305 | ✅ AEAD | ✅ Alto en software | ✅ Alternativa válida |
| AES-128-GCM | ✅ AEAD | ✅ Muy alto | ⚠️ Menor margen de seguridad |

**GCM (Galois/Counter Mode)** es un modo AEAD (Authenticated Encryption with Associated Data) que garantiza simultáneamente:
- **Confidencialidad** — los datos no pueden leerse sin la clave
- **Integridad** — cualquier modificación del ciphertext es detectable
- **Autenticación** — confirma que los datos provienen de quien tiene la clave

### Implementación del cifrado

```javascript
async function cifrar(datos, clave) {
  // IV único por operación — CRÍTICO para la seguridad de GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const datosCifrados = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    clave,
    stringABuffer(JSON.stringify(datos))
  );

  // El IV se almacena junto al ciphertext — no es secreto
  return {
    iv:    bufferABase64(iv.buffer),
    datos: bufferABase64(datosCifrados),
  };
}
```

> **Decisión de seguridad crítica:** El IV (Initialization Vector) debe ser único por cada operación de cifrado con la misma clave. Reutilizar un IV rompe completamente la seguridad de GCM. Por eso generamos un IV aleatorio en cada cifrado usando `crypto.getRandomValues()`.

---

## 5. Gestión de Claves

### PBKDF2 — Derivación de la clave maestra

**PBKDF2** (Password-Based Key Derivation Function 2) convierte la contraseña maestra del usuario en una clave criptográfica de 256 bits.

```
Parámetros:
├── Función hash:   SHA-256
├── Iteraciones:    600,000
├── Salt:           256 bits (32 bytes) — aleatorio, único por vault
└── Longitud clave: 256 bits (para AES-256)
```

**¿Por qué 600,000 iteraciones?**

OWASP 2024 recomienda mínimo 600,000 iteraciones de PBKDF2-SHA256. Cada iteración adicional aumenta el costo computacional de un ataque de fuerza bruta:

```
Tiempo de derivación en hardware moderno (~1 segundo):
├── Usuario legítimo:  ~1 segundo por unlock — aceptable
└── Atacante:          ~1 segundo por intento × millones de intentos = inviable

En mobile (dispositivo gama media):
└── ~200–350ms — aceptable y consistente con experiencia de usuario
```

| Año | OWASP Recomendación PBKDF2-SHA256 |
|-----|----------------------------------|
| 2021 | 310,000 iteraciones |
| 2023 | 480,000 iteraciones |
| 2024 | 600,000 iteraciones ← usamos este |

### Sistema de doble sal

El vault usa **dos sales independientes** para funciones diferentes:

```
sal  → Derivar clave de CIFRADO del vault
sal2 → Derivar clave de VERIFICACIÓN (token de desbloqueo)
```

Esta separación garantiza que comprometer la verificación no compromete el cifrado:

```javascript
// sal: para cifrar/descifrar el vault
const clave = await derivarClave(password, sal);

// sal2: para verificar la contraseña sin descifrar todo el vault
const claveVerif = await derivarClave(password, sal2);
const token = await descifrarConVersion(tokenVerificacion, claveVerif); // dispatch por versión desde v0.4.0
// Si falla → contraseña incorrecta, sin exponer el vault
```

### Ciclo de vida de la clave

```
[Master Password ingresado]
        │
        ▼
[PBKDF2 → Clave AES en memoria RAM]
        │
        ├── Vault desbloqueado → clave permanece en memoria
        │
        ├── Inactividad (X minutos) → chrome.alarms → clave eliminada
        │
        ├── Clic "Bloquear" → clave eliminada inmediatamente
        │
        └── Cierre del browser → memoria liberada automáticamente

La clave NUNCA:
├── Se escribe en chrome.storage.local / IndexedDB
├── Se serializa en JSON
├── Se transmite por red
└── Se loguea en consola
```

### Biometría en Capacitor (v0.5.0+) — patrón Zero-Knowledge

En la app nativa Capacitor, la biometría no reemplaza la contraseña maestra
— la envuelve de forma segura para desbloqueos subsecuentes:

```
Primera vez:
  Contraseña maestra → PBKDF2 → vault_key (en memoria)
  Secure Enclave (iOS) / Keystore StrongBox (Android) genera wrap_key
  AES-GCM(vault_key, wrap_key) → guardado en Keychain/Keystore
  La contraseña maestra nunca se almacena

Desbloqueos con biometría:
  Face ID / Fingerprint → autenticar con BiometricPrompt.CryptoObject
  → recuperar wrap_key del hardware → descifrar vault_key → vault abierto

Invalidación automática:
  Nueva huella registrada → wrap_key invalidada → pedir contraseña maestra
```

---

## 6. Almacenamiento y Sesiones

### Chrome Extension — chrome.storage.local

Almacena únicamente datos cifrados:

```javascript
{
  vaultConfigurado:    Boolean,     // ¿Existe un vault configurado?
  sal:                 Base64,      // Salt para derivación de clave de cifrado
  sal2:                Base64,      // Salt para derivación de clave de verificación
  tokenVerificacion:   { iv, datos }, // Token cifrado para verificar master password
  vaultCifrado:        { __version, kdf, kdfIterations, iv, datos }, // Vault completo
  sesionActiva:        Boolean,     // Estado de la sesión (no datos sensibles)
  config:              Object,      // Configuración de usuario (autolock, clipboard)
}
```

### PWA Mobile — IndexedDB

Mismo formato de datos que la extensión Chrome — solo cambia el mecanismo de persistencia:

```javascript
// Database: 'dacmos-pm', Object Store: 'vault'
// Clave: string, Valor: mismo formato que chrome.storage.local
{
  'vaultConfigurado':  Boolean,
  'sal':               Base64,
  'sal2':              Base64,
  'tokenVerificacion': { iv, datos },
  'vaultCifrado':      { __version, kdf, kdfIterations, iv, datos },
  'config':            Object,
}
```

> **Nota:** `sesionActiva` no se persiste en IndexedDB — se mantiene en memoria durante la sesión PWA.

### chrome.storage.session / sessionStorage — Datos de sesión

Almacena credenciales descifradas durante la sesión activa:

```javascript
{
  credencialesSesion: Array  // Credenciales en claro — SOLO durante sesión activa
}
```

**Propiedades de seguridad:**
- Se borra automáticamente al cerrar el browser / pestaña
- No persiste entre reinicios
- Solo accesible por la extensión / origen que lo creó
- Se limpia explícitamente al bloquear el vault

### Estrategia de limpieza de datos sensibles

```javascript
async function bloquearVault() {
  // 1. Cancelar alarma de autolock
  chrome.alarms.clear('autoLock');

  // 2. Limpiar credenciales de sesión
  await chrome.storage.session.clear(); // Extensión Chrome
  // En PWA: limpiarSesion() de session.js — borra variables de módulo en RAM.
  // No hay sessionStorage.clear() — la PWA no escribe credenciales en sessionStorage.

  // 3. Marcar sesión como inactiva
  chrome.storage.local.set({ sesionActiva: false });

  // 4. Actualizar badge
  chrome.action.setBadgeText({ text: '' });

  // 5. Notificar a todas las pestañas
  chrome.tabs.query({}, tabs =>
    tabs.forEach(tab =>
      chrome.tabs.sendMessage(tab.id, { tipo: 'VAULT_BLOQUEADO' })
    )
  );
}
```

### Schema canónico de credencial (documentado en v0.5.1)

> Añadido en v0.5.1 (hallazgo M-5 de la auditoría v0.5.0): la ausencia de un
> schema documentado fue la causa raíz de que el campo TOTP se implementara con
> dos nombres distintos entre superficies (`claveTotp` en Extension, `totp` en PWA).

Cada credencial del array `credenciales` (dentro del vault cifrado) sigue este
schema canónico:

```javascript
{
  id:         string,   // UUID v4 — inmutable tras creación
  tipo:       string,   // 'login' | 'tarjeta' | 'identidad'
  sitio:      string,   // nombre visible
  url:        string,   // para URL matching en autofill
  usuario:    string,
  password:   string,
  totp:       string,   // secreto TOTP Base32 (RFC 6238). Campo canónico. Opcional.
  notas:      string,
  creado:     string,   // ISO 8601
  modificado: string,   // ISO 8601
}
```

Los tipos `tarjeta` e `identidad` reemplazan los campos de login por sus propios
campos (`numero`/`titular`/`vencimiento`/`cvv` y `nombre`/`email`/`telefono`/…
respectivamente), gestionados en `credential-types.js`.

**Migración TOTP `claveTotp` → `totp`:** vaults creados en la Extension pre-v0.5.1
pueden tener `claveTotp`. El módulo `credential-schema.js` normaliza al cargar
(`normalizarTOTP`) con convergencia lazy: el primer unlock post-actualización
persiste el campo canónico y descarta el legacy. No requiere bump de
`BLOB_VERSION` — es migración a nivel de schema de aplicación, no del envelope
criptográfico. Ver §28.

---

## 7. Autocompletado

El autocompletado es el componente más complejo desde el punto de vista de seguridad porque requiere comunicación entre contextos de diferente nivel de confianza.

### Arquitectura de seguridad del autocompletado

```
[Página web — contexto NO confiable]
        │
        │  (1) Detecta campo password
        │  (2) Inyecta ícono 🔐
        │  (3) Usuario hace clic
        ▼
[Content Script: autofill.js — contexto AISLADO]
        │
        │  chrome.runtime.sendMessage({ tipo: 'SOLICITAR_AUTOCOMPLETADO' })
        ▼
[Service Worker — contexto CONFIABLE]
        │
        │  Consulta chrome.storage.session
        │  Filtra por dominio
        ▼
[Credenciales filtradas → Content Script]
        │
        │  Llena campos del formulario
        ▼
[Página web recibe valores — sin acceso a la clave]
```

### Selección del campo password objetivo

En formularios con múltiples campos password (ej. "Create password" + "Confirm password"),
el autofill prioriza siempre el **primer** campo password válido del formulario:

```javascript
// Correcto — for...of con break garantiza que el primer campo gana
for (const campoPass of camposPassword) {
  if (!esFormularioLogin(form, campoPass)) continue
  camposDetectados.password = campoPass
  break  // Primer campo válido — no procesar campos siguientes
}
```

> **Decisión técnica:** El patrón `forEach` con `return` actúa como `continue`,
> no como `break`. Causa: el último campo sobreescribe al primero. Corregido en v0.3.1.

### Aislamiento de contextos

Chrome Extension Manifest V3 garantiza que el content script y la página web operan en **mundos JavaScript separados**:

- La página web no puede acceder a las variables del content script
- El content script no puede acceder a las variables de la página web (solo al DOM)
- El service worker no es accesible desde la página web

### Detección de formularios de login

El content script usa heurísticas para identificar formularios de login:

```javascript
// Criterios de detección (en orden de confiabilidad):
1. Presencia de input[type="password"] — indicador más fuerte
2. Texto del formulario contiene palabras clave: login, signin, auth...
3. Un solo campo password en el formulario (login vs registro)
4. Atributos autocomplete="username" / autocomplete="email"
```

### MutationObserver para SPAs

Las aplicaciones modernas (React, Vue, Angular) modifican el DOM dinámicamente. El content script usa `MutationObserver` para detectar nuevos campos:

```javascript
const observer = new MutationObserver((mutations) => {
  const hayNuevosCampos = mutations.some(m =>
    Array.from(m.addedNodes).some(n =>
      n.querySelector?.('input[type="password"]')
    )
  );
  if (hayNuevosCampos) setTimeout(detectarCamposLogin, 500);
});

observer.observe(document.body, { childList: true, subtree: true });
```

---

## 8. Generador de Contraseñas

### Rejection Sampling — Eliminación de sesgo estadístico

El generador usa el método de **rechazo** para evitar sesgo al mapear bytes aleatorios a caracteres:

**El problema con módulo simple:**
```javascript
// ❌ INCORRECTO — introduce sesgo estadístico
const char = alphabet[randomByte % alphabet.length];
```

**La solución con rejection sampling:**
```javascript
// ✅ CORRECTO — sin sesgo
const limite = 256 - (256 % alphabet.length);

for (const byte of randomBytes) {
  if (byte < limite) {
    result.push(alphabet[byte % alphabet.length]);
  }
  // Rechazar bytes >= limite (los que causarían sesgo)
}
```

### Cálculo de entropía

```
H = L × log₂(N)

Donde:
  H = entropía en bits
  L = longitud de la contraseña
  N = tamaño del alfabeto

Ejemplos:
  16 chars, alfabeto 90 (mayús+minús+núm+símb): H = 16 × log₂(90) ≈ 103 bits
  12 chars, solo letras (52):                   H = 12 × log₂(52)  ≈  68 bits
  8 chars, solo números (10):                   H = 8  × log₂(10)  ≈  27 bits
```

**Referencias de seguridad:**
- NIST SP 800-63B: mínimo 80 bits para contraseñas de alta seguridad
- 100+ bits: resistente a ataques de fuerza bruta con hardware especializado
- 128+ bits: resistente a ataques cuánticos (con algoritmos actuales)

### Garantía de inclusión de tipos

El generador garantiza que la contraseña incluya al menos un carácter de cada tipo activado, usando Fisher-Yates shuffle con `crypto.getRandomValues()`:

```javascript
// 1. Generar contraseña base con rejection sampling
// 2. Forzar inclusión de un carácter de cada tipo si falta
// 3. Mezclar con Fisher-Yates para que los caracteres forzados
//    no queden siempre al inicio
```

---

## 9. Decisiones Técnicas

### ¿Por qué Web Crypto API y no librerías como CryptoJS?

| Criterio | Web Crypto API | CryptoJS / Forge |
|---------|---------------|-----------------|
| Implementación | Nativa del browser (C++) | JavaScript puro |
| Auditoría | Google, Mozilla, Apple | Comunidad open source |
| Rendimiento | Hardware-accelerated | Software |
| Dependencias | Ninguna | npm packages |
| Superficie de ataque | Mínima | Dependencias transitivas |
| Supply chain risk | Ninguno | Alto (compromiso npm) |

> Un ataque de supply chain en una librería de crypto podría comprometer TODOS los vaults de todos los usuarios. Web Crypto API elimina este riesgo completamente. En mobile, `crypto.subtle` está disponible en WKWebView (iOS) y Chromium WebView (Android) — no se necesita ninguna librería nativa adicional.

### ¿Por qué PWA → Capacitor y no React Native?

Ver `docs/decisions/ADR-001-stack-mobile.md` para el análisis completo. Resumen:

| Criterio | React Native + Expo | PWA → Capacitor |
|---------|--------------------|--------------------|
| PBKDF2 600k nativo | ❌ expo-crypto no lo soporta | ✅ crypto.subtle nativo |
| Reutilización engine.js | 30–50% | 85–95% |
| Biometría segura | ⚠️ bypass via Frida (#14456) | ✅ módulo nativo propio |
| Compatibilidad vault | Parcial | Bit-exacta |
| Costo año 1 | $134–367 | $10–15 |

### ¿Por qué Manifest V3 y no V2?

Manifest V3 ofrece ventajas de seguridad significativas:
- **Service Workers efímeros** — el estado sensible en memoria se limpia automáticamente
- **Sin eval()** — imposible inyectar código malicioso en runtime
- **CSP estricta** — `script-src 'self'` previene carga de scripts externos
- **Declarative Net Request** — mejor control de red

### ¿Por qué chrome.storage.session y no variables globales?

Las variables globales en el service worker se pierden cuando el service worker se "duerme" (cada 30 segundos de inactividad en MV3). `chrome.storage.session` persiste durante toda la sesión del browser, sobreviviendo los ciclos de sleep/wake del service worker.

### ¿Por qué chrome.alarms y no setTimeout para autolock?

```javascript
// ❌ setTimeout — no funciona en Service Workers MV3
setTimeout(() => bloquear(), 5 * 60 * 1000);
// El service worker se duerme a los 30 segundos
// El setTimeout se cancela silenciosamente

// ✅ chrome.alarms — persiste aunque el service worker esté dormido
chrome.alarms.create('autoLock', { delayInMinutes: 5 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'autoLock') bloquear();
});
```

### ¿Por qué dos sales y no una?

Con una sola sal, verificar la contraseña requeriría intentar descifrar el vault completo, exponiendo los datos en caso de timing attack. Con dos sales independientes:

1. `sal` → clave de cifrado del vault (datos reales)
2. `sal2` → clave de verificación (token conocido)

La verificación falla rápido con contraseña incorrecta sin exponer el vault.

---

## 10. Superficie de Ataque y Mitigaciones

### Vectores de ataque considerados

| Vector | Riesgo | Mitigación |
|--------|--------|-----------|
| Robo de chrome.storage.local / IndexedDB | Alto | Todos los datos están cifrados con AES-256-GCM |
| Fuerza bruta en master password | Alto | PBKDF2-SHA256 × 600,000 iteraciones |
| Inyección XSS en vault UI | Medio | `escapeHtml()` centralizada en `web/src/utils/escape.js` e importada en todas las vistas PWA con innerHTML sobre datos de usuario (vault, credential-form, generator, health) |
| Content script malicioso | Medio | Aislamiento de contextos MV3 |
| Supply chain (librerías) | Alto | Sin dependencias de crypto de terceros |
| Biometría bypasseable en mobile | Alto | BiometricPrompt.CryptoObject obligatorio (v0.5.0+) |
| Eviction de datos iOS Safari | Medio | navigator.storage.persist() + sync BYOC como red de seguridad |
| Prompt injection | Bajo | No hay procesamiento de texto no confiable |
| Timing attack en verificación | Bajo | Verificación por descifrado (AES-GCM falla uniformemente) |
| Exposición en portapapeles | Medio | Limpieza automática configurable (default: 30 segundos) |
| Session hijacking (Extensión) | Bajo | chrome.storage.session accesible solo por la extensión — aislamiento MV3 |
| Tokens OAuth en sessionStorage (PWA) | Bajo | MSAL almacena tokens de Microsoft en sessionStorage — aislado por origen, no cifrado por el API; el cifrado es del perfil del browser en disco. Tokens de Google viven en memoria pura (nunca en storage). |
| refresh_token OneDrive en `chrome.storage.local` (Extension) | Bajo | El adapter OneDrive de la Extension persiste un `refreshToken` de larga vida en `chrome.storage.local` (sin cifrar), que sobrevive al reinicio del browser. Mitigación: `chrome.storage.local` está aislado por extensión (MV3); extraerlo requiere acceso al perfil del SO. Contraste: el adapter Google mantiene el token solo en memoria. Documentado en v0.5.1 (hallazgo B-1). Evaluación de Capacitor Keychain diferida a v0.6.0. |
| XSS en PWA | Medio | La PWA no tiene el aislamiento MV3 de múltiples contextos. Un XSS exitoso en `dpm.dacmosgroup.co` podría acceder a las variables de `session.js`. Mitigaciones: CSP sin `unsafe-inline`/`unsafe-eval` (desde v0.4.1), `escapeHtml()` centralizada en módulo compartido aplicada en todas las vistas, sin `eval()`. Permiso `activeTab` eliminado del manifest (v0.4.2, superficie reducida). |
| Cambio de master password concurrente | Bajo | Flag `_cambioEnProgreso` (módulo) en ambos engines previene re-entrada en `cambiarMasterPassword()`; liberado en `finally` para evitar bloqueo permanente. |
| Service Worker comprometido (PWA) | Medio | Un SW interceptor puede servir assets modificados a todos los clientes de ese origen. Mitigaciones: HTTPS obligatorio en Cloudflare Pages, SW servido desde el mismo origen (`'self'`), `worker-src` restringida en CSP, Workbox fijado a versión exacta (`7.0.0`). |

### Limitaciones conocidas

1. **Sin protección contra keyloggers** — si el dispositivo está comprometido a nivel de SO, la master password puede capturarse al ingresarse
2. **Sin protección contra extensiones maliciosas** — otras extensiones con permisos elevados podrían leer `chrome.storage.local`
3. **Dependencia del modelo de seguridad de Chrome** — vulnerabilidades en Chrome podrían afectar el aislamiento de contextos
4. **Sin 2FA para el vault** — no existe un segundo factor para desbloquear el vault en sí (el vault gestiona 2FA/TOTP de terceros)
5. **iOS Safari eviction** — datos locales pueden borrarse tras 7 días sin uso si el usuario no activa persistencia ni sync (mitigado en v0.4.0)
6. **Autofill no disponible en PWA iOS** — limitación estructural de Apple; se resuelve con autofill nativo en v0.6.0
7. **`sesionActiva` persistido puede no reflejar el estado real (extensión)** — `chrome.storage.local` puede conservar `sesionActiva: true` entre reinicios del browser, haciendo que la extensión aparezca desbloqueada sin haber verificado la master password en esa sesión. Sin impacto en seguridad — la clave AES en `chrome.storage.session` sí se limpia al reiniciar el browser. Comportamiento cosmético confuso para el usuario.
8. **Zona de Peligro ausente en PWA** — no existe UI de reset para usuarios bloqueados permanentemente (contraseña maestra olvidada). El workaround es borrar manualmente IndexedDB desde DevTools del browser. Eleva la prioridad de DT-3.

### Deudas técnicas identificadas — auditoría v0.4.0

| Deuda | Descripción | Impacto | Resolución |
|-------|-------------|---------|------------|
| `ultimaModificacion()` sin invalidación de fileId | `GoogleDriveAdapter.ultimaModificacion()` no invalida el fileId cacheado cuando Drive retorna 404 → el sync queda atascado en `DRIVE_404` si el archivo remoto se borra externamente (BUG-SYNC-404). | Medio — sync atascado, workaround: desconectar/reconectar | **PWA:** ✅ Resuelto en BUG-1 (commit `071391d`). **Extension:** ✅ Resuelto en v0.5.1 (F5.1-C) — el fix solo existía en el fork PWA; corregido el drift invertido. Ver §28. |
| Precache revision fields manuales | Los campos `revision` del precache en `web/service-worker.js` deben incrementarse manualmente por archivo al hacer deploy. Sin Workbox Inject Manifest no hay automatización. | Operacional — usuarios pueden usar assets desactualizados hasta que la cache expire (30 días TTL) | ✅ Resuelto en BUG-2 — `SW_DEPLOY_ID` inyectado por CI |
| Import desde setup (Caso 1 — vault vacío) | `importarVaultBackup()` maneja correctamente el Caso 1 (sin vault previo) pero no hay ruta UI que lo dispare — Settings requiere sesión activa. El código es correcto; falta la UX de "Restaurar backup" en la pantalla de setup inicial. | UX — el import solo funciona si el usuario ya tiene un vault configurado. **Prioridad elevada:** la ausencia de Zona de Peligro en la PWA deja sin ruta de escape a usuarios con contraseña olvidada. | v0.5.0 — pantalla de setup con opción de restauración |

### Bugs conocidos — pendientes de diagnóstico

| Bug | Síntoma | Causa probable | Impacto | Estado |
|-----|---------|----------------|---------|--------|
| BUG-3 | Sync Chrome Extension ↔ PWA devuelve `SYNC_MASTER_PASSWORD_MISMATCH` aunque la master password sea idéntica | Dos causas confirmadas: (1) AAD en AES-GCM — engine v0.3.1 no implementa `descifrarConVersion()`, el auth tag falla con blobs v1. (2) Sales incompatibles — los sync managers subían solo `vaultCifrado` sin sal/sal2/token; el destinatario no puede derivar la clave correcta. | Alto — el objetivo principal de v0.4.0 (multi-dispositivo Extension↔PWA) no funciona en el escenario más común | ✅ Resuelto en v0.4.2 — rama `fix/auditoria-remediaciones` (commit `b3edba4`) |

### Nota operativa de desarrollo

> **Nunca realizar pruebas de desarrollo con la extensión productiva activa en el
> mismo perfil de Chrome.** Las pruebas desde `localhost` comparten el mismo
> `chrome.storage.local` con la extensión instalada desde Chrome Web Store. Un
> ciclo de prueba puede sobrescribir el `vaultCifrado` real con datos de prueba —
> pérdida irreversible sin backup previo.
>
> **Solución:** usar un perfil de Chrome dedicado para desarrollo, o deshabilitar
> la extensión CWS durante las pruebas en `localhost`.

---

## 11. Roadmap Técnico

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 ✅  UX Polish — navegación, legibilidad, fixes autofill
v0.4.0 ✅  PWA — vault en mobile via navegador, APK Android via TWA
v0.4.1 ✅  Remediación auditoría de seguridad — 5 hallazgos corregidos (A-1, M-1..4, B-1..2)
v0.4.2 ✅  Remediación auditoría Fases 1+2 (C1-C4, A2-A5) + CSV import/export en PWA + BUG-3 sync salts
v0.5.0 ✅  Auto-lock PWA + i18n ES/EN/PT-BR (Extension + PWA)
v0.5.1 ✅  Saneamiento pre-v0.6.0 (TOTP canónico, BUG-SYNC-404, CSV injection, i18n wizard)
v0.6.0 ✅  Capacitor Android — DpmKeyPlugin biometría + Play Store (iOS → v0.6.1)
v0.7.0 ⏳  Autofill nativo — iOS Credential Provider + Android Autofill Service
v0.8.0 ⏳  Monetización — lifetime $29 + Stripe (cuando haya tracción medible)
v0.9.0 ⏳  Argon2id opcional + preparación auditoría
v1.0.0 ⏳  Auditoría Cure53 + App Store + Play Store público
```

### Fase 4 — PWA Mobile (v0.4.0)

La expansión mobile reutiliza el código JavaScript existente sin modificar la lógica de cifrado:

- `engine.js` y `totp.js` — **intactos, sin cambios**
- `crypto.subtle` en WKWebView / Chromium WebView — misma API que Chrome desktop
- `IndexedDB` reemplaza `chrome.storage.local` — mismo formato de datos
- OAuth PKCE con Google Identity Services JS y MSAL.js v3 — reemplaza `chrome.identity`
- Workbox Service Worker — cache-first offline, compatible con todos los browsers mobile

### Fase 5 — Capacitor (v0.6.0)

La misma PWA de v0.4.0 ejecuta dentro de un shell Capacitor v8 nativo:

- WKWebView (iOS) / Chromium WebView (Android) — `crypto.subtle` intacta
- `DpmKeyPlugin` propio (Kotlin/Swift) — `BiometricPrompt.CryptoObject` / Secure Enclave
  (`@aparajita/capacitor-secure-storage` descartado — ver DA-2 en §29)
- Android-first: Play Store v0.6.0 · App Store cuando haya macOS + Apple Developer $99
- Scope iOS diferido a v0.6.1

---

## 12. Sincronización BYOC

La v0.3.0 introduce sincronización multi-dispositivo con arquitectura **BYOC (Bring Your Own Cloud)**. El usuario elige dónde vive su vault cifrado. El proveedor cloud nunca recibe la clave — solo almacena bytes opacos AES-256-GCM. Zero-Knowledge se mantiene intacto.

### StorageAdapter — Interfaz base

Todos los adaptadores implementan la misma interfaz definida en `src/sync/storage-adapter.js`:

```javascript
export class StorageAdapter {
  async guardar(vaultCifrado)    { throw new Error('No implementado') }
  async cargar()                 { throw new Error('No implementado') }
  async ultimaModificacion()     { throw new Error('No implementado') }
  async verificarConexion()      { throw new Error('No implementado') }
  nombreProveedor()              { throw new Error('No implementado') }
}
```

### GoogleDriveAdapter

- Autenticación OAuth via `chrome.identity` (Extension) / Google Identity Services JS (PWA)
- Almacena el vault en la carpeta privada de la app — no visible en la UI de Drive
- El archivo es un blob JSON completamente opaco para Google
- Usa la REST API de Google Drive v3
- Scope mínimo: `drive.appdata`

### OneDriveAdapter

- Autenticación OAuth via `chrome.identity` (Extension) / MSAL.js v3 (PWA)
- Almacena el vault en `/me/drive/special/approot` via Microsoft Graph API
- Mismo blob opaco que Google Drive — Microsoft nunca ve los datos en claro
- Scope mínimo: `Files.ReadWrite.AppFolder`

### Resolución de conflictos — v0.3.x y v0.4.0: Last Write Wins (LWW)

Estrategia **LWW por timestamp** sobre un único blob de vault. Guardia anti-loop `_syncTs` para evitar sincronizaciones en cascada entre dispositivos.

> **Limitación conocida del modelo LWW de blob único:** si dos dispositivos editan offline simultáneamente, el último en subir sobreescribe al otro. Este comportamiento es aceptable donde el uso multi-dispositivo simultáneo offline es raro. El modelo per-item que lo resolvería está **esbozado pero no implementado** (ver §15) — el sync vigente sigue siendo este LWW de blob único.

### Seguridad Zero-Knowledge mantenida

| Principio | Implementación en v0.3.0+ |
|-----------|--------------------------|
| El proveedor nunca ve la clave | La clave AES permanece en memoria RAM local — nunca se sube |
| El vault viaja cifrado | Blob `{ __version, kdf, iv, datos }` — AES-256-GCM opaco |
| OAuth scope mínimo | `drive.appdata` (Google) / `Files.ReadWrite.AppFolder` (Microsoft) |
| Token OAuth protegido | Extensión: `chrome.storage.local` (cifrado de perfil Chrome). PWA: tokens de Google en memoria de módulo JS (nunca en storage); tokens de Microsoft en `sessionStorage` via MSAL — aislado por origen, **no cifrado a nivel de API** (el cifrado es del perfil del browser en disco, no de la Web Storage API). Ambos se borran al cerrar browser/pestaña. |
| Sin servidor de DacmosGroup | Todo en la cuenta del usuario — zero infraestructura propia |

---

## 13. Formato Canónico Versionado del Blob

A partir de v0.4.0, el blob del vault incluye metadatos de versión que permiten al motor detectar el KDF y los parámetros utilizados. Esto habilita la migración no destructiva a algoritmos futuros (ej. Argon2id en v0.7.0) sin romper la compatibilidad con vaults creados en versiones anteriores.

### Formato histórico (v0.1.1 — v0.3.1)

```json
{
  "iv":    "<base64 — 12 bytes>",
  "datos": "<base64 — ciphertext + auth tag>"
}
```

Sin metadatos de versión. Se asume implícitamente PBKDF2-SHA256 × 600,000.

### Formato v1 (desde v0.4.0)

```json
{
  "__version":    1,
  "kdf":          "PBKDF2-SHA256",
  "kdfIterations": 600000,
  "iv":           "<base64 — 12 bytes>",
  "datos":        "<base64 — ciphertext + auth tag>"
}
```

### Tabla de versiones

| `__version` | KDF | Parámetros | Desde versión |
|-------------|-----|------------|---------------|
| 0 (ausente) | PBKDF2-SHA256 | 600,000 iter. | v0.1.1 — backward compat |
| 1 | PBKDF2-SHA256 | 600,000 iter. | v0.4.0 |
| 2 *(reservado)* | Argon2id | m=46MB, t=3, p=2 | v0.7.0 |

### Lógica de detección en el motor

```javascript
// Detecta la versión del blob y enruta al descifrado correcto
function detectarVersionBlob(blob) {
  if (!blob.__version) return 0; // backward compat — tratar como v1
  return blob.__version;
}

async function descifrarVault(blob, clave) {
  const version = detectarVersionBlob(blob);

  switch (version) {
    case 0:
    case 1:
      // Path actual — PBKDF2-SHA256 × 600,000
      return await descifrar(blob, clave);

    case 2:
      // Argon2id — implementado en v0.7.0
      throw new Error('Formato de vault v2 requiere actualización de la app');

    default:
      throw new Error(`Versión de vault desconocida: ${version}. Actualiza la app.`);
  }
}
```

### AAD (Additional Authenticated Data)

Para `__version` ≥ 1, los campos de metadatos `{ __version, kdf, kdfIterations }` se incluyen como **AAD en AES-GCM**. Esto significa que cualquier modificación de los metadatos invalida el auth tag y hace el blob indescifrable — previniendo ataques de downgrade donde un atacante podría manipular el número de iteraciones para facilitar el brute force.

```javascript
// Serializar el header como AAD — template literal canónico (orden de campos fijo)
// NO usar JSON.stringify({...}): el orden de keys depende del motor JS y rompe vaults
// existentes si se refactoriza el objeto. Ver Sección 14 para la decisión completa.
const aad = new TextEncoder().encode(
  `{"__version":${blob.__version},"kdf":${JSON.stringify(blob.kdf)},"kdfIterations":${blob.kdfIterations}}`
);

const datosCifrados = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv: iv, additionalData: aad },
  clave,
  datos
);
```

### Compatibilidad cruzada

| Cliente | Lee v0 (sin `__version`) | Lee v1 | Lee v2 |
|---------|--------------------------|--------|--------|
| Chrome Extension v0.3.1 y anteriores | ✅ | ❌ (no entiende el campo) | ❌ |
| Chrome Extension v0.4.0+ | ✅ | ✅ | ❌ (error con mensaje claro) |
| PWA v0.4.0+ | ✅ | ✅ | ❌ (error con mensaje claro) |
| App Capacitor v0.5.0+ | ✅ | ✅ | ❌ (error con mensaje claro) |
| App v0.7.0+ | ✅ | ✅ | ✅ |

> **Nota:** La Chrome Extension actualiza su `engine.js` en v0.4.0 para leer el campo `__version` y mantener compatibilidad bidireccional con la PWA. Los blobs sin `__version` (vaults v0.3.1 y anteriores) siempre se tratan como v1.

---

## 14. Decisiones de Implementación — F4.7

Esta sección captura las decisiones de diseño tomadas
durante la implementación de F4.7 (versionado del blob).
Está orientada a futuros contribuidores y auditores que
modifiquen engine.js.

### Arquitectura en capas — L1 / L2 / L3

El motor de cifrado se organiza en tres capas:

| Capa | Contenido | Regla |
|------|-----------|-------|
| L1 — Primitivos | `cifrar()`, `descifrar()` | Nunca se modifican. Sin conocimiento de versiones. |
| L2 — Versionado | `cifrarConVersion()`, `descifrarConVersion()`, `serializarAAD()`, `detectarVersionBlob()` | Toda la lógica de versiones vive aquí. |
| L3 — API pública | `guardarVaultCifrado()`, `cargarVaultDescifrado()`, `configurarVault()`, etc. | Llaman a L2, nunca a L1 directamente. |

**Regla de oro:** ninguna función de L3 debe llamar a
`cifrar()` o `descifrar()` directamente. Todo acceso
pasa por L2. Violar esto rompe la protección AAD en
blobs v1.

### Contrato de serialización del AAD — decisión crítica

El AAD usa un **template literal explícito**, no
`JSON.stringify` de un objeto:

```javascript
// ✅ CORRECTO — orden estructural, no dependiente del objeto
`{"__version":${version},"kdf":${JSON.stringify(kdf)},"kdfIterations":${kdfIterations}}`

// ❌ PELIGROSO — el orden de keys depende del orden
//    del literal de objeto; refactoring silencioso lo rompe
JSON.stringify({ __version: version, kdf, kdfIterations })
```

El AAD canónico para v1 produce siempre:

```
{"__version":1,"kdf":"PBKDF2-SHA256","kdfIterations":600000}
```

**Este string debe ser bit-a-bit idéntico** entre
`cifrarConVersion()` y `descifrarConVersion()`, en todos
los clientes (Chrome Extension, PWA, Capacitor), en todas
las versiones futuras. Cualquier diferencia — incluso un
espacio — hace que todos los vaults v1 existentes sean
indescifrados.

### tokenVerificacion — Opción A (versionar el token)

El `tokenVerificacion` (sistema double-salt) también usa
`cifrarConVersion()`, no el primitivo `cifrar()`.

**Razón:** consistencia arquitectural y preparación para
v0.7.0. Si en v0.7.0 el KDF de verificación migra a
Argon2id, el campo `__version` del token será la señal
para saber qué derivación se usó. Sin esa señal, hay que
asumir — y asumir en crypto es un antipatrón.

**Consecuencia conocida y aceptada:** backups generados
en v0.4.0+ no son importables en Chrome Extension v0.3.1.
Este comportamiento está documentado en la tabla de
compatibilidad de la Sección 13.

### Riesgos identificados durante F4.7

| # | Riesgo | Severidad | Mitigación aplicada |
|---|--------|-----------|---------------------|
| R1 | Key order en AAD | Crítico | Template literal explícito en `serializarAAD()` |
| R2 | Call sites de `descifrar()` en L3 no migrados | Alto | Todos los call sites auditados y migrados a L2 |
| R3 | `VAULT_VERSION_INCOMPATIBLE` no capturado en UI | Medio | Capturado en `desbloquearVault` e `importarVaultBackup` (×3) |
| R4 | Blob v1 enviado a Extension v0.3.1 | Medio | Documentado — error controlado, no corrupción |
| R5 | `importarVaultBackup()` tiene 3 call sites | Medio | Auditados: CS1 (token), CS2 (vault backup), CS3 (vault merge) |
| R6 | Argon2id (v0.7.0) necesitará campos adicionales en AAD | Bajo | Aceptable para v1; el AAD se extiende en v2 |

### Patrón de captura de versión incompatible

Todos los callers de `descifrarConVersion()` deben
capturar este error específico para mostrar un mensaje
orientado al usuario:

```javascript
} catch (error) {
  if (error.message.startsWith('VAULT_VERSION_INCOMPATIBLE')) {
    // Mostrar en UI: "Tu vault fue creado con una versión
    // más nueva de la app. Actualiza Dacmos PM para continuar."
  }
  throw error; // re-throw para otros errores
}
```

---

## 15. Arquitectura Sync Per-Item

> ⚠️ **Diseño de referencia — NO implementado (verificado sep-2026).** El sync
> vigente sigue siendo blob monolítico Last Write Wins (§12): `sync-manager.js`
> sube el `vaultCifrado` completo, enriquecido solo con `{ sal, sal2,
> tokenVerificacion }` (§19 BUG-1). No existe en el código `manifest.encrypted`,
> ni archivos `.enc` por item, ni Lamport clock, ni tombstones. El `deviceId` +
> `lamportClock` per-item que describe esta sección tampoco existe: la única
> identidad de dispositivo real del proyecto es `web/src/storage/device-id.js`
> (ver §30, H-5). Esta sección queda como candidato de backlog si en algún
> momento se decide construir el modelo per-item; no se borra, se marca su
> estado real.

*(Diseño esbozado durante v0.5.0. La implementación nunca ocurrió — v0.5.0 cerró
con blob monolítico + LWW.)*

El modelo de sync de blob único (v0.3.x — v0.4.0) usa Last Write Wins sobre un solo archivo en Drive/OneDrive. Este modelo garantiza pérdida silenciosa de credenciales si dos dispositivos editan offline simultáneamente y luego sincronizan — un escenario inaceptable para un password manager.

El modelo **per-item** descrito abajo eliminaría este problema.

### Estructura de archivos en el proveedor cloud

```
/Apps/Dacmos/                         ← carpeta privada drive.appdata
  manifest.encrypted                  ← índice cifrado del vault (lista de UUIDs)
  items/
    <item-uuid-1>.enc                 ← una credencial cifrada
    <item-uuid-2>.enc
    <item-uuid-3>.enc
    ...
  tombstones/
    <item-uuid-deleted>.tomb          ← marca de eliminación (TTL: 90 días)
```

Cada archivo `.enc` es un blob AES-256-GCM autónomo con el mismo formato `__version` de la Sección 13. El manifest cifrado contiene el índice de UUIDs y sus timestamps de modificación.

### Lamport Clock por dispositivo

Cada dispositivo mantiene un contador lógico (Lamport clock) que se incrementa en cada operación de escritura:

```javascript
// Estructura de un item cifrado (contenido del .enc, antes de cifrar)
{
  uuid:         "<uuid-v4>",
  deviceId:     "<id único del dispositivo>",
  lamportClock: 42,           // incrementa en cada modificación
  updatedAt:    1716134400,   // timestamp Unix para LWW de desempate
  payload:      { /* credencial */ }
}
```

### Resolución de conflictos — LWW por campo con Lamport

Cuando dos dispositivos modifican el mismo item offline:

```
Dispositivo A (offline): lamportClock=5, updatedAt=T1
Dispositivo B (offline): lamportClock=3, updatedAt=T2, T2 > T1

Al sincronizar:
  └── Gana A (mayor lamportClock) para campos que A modificó
  └── Gana B (mayor updatedAt) para campos que B modificó con clock igual
  └── Tiebreaker final: deviceId lexicográfico (determinista)
```

### Conditional writes — prevenir race conditions

```javascript
// Google Drive — If-Match con etag
await fetch(uploadUrl, {
  method: 'PATCH',
  headers: {
    'If-Match': etag,  // falla si alguien modificó el archivo antes
    'Content-Type': 'application/json'
  },
  body: itemCifrado
});

// Si recibe 412 Precondition Failed → descargar versión remota → resolver conflicto → reintentar
```

### Tombstones — deletes sin pérdida de datos

Cuando el usuario elimina una credencial, no se borra el archivo — se crea un tombstone:

```javascript
// tombstones/<uuid>.tomb — contenido (no cifrado, solo metadatos)
{
  uuid:      "<uuid>",
  deletedAt: 1716134400,
  deviceId:  "<id del dispositivo que borró>"
}
```

Los tombstones tienen TTL de **90 días**. Después de 90 días sin conflicto, el tombstone y el item `.enc` se eliminan definitivamente. Esto garantiza que un dispositivo offline por hasta 90 días puede sincronizar sus deletes correctamente al volver a conectarse.

### Migración desde blob único (v0.4.0 → v0.5.0)

El primer sync en v0.5.0 detecta si el proveedor cloud tiene el blob monolítico de v0.4.0 y lo migra automáticamente:

```javascript
async function migrarDesdeBlob(blobMonolitico, clave) {
  // 1. Descifrar el blob completo
  const vault = await descifrarVault(blobMonolitico, clave);

  // 2. Crear un archivo .enc por credencial
  for (const credencial of vault.credenciales) {
    const uuid = credencial.uuid ?? generarUUID();
    const itemCifrado = await cifrarItem({ uuid, payload: credencial }, clave);
    await drive.subir(`items/${uuid}.enc`, itemCifrado);
  }

  // 3. Crear manifest cifrado con el índice
  await drive.subir('manifest.encrypted', await cifrarManifest(vault, clave));

  // 4. Eliminar el blob monolítico (después de confirmar que todos los items subieron)
  await drive.eliminar('vault.encrypted');
}
```

### Seguridad Zero-Knowledge — intacta

El modelo per-item no cambia la garantía Zero-Knowledge:
- Cada archivo `.enc` es un blob AES-256-GCM opaco — el proveedor no puede leerlo
- El manifest está también cifrado — el proveedor no puede ver la lista de credenciales
- La clave AES nunca sale del dispositivo
- Los tombstones no cifrados contienen solo UUIDs — sin información personal

---

## 16. Decisiones de Implementación — F4.3

Esta sección captura las decisiones de diseño tomadas durante la
implementación de F4.3 (OAuth PKCE sin chrome.identity para la PWA).
Está orientada a futuros contribuidores y auditores que modifiquen
los módulos de autenticación o los adaptadores de sync de la PWA.

### Google Drive — GIS Token Client (no Authorization Code PKCE)

La extensión Chrome usa `chrome.identity.getAuthToken()` para obtener
un `access_token` de Google. La PWA usa **Google Identity Services JS
(GIS) Token Client** — la API oficial de Google para SPAs y PWAs.

| Característica | Extensión Chrome | PWA |
|---|---|---|
| Mecanismo | `chrome.identity.getAuthToken` | GIS Token Client |
| Flujo OAuth | Implícito gestionado por Chrome | Token Model (GIS interno) |
| PKCE | No aplica (Chrome Extension) | No aplica (GIS lo abstrae) |
| Refresh | Chrome renueva automáticamente | `prompt: ''` → GIS silencioso |

> **Por qué GIS y no Authorization Code + PKCE manual para Google:**
> GIS Token Client es el flujo oficial de Google para obtener `access_token`
> en apps de página única. Authorization Code + PKCE es correcto para
> backends; GIS lo gestiona internamente con seguridad equivalente y
> una API más simple. El scope `drive.appdata` funciona con GIS.

### Ciclo de vida del access_token de Google

```
_accessToken = null  ← al cargar el módulo
        │
        ▼ conectar() / obtenerToken() con prompt='consent' o ''
[GIS callback] → _accessToken = response.access_token
                  _expiraEn = Date.now() + (expires_in - 60) * 1000
        │
        ├── obtenerToken() → token vigente → retorna _accessToken (sin red)
        │
        ├── obtenerToken() → token expirado → GIS silent (prompt='')
        │     Si sesión Google activa → nuevo token sin popup
        │     Si no hay sesión → popup de login
        │
        ├── 401 del servidor → invalidarToken() → obtenerToken()
        │     (fuerza nuevo token aunque _expiraEn no haya llegado)
        │
        └── desconectar() → _accessToken = null → revoke best-effort en Google

NUNCA: localStorage / sessionStorage / IndexedDB
```

### Microsoft OneDrive — MSAL.js v3 con PKCE S256

| Característica | Extensión Chrome | PWA |
|---|---|---|
| Mecanismo | `chrome.identity.launchWebAuthFlow` + PKCE manual | MSAL.js v3 PublicClientApplication |
| PKCE | Implementado manualmente (Web Crypto SHA-256) | Implementado por MSAL internamente |
| Refresh token | Almacenado en `chrome.storage.local` | Almacenado en `sessionStorage` (MSAL) |
| Silent renewal | `_refrescarToken()` propio | `acquireTokenSilent()` (MSAL) |
| Re-auth forzada | `launchWebAuthFlow` interactivo | `acquireTokenPopup()` |

#### Lógica de obtención de token (MSAL)

```javascript
// 1. Intento silencioso — usa refresh_token en sessionStorage
const resultado = await msalInstance.acquireTokenSilent({ account, scopes })

// 2. Si falla (refresh_token expirado o revocado):
//    InteractionRequiredAuthError → popup de Microsoft
const resultado = await msalInstance.acquireTokenPopup({ account, scopes })
```

### Decisión: sessionStorage para MSAL (no localStorage)

`cacheLocation: 'sessionStorage'` garantiza que los tokens de Microsoft
se borran al cerrar la pestaña. Alternativa rechazada: `'localStorage'`
persistiría los tokens indefinidamente entre sesiones — inconsistente con
el principio de sesión volátil (equivalente a `chrome.storage.session`).

### Decisión: bundle ESM local de MSAL (no CDN)

`@azure/msal-browser@3.30.0` no incluye un bundle ESM autocontenido.
El archivo `dist/index.mjs` re-exporta desde 336 archivos subdivididos en
subdirectorios — no puede servirse directamente en la PWA sin bundler.

**Solución:** esbuild genera un único archivo ESM autocontenido en 71ms:

```
npx esbuild dist/index.mjs --bundle --format=esm --platform=browser \
  --minify --outfile=msal-browser.esm.min.js
```

**Resultado:** `web/libs/msal-browser.esm.min.js` — 311KB, sin dependencias externas.

**Ventajas sobre CDN:**
- Funciona offline (Service Worker lo cachea como asset estático)
- Sin dominio adicional en `script-src` de la CSP
- Versión fija y controlada (registrada en `web/libs/versions.json`)
- Sin dependencia de disponibilidad de CDN en runtime

**Versión fija:** `web/libs/versions.json` registra la versión exacta bundleada.
Al actualizar MSAL, hay que re-ejecutar el bundle y actualizar `versions.json`.

### Decisión: import directo del módulo auth en los adaptadores de sync

Los adaptadores PWA (`google-drive-adapter.js`, `onedrive-adapter.js`) obtienen
el token via **import directo** de los módulos auth:

```javascript
import { obtenerToken } from '../auth/google-auth.js'    // GoogleDriveAdapter
import { obtenerToken as obtenerTokenMicrosoft } from '../auth/microsoft-auth.js'  // OneDriveAdapter
```

**Alternativa rechazada: pasar el token como parámetro** (`guardar(vaultCifrado, token)`).
Esto hubiera roto la interfaz `StorageAdapter` — `guardar()` tiene firma fija y el
`sync-manager.js` de la extensión Chrome la llama sin token. El import directo
mantiene la firma pública idéntica al original sin tocar el código compartido.

### Decisión: forks independientes (no modificar src/sync/)

Los adaptadores de la PWA viven en `web/src/sync/` y **no modifican** los archivos
en `src/sync/`. Razones:

1. Los originales en `src/sync/` usan `chrome.*` APIs que no existen en PWA
2. Un único archivo con branching (`if (chrome.identity)`) introduciría
   complejidad y riesgo en el adaptador de la extensión Chrome
3. Los forks son pequeños (~100 líneas) — el mantenimiento paralelo es manejable
4. El patrón es consistente con `web/src/crypto/engine.js` (fork de F4.2)

`web/src/sync/storage-adapter.js` es un fork literal (21 líneas) de la clase base
abstracta. Es necesario porque la PWA se sirve desde `web/` y el browser retornaría
404 para rutas que salgan de ese directorio (`../../src/sync/storage-adapter.js`).

### CSP — cambios en F4.3

| Directiva | Adición | Justificación |
|---|---|---|
| `script-src` | `https://accounts.google.com` | Tag `<script src=".../gsi/client">` en `index.html` |
| `connect-src` | `https://oauth2.googleapis.com` | `google.accounts.oauth2.revoke()` hace POST aquí |
| `connect-src` | `https://login.microsoftonline.com` | MSAL fetch al token endpoint de Microsoft |

Sin cambios en `script-src` por MSAL: el bundle se sirve desde `/libs/` (origen propio).
Sin `frame-src`: los popups OAuth son ventanas del browser, no iframes.

### Riesgos identificados en F4.3

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|------------|
| R1 | GIS no cargado cuando se llama `obtenerToken()` | Medio | `_gisListo` Promise con rAF polling **y timeout de 10 segundos** — rechaza con `GOOGLE_GIS_TIMEOUT` si GIS no carga; evita cuelgue indefinido (fix v0.4.1) |
| R2 | Popup bloqueado por el browser | Medio | `conectar()` y `obtenerToken()` se llaman solo desde event handlers de usuario; errores `popup_blocked_by_browser` y `MICROSOFT_POPUP_BLOQUEADO` muestran mensaje accionable (fix v0.4.1) |
| R3 | `CLIENT_ID` de Google como placeholder en código | Alto | `docs/f4.3-oauth-setup.md` documenta el paso de reemplazo; el placeholder es obvio |
| R4 | Token de Google revocado externamente antes de `_expiraEn` | Bajo | 401 del servidor → `invalidarToken()` → `obtenerToken()` obtiene token fresco |
| R5 | MSAL `clearCache()` no disponible en v3 futura | Bajo | Documentado; alternativa: `msalInstance.getTokenCache().clear()` |
| R6 | bundle MSAL desactualizado | Bajo | `web/libs/versions.json` + proceso de actualización documentado |

---

## 17. Decisiones de Implementación — F4.4 + F4.5

Esta sección captura las decisiones de diseño tomadas durante la
implementación de F4.4 (UI responsive mobile-first) y F4.5
(persistencia robusta). Orientada a futuros contribuidores y a
v0.5.0 (Capacitor) que reutilizará esta arquitectura de UI.

### Módulo implícito: session.js

La especificación en CLAUDE.md indica *"Session state lives in JS
module memory only"* pero no detalla cómo compartirlo entre vistas.
La solución adoptada es `web/src/storage/session.js`: un módulo ES
con variables a nivel de módulo (`_claveSesion`, `_credenciales`)
y funciones getter/setter exportadas.

Este patrón funciona porque los ES Modules son singletons — el
browser carga cada módulo una sola vez y todas las importaciones
comparten la misma instancia. Cualquier vista que importe `session.js`
accede al mismo estado en memoria.

**Consecuencia operativa:** la sesión se pierde al recargar la página.
El usuario debe volver a ingresar la contraseña maestra. Este
comportamiento es idéntico al de la extensión Chrome cuando el
service worker se reinicia y es correcto por diseño (Zero-Knowledge:
la clave AES no persiste).

### Fork web/src/health/password-health.js

Mismo patrón que `web/src/sync/storage-adapter.js` (F4.3): Cloudflare
Pages sirve desde `web/` como raíz del servidor. Una ruta como
`../../src/health/password-health.js` desde `web/src/ui/views/health.js`
saldría del directorio servido y devolvería 404 en producción.

El fork es literal — sin cambios de lógica. Solo cambia el lugar
en el sistema de archivos. Cuando `src/health/password-health.js`
reciba actualizaciones (ej. nuevas métricas en v0.5.0), deben
portarse manualmente al fork de la PWA, igual que con `engine.js`.

### Hash routing vs History API

Se eligió hash routing (`#/vault`, `#/unlock`, etc.) sobre History API
(`/vault`, `/unlock`) aunque `web/_redirects` ya tiene la regla SPA
`/* /index.html 200`.

**Razón:** iOS Safari en modo standalone (PWA instalada) tiene
comportamiento no estándar con `history.pushState` cuando la sesión
expira o el usuario navega directamente a una ruta profunda. Con hash
routing, el servidor siempre sirve `index.html` para cualquier URL y
el router en JS se encarga de todo — sin dependencia del comportamiento
del navegador para manejar deep links.

### CSS unificado (main.css) sin @import

Sin bundler (ni Vite, ni webpack, ni esbuild), la alternativa a un
único `main.css` sería múltiples archivos CSS con `@import` o
múltiples `<link>` en el HTML.

`@import` en CSS es render-blocking: el browser descarga el archivo
importado de forma secuencial antes de procesar el resto. Con 7+ vistas
esto crearía una cascada de bloqueos en la primera carga.

Múltiples `<link>` resolverían el bloqueo pero requerirían actualizar
el HTML cada vez que se añade una vista.

Un único `main.css` con secciones claramente delimitadas por
comentarios es el tradeoff óptimo para este stack sin build step.

### Pointer Events API para swipe (no Touch Events)

`swipe-card.js` usa exclusivamente Pointer Events API (W3C standard)
en lugar de Touch Events (API legacy).

| Criterio | Pointer Events | Touch Events |
|----------|---------------|--------------|
| Dispositivos cubiertos | Touch + mouse + stylus | Solo touch |
| `setPointerCapture()` | ✅ Nativo | ❌ No disponible |
| Compatibilidad | iOS 13+, Chrome Android | Todos |
| Mantenimiento | Una sola API | Dos APIs paralelas |

`setPointerCapture(e.pointerId)` es la razón técnica principal: garantiza
que `pointermove` y `pointerup` lleguen al elemento aunque el dedo
salga de sus límites durante el gesto. Sin esto, el swipe se interrumpe
si el usuario arrastra demasiado rápido y el dedo sale momentáneamente.

`touch-action: pan-y` en `.card__contenido` es condición necesaria para que
`setPointerCapture` funcione sin `pointercancel` en Chrome Android. Sin esta
propiedad, el browser reclama el puntero al detectar movimiento mínimo y
silencia tanto el swipe como el tap.

El guard `e.target.closest('.card__acciones')` en el handler `pointerdown` es
condición necesaria para que los botones Editar/Eliminar reciban sus propios
eventos `click`. Sin él, `setPointerCapture` redirige el `click` a `card`
(el elemento capturante) y los handlers de los botones nunca se ejecutan.

### Clase CSS sin-nav para vistas de pantalla completa

Las vistas setup, unlock y credential-form son de pantalla completa —
no deben mostrar el bottom-nav ni el margen del sidebar.

`nav-bottom.js` añade/quita `.sin-nav` en `#app` al cambiar de ruta.
En `main.css`:

```css
/* Mobile: quitar padding-bottom del espacio reservado para la nav */
#app.sin-nav { padding-bottom: 0; }

/* Desktop: quitar el margin-left del sidebar */
@media (min-width: 768px) {
  #app.sin-nav { margin-left: 0; padding-bottom: 0; }
}
```

Sin esta clase, las vistas unlock/setup en desktop mostrarían un margen
izquierdo de 220px y las vistas centradas (`.vista--centrada`) no
quedarían correctamente centradas en la pantalla.

### solicitarPersistencia() desde el submit handler (F4.5)

La Storage API requiere un "user gesture" (interacción activa del usuario)
para llamar a `navigator.storage.persist()` en algunos browsers, en
particular Safari iOS.

`setup.js` llama `solicitarPersistencia()` dentro del handler del
evento `submit` del formulario — que es un gesto del usuario (clic en
"Crear vault"). Esto satisface el gesture requirement.

Si se llamara desde `app.js` al cargar (sin gesto), Safari rechazaría
la solicitud silenciosamente y `persist()` devolvería `false` aunque
el usuario pudiera haberla concedido.

### Banner no modal para eviction iOS (F4.5)

Cuando el browser rechaza la persistencia, se muestra un banner
no bloqueante en la parte inferior de la vista vault — no un modal.

**Razón:** el riesgo de eviction de iOS Safari ocurre después de 7 días
sin abrir la PWA. No es un riesgo inmediato. Un modal interrumpiría el
flujo del usuario en su primera visita al vault, generando fricción
innecesaria en el momento de mayor valor percibido de la app.

El banner es descartable (botón X) y no reaparece tras cerrarlo
(`bannerPersistenciaVisto: true` en idbStorage). La red de seguridad
real es el sync BYOC (Google Drive / OneDrive), que actúa como backup
automático del vault cifrado.

---

## 18. Decisiones de Implementación — F4.6

Esta sección captura las decisiones de diseño tomadas durante la
implementación de F4.6 (distribución: dominio de producción + APK
Android via TWA). Orientada a futuros contribuidores y auditores.

### URL de producción definitiva: dpm.dacmosgroup.co

El dominio de producción es `dpm.dacmosgroup.co`, no `app.dacmosgroup.co`.

**Razón:** convención de subdominio multi-producto de DacmosGroup basada
en abreviaturas del producto. Escala limpiamente:

```
dpm.dacmosgroup.co   ← Dacmos Password Manager
pg.dacmosgroup.co    ← Dacmos PolicyGen (futuro)
```

Un subdominio tipo `app.` implicaría que todos los productos de la marca
comparten el mismo punto de entrada, lo que genera ambigüedad a medida que
el portafolio crece. La abreviatura del producto como subdominio establece
la identidad individual desde el primer día.

### Package name Android: co.dacmosgroup.dpm

Convención `reverse-domain + abreviatura`:

```
co.dacmosgroup.dpm   (Dacmos Password Manager)
```

El package name es inmutable una vez publicado el APK. Si se publica bajo
`co.dacmosgroup.pm` y luego se quiere cambiar a `co.dacmosgroup.dpm`, la
identidad de la app se pierde y los usuarios existentes no reciben
actualizaciones. `dpm` es la abreviatura canónica del producto desde los
primeros commits.

### Keystore de firma: dacmos-release.keystore

| Campo | Valor |
|-------|-------|
| Alias | `dacmos-dpm` |
| Algoritmo | RSA 2048 |
| Firma | SHA256withRSA |
| Validez | 9.125 días (~25 años, vence 24 mayo 2051) |
| SHA-256 | `B0:A1:FC:98:88:FB:8B:EE:F1:34:49:F8:FE:49:92:7C:E6:D2:4D:2E:FD:D0:0C:17:75:A0:E7:33:8F:8E:DE:0D` |

El archivo `.keystore` está excluido por `.gitignore` (`*.keystore`).
La documentación operativa (fingerprints, backup, comandos) vive en
`docs/f4.6-keystore.md` que SÍ está en el repo para sobrevivir re-clones.

### Digital Asset Links: web/.well-known/assetlinks.json

El archivo `assetlinks.json` crea la relación de confianza entre el dominio
`dpm.dacmosgroup.co` y el APK `co.dacmosgroup.dpm`. Sin este archivo en
producción, el APK funciona pero no es una TWA legítima — el navegador
muestra la barra de URL del Chrome, eliminando la experiencia de app nativa.

**Regla crítica:** el `sha256_cert_fingerprints` en `assetlinks.json` debe
coincidir exactamente con el fingerprint del keystore usado para firmar el
APK. Cualquier discrepancia hace que la TWA caiga silenciosamente a Custom
Tabs (con barra de URL visible).

**Regla de Content-Type:** el archivo debe servirse con `Content-Type: application/json`.
Configurado en `web/_headers`. Sin esta cabecera, algunos dispositivos Android
rechazan el archivo aunque el contenido sea válido JSON.

**Regla de _redirects:** la regla SPA `/* /index.html 200` captura
`/.well-known/assetlinks.json` si no existe una regla más específica antes.
Añadida `/.well-known/* /.well-known/:splat 200` antes de la catch-all.

### Íconos PNG como requisito de bubblewrap

`bubblewrap` requiere íconos PNG para generar el launcher icon del APK.
Los SVG con `"sizes": "any"` son válidos para la PWA en el browser, pero
el proceso de generación del APK necesita rasterizar el ícono para las
densidades de pantalla Android (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi).

Los PNG añadidos al manifest son placeholders de color sólido (`#0066cc`
brand color) generados con Node.js nativo (zlib, fs — sin dependencias).
**Deben reemplazarse con el arte final de DacmosGroup antes del release.**

### Herramienta de distribución: bubblewrap + twa-manifest.json

El archivo `twa-manifest.json` en la raíz del repo reemplaza la necesidad
de ejecutar `bubblewrap init` cada vez (que requiere la URL de producción
activa). Con `twa-manifest.json` presente, solo se necesita:

```bash
bubblewrap build --skipPwaValidation
```

### Incompatibilidad bubblewrap CLI + Node.js 26

Durante la implementación de F4.6 se confirmó que `bubblewrap CLI v1.24.1`
es incompatible con Node.js v26 cuando sus prompts interactivos reciben
entrada por pipe. El error:

```
Error [ERR_USE_AFTER_CLOSE]: readline was closed
```

ocurre porque `inquirer` (dependencia de bubblewrap) intenta pausar una
interfaz readline ya cerrada al agotarse stdin. Es un problema de la versión
de inquirer empaquetada en bubblewrap, no de Node.js.

**Workaround aplicado en F4.6:**
1. `bubblewrap init` generó el proyecto Android (`app/`, `build.gradle`, etc.)
   — esta fase sí completó antes del crash
2. El APK se compiló directamente con `./gradlew assembleRelease` pasando
   los parámetros de firma como flags de Gradle:
   ```
   -Pandroid.injected.signing.store.file=<ruta>
   -Pandroid.injected.signing.store.password=<pass>
   -Pandroid.injected.signing.key.alias=<alias>
   -Pandroid.injected.signing.key.password=<pass>
   ```
   Esto evita la dependencia de los prompts interactivos de bubblewrap
   para la firma.

**Implicación para v0.5.0 (Capacitor):** si Node.js sigue en v26 al
construir el APK de Capacitor, verificar si la herramienta de build de
Capacitor (Ionic Appflow o Codemagic) tiene la misma incompatibilidad.
En entorno local, la solución directa es `./gradlew` con flags de firma.

### Canales de distribución v0.4.0

| Canal | Estado |
|-------|--------|
| `dpm.dacmosgroup.co` (PWA — todos los dispositivos) | ✅ Dominio activo |
| GitHub Releases (`dacmos-pm-v0.4.0.apk`) | ✅ APK firmado |
| IzzyOnDroid | 🔄 Pendiente submisión (2–7 días revisión) |
| F-Droid main repo | ⏳ v0.4.x (requiere build reproducible) |
| Google Play Store | ⏳ v0.5.0 ($25 Play Console) |
| Apple App Store | ⏳ v0.6.0 ($99/año Developer Program) |

### Prerequisitos resueltos al cierre de F4.6

Los siguientes items estaban pendientes en la propuesta arquitectural
y quedaron resueltos durante la misma sesión de implementación:

| Prerequisito | Estado al cerrar F4.6 |
|---|---|
| `CLOUDFLARE_API_TOKEN` en GitHub Secrets | ✅ Configurado desde F4.1, verificado en F4.6 |
| `CLOUDFLARE_ACCOUNT_ID` en GitHub Secrets | ✅ Configurado desde F4.1, verificado en F4.6 |
| URI OAuth Google Cloud Console (`dpm.dacmosgroup.co`) | ✅ Actualizada en sesión de F4.6 |
| URI OAuth Azure Portal (`dpm.dacmosgroup.co/blank.html`) | ✅ Actualizada en sesión de F4.6 |

### Android Developer Console gratuita — deadline septiembre 2026

Google exige registro en la Android Developer Console (gratuita, distinta
de Play Console) para distribución directa de APKs en LATAM a partir de
septiembre 2026. No afecta GitHub Releases ni IzzyOnDroid hoy, pero es un
prerequisito para distribución directa en el mercado latinoamericano.

Registro: `play.google.com/console/about/` → "Crear cuenta gratuita".
Solo requiere verificación de identidad (documento + selfie). Sin costo.

---

## 19. Decisiones de Implementación — BUG-1

Esta sección captura las decisiones de diseño tomadas durante la
remediación de BUG-1 (sync BYOC upload-only en la PWA).
Orientada a futuros contribuidores y auditores que modifiquen
los módulos de sincronización de la PWA.

### Causa raíz: upload-only sin LWW en settings.js

Los handlers `btn-sync-google` y `btn-sync-onedrive` en
`web/src/ui/views/settings.js` llamaban únicamente a
`adapter.guardar()` — sin llamar a `adapter.cargar()` ni comparar
timestamps. Consecuencias:

- El vault en el proveedor nunca se descargaba al dispositivo local.
- Si el vault local estaba vacío (primer setup en dispositivo nuevo),
  el handler subía el vault vacío al proveedor, sobrescribiendo los
  datos de otros dispositivos sin advertencia — pérdida de datos
  silenciosa y crítica.
- `session.js._credenciales` nunca se actualizaba tras el "sync",
  por lo que el vault seguía mostrando las credenciales del unlock
  anterior (o ninguna si el vault era vacío).

La Chrome Extension tenía `src/sync/sync-manager.js` con lógica LWW
completa desde F2.1. La PWA nunca recibió su equivalente — el sync
fue implementado ad-hoc e incompleto en `settings.js`.

### Decisión: crear web/src/sync/sync-manager.js

Se crea `web/src/sync/sync-manager.js` como equivalente PWA de
`src/sync/sync-manager.js`, adaptado a la infraestructura de la PWA.

| Aspecto | Chrome Extension | PWA |
|---------|-----------------|-----|
| Storage | `chrome.storage.local` | `idbStorage` (IndexedDB) |
| Sesión | `chrome.storage.session` | `session.js` (módulo JS en RAM) |
| Trigger de sync | Automático via `onChanged` listener | Solo manual desde UI |
| Guardia anti-loop | `_syncTs` en storage | No necesaria — sin listener `onChanged` |

### Contrato de seguridad: solo blob cifrado

`sync-manager.js` opera exclusivamente sobre el blob cifrado
(`vaultCifrado`). Llama a `cargarVaultDescifrado()` y pasa el
resultado directamente a `establecerCredenciales()` sin inspeccionar
ni almacenar las credenciales descifradas en variables del módulo.
La clave AES permanece en `session.js` — nunca ingresa a
`sync-manager.js`.

### LWW con ultimaSincronizacion = 0 en primera sync (D2)

Sin historial previo de sync (`ultimaSincronizacion` ausente en
`syncConfig`), se usa `ultimaSync = 0`. Cualquier archivo en el
proveedor tendrá `modRemoto > 0` → el proveedor siempre gana.
Esto protege al usuario de sobrescribir datos en Drive con un
vault vacío local en el primer uso en un dispositivo nuevo.

### Atomicidad de la descarga y rollback (D3)

El flujo de descarga en `_descargar()`:

```
1. adapter.cargar()             → blob cifrado desde el proveedor
2. idbStorage.set(vaultCifrado) → blob escrito a IDB
3. cargarVaultDescifrado(clave) → descifrar con clave de sesión activa
4. establecerCredenciales(...)  → actualizar credenciales en RAM
5. _actualizarUltimaSync()      → guardar timestamp de sync exitoso
```

Si el paso 3 falla (AES-GCM rechaza el descifrado), se ejecuta
rollback del paso 2: el `vaultCifrado` anterior se restaura en IDB
(o se elimina si no existía) y se lanza `SYNC_MASTER_PASSWORD_MISMATCH`.
El estado local queda intacto.

Si no hay sesión activa al descargar (vault bloqueado), los pasos 3 y 4
se omiten. IDB recibe el blob actualizado y el próximo `desbloquearVault()`
lo cargará con la clave que el usuario ingrese.

### Manejo de SYNC_MASTER_PASSWORD_MISMATCH

El error indica que el vault en el proveedor fue cifrado con una
master password distinta a la de la sesión activa. `settings.js`
lo traduce a:

> "El vault en el proveedor fue creado con una contraseña diferente.
> No es posible sincronizar."

El usuario debe decidir qué vault retener. La app no fuerza ninguna
sobreescritura — el estado local queda intacto (rollback garantizado).

### Mensajes diferenciados por operación

Los handlers de sync en `settings.js` usan `_mensajeSyncOk(resultado,
proveedor)` donde `resultado ∈ { 'descargado', 'subido', 'sin_cambios' }`.
El parámetro `proveedor` es `'Google Drive'` o `'OneDrive'` según el
adaptador — no hay strings hardcodeados del nombre del proveedor en
los handlers individuales.

| resultado | Mensaje (Google Drive como ejemplo) |
|-----------|-------------------------------------|
| `'descargado'` | `"Vault descargado desde Google Drive. Credenciales actualizadas — ve al vault para verlas."` |
| `'subido'` | `"Vault subido a Google Drive."` |
| `'sin_cambios'` | `"Sin cambios — el vault ya estaba sincronizado."` |

### Riesgos identificados y mitigaciones

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|------------|
| R1 | Vault vacío local sube al proveedor, destruyendo datos remotos | **Crítico** | D2: primera sync siempre descarga (`ultimaSync = 0`) |
| R2 | Credenciales no visibles en vault tras sync exitoso | Alto | Post-descarga: `cargarVaultDescifrado()` + `establecerCredenciales()` actualiza la sesión activa inmediatamente |
| R3 | Master password distinta entre dispositivos | Medio | Rollback atómico de IDB + error `SYNC_MASTER_PASSWORD_MISMATCH` con mensaje claro; sin pérdida de datos |
| R4 | `ultimaSincronizacion` ausente en IDB de la PWA | Medio | `ultimaSync = 0` es el default correcto — el proveedor gana y el timestamp se guarda post-sync |
| R5 | Bug de `ultimaModificacion()` sin invalidar fileId en 404 | Bajo | Corregido en el mismo commit (D4) — ver deuda técnica DT-1 en §10 |

### Archivos modificados

| Archivo | Tipo | Rol |
|---------|------|-----|
| `web/src/sync/sync-manager.js` | Nuevo | Orquestador LWW bidireccional para Google Drive y OneDrive |
| `web/src/sync/google-drive-adapter.js` | Editado | D4: `ultimaModificacion()` invalida fileId cacheado en 404 |
| `web/src/ui/views/settings.js` | Editado | Handlers reemplazados para usar `sincronizar(adapter)`; mensajes diferenciados; `SYNC_MASTER_PASSWORD_MISMATCH` traducido |

---

## 20. Decisiones de Implementación — BUG-2

Esta sección captura las decisiones de diseño tomadas durante la
remediación de BUG-2 (Service Worker sirve versión cacheada tras
deploy). Orientada a futuros contribuidores que modifiquen el
Service Worker o el pipeline de CI/CD.

### Causa raíz: revision: '1' hardcodeada en precacheAndRoute

`web/service-worker.js` registraba los assets en `precacheAndRoute`
con `revision: '1'` fija en las 16 entradas:

```javascript
workbox.precaching.precacheAndRoute([
  { url: '/', revision: '1' },
  { url: '/src/app.js', revision: '1' },
  // ... 14 entradas adicionales con la misma revision
])
```

Workbox usa el campo `revision` como clave de caché. Al ser constante
entre deploys, el SW actualizado reutilizaba las entradas del caché
anterior y nunca refetcheaba los assets. El problema persistía incluso
tras confirmar la actualización en el banner — el SW nuevo tomaba
control pero seguía sirviendo los assets viejos desde caché.

### Hallazgo clave: skipWaiting + banner ya funcionaban correctamente

El mecanismo `skipWaiting()` en el SW y el banner de "Nueva versión
disponible" en `app.js` ya estaban implementados correctamente en
`main` via `fix/sw-update-flow`. El bug no era de activación del SW
sino de invalidación de caché.

Este hallazgo fue importante: cualquier diagnóstico que apuntara a
"el SW no se activa" habría sido incorrecto. La causa raíz estaba
un nivel más abajo — en los assets que el SW recién activado seguía
sirviendo desde caché con revision obsoleta.

### Decisión: SW_DEPLOY_ID inyectado por CI vía sed

| Alternativa considerada | Razón de descarte |
|------------------------|-------------------|
| Workbox Inject Manifest | Requiere build pipeline (Node.js + bundler) — incompatible con el stack sin build step |
| `revision` incremental manual | Error-prone: puede olvidarse en cada deploy; no escalable |
| **`SW_DEPLOY_ID` inyectado por CI** | Automático en cada deploy, sin cambiar el stack — ✅ elegido |

El archivo `web/service-worker.js` define en el repositorio:

```javascript
const SW_DEPLOY_ID = 'dev'
```

El workflow `.github/workflows/deploy-pwa.yml` reemplaza este valor
antes de cada deploy a Cloudflare Pages:

```bash
DEPLOY_ID="${GITHUB_SHA:0:7}"
sed -i "s/const SW_DEPLOY_ID = 'dev'/const SW_DEPLOY_ID = '${DEPLOY_ID}'/" web/service-worker.js
```

Todos los nombres de caché y los campos `revision` del precache
incorporan `SW_DEPLOY_ID`. Cada deploy produce nombres de caché
únicos → Workbox invalida los assets anteriores → los usuarios
reciben la versión correcta al confirmar la actualización.

El valor `'dev'` en el repositorio permite desarrollo y testing local
sin depender del CI: el SW en `localhost` usa `'dev'` como
identificador de caché estable entre recargas, sin colisiones entre
deploys de producción.

### Archivos modificados

| Archivo | Tipo | Rol |
|---------|------|-----|
| `web/service-worker.js` | Editado | `SW_DEPLOY_ID = 'dev'` como placeholder; nombres de caché y campos `revision` parametrizados; listener `activate` limpia cachés de deploys anteriores |
| `.github/workflows/deploy-pwa.yml` | Editado | Paso que inyecta los primeros 7 chars del commit SHA como `SW_DEPLOY_ID` antes de cada deploy |

### Comportamiento en entorno de desarrollo (localhost)

**Fecha:** 2 junio 2026
**Sesión:** Arquitecto revisor — desbloqueo de verificación funcional v0.4.2

#### Síntoma

Durante la verificación funcional de v0.4.2 (`fix/auditoria-remediaciones`),
los cambios del commit `787c80b` (tap card / `swipe-card.js`) no se reflejaban
en `localhost` ni tras Clear Site Data + Unregister SW. Bloqueaba los criterios
de aceptación C1/C2/C3, que se verifican interactuando con las cards en la UI
de la PWA.

#### Causa raíz

Es la causa raíz de BUG-2 reapareciendo en el dev-path que el fix de
producción no cubre. El fix de BUG-2 reemplaza `SW_DEPLOY_ID` vía CI (`sed`)
únicamente en cada deploy a Cloudflare. En `localhost` no hay CI, así que
`SW_DEPLOY_ID` queda en su placeholder `'dev'` — constante por diseño. Como
Workbox usa el `revision` derivado de `SW_DEPLOY_ID` como clave de
invalidación, un asset editado con `revision` sin cambiar es tratado como
"sin cambios" → Workbox sirve la copia cacheada y nunca refetchea.

Culpables concurrentes en el fallo de "Clear Site Data + Unregister SW":
1. `Unregister` no surte efecto hasta cerrar todos los clientes (tabs) del origin.
2. Repoblación inmediata del precache desde servidor estático local / HTTP disk cache que devuelve 304.
3. Ruta runtime `CacheFirst` sin revalidación (cache por URL, TTL 30 días).

#### Decisión: Opción A — bypass del SW gated por hostname

| Opción | Estado | Razón |
|--------|--------|-------|
| **A — bypass gated por hostname (`ENTORNO_DEV`)** | ✅ Aprobada | Dev siempre fresco, prod intacto, sin toggles manuales |
| B — `SW_DEPLOY_ID = 'dev-' + Date.now()` en localhost | Descartada | Re-precachea todo en cada reload y aún exige "Update on reload" para tomar el nuevo id |
| C — solo proceso (DevTools "Bypass for network" + "Update on reload") | Desbloqueo inmediato | Útil para cerrar C1–C7 en sesión, pero no enforced |
| Workbox Inject Manifest | Descartada (ya en BUG-2) | Requiere build step — incompatible con stack sin bundler |

**Resolución:** C como desbloqueo inmediato + A como fix durable en el mismo PR de v0.4.2.

#### Contrato de implementación

`web/service-worker.js`:

```javascript
const ENTORNO_DEV = ['localhost', '127.0.0.1', '[::1]']
    .includes(self.location.hostname);
```

- `precacheAndRoute([...])` y la ruta runtime `CacheFirst` de assets se registran
  solo si `!ENTORNO_DEV`. En dev el fetch de assets pasa a red.
- La ruta `NetworkFirst` de HTML no cambia (va a red primero, no produce stale).
- El listener `activate`, en `ENTORNO_DEV`, limpia todas las Cache Storage del origin.
- `skipWaiting()` + `clientsClaim()` sin cambios.

#### Riesgos mitigados

| # | Riesgo | Mitigación |
|---|--------|------------|
| R1 | La rama dev llega a producción | Gate runtime por hostname real; Cloudflare jamás sirve `localhost`. Guard + comentario explícito; revisión en PR |
| R2 | Superficie de amenaza del SW | El bypass reduce caché, no añade capacidad → no ensancha la superficie en prod |
| R3 | `offline.html` no funciona en localhost dev | Aceptable; offline es preocupación de prod. Documentado |

---

## 21. Auditoría Profunda — Hallazgos v0.4.1 / v0.4.2

**Fecha:** 31 mayo 2026
**Disparada por:** sync PWA ↔ Extension falla + vault inaccesible en extensión CWS.
**Branch auditado:** main + feature/v0.4.0

### H-0 [URGENTE] — Causa raíz del vault inaccesible ✅ Resuelto v0.4.2

**Síntoma:** "Error al verificar — intenta de nuevo" al desbloquear la extensión CWS v0.3.1.

**Diagnóstico confirmado via chrome.storage.local DevTools:**
El sync de la extensión descargó el vault completo de la PWA (blob v1 con AAD) e instaló las sales de la PWA en chrome.storage.local. El storage era internamente consistente (todo v1) pero la extensión CWS v0.3.1 usa engine.js sin `descifrarConVersion()` — llama a `descifrar()` sin AAD → AES-GCM auth tag falla.

**Cierre:** Publicar extensión v0.4.2 con engine.js que incluye `descifrarConVersion()`.

---

### H-1 [CRÍTICO — Integrity] — Vault overwrite sin verificación ✅ Resuelto v0.4.2

**Archivo:** `src/sync/sync-manager.js`, `src/sync/onedrive-sync-manager.js`

El sync de la extensión almacenaba el blob descargado directamente en chrome.storage.local sin verificar compatibilidad con el vault local. La PWA había corregido esto en BUG-1 (rollback si descifrado falla) pero la extensión nunca recibió ese fix.

**Remediación implementada:** Verificación defensiva por comparación de sales:
- Sal igual a la local → actualización segura (mismo origen de claves).
- Sal distinta + sesión activa → NO escribe, error visible al usuario.
- Sal distinta + sin sesión → escribe todo, invalida sesión, notifica al usuario.
- Blob legacy (sin sal) → comportamiento anterior (backward compat).

---

### H-2 [CRÍTICO — Confidentiality] — engine.js v1 incompatible con CWS v0.3.1 ✅ Resuelto v0.4.2

La extensión publicada en CWS (v0.3.1) no tiene `descifrarConVersion()`. El repo (main) sí la tiene. El vault v1 producido por la PWA no puede descifrarse por el engine v0.3.1. Cierre: publicar v0.4.2.

---

### H-3 [CRÍTICO — Integrity] — BUG-3 fix incompleto: OneDrive no enriquece blob ✅ Resuelto v0.4.2

**Archivo:** `src/sync/onedrive-sync-manager.js`

El fix de BUG-3 (blob enriquecido con sal/sal2/tokenVerificacion) había sido implementado solo para Google Drive en feature/v0.4.0. OneDrive seguía subiendo el blob sin enriquecer. Corregido: ambos sync managers de la extensión (y el de la PWA, scope ampliado aprobado) implementan el mismo patrón.

---

### H-4 [ALTO — Availability] — BUG-3 fix no estaba en producción ✅ Resuelto v0.4.2

Los commits 233ebcc y 266a024 (fix BUG-3 parcial) estaban solo en feature/v0.4.0. La PWA desplegada y la extensión CWS no los tenían. Resuelto al publicar v0.4.2 con todos los fixes mergeados desde main.

---

### Hallazgo H-5 (auditoría) [ALTO — Non-repudiation] — Sin verificación de identidad del vault en sync

> **Nomenclatura:** este es el *Hallazgo H-5* de la auditoría v0.4.1/v0.4.2 (mayo 2026).
> No confundir con el *Backlog H-5* del Sprint 2 (sep-2026) — el item que embebe
> `_deviceId` en el vault (§30). Cadenas iguales, sistemas de tracking distintos.

El sync no puede confirmar que el vault en Drive "pertenece" a esta instalación.
Estado (sep-2026): el identificador de instalación opaco (`_deviceId`) ya está
embebido en el payload cifrado del vault vía el *Backlog H-5* (Sprint 2, §30), y
por tanto **ya viaja dentro del blob sincronizado** (el sync monolítico sube el
`vaultCifrado` completo). Lo que falta es la lógica en `sync-manager.js` que lo
lea y lo compare tras descifrar — la verificación de identidad en sync sigue sin
implementar.

---

### H-6 [ALTO — Confidentiality] — vault.js enmascaraba errores críticos ✅ Resuelto v0.4.2

**Archivo:** `src/ui/vault/vault.js`

El catch genérico `catch (_)` convertía DOMException, TypeError, SyntaxError y VAULT_VERSION_INCOMPATIBLE en el mismo string genérico "Error al desbloquear — intenta de nuevo". El usuario no podía distinguir entre contraseña incorrecta y versión incompatible.

**Remediación:** `catch (err)` con distinción explícita:
- `VAULT_VERSION_INCOMPATIBLE` → "Actualiza la extensión para abrir este vault"
- Cualquier otro error → "Contraseña incorrecta — intenta de nuevo"

---

### H-7 [MEDIO — Integrity] — Inconsistencia nombre proveedor Google Drive ✅ Resuelto v0.4.2

La PWA usaba el string `'google'` para el proveedor mientras la extensión usaba `'google-drive'`. Normalizado a `'google-drive'` en todos los componentes. No produce choque funcional en v0.4.x (storages separados) pero podría causar bugs en v0.5.0 con Capacitor compartiendo storage.

---

### H-8 [MEDIO — Availability] — sesionActiva persiste tras reinicio

`sesionActiva: true` puede quedar en chrome.storage.local tras reinicio del service worker. El popup puede mostrar "desbloqueado" sin credenciales en session storage. No compromete seguridad (clave AES limpiada). **Deuda técnica — resolución en v0.5.0.**

---

### H-9 [BAJO — Non-repudiation] — Sin logging de sync

No hay registro de sync events (quién subió, cuándo, qué timestamp ganó LWW). **Deuda técnica — resolución en v0.5.0** con sync per-item + Lamport clock.

---

### H-10 [NUEVO — UX/Security] — Campo contraseña en diálogo importar muestra texto plano ✅ Resuelto v0.4.2

**Archivo:** `web/src/ui/views/settings.js`

Los diálogos de exportar e importar backup usaban `prompt()` nativo, que muestra la contraseña en texto claro mientras se escribe. Reemplazados por `_pedirContrasena()`: modal con `<input type="password">`, toggle de visibilidad, soporte Enter/Escape.

---

### Estado de recuperación del vault (incidente sesión 31 mayo 2026)

- **Vault en Drive:** Intacto — blob v1 con sales de la extensión original.
- **Backup local:** `dacmos-backup-2026-05-31T22:04:59.json` — 1KB, formato v1 con envelope completo, 2 credenciales confirmadas.
- **Ruta de recuperación:** Importar backup en la PWA v0.4.2 (importarVaultBackup() funciona correctamente; el error previo era por el catch genérico en console.error, no en el engine).

---

## 22. Decisiones de Implementación — v0.4.2

**Fecha:** 1 junio 2026
**Sesión:** Arquitecto revisor (Claude) — aprobación de estrategia de remediación post-auditoría #2

### Causa raíz confirmada — incompatibilidad cross-platform

La incompatibilidad entre Chrome Extension v0.3.1 (CWS) y PWA v0.4.1 es de **AAD en AES-GCM**, no de sales.

El engine.js publicado en CWS (v0.3.1) no implementa `descifrarConVersion()`, `serializarAAD()`, ni el parámetro `additionalData` en ninguna llamada a `crypto.subtle`. Toda la lógica de AAD/versionado se introdujo en v0.4.0 y nunca se publicó a CWS. Un blob `__version: 1` producido por la PWA no puede descifrarse por el engine v0.3.1 — el auth tag de AES-GCM falla porque la contraparte no computa el mismo AAD.

Las sales (BUG-3) son un hallazgo separado y correcto, pero no la causa del bloqueo actual del usuario.

### H-4 — BUG-3 fix nunca llegó a main

El commit `233ebcc` (fix de sales para Google Drive) existe únicamente en `feature/v0.4.0`. No fue mergeado a `main`. Por tanto:
- La PWA desplegada en `dpm.dacmosgroup.co` (desde main) no tenía enriquecimiento de sales en Drive.
- La extensión CWS nunca tuvo ese fix.

Ambas superficies se corrigen en v0.4.2.

### Decisión: Opción B — rama fix/auditoria-remediaciones desde main

**Opciones evaluadas:**
- A: Hotpatch v0.3.2 (solo engine.js) → descartada: deja H-1, H-3 abiertos.
- **B: fix/auditoria-remediaciones → v0.4.2 → APROBADA.**
- C: Merge feature/v0.4.0 + remediaciones → descartada: 269 líneas no auditadas en setup.js; H-3 OneDrive tampoco resuelto en esa rama.
- D: Hotpatch + release limpio → descartada: vault tiene solo 2 credenciales desechables; doble submission CWS no justificada.

**Razonamiento:** El vault del usuario es desechable (2 credenciales, backups disponibles). Un solo release limpio con todos los hallazgos cerrados es preferible.

### Decisión: re-implementar BUG-3 desde spec, no cherry-pick

El fix de BUG-3 para Google Drive (commit `233ebcc`, solo en `feature/v0.4.0`) **no se cherry-pickeó** en `fix/auditoria-remediaciones`. Se re-implementó en ambos proveedores de la extensión (Google Drive y OneDrive) y en la PWA (scope ampliado) usando `docs/documento-tecnico.md §19` como spec de referencia.

**Razón:** `feature/v0.4.0` contiene cambios no auditados (setup.js, 269 líneas nuevas) fuera del scope de v0.4.2. Importar esa rama introduce superficie no revisada en un release de seguridad.

### Formato del blob enriquecido (BUG-3)

```
// Blob legacy (v0.3.x, upload sin enriquecimiento):
{ "__version": 1, "kdf": "PBKDF2-SHA256", "kdfIterations": 600000, "iv": "...", "datos": "..." }

// Blob enriquecido (v0.4.2+, formato plano):
{ "__version": 1, "kdf": "PBKDF2-SHA256", "kdfIterations": 600000, "iv": "...", "datos": "...",
  "sal": "<base64>", "sal2": "<base64>", "tokenVerificacion": { ... } }
```

**Detección:** `blobRemoto.sal !== undefined` → enriquecido; sin campo `sal` → legacy.
**Backward compat:** Blobs legacy se procesan sin verificación de sales (mismo comportamiento anterior).
**Extracción:** `const { sal, sal2, tokenVerificacion, ...vaultCifrado } = blobEnriquecido` — el vault se guarda en `vaultCifrado`, las sales en sus claves propias en storage.

### Decisión: verificación defensiva en service worker sin clave AES (H-1)

El service worker de la extensión NO tiene acceso a la clave AES (principio Zero-Knowledge documentado: "The AES key stays only in JS memory within the page/popup context"). La verificación "intentar descifrar antes de persistir" se implementa mediante comparación de sales:

| Escenario | Acción |
|-----------|--------|
| `sal_remoto === sal_local` | Escribir vault + sales (compatible) |
| `sal_remoto !== sal_local` + sesión activa | NO escribir — error visible. La clave AES en sesión no puede descifrar el vault remoto |
| `sal_remoto !== sal_local` + sin sesión | Escribir todo + invalidar sesión + notificar |
| Blob legacy (sin `sal`) | Escritura directa (backward compat) |

### Decisión: scope ampliado — PWA sync-manager incluida en Bloque 2

Aprobado por el arquitecto para cerrar el criterio de aceptación 1 (round-trip PWA→Extension). `web/src/sync/sync-manager.js` incluye enriquecimiento en upload y extracción + rollback completo de sales en descarga.

### Regla de proceso — aislamiento de Drive en desarrollo

La extensión load-unpacked (desarrollo) y la extensión CWS comparten el mismo `appDataFolder` en Google Drive del perfil Chrome activo. Una operación de sync desde la extensión de desarrollo puede sobrescribir el vault real de producción — fue la causa del incidente de esta sesión.

**Regla:** Nunca ejecutar operaciones de sync desde la extensión load-unpacked contra el Drive/OneDrive de producción. Usar perfil Chrome separado o cuenta de prueba. Documentado en `.claude/CLAUDE.md`.

### CSV Import/Export en PWA (C3 — Fase 1)

Hallazgo C3 de la auditoría identificó que CSV import/export existía en la extensión Chrome pero no en la PWA. Cerrado en v0.4.2 con los siguientes módulos:

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| CSV Importer | `web/src/import/csv-importer.js` | Parser RFC 4180 con detección automática de formato (Google, Bitwarden, LastPass, 1Password, genérico). Maneja BOM UTF-8, campos citados, CRLF. |
| Import Wizard | `web/src/import/import-wizard.js` | UI del wizard de importación. Vista dentro de Settings → Importar credenciales. |
| CSV Exporter | `web/src/export/csv-exporter.js` | Exporta el vault descifrado como CSV. Formato compatible con Google Password Manager. |

**Decisión de implementación:** Fork de `src/import/csv-importer.js` y `src/export/csv-exporter.js`. La lógica es idéntica — no se introdujeron diferencias de comportamiento. Los módulos PWA eliminan referencias a `chrome.*` que no existen en el contexto PWA (los originales no tenían ninguna, así que los archivos son byte-for-byte iguales salvo el comentario de cabecera).

**Esquema de credencial importada:**
```json
{ "sitio": "string", "url": "string", "usuario": "string", "password": "string", "notas": "string" }
```
El importador filtra silenciosamente entradas sin `usuario` y sin `password`. Si falta `sitio`, lo deriva del hostname de `url`.

**Validación de schema en backup import (M2 — Fase 3):** `importarVaultBackup()` en ambos engines valida ahora que cada credencial del backup tenga los campos `id`, `sitio`, `usuario`, `password` antes de persistir. Backups malformados lanzan `BACKUP_CREDENCIALES_INVALIDAS`.

---

### 7 criterios de aceptación — v0.4.2

1. Round-trip PWA→Extension: credencial creada en PWA sincroniza a Drive y es visible en extensión v0.4.2 desbloqueada.
2. Round-trip Extension→PWA: credencial creada en extensión sincroniza a Drive y es visible en PWA desbloqueada.
3. H-1 cerrado: forzar descarga de vault con contraseña distinta no sobrescribe el vault local; error visible; vault intacto.
4. H-3 cerrado: sync OneDrive incluye sal, sal2, tokenVerificacion en el blob subido.
5. H-6 cerrado: extensión v0.4.2 con vault v1 en storage muestra "Actualiza la extensión" (no "Error al desbloquear").
6. H-10 cerrado: campo contraseña en import/export no visible al escribir.
7. Docs reconciliados: roadmap sin sección duplicada; BUG-3 con commit correcto; manifest.json version == tag de release; 0 catch silenciosos en paths de descifrado o import/export.

---

## 23. Versionado por superficie

A partir de v0.4.2, cada superficie versiona de forma independiente.
El mismo número de versión hoy no implica ciclos de release acoplados
en el futuro: la extensión Chrome sigue el ciclo de Chrome Web Store
(revisión manual, días de latencia) y la PWA sigue el ciclo de
Cloudflare Pages (deploy inmediato en cada push a main).

### Fuentes de verdad por superficie

| Superficie | Archivo | Ciclo de release |
|------------|---------|-----------------|
| Chrome Extension | `manifest.json` → campo `"version"` | Chrome Web Store (review manual) |
| PWA | `web/manifest.json` → campo `"version"` | Cloudflare Pages (deploy en push a main) |
| Vault format | `__version` en blob cifrado (`web/src/crypto/engine.js`) | Contrato compartido — cambiar requiere migración en ambas superficies |

### Compatibilidad inicial

| Extension | PWA | Vault `__version` | Compatible |
|-----------|-----|-------------------|-----------|
| v0.4.2+   | v0.4.2+ | 1 | ✅ |
| v0.3.1 (CWS) | cualquiera | 1 | ❌ AAD incompatible — Extension muestra "Actualiza la extensión" |
| cualquiera | cualquiera | 0 (legacy, sin campo) | ✅ backward compat vía path sin AAD |

**Regla de evolución:** un incremento en `__version` del blob (ej. v1→v2)
requiere que AMBAS superficies soporten el nuevo formato antes de que
cualquier cliente produzca blobs con ese `__version`. El campo
`VAULT_VERSION_INCOMPATIBLE` en `engine.js` es el mecanismo de
detección de incompatibilidad en runtime.

---

## 24. Decisiones de Sesión — v0.5.0 Replanificación Estratégica

**Fecha:** 2026-06-08
**Contexto:** Pausa estratégica post-publicación CWS — replanificación del roadmap
antes de iniciar la implementación de v0.5.0.

### Contexto de la decisión

La publicación de la Chrome Extension en CWS el 2026-06-08 cambia el perfil
de audiencia del producto: de LATAM hispanohablante exclusivo a descubrimiento
global potencial. Esto desencadenó una revisión estratégica del roadmap antes
de continuar con la implementación de v0.5.0.

### D1 — Alcance revisado de v0.5.0

v0.5.0 contiene exactamente dos features:
- **F5-A:** Auto-lock timer en PWA (paridad con Chrome Extension)
- **F5-B:** Internacionalización (i18n) ES / EN / PT-BR en Extension + PWA

| Feature | Nueva versión | Razón del movimiento |
|---|---|---|
| Capacitor wrapping (iOS + Android nativo) | v0.6.0 | Depende de i18n completo — Capacitor hereda i18n de v0.5.0 sin costo adicional si el orden es correcto |
| Integración Stripe / monetización | v0.8.0 | Sin masa crítica de usuarios; la Extension se publicó en esta fecha |
| Biometría nativa | v0.6.0 | Requiere Capacitor como base |
| Play Store / App Store | v0.6.0+ | Requiere Capacitor + i18n |

### D2 — Monetización postergada

Monetización (Stripe, modelo lifetime $29) postergada hasta que exista masa crítica
de usuarios medible. No hay fecha fija — la condición de activación es tracción real,
no calendario.

**Modelo de monetización confirmado (resuelve contradicción entre docs):**

| Año | Modelo |
|---|---|
| Año 1 (2026) | 100% gratuito + donaciones opcionales |
| Año 2 (2027) | Lifetime $29 USD — features avanzados, tier free completo se mantiene |
| Año 3 (2028) | Business $3/usuario/mes + upsell consultoría DacmosGroup |

> **Nota:** Cualquier referencia a "$1–1.50/mes" en la documentación es incorrecta.
> El modelo correcto es el documentado en ADR-001 (lifetime $29 en Año 2).

### D3 — Estrategia de internacionalización (i18n)

Detección automática de idioma del browser como punto de partida, con opción
explícita de cambio en Settings. Tres idiomas: ES, EN, PT-BR.

**Fallback chain:** idioma preferido del usuario → ES → EN (si la key no existe en ES).

#### Chrome Extension — `chrome.i18n` nativo MV3

- Estructura: `_locales/es/messages.json`, `_locales/en/messages.json`, `_locales/pt_BR/messages.json`
- API: `chrome.i18n.getMessage('key')` — wrapper `t('key')` para uso en JS
- HTML: atributos `data-i18n="key"` + walker en `init()` de cada página
- Detección: automática desde el idioma del browser Chrome
- Override usuario: campo `config.idioma` en `chrome.storage.local`
- Beneficio: CWS muestra descripción localizada automáticamente si `_locales/` contiene la descripción del producto

#### PWA — módulo custom `web/src/i18n/i18n.js`

- Estructura: función `t(key, vars)` + diccionarios por idioma en `web/src/i18n/strings.{es,en,pt_BR}.js`
- Detección: `navigator.language` → ES si empieza con 'es', PT-BR si empieza con 'pt', EN para el resto
- Override usuario: campo `config.idioma` en IndexedDB
- Toggle UI: vista Settings — prominente, con tres opciones visibles

#### Contrato de strings — catálogos independientes por superficie

> **Corrección (v0.5.1, hallazgo M-4 de la auditoría v0.5.0):** la afirmación
> previa de que "ambas plataformas usan las mismas keys, solo cambia el separador"
> es **incorrecta**. La verificación contra código vivo muestra:
> - **Paridad intra-superficie: perfecta** — los 3 idiomas son consistentes dentro
>   de cada superficie (Extension `_locales/`, PWA `i18n/strings.*.js`).
> - **Paridad cross-superficie: inexistente** — los vocabularios de keys son
>   distintos (no solo el separador `.` vs `_`); 179 de las keys de la PWA no
>   tienen equivalente en la Extension y los conteos divergen.
>
> Parte de la divergencia es legítima (cada superficie tiene pantallas que la otra
> no). No existe hoy un contrato de keys compartido ni verificación de paridad
> cross-superficie. **La decisión de si v0.6.0 unifica los catálogos en un contrato
> compartido o los mantiene independientes queda diferida a la arquitectura de
> v0.6.0.**

### D4 — Roadmap completo actualizado

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1–F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 ✅  UX Polish — navegación, legibilidad, fixes autofill
v0.4.0 ✅  PWA — vault en mobile via navegador, APK Android via TWA
v0.4.1 ✅  Ext: flujo "¿Olvidaste tu contraseña?"
v0.4.2 ✅  Auditoría #3 — 4 críticos + 4 altos resueltos, sync multi-dispositivo
v0.4.3 ✅  PWA: paridad con v0.4.1 Ext
v0.5.0 ✅  Auto-lock PWA + i18n ES/EN/PT-BR (Extension + PWA)  ← 2026-06-08
v0.6.0 ⏳  Capacitor — app nativa iOS + Android (hereda i18n de v0.5.0)
v0.7.0 ⏳  Autofill nativo — iOS Credential Provider + Android Autofill Service
v0.8.0 ⏳  Monetización — lifetime $29 + Stripe (cuando haya tracción medible)
v0.9.0 ⏳  Argon2id opcional + preparación auditoría
v1.0.0 ⏳  Auditoría Cure53 + App Store + Play Store público
```

---

## 25. Decisiones de Implementación — F5-A

**Fecha:** 2026-06-08

### Módulo: web/src/auto-lock/auto-lock-manager.js

La Chrome Extension usa `chrome.alarms` para el auto-lock (sobrevive al sleep del service worker MV3). La PWA no tiene `chrome.alarms` — la implementación usa exclusivamente Web APIs estándar.

**Contrato de módulo aprobado:**

```javascript
export function init({ limitMinutos, onLock }) { ... }  // 0 = "Nunca"
export function reset()   { ... }  // resetea _tsLastActivity + setTimeout
export function destroy() { ... }  // idempotente — safe para llamar N veces
```

### Mecanismo visibilitychange + Date.now()

Cuando la PWA va a background (`visibilitychange → 'hidden'`), `setTimeout` es poco fiable en mobile browsers. El auto-lock PWA usa:

1. Al ir a background: cancelar el `setTimeout` activo + registrar `_tsLastActivity`
2. Al volver a foreground (`visibilitychange → 'visible'`): evaluar `Date.now() - _tsLastActivity >= limitMs`
   - Si sí → `onLock()` inmediato
   - Si no → reanudar `setTimeout` con tiempo restante

### Persistencia de config

`config.autoLock` (integer, minutos) persiste en IndexedDB — mismo nombre de campo que `chrome.storage.local.config.autoLock` en la Extension. Valor 0 = "Nunca" (sin timer).

### Integración en el flujo de vistas

- `web/src/ui/views/unlock.js` — `init()` post-desbloqueo exitoso; `destroy()` antes de navegar
- `web/src/ui/views/settings.js` — selector UI persiste `config.autoLock`; `destroy()` antes de re-init; `destroy()` en bloqueo manual

### Riesgos identificados

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|------------|
| R1 | `setTimeout` no fiable en background mobile | Alto | `visibilitychange` + `Date.now()` evalúa tiempo real transcurrido |
| R2 | Timer no destruido al navegar → double-lock | Medio | `destroy()` idempotente llamado en cada transición de vista |
| R3 | Timer nunca iniciado con "Nunca" | Bajo | `limitMinutos === 0` → `init()` retorna sin crear timer |

---

## 26. Decisiones de Implementación — F5-B

**Fecha:** 2026-06-08

### Dos sistemas de i18n — mismo contrato de keys

F5-B implementa internacionalización (ES/EN/PT-BR) en dos plataformas con mecanismos distintos:

| Aspecto | Chrome Extension | PWA |
|---------|-----------------|-----|
| Mecanismo | `chrome.i18n` nativo MV3 | Módulo custom `web/src/i18n/i18n.js` |
| Archivos | `_locales/{es,en,pt_BR}/messages.json` | `web/src/i18n/strings.{es,en,pt_BR}.js` |
| Keys | Underscore (`auth_unlock_title`) | Puntos directos (`auth.unlock.title`) |
| Detección | Automática desde idioma del browser Chrome | `navigator.language` |
| Override | `config.idioma` en `chrome.storage.local` | `config.idioma` en IndexedDB |
| Toggle UI | Settings (Extension) | Settings — prominente ✅ |

Las keys se mantienen en sincronía **dentro de cada superficie** (paridad de los 3 idiomas) de forma manual, sin build step. **No** existe un contrato de keys compartido entre superficies — ver la corrección M-4 en "Contrato de strings — catálogos independientes por superficie" (decisión de unificación diferida a v0.6.0).

### Módulo i18n PWA — inicialización

```javascript
export async function initI18n() {
  try {
    const { config } = await idbStorage.get(['config'])
    const stored = config?.idioma
    if (stored && DICTIONARIES[stored]) {
      _dict = DICTIONARIES[stored]
      return  // early return — IDB tiene prioridad absoluta
    }
  } catch (_) { }
  const lang = navigator.language ?? 'en'
  if (lang.startsWith('es'))      { _dict = stringsEs }
  else if (lang.startsWith('pt')) { _dict = stringsPtBr }
  else                            { _dict = stringsEn }
}
```

El `early return` garantiza que `config.idioma` en IDB tiene prioridad absoluta — sin condición que lo bypasee.

### Toggle de idioma en Settings — decisiones de implementación

| Opción evaluada | Estado | Razón |
|---|---|---|
| `navegar('#/settings')` post-cambio | Descartada | Navega fuera de la vista actual si el usuario estaba en vault/generator |
| **`window.location.reload()`** | ✅ Elegida | Recarga completa — toda la UI (incluidos SW banner y nav) refleja el nuevo idioma |

**Opción "Automático" (no estaba en spec original):** La opción `auto` borra `config.idioma` del objeto de configuración con destructuring:

```javascript
const { idioma: _omit, ...configSinIdioma } = configActual
await idbStorage.set({ config: configSinIdioma })
```

Restaura la detección via `navigator.language` en la próxima carga. Aprobado por el arquitecto — mejora de UX, no una desviación del spec.

### Guard de copia en Generator — language-agnostic

La versión anterior usaba `texto.startsWith('Pulsa') || texto.startsWith('Selecciona')` — strings hardcodeados en español que romperían en EN/PT-BR. Solución: atributo `data-has-password` en el `<span>` de output:

```javascript
// Antes de generar: data-has-password="false"
// Después de generar exitosamente: data-has-password="true"
// Handler de copia: if (outputEl.dataset.hasPassword !== 'true') return
```

### ITEMS de navegación dentro de montarNavBottom()

Si el array `ITEMS` estuviera a nivel de módulo, `t()` se evaluaría en tiempo de import — antes de que `initI18n()` completara, mostrando keys en lugar de texto. Solución: definir `ITEMS` dentro de `montarNavBottom()` para que `t()` evalúe siempre después del `await initI18n()` en `app.js`.

### Riesgos identificados

| # | Riesgo | Severidad | Mitigación |
|---|--------|-----------|------------|
| R1 | `t()` evaluada antes de `initI18n()` | Alto | ITEMS de nav definidos dentro de `montarNavBottom()` |
| R2 | Copy guard rompe en idiomas no-ES | Medio | Reemplazado por `data-has-password` attribute |
| R3 | Toggle de idioma no re-monta todas las vistas | Medio | `window.location.reload()` — recarga completa |
| R4 | `auto` no borra `config.idioma` correctamente | Bajo | Destructuring elimina la key del objeto antes de persistir |

---

## 28. Decisiones de Implementación — v0.5.1 (Saneamiento pre-v0.6.0)

**Fecha:** 2026-06-11
**Origen:** Auditoría interna v0.5.0 (`docs/auditoria-v0.5.0-hallazgos.md`).
Ciclo de saneamiento que resuelve el cluster TOTP, paridad de sync Drive,
CSV injection, i18n del wizard y correcciones documentales **antes** de que
Capacitor (v0.6.0) herede el bundle PWA.

### D1 — Campo canónico TOTP: `totp`

El nombre canónico del secreto TOTP en el schema de credencial es `totp`.
La Extension usaba `claveTotp`; la PWA ya usaba `totp` (y Capacitor la hereda).
Migrar la Extension a `totp` toca menos código a largo plazo. Ver el schema
completo en §6.

### D2 — Migración: convergencia lazy activa en unlock (B2)

`credential-schema.js::normalizarTOTP` normaliza `claveTotp → totp` al cargar
(precedencia: gana `totp` si coexisten ambos, por ser determinista sin timestamp
por-campo). Si algún credencial traía `claveTotp`, el chokepoint dispara un único
`guardarVaultCifrado` de convergencia tras el unlock — el vault se sana en storage
y se propaga a la nube vía sync. Idempotente: tras converger no queda `claveTotp`,
el segundo unlock no re-dispara.

**Propiedad crítica:** `BLOB_VERSION` permanece en 1. La migración es a nivel de
schema de aplicación (sobre el array descifrado), no del envelope criptográfico —
`serializarAAD()` no cambia. Riesgo de corrupción de vault: nulo por diseño.

### D3 — Módulo `credential-schema.js` como chokepoint único

La normalización vive en `src/schema/credential-schema.js` (+ fork PWA), **no** en
`engine.js`: el engine es la única fuente de verdad de *cifrado*, no de *schema*.
Aplicado en los chokepoints de carga — Extension `vault.js`, PWA `unlock.js`
(el `setup.js` de la PWA crea vault vacío o delega el restore en `unlock.js`, por
lo que `unlock.js` es el chokepoint efectivo). Incorporado al protocolo de forks
(`verify-crypto-sync.sh`).

### D4 — TOTP funcional en la PWA (A-2)

La PWA almacenaba el secreto pero nunca generaba el código. v0.5.1 porta
`totp.js` al fork PWA (módulo puro Web Crypto; produce códigos idénticos a la
Extension) y añade el código en vivo + countdown + copia en la card del vault.

### D5 — Adapters de sync: fix 404 + protocolo de forks (M-1/D6)

`google-drive-adapter.js` de la Extension recibe el `_invalidarFileId()` + manejo
de 404 que solo existía en el fork PWA (drift invertido — el fix estaba en el fork,
no en el original). `verify-crypto-sync.sh` ahora verifica el contrato público
StorageAdapter de los 4 adapters (Google Drive + OneDrive × 2 superficies) y ancla
la presencia del fix 404 en ambas superficies. OneDrive es inmune (direcciona por
path, no por fileId cacheado).

### D6 — CSV formula injection + columna TOTP canónica (M-2/M-3)

`escaparCampo()` (ambos exportadores) neutraliza campos que empiezan con `= + - @`
tab o CR prefijando comilla simple (OWASP CSV Injection). La columna `login_totp`
del export Bitwarden lee `totp` (canónico) con fallback a `claveTotp` legacy.

### D7 — i18n del wizard de import (B-2)

Los ~20 strings hardcoded del wizard de import de la PWA (`import-wizard.js`)
pasan a `t()`. 29 keys nuevas `import.*` en ES/EN/PT-BR con variantes `.one/.other`.
Paridad intra-superficie mantenida.

### D8 — Documentación corregida

§6 documenta el schema canónico de credencial (incluido `totp`). §10 desglosa la
deuda de fileId Drive por superficie y añade el refresh_token de OneDrive a la
tabla de amenazas. §26 corrige la afirmación inexacta de paridad de keys i18n
cross-superficie (decisión de unificación diferida a v0.6.0).

### Criterio de aceptación de migración (verificación de storage)

Tras el primer unlock post-actualización en la Extension, ningún objeto credencial
del vault debe conservar la propiedad `claveTotp`. Verificación: Chrome DevTools →
Application → Extension Storage → Local, o un log de diagnóstico temporal sobre las
credenciales en sesión post-normalización. Solo aplica a la Extension (origen de
`claveTotp`); la PWA no tiene este campo.

**D8 — QA resultado:** No aplicable en este ciclo. No existen vaults con TOTP
creado pre-v0.5.1 en el entorno de prueba. El shim `normalizarTOTP()` fue verificado
por Code vía test funcional unitario (commit `efcc8b9`). La verificación en DevTools
queda como procedimiento documentado para cuando existan usuarios reales con TOTP
legacy.

---

## 27. Referencias

### Estándares y especificaciones

- **NIST FIPS 197** — Advanced Encryption Standard (AES)
  https://csrc.nist.gov/publications/detail/fips/197/final

- **NIST SP 800-38D** — GCM Mode
  https://csrc.nist.gov/publications/detail/sp/800-38d/final

- **OWASP Password Storage Cheat Sheet 2024**
  https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

- **OWASP Mobile Security Testing Guide (MSTG)**
  https://owasp.org/www-project-mobile-security-testing-guide/

- **Web Crypto API — W3C Specification**
  https://www.w3.org/TR/WebCryptoAPI/

- **Chrome Extension Manifest V3**
  https://developer.chrome.com/docs/extensions/mv3/

- **RFC 6238** — TOTP: Time-Based One-Time Password Algorithm
  https://datatracker.ietf.org/doc/html/rfc6238

### Decisiones arquitecturales

- **ADR-001** — Stack tecnológico para mobile: PWA → Capacitor
  `docs/decisions/ADR-001-stack-mobile.md`

### Herramientas utilizadas

- **Web Crypto API** — Motor criptográfico nativo del browser (Chrome + mobile)
- **chrome.storage.local** — Almacenamiento persistente (Chrome Extension)
- **IndexedDB** — Almacenamiento persistente (PWA)
- **chrome.storage.session / sessionStorage** — Almacenamiento de sesión volátil
- **chrome.alarms** — Timers persistentes en Service Workers MV3
- **MutationObserver API** — Detección de cambios dinámicos en el DOM
- **Workbox** — Service Worker para cache offline en PWA

---

## 29. Decisiones de Implementación — v0.6.0 Capacitor Android-first

**Fecha:** 2026-06-12

| Decisión | Resolución |
|---|---|
| DA-1: TWA app/ | Eliminado. Reemplazado por `android/` generado por Capacitor CLI. |
| DA-2: Plugin biometría | `DpmKeyPlugin` nativo propio (`BiometricPrompt.CryptoObject`). `@aparajita/capacitor-secure-storage` descartado — no expone `CryptoObject` en Android. La `wrap_key` nunca sale del hardware; JS recibe solo `{iv, ciphertext}`. |
| DA-3: `_deviceId` | Dentro del vault cifrado — nunca en sync metadata en claro (consistencia ZK). **Embedding hecho en Sprint 2 (Backlog H-5, sep-2026 — §30):** `_deviceId` se resuelve dentro del engine (PWA vía `device-id.js`; Extension → `null`) y se incluye en el payload cifrado en `configurarVault`, `guardarVaultCifrado` y `cambiarMasterPassword`. Sin bump de `BLOB_VERSION` (es contenido cifrado, no metadato del envelope). |
| DA-4: OneDrive token (B-1) | Diferido a v0.7.0 — el `refresh_token` lo gestiona MSAL en `sessionStorage`, no hay nada en IDB que migrar. |
| DA-5: M-4, H-9 | Diferidos a v0.7.0. |
| Scope | Android-first. iOS (v0.6.1/v0.7.0) requiere macOS + Apple Developer $99. |

**Principio no negociable:** la `wrap_key` nunca sale del hardware. JS recibe `{iv, ciphertext}` o el `vault_key` descifrado — nunca la `wrap_key`. Ver §5 "Biometría en Capacitor" para el patrón completo.

---

## 30. Decisiones de Implementación — H-5 (`_deviceId` en el vault, Sprint 2)

**Fecha:** 2026-09-06 · **Sprint:** 2 · **Reemplaza:** §29 DA-3 ("diferido a v0.7.0 con H-9" — ya no aplica)

Origen: gate de arquitectura del *Backlog H-5* (Sprint 2). El brief del arquitecto
revisor pasó por dos versiones; esta sección consolida la v2, corregida tras la
auditoría de código de Code.

### D-1 — El payload cifrado ya es un objeto, no un array plano

Premisa corregida del brief v1: desde v0.4.0 ambos forks cifran
`cifrarConVersion({ credenciales }, clave)` y `cargarVaultDescifrado()` devuelve
`vault.credenciales || []`. El contenido cifrado **ya es un objeto**. Añadir
`_deviceId` es un campo más en ese objeto — compatible hacia atrás y hacia
adelante sin lógica de lectura dual-forma ni convergencia. No existe en
producción ninguna forma legada de array plano.

### D-2 — `BLOB_VERSION` no cambia · sin migración

`_deviceId` vive dentro de `datos` (contenido cifrado), no en los campos del AAD
(`__version`, `kdf`, `kdfIterations` — §13). No toca `serializarAAD()`.
`BLOB_VERSION` permanece en 1. Un vault sin `_deviceId` (legado, o recién creado
antes de este cambio) se lee sin error; el campo aparece en el próximo guardado.

### D-3 — Resolución dentro del engine, sin parámetro nuevo

`guardarVaultCifrado()` **mantiene su firma** en ambos forks. El engine resuelve
`_deviceId` internamente vía el helper `_resolverDeviceId()`:

- **PWA** (`web/src/crypto/engine.js`): `_resolverDeviceId()` → `obtenerDeviceId()`
  de `device-id.js` (UUID opaco persistido en IndexedDB). Cubre los 6 call sites
  de escritura del vault sin tocar ninguno.
- **Extension** (`src/crypto/engine.js`): `_resolverDeviceId()` → `null`. La
  Extension no genera identidad de instalación (decisión de producto pendiente).
  El dispositivo que re-cifra es el último escritor y no tiene id → `null` es el
  valor correcto, no una pérdida.

No es un parámetro opcional que ningún caller pasaría (misma "superficie sin uso
real" que se evitó en otras decisiones). Paridad de **comportamiento** entre
forks, no de firma con argumentos sin consumidor. `verify-crypto-sync.sh` compara
la API surface exportada, no helpers internos ni imports — exit 0.

### D-3b — Toda función que cifra y persiste el vault completo

No solo `guardarVaultCifrado`. `configurarVault()` embebe `_deviceId` desde la
creación. `cambiarMasterPassword()` lo re-resuelve al re-cifrar: un cambio de
master password re-cifra un vault que ya podía tener `_deviceId` seteado — nunca
puede dejar el campo pasar de "presente" a "ausente" en silencio (sería una
regresión, no convergencia lazy).

### D-4 — Relación con el sync y con H-9

`device-id.js` es la **fuente canónica única** de identidad de dispositivo en el
código. El sync per-item con `deviceId`/`lamportClock` por item (§15) **no está
implementado** — es diseño de referencia. El sync vigente (blob monolítico LWW,
§12/§19) sube el `vaultCifrado` completo, así que `_deviceId` ya viaja cifrado
dentro del blob; lo que falta es que `sync-manager.js` lo lea y lo compare (ver
Hallazgo H-5 de auditoría en §21). `syncLog[]` (Backlog H-9, Sprint 3) debe
consumir `device-id.js` — no generar una segunda identidad.

### Asimetría de forks documentada

`device-id.js` existe solo en `web/` (PWA). No es una fila de la tabla Fork Sync
Protocol de `CLAUDE.md` — esa tabla certifica pares que deben existir en ambos
forks. La asimetría (Extension sin identidad de dispositivo) es deliberada, no
drift.

### Riesgo de release

El AAB v0.6.0 ya firmado (pendiente de subir al internal track cuando apruebe
PS-1) es un snapshot de `web/src/crypto/engine.js` **anterior** a H-5. No
re-firmar ni resubir un AAB con H-5 antes de esa subida — se sube el AAB v0.6.0
tal cual, y H-5 entra en el siguiente build Android.

### Verificación

- `verify-crypto-sync.sh` → exit 0 (constantes + API surface).
- `tests/h5-verify.mjs` (harness Node temporal, stub de storage por superficie) →
  exit 0: `_deviceId` embebido en `configurarVault`/`guardarVaultCifrado`/
  `cambiarMasterPassword`; PWA = UUID v4 estable == deviceId en IDB; Extension =
  `null`; `cargarVaultDescifrado()` sigue devolviendo array plano; `BLOB_VERSION`
  = 1; blob legado sin `_deviceId` se lee sin romper.

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
>
> Repositorio: [github.com/DacmosGroup/dacmosgroup-password-manager](https://github.com/DacmosGroup/dacmosgroup-password-manager)
