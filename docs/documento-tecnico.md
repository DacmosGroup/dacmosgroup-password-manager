# 🔐 Documento Técnico — Dacmos Password Manager

**Versión 0.4.1 · Mayo 2026**
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
19. [Referencias](#19-referencias)

---

## 1. Visión General

Dacmos Password Manager es una extensión Chrome construida con **Manifest V3** que implementa un gestor de contraseñas con modelo **Zero-Knowledge local-first**. A partir de v0.4.0, el mismo vault es accesible desde mobile mediante una **Progressive Web App (PWA)**, y en v0.5.0 como app nativa via Capacitor.

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

App Nativa (v0.5.0+):
├── Plataforma:     Capacitor (iOS + Android)
├── Crypto:         crypto.subtle en WKWebView / Chromium WebView
├── Almacenamiento: iOS Keychain / Android Keystore
└── Distribución:   Google Play Store + App Store
```

### Versiones actuales por plataforma

| Plataforma | Versión | Notas |
|------------|---------|-------|
| **PWA** (`dpm.dacmosgroup.co`) | **v0.4.1** | Versión activa — incluye remediaciones de auditoría |
| **Chrome Extension** (Chrome Web Store) | **v0.3.1** | Ciclo de release independiente — los PRs de remediación v0.4.x afectaron principalmente la PWA; el bump de la extensión se realizará en el próximo release dedicado |
| **APK Android** (GitHub Releases + IzzyOnDroid) | **v0.4.1** | Generado via TWA — sigue la versión de la PWA |

> **Nota:** La Chrome Extension y la PWA comparten el motor de cifrado (`engine.js`) pero tienen cadencias de release separadas. Un vault creado con la extensión v0.3.1 es plenamente compatible con la PWA v0.4.1 (backward compat garantizada — ver Sección 13).

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
| Inyección XSS en vault UI | Medio | Función escapeHtml() en todos los datos del usuario |
| Content script malicioso | Medio | Aislamiento de contextos MV3 |
| Supply chain (librerías) | Alto | Sin dependencias de crypto de terceros |
| Biometría bypasseable en mobile | Alto | BiometricPrompt.CryptoObject obligatorio (v0.5.0+) |
| Eviction de datos iOS Safari | Medio | navigator.storage.persist() + sync BYOC como red de seguridad |
| Prompt injection | Bajo | No hay procesamiento de texto no confiable |
| Timing attack en verificación | Bajo | Verificación por descifrado (AES-GCM falla uniformemente) |
| Exposición en portapapeles | Medio | Limpieza automática configurable (default: 30 segundos) |
| Session hijacking (Extensión) | Bajo | chrome.storage.session accesible solo por la extensión — aislamiento MV3 |
| Tokens OAuth en sessionStorage (PWA) | Bajo | MSAL almacena tokens de Microsoft en sessionStorage — aislado por origen, no cifrado por el API; el cifrado es del perfil del browser en disco. Tokens de Google viven en memoria pura (nunca en storage). |
| XSS en PWA | Medio | La PWA no tiene el aislamiento MV3 de múltiples contextos. Un XSS exitoso en `dpm.dacmosgroup.co` podría acceder a las variables de `session.js`. Mitigaciones: CSP sin `unsafe-inline`/`unsafe-eval` (implementada desde v0.4.1), `escapeHtml()` en todos los datos de usuario, sin `eval()`. |
| Service Worker comprometido (PWA) | Medio | Un SW interceptor puede servir assets modificados a todos los clientes de ese origen. Mitigaciones: HTTPS obligatorio en Cloudflare Pages, SW servido desde el mismo origen (`'self'`), `worker-src` restringida en CSP, Workbox fijado a versión exacta (`7.0.0`). |

### Limitaciones conocidas

1. **Sin protección contra keyloggers** — si el dispositivo está comprometido a nivel de SO, la master password puede capturarse al ingresarse
2. **Sin protección contra extensiones maliciosas** — otras extensiones con permisos elevados podrían leer `chrome.storage.local`
3. **Dependencia del modelo de seguridad de Chrome** — vulnerabilidades en Chrome podrían afectar el aislamiento de contextos
4. **Sin 2FA para el vault** — no existe un segundo factor para desbloquear el vault en sí (el vault gestiona 2FA/TOTP de terceros)
5. **iOS Safari eviction** — datos locales pueden borrarse tras 7 días sin uso si el usuario no activa persistencia ni sync (mitigado en v0.4.0)
6. **Autofill no disponible en PWA iOS** — limitación estructural de Apple; se resuelve con autofill nativo en v0.6.0

### Deudas técnicas identificadas — auditoría v0.4.0

| Deuda | Descripción | Impacto | Resolución esperada |
|-------|-------------|---------|---------------------|
| `ultimaModificacion()` sin invalidación de fileId | `GoogleDriveAdapter.ultimaModificacion()` no invalida el fileId cacheado en IDB cuando Drive retorna 404. La autocorrección ocurre en el siguiente `guardar()` o `cargar()`, que sí implementan la invalidación. | Bajo — error visible en el sync, sin pérdida de datos | v0.5.0 o próximo PR de Drive |
| Precache revision fields manuales | Los campos `revision` del precache en `web/service-worker.js` deben incrementarse manualmente por archivo al hacer deploy. Sin Workbox Inject Manifest no hay automatización. | Operacional — usuarios pueden usar assets desactualizados hasta que la cache expire (30 días TTL) | v0.5.0 con build pipeline |
| Import desde setup (Caso 1 — vault vacío) | `importarVaultBackup()` maneja correctamente el Caso 1 (sin vault previo) pero no hay ruta UI que lo dispare — Settings requiere sesión activa. El código es correcto; falta la UX de "Restaurar backup" en la pantalla de setup inicial. | UX — el import solo funciona si el usuario ya tiene un vault configurado | v0.5.0 — pantalla de setup con opción de restauración |

---

## 11. Roadmap Técnico

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 ✅  UX Polish — navegación, legibilidad, fixes autofill
v0.4.0 ✅  PWA — vault en mobile via navegador, APK Android via TWA
v0.4.1 ✅  Remediación auditoría de seguridad — 5 hallazgos corregidos (A-1, M-1..4, B-1..2)
v0.5.0 ⏳  Capacitor — app nativa iOS + Android, biometría, Play Store
v0.6.0 ⏳  Autofill nativo — iOS Credential Provider + Android Autofill Service
v0.7.0 ⏳  Argon2id opcional + preparación de auditoría
v1.0.0 ⏳  Auditoría Cure53 + listado público CWS + App Store + Play Store
```

### Fase 4 — PWA Mobile (v0.4.0)

La expansión mobile reutiliza el código JavaScript existente sin modificar la lógica de cifrado:

- `engine.js` y `totp.js` — **intactos, sin cambios**
- `crypto.subtle` en WKWebView / Chromium WebView — misma API que Chrome desktop
- `IndexedDB` reemplaza `chrome.storage.local` — mismo formato de datos
- OAuth PKCE con Google Identity Services JS y MSAL.js v3 — reemplaza `chrome.identity`
- Workbox Service Worker — cache-first offline, compatible con todos los browsers mobile

### Fase 5 — Capacitor (v0.5.0)

La misma PWA de v0.4.0 ejecuta dentro de un shell Capacitor nativo:

- WKWebView (iOS) / Chromium WebView (Android) — `crypto.subtle` intacta
- Módulo nativo propio para biometría (Swift + Kotlin) con `BiometricPrompt.CryptoObject`
- `@aparajita/capacitor-secure-storage` para Keychain / Keystore
- Sync per-item con Lamport ordering (ver Sección 14)

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

> **Limitación conocida del modelo LWW de blob único:** si dos dispositivos editan offline simultáneamente, el último en subir sobreescribe al otro. Este comportamiento es aceptable en v0.3.x y v0.4.0 donde el uso multi-dispositivo simultáneo offline es raro. Se resuelve definitivamente en v0.5.0 con sync per-item (ver Sección 14).

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

*(Implementación en v0.5.0 — documentada aquí como referencia arquitectural)*

El modelo de sync de blob único (v0.3.x — v0.4.0) usa Last Write Wins sobre un solo archivo en Drive/OneDrive. Este modelo garantiza pérdida silenciosa de credenciales si dos dispositivos editan offline simultáneamente y luego sincronizan — un escenario inaceptable para un password manager.

v0.5.0 introduce un modelo **per-item** que elimina este problema.

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

## 19. Referencias

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

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
>
> Repositorio: [github.com/DacmosGroup/dacmosgroup-password-manager](https://github.com/DacmosGroup/dacmosgroup-password-manager)
