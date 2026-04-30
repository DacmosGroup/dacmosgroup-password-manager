# 📎 Adiciones v0.2.0 — Documento Técnico
## Instrucciones de integración
Insertar estas secciones en `docs/documento-tecnico.md`:
- Actualizar encabezado: "Versión 0.2.0 · Abril 2026"
- Actualizar Stack: agregar módulos nuevos
- Agregar secciones 13-18 al final, antes de Referencias
- Actualizar sección 3 (Arquitectura) con nueva estructura de carpetas
- Actualizar sección 11 (Roadmap) con estado actual

---

## ACTUALIZACIÓN — Encabezado

Reemplazar:
`**Versión 0.1.1 · Abril 2026**`

Por:
`**Versión 0.2.0 · Abril 2026**`

---

## ACTUALIZACIÓN — Stack tecnológico (Sección 1)

Reemplazar el bloque de stack por:

```
├── Plataforma:     Chrome Extension Manifest V3
├── Lenguaje:       JavaScript (ES Modules)
├── Crypto:         Web Crypto API (nativa del browser)
├── Almacenamiento: chrome.storage.local / chrome.storage.session
├── UI:             HTML5 + CSS3 (Vanilla — sin frameworks)
└── Versión:        0.2.0

Módulos v0.2.0 (nuevos):
├── src/import/csv-importer.js     ← Parser RFC 4180 + fingerprinting
├── src/export/csv-exporter.js     ← Generador CSV genérico y Bitwarden
├── src/crypto/totp.js             ← RFC 6238 via Web Crypto API
├── src/health/password-health.js  ← Entropía + HIBP k-anonymity
├── src/ui/vault/credential-types.js ← Login, Tarjeta, Identidad
└── src/utils/url-matcher.js       ← eTLD+1 + scoring system
```

---

## ACTUALIZACIÓN — Arquitectura (Sección 3)

Reemplazar el árbol de estructura por:

```
dacmosgroup-password-manager/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.js
│   ├── content/
│   │   └── autofill.js          ← F1.5: detección checkout/identidad
│   ├── crypto/
│   │   ├── engine.js            ← Motor AES-256-GCM (sin cambios)
│   │   └── totp.js              ← F1.2: RFC 6238 TOTP
│   ├── export/
│   │   └── csv-exporter.js      ← F1.4: CSV genérico y Bitwarden
│   ├── health/
│   │   └── password-health.js   ← F1.3: entropía + HIBP
│   ├── import/
│   │   └── csv-importer.js      ← F1.1: parser RFC 4180
│   ├── ui/
│   │   ├── popup/
│   │   ├── vault/
│   │   │   ├── credential-types.js ← F1.5: tipos de credencial
│   │   │   ├── vault.html
│   │   │   ├── vault.js
│   │   │   └── vault.css
│   │   ├── health/              ← F1.3: dashboard de salud
│   │   ├── settings/
│   │   │   ├── import-wizard.js ← F1.1: UI importación CSV
│   │   │   ├── settings.html
│   │   │   ├── settings.js
│   │   │   └── settings.css
│   │   └── generator/
│   └── utils/
│       ├── helpers.js
│       └── url-matcher.js       ← F1.6: matching eTLD+1
└── assets/
    └── icons/
```

---

## NUEVAS SECCIONES — Agregar al final (antes de Referencias)

---

## 13. Módulo de Importación CSV (F1.1)

### Arquitectura

`src/import/csv-importer.js` es un módulo ES puro — sin imports de
otros módulos del proyecto, sin acceso a chrome.* ni al DOM.

```
parsearCSV(texto)              → array de arrays (RFC 4180)
detectarFormato(headers)       → 'google'|'bitwarden'|'lastpass'|'1password'|'generico'|null
normalizarCredenciales(filas, formato) → array de objetos credencial
```

### Parser RFC 4180

Implementado como máquina de estados carácter a carácter con tres
estados: NORMAL, DENTRO_CAMPO_CITADO, ESCAPE_EN_CITADO.

Casos cubiertos:
- BOM UTF-8 (0xFEFF) → eliminado antes de parsear
- Campos con comas internas: `"campo,con,comas"` → protegidos por comillas
- Comillas escapadas: `"campo ""con"" comillas"` → `""` representa `"`
- Saltos de línea en campos (notas multilínea)
- CRLF y LF como terminadores de fila
- Líneas vacías al final → ignoradas

