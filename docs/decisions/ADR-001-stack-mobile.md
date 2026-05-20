# 📐 ADR-001 — Stack tecnológico para mobile: PWA → Capacitor

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**

| Campo | Valor |
|-------|-------|
| **Número** | ADR-001 |
| **Estado** | ✅ Aceptada |
| **Fecha** | 19 de mayo, 2026 |
| **Versión afectada** | v0.4.0 y posteriores |
| **Decisión previa** | React Native con Expo (`roadmap-v0.4.0.md` original) |
| **Reemplaza** | Sección "Stack tecnológico — Mobile" del roadmap original |
| **Autor** | DacmosGroup |

---

## Contexto

### Estado del proyecto a mayo 2026

Dacmos Password Manager publicó v0.3.1 en Chrome Web Store el 18 de mayo de 2026.
La extensión Chrome alcanzó paridad funcional con los gestores líderes y completó
la fase de sincronización BYOC (Google Drive + OneDrive). El siguiente paso del
roadmap es la expansión a mobile (iOS + Android).

### Plan original de v0.4.0

El roadmap original (`roadmap-v0.4.0.md`) proponía React Native con Expo, asumiendo:

- `expo-crypto` para AES-256-GCM y PBKDF2-SHA256 nativo
- `expo-local-authentication` para Face ID / Fingerprint
- `expo-secure-store` como reemplazo de `chrome.storage.local`
- `expo-auth-session` para OAuth (sustituto de `chrome.identity`)
- Monorepo `chrome-extension/` + `mobile/`

### Restricciones operativas confirmadas

| Restricción | Estado |
|-------------|--------|
| Cuenta Apple Developer ($99/año) | ❌ No disponible |
| Cuenta Google Play Console ($25 una vez) | ❌ No disponible |
| macOS para builds iOS | ❌ Dev en Windows 11 |
| Presupuesto operativo | Mínimo / nulo |
| Equipo | 1 desarrollador (solo founder) |

### Principios no negociables del proyecto

1. **Zero-Knowledge local-first** — el cifrado siempre en el cliente
2. **AES-256-GCM + PBKDF2-SHA256 × 600,000 iteraciones** — idénticos a la extensión Chrome
3. **Sin dependencias externas de crypto** — solo primitivas nativas del SO o Web Crypto API
4. **Sin servidores propios** — arquitectura BYOC
5. **Código comentado en español**
6. **Compatibilidad bit-exacta del vault** — un vault cifrado en Chrome debe descifrarse en mobile sin capa de traducción y viceversa

---

## Problemas identificados con el plan original

Una investigación profunda (mayo 2026) reveló cuatro problemas técnicos significativos
con la elección de React Native + Expo. El research completo está documentado en
`research/v0.4.0-stack-evaluation.md`.

### Problema #1 — expo-crypto no expone PBKDF2 nativo en 2026

La API actual de `expo-crypto` provee únicamente: `aesEncryptAsync`, `aesDecryptAsync`,
`digest`, `getRandomBytes` y `randomUUID`. **No hay `deriveKey`, `pbkdf2Async`,
ni HMAC nativo.**

Implementar PBKDF2 con 600,000 iteraciones requiere uno de tres caminos, todos problemáticos:

| Camino | Problema |
|--------|----------|
| Loop JS manual sobre `digestStringAsync` | Performance inaceptable (segundos en gama media) |
| Librería externa (`react-native-quick-crypto`, `react-native-aes-crypto`) | **Rompe el principio #3** — sin dependencias externas de crypto |
| Módulo nativo propio (Swift + Kotlin) | Obliga a Expo Dev Build, elimina la ventaja de Expo Go y añade complejidad equivalente a no usar Expo |

**Veredicto:** ninguna opción es satisfactoria sin violar un principio no negociable.

### Problema #2 — expo-local-authentication vulnerable a bypass

