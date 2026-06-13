# Roadmap v0.7.0 — Android Autofill + Backlog diferido

**DacmosGroup.co — Dacmos Password Manager**
**Estado:** PLANIFICACIÓN · inicio sesión 2026-06-13
**Prerequisito:** v0.6.0 COMPLETO ✅ · Play Store submission pendiente aprobación identidad

---

## Objetivo principal

Autofill nativo en Android: el gestor aparece como opción de autocompletado del sistema
en cualquier app y navegador (igual que Bitwarden/1Password), sin necesidad de abrir la app.

---

## Features confirmados

### F7-A — Android Autofill Service (PRIORITARIO)

Implementar `AutofillService` en Android que sirve credenciales del vault a cualquier app.

**Componentes:**
- `DpmAutofillService.kt` — servicio Android con `onFillRequest` / `onSaveRequest`
- Heurística de matching por `packageName` + `webDomain` (equivalente a la Extension)
- Bridge JS→Kotlin para leer credenciales desde el vault descifrado en sesión
- UI de selección de credencial (inline o actividad dedicada)
- `AndroidManifest.xml`: declarar `<service android:name=".DpmAutofillService">`

**Restricciones de seguridad:**
- Solo sirve credenciales si la sesión biométrica está activa (vault desbloqueado)
- No persiste credenciales descifradas fuera de la sesión Capacitor
- `autofillHints` correctos para evitar fingerprinting

### F7-B — iOS Credential Provider Extension (DIFERIDO)

Requiere macOS + Xcode + Apple Developer $99/año.
Implementar cuando se tenga acceso a Mac.

---

## Backlog diferido de v0.6.0

### H-5 — deviceId dentro del vault cifrado

`device-id.js` ya genera y persiste el UUID en IDB (base lista).
Falta: modificar `guardarVaultCifrado` en `web/src/crypto/engine.js` para incluir
`_deviceId` en el payload cifrado antes del `JSON.stringify`.

**Consideración:** toca archivo forked — portar también a `src/crypto/engine.js` para
mantener verify-crypto-sync.sh verde. La Extension no usa deviceId pero debe exportar
la misma API surface.

### H-9 — Logging de eventos sync

Añadir registro estructurado de operaciones sync (subida/descarga/conflicto) en IDB.
Útil para diagnóstico en Play Store donde los crashes llegan sin contexto.
Diseño: append-only log `syncLog[]` con timestamp, operación, resultado, `_deviceId`.

### M-4 — Decisión unificación i18n

Los catálogos actuales:
- Extension: `_locales/{es,en,pt_BR}/messages.json` (formato Chrome i18n)
- PWA/Capacitor: `web/src/i18n/strings.*.js` (módulos JS)

Opciones a decidir en arquitectura v0.7.0:
- A) Mantener separados (costo: keys pueden divergir)
- B) Source único JSON + script de generación para ambos formatos
- C) Capacitor hereda PWA (actual), Extension mantiene `_locales` independiente

### B-1 — OneDrive refresh_token → almacenamiento seguro

En v0.6.0 se descubrió que MSAL gestiona el token en `sessionStorage` (no IDB).
Para Capacitor, MSAL tiene una API de cache personalizable.
Investigar `PublicClientApplication` con `INetworkModule` / cache persistente
para poder mover el token al `DpmKeyPlugin` (Android Keystore).

---

## Prerequisitos técnicos antes de F7-A

1. Play Store aprobación de identidad → cuenta activa para internal track
2. Subir AAB v0.6.0 al internal track → confirmar que la app instala y corre
3. Probar biometría en dispositivo físico (el emulador no permite enroll real)
4. Decidir si F7-A va en el mismo Capacitor project o como módulo separado

---

## Archivos a crear/modificar (F7-A estimado)

| Archivo | Cambio |
|---|---|
| `android/app/src/main/java/co/dacmosgroup/dpm/DpmAutofillService.kt` | NUEVO |
| `android/app/src/main/AndroidManifest.xml` | Declarar AutofillService |
| `android/app/src/main/res/xml/autofill_service.xml` | Metadata del servicio |
| `android/app/build.gradle` | Permiso `BIND_AUTOFILL_SERVICE` |
| `web/src/storage/session.js` | Exponer API para que Kotlin lea credenciales de sesión |

---

## Verificación de cierre

- [ ] AutofillService aparece en Ajustes → Autocompletar del sistema Android
- [ ] Al abrir una app con login: el gestor aparece como opción
- [ ] Solo ofrece credenciales cuando la sesión biométrica está activa
- [ ] `verify-crypto-sync.sh` exit 0 si se tocaron archivos forked
- [ ] `bundleRelease` compila sin errores