**Decisión de seguridad:** No se usa `split(',')` — falla con comas
internas y es incorrecto según RFC 4180.

### Detección de formato (fingerprinting)

Tres pasos en orden:
1. Coincidencia exacta de headers (respeta capitalización de 1Password)
2. Coincidencia insensible a mayúsculas
3. Genérico: requiere mínimo un campo de usuario Y uno de password

### Deduplicación

Clave canónica: `url.toLowerCase().trimTrailingSlash() + '||' + usuario.toLowerCase()`

Implementada con `Set` para O(n) eficiencia. Re-filtrado en el momento
de confirmación para cubrir race conditions.

### Seguridad

- El CSV nunca sale del dispositivo — procesado 100% en memoria
- El archivo se lee con FileReader API nativa
- Preview con password siempre enmascarada (`••••••••`)
- El archivo CSV no se persiste — solo se procesa y descarta
- `escapeHtml()` en todos los datos antes de insertar en el DOM (XSS)
- Clave AES liberada en bloque `finally` de confirmarImportacion()

---

## 14. Generador TOTP Integrado (F1.2)

### Estándar implementado

RFC 6238 (TOTP) sobre RFC 4226 (HOTP) con RFC 4648 (Base32).
Motor: `crypto.subtle` de Web Crypto API — sin librerías externas.

### Algoritmo HMAC-SHA1

```javascript
// Counter T: intervalos de 30s desde epoch Unix (RFC 6238 §4.1)
const T = Math.floor(Date.now() / 1000 / 30)

// Counter como 8 bytes big-endian (RFC 4226 §5.3)
// HMAC-SHA1(secreto, counter) → firma de 20 bytes
// Dynamic truncation (RFC 4226 §5.4):
//   offset = últimos 4 bits del byte 19
//   extraer 4 bytes desde offset, descartar bit de signo
// Código = binCode % 1_000_000, padStart(6, '0')
```

### Decodificador Base32

RFC 4648 — alfabeto A–Z + 2–7 (5 bits por carácter).
Implementado con aritmética de bits pura (~20 líneas).

### Validación

`esBase32Valido(str)` con regex `/^[A-Za-z2-7\s=]+$/` — previene
que el usuario pegue una URL `otpauth://` completa en lugar de la
clave. Si contiene caracteres fuera del alfabeto Base32, muestra
advertencia antes de persistir.

### Integración con vault

Campo `claveTotp: string | undefined` en el esquema de credencial.
Credenciales existentes tienen `claveTotp: undefined` — backward
compatible sin migración.

La clave TOTP viaja cifrada dentro del mismo JSON que se cifra con
AES-256-GCM. El código de 6 dígitos se genera en tiempo real en el
cliente — nunca se almacena.

### Cuenta regresiva

`setInterval` de 1 segundo actualiza la barra visual y el timer.
El código TOTP se regenera solo en cambio de período (cada 30s) —
`crypto.subtle` no se invoca cada segundo.

---

## 15. Password Health Reports (F1.3)

### Módulo puro

`src/health/password-health.js` — sin DOM, sin chrome.*:

```
calcularEntropia(password)              → bits (number)
detectarReutilizadas(credenciales)      → Set de IDs reutilizados
verificarHIBP(password)                 → { comprometida, conteo, error }
analizarSaludLocal(credenciales)        → reporte sin contraseñas en claro
```

### Cálculo de entropía

`H = L × log₂(N)` donde N es el tamaño del alfabeto inferido de los
caracteres presentes. Umbral: < 50 bits → débil (NIST SP 800-63B).

### Deduplicación por SHA-256

**Garantía de seguridad:** las contraseñas en texto plano NUNCA se
comparan directamente. El Map intermedio contiene únicamente:
- Clave: hash SHA-256 (opaco)
- Valor: array de IDs (no datos sensibles)

```javascript
const hash = await crypto.subtle.digest('SHA-256', encode(password))
// Grupos con > 1 ID indican reutilización
```

### Protocolo k-anonymity HIBP

