# 🗺️ Roadmap — Dacmos Password Manager v0.5.0

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**
**Documento generado:** Mayo 2026
**Versión base:** 0.4.0 (PWA — pendiente de desarrollo)
**Versión objetivo:** 0.5.0

> ⚠️ **Este es un documento de alcance alto nivel.**
> El detalle de implementación se completa cuando v0.4.0 esté shippeado.
> Referencia arquitectural: `docs/decisions/ADR-001-stack-mobile.md`

---

## Contexto estratégico

v0.5.0 convierte la PWA de v0.4.0 en una **app nativa para iOS y Android**
usando Capacitor como shell. El mismo bundle JS que sirve la PWA se ejecuta
dentro de WKWebView (iOS) y Chromium WebView (Android), activando acceso
a APIs nativas del sistema operativo que una PWA no puede tocar.

**Las barreras que elimina v0.5.0:**

| Limitación de v0.4.0 (PWA) | Solución en v0.5.0 (Capacitor) |
|-----------------------------|-------------------------------|
| Sin biometría (Face ID / Fingerprint) | Módulo nativo Keychain + Keystore |
| Eviction de datos en iOS Safari | Almacenamiento en iOS Keychain — sin eviction |
| Sin distribución en Play Store | Google Play Store ($25 vitalicio) |
| OAuth en popup del navegador | Custom scheme + Universal/App Links |
| Sync LWW con posible pérdida de datos | Sync per-item con Lamport ordering + tombstones |

---

## Principios que NO cambian en v0.5.0

- Zero-Knowledge local-first
- AES-256-GCM + PBKDF2-SHA256 × 600,000 iteraciones
- Sin dependencias externas de crypto — `crypto.subtle` en WKWebView/WebView
- Sin servidores propios — BYOC (Google Drive / OneDrive)
- Código comentado en español
- Compatibilidad bit-exacta del vault (Chrome Extension ↔ PWA ↔ app Capacitor)

---

## Stack tecnológico — Capacitor

```
├── Shell:          Capacitor 6+ (iOS + Android)
├── Bundle JS:      El mismo de v0.4.0 — sin cambios de lógica
├── Crypto:         crypto.subtle en WKWebView / Chromium WebView (idéntico a PWA)
├── Biometría:      Módulo nativo propio (Swift + Kotlin) — NO expo-local-authentication
├── Almacenamiento: @aparajita/capacitor-secure-storage (iOS Keychain / Android Keystore)
├── OAuth:          Custom URL scheme + Universal Links (iOS) / App Links (Android)
├── Build iOS:      Codemagic free tier (500 min/mes macOS M2) — sin Mac local
├── Build Android:  GitHub Actions (gratuito) — igual que v0.4.0
└── Distribución:   Google Play Store + GitHub Releases + F-Droid
```

---

## Features v0.5.0

### F5.1 — Setup Capacitor + reestructura del repo

**Alcance:**
- Añadir Capacitor al proyecto existente sobre la base PWA de v0.4.0
- `capacitor.config.json` apuntando al build de la PWA como `webDir`
- Targets nativos: `ios/` y `android/` generados por `npx cap add ios android`
- Pipeline de build en Codemagic (iOS, free tier) + GitHub Actions (Android)
- Sin reestructura de monorepo — Capacitor se agrega encima de `web/`

**Criterio de completitud:**
- `npx cap run android` ejecuta la PWA en emulador Android
- `npx cap run ios` ejecuta la PWA en simulador iOS (via Codemagic)

---

### F5.2 — Biometría nativa Zero-Knowledge

**El feature más crítico de seguridad de v0.5.0.**

La biometría permite desbloquear el vault sin escribir la contraseña maestra
en cada sesión, pero sin comprometer el modelo Zero-Knowledge.

**Patrón de seguridad (igual que 1Password y Bitwarden):**

```
Primera vez:
  Usuario ingresa contraseña maestra
  → Derivar vault_key (PBKDF2 → AES-256)
  → Generar wrap_key en Secure Enclave (iOS) / Keystore StrongBox (Android)
  → Cifrar vault_key con wrap_key → guardar en Keychain/Keystore
  → La contraseña maestra nunca se almacena

Desbloqueos siguientes:
  Face ID / Touch ID / Fingerprint
  → Autenticar con BiometricPrompt.CryptoObject (Android) o LAContext (iOS)
  → Recuperar wrap_key del Secure Enclave / Keystore
  → Descifrar vault_key → vault desbloqueado

Invalidación automática:
  Si el usuario añade huellas nuevas → wrap_key invalidada → pedir contraseña
  Implementado con .biometryCurrentSet (iOS) / setUserAuthenticationValidityDuration(-1) (Android)
```

