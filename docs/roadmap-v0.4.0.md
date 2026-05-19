# 🗺️ Roadmap — Dacmos Password Manager v0.4.0

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**
**Documento generado:** Mayo 2026
**Versión base:** 0.3.1 (en revisión Chrome Web Store)
**Versión objetivo:** 0.4.0

---

## Contexto estratégico

v0.4.0 es la expansión más significativa del producto desde su lanzamiento.
Dacmos Password Manager deja de ser exclusivamente una extensión Chrome y
se convierte en una solución **multi-plataforma**: Chrome Extension + App móvil nativa.

El mismo vault cifrado, el mismo modelo Zero-Knowledge, en iOS y Android.

**Barrera que elimina:**
> *"Solo funciona en mi computadora"*

Con v0.3.0 el vault ya viaja cifrado en la nube del usuario (BYOC).
v0.4.0 añade el cliente móvil que lo consume — el ciclo se cierra.

---

## Decisión de repositorio

**Monorepo** con estructura separada por plataforma:

```
dacmosgroup-password-manager/          ← repo existente
├── chrome-extension/                  ← código actual (src/, manifest.json)
├── mobile/                            ← nuevo — React Native / Expo
│   ├── app/                           ← pantallas
│   ├── src/
│   │   ├── crypto/                    ← motor portado
│   │   ├── sync/                      ← adaptadores reutilizados
│   │   └── components/
│   └── package.json
└── docs/                              ← documentación compartida
```

**Alternativa descartada:** repo separado — complica mantener los docs
y la sincronización de versiones del motor de cifrado.

---

## Principios que NO cambian en v0.4.0

- Zero-Knowledge local-first
- AES-256-GCM + PBKDF2-SHA256 × 600,000 iteraciones
- Sin dependencias externas de crypto (primitivas nativas del SO)
- Sin servidores propios — BYOC (Google Drive / OneDrive)
- Código comentado en español

---

## Stack tecnológico — Mobile

```
├── Framework:      React Native con Expo (SDK 51+)
├── Lenguaje:       TypeScript
├── Crypto:         expo-crypto (primitivas nativas del SO)
├── Biometría:      expo-local-authentication
├── Almacenamiento: expo-secure-store (equivale a chrome.storage.local)
├── Sync:           Adaptadores Google Drive / OneDrive (portados de v0.3.0)
└── Navegación:     Expo Router
```

---

## Features v0.4.0

### F4.1 — Setup del proyecto React Native / Expo

**Alcance:**
- Crear la estructura `mobile/` dentro del monorepo existente
- Configurar Expo con TypeScript
- Configurar ESLint + Prettier con las mismas reglas del proyecto
- Configurar expo-crypto, expo-local-authentication, expo-secure-store
- Pantalla de bienvenida mínima que confirma que el setup funciona

**Criterio de completitud:**
- `npx expo start` sin errores en iOS Simulator y Android Emulator
- Dependencias instaladas y tipadas correctamente

---

### F4.2 — Motor de cifrado portado a React Native

**Alcance:**
Portar `src/crypto/engine.js` a TypeScript usando `expo-crypto` como
reemplazo de la Web Crypto API.

**Equivalencias de API:**

| Web Crypto API (Chrome) | expo-crypto (React Native) |
|------------------------|---------------------------|
| `crypto.subtle.encrypt` (AES-GCM) | `expo-crypto` + `expo-modules-core` |
| `crypto.subtle.deriveKey` (PBKDF2) | `expo-crypto.digestStringAsync` + custom PBKDF2 |
| `crypto.getRandomValues` | `expo-crypto.getRandomValues` |

**Decisión técnica crítica:** validar que AES-256-GCM y PBKDF2-SHA256
con 600,000 iteraciones producen output idéntico al engine.js de la
extensión Chrome. Un vault cifrado en Chrome debe descifrarse en móvil
y viceversa — **compatibilidad cruzada no negociable**.

**Criterio de completitud:**
- Test de round-trip: cifrar en mobile → descifrar en Chrome Extension ✅
- Test de round-trip inverso: cifrar en Chrome → descifrar en mobile ✅

---

### F4.3 — Vault local con CRUD completo

**Alcance:**
- Pantalla de configuración de contraseña maestra (primera vez)
- Pantalla de desbloqueo con contraseña maestra
- Lista de credenciales (tipos: Login, Tarjeta, Identidad)
- Modal de nueva credencial
- Editar y eliminar credencial
- Búsqueda en tiempo real
- Generador de contraseñas integrado

**Almacenamiento:**
`expo-secure-store` para el vault cifrado — equivale a `chrome.storage.local`.
Mismo formato de datos que la extensión Chrome para garantizar compatibilidad
con el vault sincronizado.

---

### F4.4 — Autenticación biométrica

**Alcance:**
Reemplazar el ingreso de contraseña maestra por biometría en desbloqueos
subsecuentes (no en el primer setup ni en operaciones críticas).

**Flujo de seguridad:**

