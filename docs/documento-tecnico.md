# 🔐 Documento Técnico — Dacmos Password Manager

**Versión 0.3.0 · Mayo 2026**
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
13. [Referencias](#13-referencias)

---

## 1. Visión General

Dacmos Password Manager es una extensión Chrome construida con **Manifest V3** que implementa un gestor de contraseñas con modelo **Zero-Knowledge local-first**.

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
├── Plataforma:     Chrome Extension Manifest V3
├── Lenguaje:       JavaScript (ES Modules)
├── Crypto:         Web Crypto API (nativa del browser)
├── Almacenamiento: chrome.storage.local / chrome.storage.session
├── UI:             HTML5 + CSS3 (Vanilla — sin frameworks)
└── Versión:        0.3.0
```

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
         ├──► [Cifrar vault] ──► [chrome.storage.local ← solo datos cifrados]
         │
         └──► [Descifrar vault] ──► [Credenciales en memoria durante sesión]
                                              │
                                              ▼
                                    [chrome.storage.session]
                                    (volátil — se borra al cerrar browser)
```

---

## 3. Arquitectura de la Extensión

### Componentes principales

```
dacmosgroup-password-manager/
├── manifest.json              ← Declaración de permisos y puntos de entrada
├── src/
│   ├── background/
│   │   └── service-worker.js  ← Gestión de estado, mensajes, autolock
│   ├── content/
│   │   └── autofill.js        ← Inyectado en páginas web — detección y autocompletado
│   ├── crypto/
│   │   └── engine.js          ← Motor AES-256-GCM + PBKDF2 (núcleo de seguridad)
│   └── ui/
│       ├── popup/             ← Punto de entrada — estado del vault
│       ├── vault/             ← CRUD de credenciales
│       ├── settings/          ← Configuración y gestión de master password
│       └── generator/         ← Generador criptográfico de contraseñas
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

[UI: popup/vault/settings]
     │  (import directo — ES Modules)
     ▼
[Motor de cifrado: engine.js]
     │  (chrome.storage.local)
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

El motor de cifrado está implementado en `src/crypto/engine.js` usando exclusivamente la **Web Crypto API nativa** del browser. No se utilizan librerías de terceros.

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

Con 600,000 iteraciones y una contraseña de 12+ caracteres:
└── Costo de fuerza bruta exhaustiva: > 100 años de cómputo continuo
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
├── Se escribe en chrome.storage.local
├── Se serializa en JSON
├── Se transmite por red
└── Se loguea en consola
```

---

## 6. Almacenamiento y Sesiones

### chrome.storage.local — Datos persistentes

Almacena únicamente datos cifrados:

```javascript
{
  vaultConfigurado:    Boolean,     // ¿Existe un vault configurado?
  sal:                 Base64,      // Salt para derivación de clave de cifrado
  sal2:                Base64,      // Salt para derivación de clave de verificación
  tokenVerificacion:   { iv, datos }, // Token cifrado para verificar master password
  vaultCifrado:        { iv, datos }, // Vault completo cifrado con AES-256-GCM
  sesionActiva:        Boolean,     // Estado de la sesión (no datos sensibles)
  config:              Object,      // Configuración de usuario (autolock, clipboard)
}
```

> **Nota de seguridad:** `sesionActiva: true` no implica que las credenciales estén en memoria. El service worker puede haberse reiniciado. La clave AES debe re-derivarse en cada sesión.

### chrome.storage.session — Datos de sesión

Almacena credenciales descifradas durante la sesión activa:

```javascript
{
  credencialesSesion: Array  // Credenciales en claro — SOLO durante sesión activa
}
```

**Propiedades de seguridad de `chrome.storage.session`:**
- Se borra automáticamente al cerrar el browser
- No persiste entre reinicios de Chrome
- Solo accesible por la extensión que lo creó
- Se limpia explícitamente al bloquear el vault

### Estrategia de limpieza de datos sensibles

```javascript
async function bloquearVault() {
  // 1. Cancelar alarma de autolock
  chrome.alarms.clear('autoLock');

  // 2. Limpiar credenciales de sesión
  await chrome.storage.session.clear();

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
// Si alphabet.length = 90 y randomByte ∈ [0,255]:
// Bytes 0-179 mapean uniformemente
// Bytes 180-255 mapean a chars 0-75 (con el doble de probabilidad)
```

**La solución con rejection sampling:**
```javascript
// ✅ CORRECTO — sin sesgo
const limite = 256 - (256 % alphabet.length); // 256 - (256 % 90) = 256 - 76 = 180

for (const byte of randomBytes) {
  if (byte < limite) {           // Solo aceptar bytes < 180
    result.push(alphabet[byte % alphabet.length]);
  }
  // Rechazar bytes >= 180 (los que causarían sesgo)
}
```

### Cálculo de entropía

La entropía mide los bits de aleatoriedad de una contraseña:

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

> Un ataque de supply chain en una librería de crypto podría comprometer TODOS los vaults de todos los usuarios. Web Crypto API elimina este riesgo completamente.

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
| Robo de chrome.storage.local | Alto | Todos los datos están cifrados con AES-256-GCM |
| Fuerza bruta en master password | Alto | PBKDF2-SHA256 × 600,000 iteraciones |
| Inyección XSS en vault UI | Medio | Función escapeHtml() en todos los datos del usuario |
| Content script malicioso | Medio | Aislamiento de contextos MV3 |
| Supply chain (librerías) | Alto | Sin dependencias de crypto de terceros |
| Prompt injection | Bajo | No hay procesamiento de texto no confiable |
| Timing attack en verificación | Bajo | Verificación por descifrado (AES-GCM falla uniformemente) |
| Exposición en portapapeles | Medio | Limpieza automática configurable (default: 30 segundos) |
| Session hijacking | Bajo | chrome.storage.session solo accesible por la extensión |

### Limitaciones conocidas

1. **Sin protección contra keyloggers** — si el dispositivo está comprometido a nivel de sistema operativo, la master password puede capturarse al ingresarse
2. **Sin protección contra extensiones maliciosas** — otras extensiones con permisos elevados podrían leer `chrome.storage.local`
3. **Dependencia del modelo de seguridad de Chrome** — vulnerabilidades en Chrome podrían afectar el aislamiento de contextos
4. **Sin 2FA** — no existe un segundo factor de autenticación en v0.1.1

### Mitigaciones futuras planificadas

- Fase 2: Cifrado adicional con clave derivada del dispositivo (hardware binding)
- Fase 2: Verificación de integridad del vault (detectar manipulación)
- Fase 3: Soporte para autenticación biométrica en Android

---

## 11. Roadmap Técnico

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.4.0 ⏳  App móvil React Native (iOS + Android)
v0.5.0 ⏳  Tier Premium $1-1.50/mes + Plan Familias
v1.0.0 ⏳  Auditoría Cure53 + listado público Chrome Web Store
```

### Fase 4 — Android App (React Native)

La lógica de cifrado se portará a React Native usando:
- `expo-crypto` para acceso a primitivas nativas
- Mismos algoritmos y parámetros (AES-256-GCM + PBKDF2-SHA256 × 600,000)
- `expo-local-authentication` para biometría (Face ID / Fingerprint)
- `expo-secure-store` como alternativa a chrome.storage.local

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

Implementado en `src/sync/google-drive-adapter.js`:

- Autenticación OAuth via `chrome.identity` con scope `drive.appdata`
- Almacena el vault en la carpeta privada de la app — no visible en la UI de Drive
- El archivo es un blob JSON `{ iv, datos }` completamente opaco para Google
- Usa la REST API de Google Drive v3

**Flujo de autenticación:**

```
chrome.identity.getAuthToken({ interactive: true })
        │
        ▼
[Token OAuth scope: drive.appdata]
        │
        ▼
[Subir / descargar blob AES-256-GCM vía Drive API]
```

### OneDriveAdapter

Implementado en `src/sync/onedrive-adapter.js`:

- Autenticación OAuth via `chrome.identity` con cuenta Microsoft
- Almacena el vault en `/me/drive/special/approot` via Microsoft Graph API
- Mismo blob opaco que Google Drive — Microsoft nunca ve los datos en claro
- Scope mínimo: `Files.ReadWrite.AppFolder`

### SyncManager

Orquestador en `src/sync/sync-manager.js`. Coordina los adaptadores y resuelve conflictos:

```javascript
// Flujo principal de sincronización
async function sincronizar(adapter) {
  const tsLocal  = await obtenerTimestampLocal()
  const tsRemoto = await adapter.ultimaModificacion()

  if (tsLocal > tsRemoto)  return await subirVault(adapter)
  if (tsRemoto > tsLocal)  return await descargarYFusionar(adapter)
  // Igual timestamp → sin cambios
}
```

### Flujo de sincronización completo

```
[Usuario conecta proveedor en Settings]
        │
        ▼
[OAuth → Token almacenado en chrome.storage.local (cifrado)]
        │
        ▼
[SyncManager compara timestamps local vs. remoto]
        │
        ├── Local más reciente  → subir vault cifrado
        ├── Remoto más reciente → descargar y fusionar
        └── Igual               → no hacer nada
        │
        ▼
[Badge en popup: ✅ Sincronizado / ⚠️ Pendiente / ❌ Error]
```

### Resolución de conflictos — Last Write Wins (LWW)

Estrategia **LWW por timestamp** a nivel de credencial individual:

```
Si ambos dispositivos modificaron el vault desde la última sync:
  1. Descargar versión remota
  2. Unión de arrays por ID de credencial
  3. En colisiones por ID → conservar el campo modificado más reciente
  4. Subir versión fusionada
  5. Notificar al usuario el resultado
```

### Guardia anti-loop `_syncTs`

Para evitar que dos dispositivos se sincronicen mutuamente en cascada, cada operación de subida incluye un timestamp `_syncTs` en los metadatos del archivo. El SyncManager ignora una descarga si `_syncTs` coincide con la última subida propia.

```javascript
// Prevención de loop: no procesar una descarga que yo mismo subí
if (metadatos._syncTs === ultimaSubidaPropia) return
```

### Seguridad Zero-Knowledge mantenida

| Principio | Implementación en v0.3.0 |
|-----------|--------------------------|
| El proveedor nunca ve la clave | La clave AES permanece en memoria RAM local — nunca se sube |
| El vault viaja cifrado | Blob `{ iv, datos }` — AES-256-GCM opaco |
| OAuth scope mínimo | `drive.appdata` (Google) / `Files.ReadWrite.AppFolder` (Microsoft) |
| Token OAuth protegido | Almacenado en `chrome.storage.local` con cifrado de Chrome |
| Sin servidor de DacmosGroup | Todo en la cuenta del usuario — zero infraestructura propia |

### Árbol de archivos de sync

```
src/sync/
├── storage-adapter.js       ← Interfaz base (clase abstracta)
├── google-drive-adapter.js  ← Adaptador Google Drive (drive.appdata)
├── onedrive-adapter.js      ← Adaptador OneDrive (Graph API)
└── sync-manager.js          ← Orquestador: timestamps, conflictos, estado
```

---

## 13. Referencias

### Estándares y especificaciones

- **NIST FIPS 197** — Advanced Encryption Standard (AES)
  https://csrc.nist.gov/publications/detail/fips/197/final

- **NIST SP 800-38D** — GCM Mode
  https://csrc.nist.gov/publications/detail/sp/800-38d/final

- **OWASP Password Storage Cheat Sheet 2024**
  https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

- **Web Crypto API — W3C Specification**
  https://www.w3.org/TR/WebCryptoAPI/

- **Chrome Extension Manifest V3**
  https://developer.chrome.com/docs/extensions/mv3/

### Herramientas utilizadas

- **Web Crypto API** — Motor criptográfico nativo del browser
- **chrome.storage.local** — Almacenamiento persistente cifrado
- **chrome.storage.session** — Almacenamiento de sesión volátil
- **chrome.alarms** — Timers persistentes en Service Workers MV3
- **MutationObserver API** — Detección de cambios dinámicos en el DOM

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
>
> Repositorio: [github.com/DacmosGroup/dacmosgroup-password-manager](https://github.com/DacmosGroup/dacmosgroup-password-manager)