**Implementación:** módulo nativo propio en Swift (iOS) + Kotlin (Android),
integrado como Capacitor plugin local. NO se usa `expo-local-authentication`
(ver ADR-001, Problema #2).

**Archivos nuevos:**
- `ios/App/DacmosBiometrics/` — plugin Swift
- `android/app/src/main/java/.../DacmosBiometrics/` — plugin Kotlin
- `web/src/native/biometrics-plugin.js` — wrapper JS del plugin

---

### F5.3 — Almacenamiento seguro nativo

**Problema que resuelve:** en la PWA (v0.4.0) IndexedDB puede ser evictado
en iOS Safari tras 7 días. En la app Capacitor el vault vive en el
iOS Keychain o Android Keystore — sin eviction posible, incluso si el
usuario no abre la app por semanas.

**Implementación:**
- `@aparajita/capacitor-secure-storage` — wrapper sobre iOS Keychain
  y Android Keystore con API key-value
- El vault cifrado `{ __version, kdf, iv, datos }` se almacena como
  valor string bajo la clave `dacmos:vault`
- La `vault_key` envuelta por biometría se almacena bajo `dacmos:wrap_key`

---

### F5.4 — OAuth nativo con deep links

En la app Capacitor, los popups OAuth del browser no funcionan igual que
en la PWA. Se reemplaza por el flujo nativo con redirect a la app.

**iOS:** Universal Links con dominio propio (`dpm.dacmosgroup.co`)
**Android:** App Links con `assetlinks.json` en el dominio

Esto elimina la fricción del popup de browser que el usuario ve en v0.4.0
al conectar Google Drive u OneDrive.

---

### F5.5 — Sync per-item con Lamport ordering y tombstones

**El cambio arquitectural de sync más importante desde v0.3.0.**

El modelo actual (un solo blob `vault.encrypted`) garantiza pérdida silenciosa
de credenciales si dos dispositivos editan offline simultáneamente — el
último en subir sobreescribe al otro. Para un gestor de contraseñas esto
es inaceptable.

**Nuevo modelo:**

```
/Apps/Dacmos/
  manifest.encrypted          ← índice cifrado de todos los items
  items/
    <item-uuid>.enc            ← un archivo por credencial
    <item-uuid>.enc
    ...
  tombstones/
    <item-uuid>.tomb           ← marcador de eliminación (TTL: 90 días)
```

**Resolución de conflictos:**
- Lamport clock por dispositivo embebido en cada item
- LWW (Last Write Wins) a nivel de campo individual, no de item completo
- Conditional writes con `If-Match` etag en Drive y OneDrive
- Tombstones con TTL de 90 días para deletes — sin pérdida silenciosa

**Backward compat:** si se detecta el blob monolítico de v0.4.0, se migra
automáticamente al nuevo formato en el primer sync de v0.5.0.

---

### F5.6 — Distribución: Google Play Store + Codemagic builds

**Google Play Store ($25 vitalicio — primera inversión del proyecto):**
- El $25 de Play Console se justifica en este momento porque ya hay
  una base de usuarios PWA/APK validada desde v0.4.0
- Publica la app Capacitor (no la TWA) para acceso a APIs nativas completas
- Auto-updates via Play Store — elimina la fricción del APK manual

**Builds iOS sin Mac local:**
- Codemagic free tier: 500 minutos/mes en macOS M2
- ~10–20 minutos por build → 25–50 builds iOS/mes gratuitos
- Fastlane Match para gestión de certificados y provisioning profiles
- Output: IPA distribuible via TestFlight (requiere Apple Developer $99)

**Nota:** Apple Developer Program ($99/año) es prerequisito para TestFlight
y App Store. Esta inversión se activa en v0.5.0 si hay usuarios iOS
validados desde la PWA de v0.4.0. Si no, los builds iOS quedan en
modo "internal testing" para el founder únicamente hasta v0.6.0.

---

## Lo que NO está en v0.5.0

| Feature | Versión | Razón |
|---------|---------|-------|
| AutoFill nativo iOS | v0.6.0 | Requiere Credential Provider Extension (Swift puro, target separado) |
| AutoFill nativo Android | v0.6.0 | Requiere Android Autofill Service + Credential Manager API (Kotlin) |
| Apple App Store (público) | v0.6.0 | Se publica cuando el autofill nativo esté listo |
| Argon2id como KDF alternativo | v0.7.0 | El versionado del blob desde v0.4.0 lo habilita |
| Monetización | v0.7.0 | Sin infraestructura de pagos todavía |

---

## Criterios de completitud

*(Se detallan cuando v0.4.0 esté shippeado)*

- [ ] F5.1 — App Capacitor ejecuta la PWA de v0.4.0 en iOS y Android
- [ ] F5.2 — Biometría nativa funcional con patrón Secure Enclave / Keystore
- [ ] F5.3 — Almacenamiento en Keychain/Keystore sin eviction
- [ ] F5.4 — OAuth nativo via deep links (sin popup de browser)
- [ ] F5.5 — Sync per-item con Lamport ordering verificado en escenario offline multi-device
- [ ] F5.6 — App en Google Play Store + builds iOS en Codemagic
- [ ] Versión bumpeada a 0.5.0
- [ ] PR mergeado a main

---

## Learnings anticipados — contenido educativo

| # | Learning | Aplicación en contenido |
|---|----------|------------------------|
| L1 | Secure Enclave iOS vs Keystore Android | Video: seguridad hardware en mobile |
| L2 | BiometricPrompt.CryptoObject — el detalle que marca la diferencia | Post técnico: biometría correcta para password managers |
| L3 | Sync distribuido sin servidor: Lamport clocks y CRDTs | Video: diseñar sistemas offline-first |
| L4 | Capacitor vs React Native: la decisión correcta para cada proyecto | Video: comparativa práctica con código real |
| L5 | Codemagic free tier: builds iOS sin Mac en 2026 | Tutorial: CI/CD mobile desde Windows |

---

## Roadmap completo actualizado

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

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