```
Primera vez:
  Ingresa contraseña maestra
  → Derivar clave AES
  → Guardar clave en expo-secure-store (enclave seguro del SO)
  → Habilitar biometría para futuros desbloqueos

Desbloqueos siguientes:
  Face ID / Touch ID / Fingerprint
  → Recuperar clave del enclave seguro
  → Vault desbloqueado sin revelar la contraseña maestra

Operaciones críticas (cambiar contraseña, exportar):
  Siempre requieren contraseña maestra explícita — biometría no es suficiente
```

**Plataformas:**
- iOS: Face ID y Touch ID via `expo-local-authentication`
- Android: Fingerprint y Face Unlock via `expo-local-authentication`

**Fallback:** si biometría no está disponible o falla 3 veces,
solicitar contraseña maestra.

---

### F4.5 — Sincronización con vault existente (Google Drive)

**Alcance:**
Reutilizar la lógica de `google-drive-adapter.js` portada a React Native.
El vault móvil y el vault de Chrome comparten el mismo archivo cifrado
en Google Drive — misma arquitectura BYOC de v0.3.0.

**OAuth en móvil:**
`expo-auth-session` para el flujo OAuth de Google Drive (reemplaza
`chrome.identity` que no existe en React Native).

**Resolución de conflictos:**
Mismo mecanismo LWW (Last Write Wins) por timestamp que usa la
extensión Chrome.

**Prioridad:** Google Drive primero. OneDrive en v0.4.x o v0.5.0.

---

### F4.6 — TOTP viewer

**Alcance:**
- Mostrar códigos TOTP en tiempo real en las cards de credenciales
- Cuenta regresiva visual (barra de progreso)
- Copiar código con un toque
- Mismo motor TOTP de `src/crypto/totp.js` portado a TypeScript

**Sin cambios al algoritmo:** RFC 6238, HMAC-SHA1, decodificador Base32.

---

## Lo que NO está en v0.4.0

| Feature | Versión estimada | Razón |
|---------|-----------------|-------|
| Autocompletado en apps móviles | v0.4.x | Requiere iOS AutoFill Extension + Android Autofill Service — scope propio |
| OneDrive sync en mobile | v0.4.x | Google Drive primero, mismo patrón |
| Password Health en mobile | v0.4.x | Requiere conectividad HIBP — feature posterior |
| Importar/Exportar CSV | v0.4.x | La migración ya ocurre desde la extensión Chrome |
| Publicación en App Store / Play Store | v0.5.0 | Requiere cuentas de desarrollador y proceso de revisión |

---

## Criterios de completitud

- [ ] F4.1 — Setup React Native / Expo funcionando en iOS y Android
- [ ] F4.2 — Motor de cifrado portado con compatibilidad cruzada verificada
- [ ] F4.3 — Vault local con CRUD completo
- [ ] F4.4 — Biometría habilitada para desbloqueo
- [ ] F4.5 — Sincronización Google Drive funcionando
- [ ] F4.6 — TOTP viewer con cuenta regresiva
- [ ] Build de desarrollo en TestFlight (iOS) y APK interno (Android)

---

## Decisiones técnicas abiertas

Estas decisiones deben resolverse en las primeras sesiones de desarrollo:

| Decisión | Opciones | Criterio |
|----------|----------|---------|
| ¿Expo Go o Expo Dev Build? | Expo Go (más simple) vs Dev Build (más control) | expo-local-authentication requiere Dev Build |
| ¿TypeScript estricto? | `strict: true` vs relajado | Recomendado `strict: true` desde el inicio |
| ¿Estructura de navegación? | Expo Router vs React Navigation | Expo Router es el estándar actual de Expo |
| ¿Tema visual? | Nuevo diseño vs adaptar el CSS existente | Adaptar paleta de colores de la extensión |

---

## Learnings anticipados — contenido educativo

| # | Tema | Aplicación en contenido |
|---|------|------------------------|
| L1 | Portar Web Crypto API a React Native | Video: criptografía en móvil vs web |
| L2 | expo-secure-store vs AsyncStorage | Video: almacenamiento seguro en apps móviles |
| L3 | OAuth en React Native (expo-auth-session) | Tutorial: integrar Google Drive en Expo |
| L4 | Biometría: Face ID / Fingerprint en Expo | Tutorial: autenticación biométrica zero-config |
| L5 | Compatibilidad de vault Chrome ↔ Mobile | Video: diseñar para multi-plataforma desde el día uno |

---

## Brief para Claude Code — v0.4.0

```
Lee estos documentos antes de hacer cualquier cosa:
- docs/roadmap-v0.4.0.md
- docs/documento-tecnico.md
- chrome-extension/src/crypto/engine.js (motor a portar)

Principios no negociables:
- Zero-Knowledge — cifrado siempre en el cliente
- AES-256-GCM + PBKDF2-SHA256 × 600,000 iteraciones
- Sin librerías de crypto externas — solo primitivas nativas del SO
- Compatibilidad de vault con la extensión Chrome existente
- Código comentado en español
- TypeScript estricto

Primer ítem a desarrollar en esta sesión: [ESPECIFICAR]
```

---

## Roadmap completo actualizado

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 ✅  UX Polish — navegación, legibilidad, fixes autofill
v0.4.0 🔄  App móvil React Native (iOS + Android)
v0.5.0 ⏳  Tier Premium $1-1.50/mes + Plan Familias
v1.0.0 ⏳  Auditoría Cure53 + listado público CWS
```

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
