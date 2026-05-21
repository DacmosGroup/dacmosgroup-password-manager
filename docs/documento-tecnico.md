# 🔐 Documento Técnico — Dacmos Password Manager

**Versión 0.4.0 · Mayo 2026**
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
16. [Referencias](#16-referencias)

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
└── Despliegue:     Cloudflare Pages (app.dacmosgroup.co)

App Nativa (v0.5.0+):
├── Plataforma:     Capacitor (iOS + Android)
├── Crypto:         crypto.subtle en WKWebView / Chromium WebView
├── Almacenamiento: iOS Keychain / Android Keystore
└── Distribución:   Google Play Store + App Store
```

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
                                              ▼
                                    [chrome.storage.session / sessionStorage]
                                    (volátil — se borra al cerrar browser)
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
const token = await descifrar(tokenVerificacion, claveVerif);
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
  await chrome.storage.session.clear(); // o sessionStorage.clear() en PWA

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
| Session hijacking | Bajo | chrome.storage.session / sessionStorage solo accesible por la extensión / origen |

### Limitaciones conocidas

1. **Sin protección contra keyloggers** — si el dispositivo está comprometido a nivel de SO, la master password puede capturarse al ingresarse
2. **Sin protección contra extensiones maliciosas** — otras extensiones con permisos elevados podrían leer `chrome.storage.local`
3. **Dependencia del modelo de seguridad de Chrome** — vulnerabilidades en Chrome podrían afectar el aislamiento de contextos
4. **Sin 2FA para el vault** — no existe un segundo factor para desbloquear el vault en sí (el vault gestiona 2FA/TOTP de terceros)
5. **iOS Safari eviction** — datos locales pueden borrarse tras 7 días sin uso si el usuario no activa persistencia ni sync (mitigado en v0.4.0)
6. **Autofill no disponible en PWA iOS** — limitación estructural de Apple; se resuelve con autofill nativo en v0.6.0

---

## 11. Roadmap Técnico

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 ✅  UX Polish — navegación, legibilidad, fixes autofill
v0.4.0 🔄  PWA — vault en mobile via navegador, APK Android via TWA
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
| Token OAuth protegido | Almacenado en `chrome.storage.local` / `sessionStorage` con cifrado del browser |
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
// Serializar el header como AAD
const aad = new TextEncoder().encode(
  JSON.stringify({ __version: blob.__version, kdf: blob.kdf, kdfIterations: blob.kdfIterations })
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

## 16. Referencias

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