El issue público **#14456** del repositorio expo/expo documenta que
`expo-local-authentication` "does not use protected KeyStore data to authenticate
the user" en Android. El callback es Frida-bypasseable, un anti-pattern catalogado
por OWASP MSTG.

WithSecure Labs documenta el patrón de ataque: si el plugin no usa
`BiometricPrompt.CryptoObject` con una clave del Keystore, la autenticación
biométrica es solo un wrapper de UI que un atacante con acceso root puede saltar.

Para un gestor de contraseñas, esta es una vulnerabilidad inaceptable.

### Problema #3 — Reutilización baja del código actual

| Stack | Reutilización de `engine.js` + `totp.js` + adaptadores sync |
|-------|------------------------------------------------------------|
| React Native + Expo | 30–50% (requiere port a TypeScript + adaptación a APIs distintas) |
| Capacitor | 85–95% (`crypto.subtle` directo, mismas APIs) |
| PWA | >90% (literalmente el mismo código) |

El código de la extensión Chrome ya está escrito, probado, auditado mentalmente,
y respeta los principios no negociables. Tirarlo a la basura para reescribirlo en
React Native es destrucción de valor injustificada.

### Problema #4 — Señal de la industria

Bitwarden, el competidor open-source de referencia, **migró su app móvil de Xamarin
(cross-platform) a Swift nativo + Kotlin nativo en 2024–2025**, citando las mismas
razones: imposibilidad de autofill correcto cross-platform, complejidad de mantener
crypto consistente entre plataformas, y limitaciones de los wrappers JS.

Si Bitwarden con su equipo y presupuesto no logró un cross-platform JS exitoso,
intentarlo con un dev solo y presupuesto cero es una mala apuesta.

---

## Opciones evaluadas

Seis stacks tecnológicos comparados contra los principios no negociables y las
restricciones operativas:

| Criterio | Capacitor | PWA | RN + Expo | Flutter | Tauri Mobile | Kotlin MP |
|----------|-----------|-----|-----------|---------|--------------|-----------|
| Web Crypto nativa AES-GCM | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| **PBKDF2 600k nativo** | ✅ subtle | ✅ subtle | ❌ | 🟡 | ✅ subtle | ✅ |
| Cumple principio #3 | ✅ | ✅✅ | ❌ | 🟡 | 🟡 | 🟡 |
| Reutilización código actual | 85–95% | >90% | 30–50% | ~70% | 80–90% | ~50% |
| Compat vault Chrome ↔ Mobile | Perfecta | Perfecta | Parcial | Buena | Buena | Buena |
| Biometría estable | ✅ | ✅ WebAuthn | ⚠️ #14456 | ✅ | ⚠️ | ✅ |
| Requiere Mac | No | **No** | No (EAS) | No | No | **Sí** |
| Costo total año 1 | $10–15 (web) | **$10–15** | $134–367 | $25–99 | $25–99 | Bloqueado |
| Casos top-tier PM en producción | Identity Vault | Bitwarden Web | **0 (Bitwarden salió)** | 0 | 0 | 0 |

### Stacks descartados

- **React Native + Expo** — 4 problemas técnicos descritos arriba
- **Flutter** — curva de aprendizaje innecesaria desde JavaScript, no agrega valor sobre Capacitor para este caso
- **Tauri Mobile** — inmaduro en 2026 para producción
- **Kotlin Multiplatform** — requiere macOS para builds iOS (bloqueador absoluto)

### Stacks adoptados

- **PWA** primero (v0.4.0)
- **Capacitor** después (v0.5.0)

---

## Decisión

**Adoptar la secuencia PWA → Capacitor para la expansión mobile de
Dacmos Password Manager.**

### Fase A — v0.4.0: Progressive Web App (1–2 meses, $10–15 inversión)

Empaquetar el código JavaScript ES Modules existente como PWA, sirviendo desde
Cloudflare Pages o GitHub Pages bajo dominio propio. Reemplazar
`chrome.storage.local` por IndexedDB para el vault cifrado, `chrome.identity` por
OAuth manual con PKCE (Google Identity Services JS + MSAL.js v3), y mantener
`engine.js` y `totp.js` sin tocar.