```
1. SHA-1(password) localmente
2. Enviar solo prefijo[0:5] (5 chars hex) a la API
3. Recibir ~800 sufijos con conteos
4. Comparar sufijo local (35 chars) — nunca enviado
5. Password en texto plano nunca abandona el dispositivo
```

Header `Add-Padding: true` — previene análisis de tráfico por tamaño
de respuesta (fingerprinting de contraseñas por tamaño del response).

### Dashboard

`src/ui/health/health.html+js+css` — página separada del vault.
El vault pasa el reporte via `chrome.storage.session` (eliminado
al cargarlo — no queda huérfano en sesión).

HIBP se ejecuta progresivamente credencial por credencial, con manejo
de rate limit HTTP 429 (detiene el bucle, marca restantes como error).

### Filtro de tipos

`analizarSaludLocal()` solo recibe credenciales `tipo === 'login'` —
no analiza tarjetas ni identidades (sus campos no son contraseñas).

---

## 16. Exportación CSV (F1.4)

### Módulo puro

`src/export/csv-exporter.js` — sin UI, sin chrome.*:

```
generarCSVGenerico(credenciales)   → string CSV (5 columnas)
generarCSVBitwarden(credenciales)  → string CSV (11 columnas con login_totp)
```

### RFC 4180 propio

`escaparCampo(valor)`: encierra en comillas si el campo contiene
coma, comilla doble o salto de línea. Comillas internas se duplican
(`""` representa `"`).

### Formato Bitwarden

11 columnas: `folder, favorite, type, name, notes, fields, reprompt,
login_uri, login_username, login_password, login_totp`

El campo `login_totp` incluye la clave Base32 — migración completa
incluyendo 2FA.

### Seguridad de exportación

Doble barrera antes de generar CSV en texto plano:
1. Checkbox de confirmación explícita (ineludible — botón deshabilitado)
2. Contraseña maestra verificada con `desbloquearVault()`

Si la contraseña es incorrecta, no se genera ningún archivo.

---

## 17. Tipos de Credencial (F1.5)

### Esquema ampliado

```javascript
// Login (existente — campo tipo ahora explícito)
{ id, tipo: 'login', sitio, url, usuario, password, notas, claveTotp, creado, modificado }

// Tarjeta (nuevo)
{ id, tipo: 'tarjeta', alias, titular, numero, vencimiento, cvv, banco, notas, creado, modificado }

// Identidad (nuevo)
{ id, tipo: 'identidad', nombre, email, telefono, direccion, ciudad, pais, notas, creado, modificado }
```

`tipo: undefined` → se trata como `'login'` en toda la UI.
Sin migración de datos — JSON soporta campos faltantes.

### Módulo central

`src/ui/vault/credential-types.js` — lógica de tipos aislada del vault:

- Constantes: `TIPO_LOGIN`, `TIPO_TARJETA`, `TIPO_IDENTIDAD`
- Renderers de formulario por tipo (HTML dinámico)
- Lectores y llenadores de formulario por tipo
- Enmascaramiento: número de tarjeta (`**** **** **** 1234`), CVV (`•••`)
- Revelado temporal 5 segundos con auto-reocultado
- `escapeHtmlInterno()` propio — no depende del DOM del vault

### Formulario dinámico

El modal del vault usa un `#formContainer` donde se inyecta el HTML
del formulario según el tipo seleccionado. Las referencias DOM se
leen con `getElementById()` después de la inyección — no como
globales fijas.

### Seguridad

- Número de tarjeta y CVV: `input[type="password"]` en formulario
- En lista del vault: siempre enmascarados
- Revelado: accede a credencial en memoria — nunca al DOM de otro elemento
- Timer cancelado en doble clic (evita doble revelado simultáneo)

### Autocompletado extendido

`autofill.js` detecta tres tipos de formulario:
- **Login**: presencia de `input[type="password"]` (comportamiento original)
- **Checkout (tarjeta)**: señales primarias (`autocomplete="cc-number"`)
  + secundarias (name/id con patrones: card, cvv, expir...) — mínimo 2 señales
- **Registro (identidad)**: señales primarias (`autocomplete="name"`, `tel`, etc.)
  + secundarias (form con 4+ inputs text/email/tel) — mínimo 3 señales

Prioridad: checkout > identidad > login (evita falsos positivos).

