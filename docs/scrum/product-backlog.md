# Product Backlog — Dacmos Password Manager

**Última actualización:** 2026-09-06 (Sprint 1 Planning)
**Product Owner:** Alejandro Seijas
**Fuente consolidada de:** `roadmap-v0.7.0.md` · backlog diferido de v0.6.0 (`documento-tecnico.md` §28) · canales de distribución de `DACMOSGROUP_MASTER_CONTEXT.md`

> Lista única y ordenada. El orden = prioridad. La talla T-shirt (S/M/L) está
> definida en `README.md`. Los roadmaps históricos (`roadmap-v0.2.0` … `roadmap-v0.6.0`)
> quedan como archivo; este documento los reemplaza como fuente de verdad del pendiente.

---

## Estado de plataformas (baseline al retomar, sep-2026)

| Plataforma | Versión | Estado |
|---|---|---|
| Chrome Extension | v0.5.1 | ✅ Publicada en CWS (ID `aflgjjkallibohcebggkkjdlhdnainai`) |
| PWA | v0.5.1 | ✅ Live en dpm.dacmosgroup.co |
| Android (Capacitor v8) | v0.6.0 | ✅ Código completo, `app-release.aab` firmado — **sin publicar** |
| iOS | — | Stub Capacitor. Bloqueado (Mac + Apple Developer $99) |

---

## Bloqueantes externos — propiedad del PO, no son trabajo de sprint

### PS-1 · Verificación de identidad Play Store  `[BLOQUEANTE EXTERNO]`
- **Estado:** RECHAZADA 2026-06-17. Motivo: *"Proof of Address: document info does not match profile"*.
- **Acción del PO:** en payments.google.com, alinear la dirección del perfil de pagos
  con el documento de prueba de domicilio (coincidencia exacta) antes de reenviar.
  Intentos limitados → verificar datos primero.
- **Qué desbloquea:** todo el track Android de v0.7.0 (internal testing → F7-A).
- **Cuenta:** dacmosgroup@gmail.com · ID 6476802733577318173.

---

## Backlog priorizado

| # | ID | Item | Talla | Depende de | Notas |
|---|---|---|---|---|---|
| 1 | **S-1..S-4** | Arranque Scrum + housekeeping repo | M | — | **Sprint 1 (en curso)** |
| 2 | **H-5** | `_deviceId` embebido en el vault cifrado | M | — | Toca ambos forks de `engine.js`. `device-id.js` ya genera y persiste el UUID en IDB. Falta incluir `_deviceId` en el payload antes del `JSON.stringify` en `guardarVaultCifrado`. La Extension no lo usa pero debe exportar la misma API surface (`verify-crypto-sync.sh` verde). |
| 3 | **H-9** | Logging de eventos sync | M | — | `syncLog[]` append-only en IDB: `{ timestamp, operación, resultado, _deviceId }`. Cubre subida/descarga/conflicto. Objetivo: diagnóstico de crashes de Play Store que llegan sin contexto. |
| 4 | **D-1** | Distribución Android alternativa | M | — | APK firmado → IzzyOnDroid + GitHub Releases. Canal Android independiente de Play Store. De-riskea la dependencia de PS-1. |
| 5 | **M-4** | Decisión de unificación i18n | S | — | Spike + ADR. Extension usa `_locales/{es,en,pt_BR}/messages.json` (formato Chrome); PWA/Capacitor usa `web/src/i18n/strings.*.js` (módulos JS). Opciones: A) mantener separados, B) source único JSON + generador, C) Capacitor hereda PWA y Extension mantiene `_locales`. |
| 6 | **B-1** | OneDrive `refresh_token` → almacenamiento seguro | M | — | Spike primero. MSAL gestiona el token en `sessionStorage`, no IDB. Investigar `PublicClientApplication` con cache persistente / `INetworkModule` para mover el token al `DpmKeyPlugin` (Android Keystore). |
| 7 | **F7-A** | Android Autofill Service nativo | L | PS-1 | Épica v0.7.0. Se divide antes de entrar a sprint. Ver desglose abajo. |
| 8 | **F7-B** | iOS Credential Provider Extension | L | Mac + Apple Dev $99 | Diferida sin fecha. |

---

## Desglose de F7-A (épica — dividir en Planning cuando PS-1 se desbloquee)

**Objetivo:** el gestor aparece como opción de autocompletado del sistema Android en
cualquier app y navegador, sin abrir la app (paridad con Bitwarden/1Password).

Prerrequisitos (no son código):
1. PS-1 resuelta → cuenta activa para internal track
2. AAB v0.6.0 subido al internal track → confirmar instala y corre
3. Biometría probada en dispositivo físico (el emulador no permite enroll real)
4. Decidir: F7-A en el mismo proyecto Capacitor o módulo separado

Sub-items candidatos:
- `DpmAutofillService.kt` — `onFillRequest` / `onSaveRequest`
- Heurística de matching por `packageName` + `webDomain` (paridad con la Extension)
- Bridge JS→Kotlin para leer credenciales del vault descifrado en sesión
- UI de selección de credencial (inline o actividad dedicada)
- `AndroidManifest.xml` + `res/xml/autofill_service.xml` + permiso `BIND_AUTOFILL_SERVICE`
- Guardas de seguridad: solo sirve credenciales con sesión biométrica activa; no
  persiste descifrado fuera de la sesión Capacitor; `autofillHints` correctos

---

## Historial de refinamiento

| Fecha | Cambio |
|---|---|
| 2026-09-06 | Backlog creado. Consolidados roadmap-v0.7.0 + backlog diferido v0.6.0 (H-5, H-9, M-4, B-1) + D-1 (distribución alternativa). Priorización con PS-1 bloqueado: hardening desbloqueado primero, F7-A al fondo hasta desbloquear Play Store. |