### Fase B — v0.5.0: Capacitor wrapping (3–4 meses)

Migrar la PWA a una shell Capacitor que ejecuta el mismo bundle JS en WKWebView
(iOS) / WebView nativo (Android). Activa biometría con módulo nativo propio,
sync con Keychain/Keystore, y prepara la base para autofill nativo.

### Fase C — v0.6.0: Autofill nativo (10–14 semanas)

iOS AutoFill Credential Provider Extension (Swift puro) + Android Autofill Service
+ Credential Manager API (Kotlin). Esta fase requiere activación de Apple Developer
Program ($99) y Google Play Console ($25 vitalicio).

---

## Consecuencias

### Positivas

- **85–95% de reutilización del código actual** — `engine.js`, `totp.js`, adaptadores de sync se mueven 1:1
- **Compatibilidad bit-exacta del vault** entre Chrome Extension y mobile — sin capa de traducción
- **PBKDF2 600k nativo** via `crypto.subtle.deriveKey`, 200–350ms en gama media iOS/Android
- **Costo total año 1: $10–15** (solo dominio) — sin Apple Developer, sin Play Console
- **Sin macOS requerido** — toda la PWA se desarrolla en Windows
- **Validación temprana del producto** en mobile con usuarios reales antes de invertir en infraestructura de stores
- **Cumple los 6 principios no negociables sin compromisos**

### Negativas y mitigaciones

| Consecuencia negativa | Mitigación |
|----------------------|------------|
| iOS Safari no permite AutoFill nativo para PWA | Documentar honestamente: copy/paste hasta v0.6.0 nativo. Mensaje claro en la UI iOS. |
| `navigator.storage` puede ser evictado en iOS Safari tras 7 días sin uso | Forzar `navigator.storage.persist()` desde Safari 17+ con UX educativa al primer setup |
| PWA no aparece en App Store / Play Store (descubribilidad) | Compensar con SEO técnico desde dacmosgroup.co + contenido educativo (videos, blog) |
| Capacitor depende del WebView del sistema | Es justo lo que queremos: `crypto.subtle` nativa del sistema, mantenida por Apple y Google |
| Tamaño del APK Capacitor: 5–10 MB | Aceptable (menor que React Native 20–40 MB) |

### Neutrales

- Cambia el paradigma: PWA primero, app nativa después (no a la inversa)
- Requiere aprender Capacitor en v0.5.0 — pero la curva desde JavaScript es mínima
- Introduce el patrón ADR (Architectural Decision Record) al proyecto — este es el primero

---