`tipoFormularioDetectado` se envía en `SOLICITAR_AUTOCOMPLETADO` —
el service worker filtra credenciales por tipo. Tarjetas e identidades
son universales (sin filtro de dominio).

---

## 18. URL Matching (F1.6)

### Problema resuelto

`filtrarPorDominio` en v0.1.x usaba `includes()` — bug de seguridad:
`'myevilbank.com'.includes('bank.com')` era `true`.

### Módulo puro

`src/utils/url-matcher.js` — sin chrome.*, sin DOM, testeable en Node:

```
extraerDominioBase(entrada)              → eTLD+1 | null
coincideURL(urlCredencial, hostname)     → { coincide, puntuacion }
coincideSitio(nombreSitio, hostname)     → { coincide, puntuacion }
filtrarCredenciales(credenciales, url)   → credenciales ordenadas por puntuación
```

### Extracción eTLD+1

Lista `TLD_MULTIPART` de ~35 entradas con foco LATAM:
`.com.pa`, `.gob.pa`, `.com.br`, `.com.mx`, `.com.co`, `.com.ar`...

Guardanes:
- IP v4: `null` (sin jerarquía de dominios → match exacto)
- `localhost` y hostnames sin punto: `null`
- TLD bipartito con menos de 3 partes: `null`

### Sistema de puntuación

| Estrategia | Puntuación |
|---|---|
| Hostname exacto | 100 |
| Mismo dominio base (ej. mail.google.com ↔ drive.google.com) | 80 |
| Wildcard `*.empresa.com` | 50 |
| Nombre de sitio (fallback sin URL) | 30 |
| Bonus de path específico | +10 |

`*.empresa.com` no coincide con `empresa.com` — solo subdominios
explícitos (comportamiento correcto por diseño).

### Integración

`filtrarCredenciales()` excluye tarjetas e identidades
(`cred.tipo !== 'login'`) — son universales y las gestiona el
service worker por separado. Retorna el array ordenado de mayor a
menor puntuación.

---

## ACTUALIZACIÓN — Roadmap Técnico (Sección 11)

Reemplazar la sección 11 por:

### v0.2.0 — Completado (Abril 2026)

Todos los features de paridad competitiva implementados:
- F1.1: Importación CSV (5 gestores)
- F1.2: TOTP integrado (RFC 6238)
- F1.3: Password Health + HIBP k-anonymity
- F1.4: Exportación CSV genérico y Bitwarden
- F1.5: Tipos de credencial (Login, Tarjeta, Identidad)
- F1.6: URL matching con eTLD+1 y scoring

### v0.3.0 — Sincronización BYOC (Mayo–Junio 2026)

**Arquitectura BYOC (Bring Your Own Cloud):**

```
Vault cifrado (blob AES-256-GCM opaco)
        ↓
StorageAdapter interface (src/sync/storage-adapter.js)
        ↓
┌──────────────┬──────────────┐
│ Google Drive │   OneDrive   │
│  (OAuth)     │ (MS Graph)   │
└──────────────┴──────────────┘
```

El proveedor cloud nunca recibe la clave de descifrado.
Zero-Knowledge se mantiene independientemente del proveedor.

OAuth scope mínimo:
- Google: `drive.appdata` (carpeta privada, invisible para el usuario)
- Microsoft: `files.readwrite.appFolder`

Costo para DacmosGroup: $0 (registro de apps gratuito en ambos).

### v0.4.0 — App Móvil React Native (Julio–Septiembre 2026)

Reutiliza motor de cifrado portado a React Native:
- `expo-crypto` para primitivas nativas
- `expo-local-authentication` para biometría
- `expo-secure-store` como equivalente a chrome.storage.local
- Mismos algoritmos: AES-256-GCM + PBKDF2-SHA256 × 600,000

### v0.5.0 — Tier Premium (Octubre–Noviembre 2026)

$1–1.50/mes — features de alto valor, baja complejidad:
- Compartir seguro (link temporal cifrado)
- Emergency access (contacto de confianza)
- Archivos adjuntos cifrados (1–5 GB)
- Plan Familias/Equipos

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
> *Datos · Nube · Movilidad · Seguridad*
> Versión 0.2.0 · Abril 2026