## Roadmap actualizado

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 ✅  UX Polish — navegación, legibilidad, fixes autofill
v0.4.0 🔄  PWA — vault completo en mobile via navegador, sin instalación
v0.5.0 ⏳  Capacitor wrapping — app nativa iOS + Android, biometría
v0.6.0 ⏳  Autofill nativo — iOS Credential Provider + Android Autofill Service
v0.7.0 ⏳  Argon2id opcional + preparación de auditoría
v1.0.0 ⏳  Auditoría Cure53 + listado público CWS + App Store + Play Store
```

### Cambios respecto al roadmap anterior

- v0.4.0 deja de ser "App móvil React Native" y se convierte en "PWA"
- v0.5.0 deja de ser "Tier Premium $1–1.50/mes" y se convierte en "Capacitor wrapping"
- v0.6.0 (nueva) — Autofill nativo
- v0.7.0 (nueva) — Argon2id opcional + preparación de auditoría
- Monetización con suscripción descartada (ver sección "Cambios en el modelo de negocio")

---

## Principios no negociables — verificación

| # | Principio | PWA (v0.4.0) | Capacitor (v0.5.0) |
|---|-----------|--------------|---------------------|
| 1 | Zero-Knowledge local-first | ✅ IndexedDB local | ✅ Capacitor Storage local |
| 2 | AES-256-GCM + PBKDF2 600k | ✅ `crypto.subtle` nativa | ✅ `crypto.subtle` en WebView |
| 3 | Sin dependencias externas de crypto | ✅✅ literalmente el mismo código que Chrome | ✅✅ mismo |
| 4 | Sin servidores propios | ✅ Google Drive + OneDrive BYOC | ✅ mismo |
| 5 | Código comentado en español | ✅ se mantiene | ✅ se mantiene |
| 6 | Compat bit-exacta del vault | ✅✅ es el mismo blob exacto | ✅✅ mismo |

**Los 6 principios se cumplen con holgura.** Esta es la única alternativa
evaluada que los cumple sin compromisos.

---

## Cambios en el modelo de negocio

El research también identificó que el plan original de monetización con
suscripción $1–1.50/mes en v0.5.0 no es óptimo para Dacmos. Los argumentos:

1. **Aritmética insuficiente** — 1,000 usuarios pagos × $18/año brutos = ~$10k netos, no mueve la aguja de una consultoría que cierra contratos de $20k–$80k por engagement.
2. **El producto es el embudo, no el negocio** — Dacmos Password Manager es activo de marca de DacmosGroup, no SaaS independiente.
3. **Aversión cultural a suscripciones en LATAM** — modelo lifetime / pago único tiene mejor recepción.

### Modelo de monetización ajustado

| Año | Modelo |
|-----|--------|
| **Año 1 (2026)** | 100% gratuito + donaciones opcionales (GitHub Sponsors, Open Collective) |
| **Año 2 (2027)** | Lifetime $29 USD para features avanzados (sync premium, soporte directo). Tier free se mantiene completo. |
| **Año 3 (2028)** | Tier Business $3/usuario/mes con onboarding profesional de DacmosGroup como upsell natural. Posicionamiento "HashiCorp local". |

### Métricas de éxito 12 meses

No se miden en MRR ni en GitHub stars. Se miden en:

- **Leads B2B cualificados para DacmosGroup atribuibles al PM**: 5 (conservador) — 30 (optimista)
- **Contratos de consultoría cerrados con atribución parcial al PM**: 1 contrato $15–40k (conservador) — 3–5 contratos $60–200k (optimista)

---

## Posicionamiento competitivo

Dacmos NO compite directamente con Bitwarden ni 1Password.

**El competidor de referencia es Enpass:**

- Misma arquitectura local-first + BYOC (Drive/OneDrive/Dropbox/iCloud)
- Pero closed source, sin auditorías públicas, UX criticada (3.8/5)
- Tier free móvil limitado a 25 items

**Mensaje de marca:** *"Enpass open-source, auditable, en español, hecho en LATAM."*

**Promesa de DacmosGroup hacia su audiencia técnica:**

> *"En DacmosGroup no recomendamos lo que no construimos. Antes de proponerte
> una arquitectura segura, te mostramos el código de la nuestra."*

---

## Referencias

- Research completo: `research/v0.4.0-stack-evaluation.md` (mayo 2026)
- Issue Expo #14456 — `expo-local-authentication` bypass
- Bitwarden migración Xamarin → nativo (2024–2025)
- OWASP Mobile Security Testing Guide
- NIST SP 800-38D — GCM Mode
- OWASP Password Storage Cheat Sheet 2024
- Capacitor iOS Documentation
- `documento-tecnico.md` v0.3.1

---

## Próximos pasos

1. ✅ ADR-001 aceptado (este documento)
2. ⏳ Reescribir `roadmap-v0.4.0.md` con el nuevo alcance PWA
3. ⏳ Crear esqueleto `roadmap-v0.5.0.md` (Capacitor wrapping)
4. ⏳ Actualizar `documento-tecnico.md` con:
   - Sección "Formato canónico versionado del blob"
   - Sección "Arquitectura de sync per-item con Lamport ordering"
5. ⏳ Actualizar `README.md` con el roadmap nuevo

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
