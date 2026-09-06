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
- **Cuenta:** `dacmosgroup@gmail.com` · ID 6476802733577318173 · tipo **individual** (nombre legal: Alejandro Seijas).
- **Qué desbloquea:** todo el track Android de v0.7.0 (internal testing → F7-A). No bloquea el resto del backlog; **D-1 es el hedge** si esto se demora o se rechaza de nuevo.
- **Reenvíos limitados** → completar el diagnóstico antes de pulsar "Verificar ahora".

**Causas más probables del rechazo (revisar primero):**
1. El recibo eléctrico usado **no está a nombre de Alejandro Seijas** (cuenta individual → el documento debe ir a su nombre; si está a nombre de un familiar/propietario/empresa, hace falta otro: estado de cuenta bancario a su nombre).
2. El recibo de junio **caducó** — los documentos de domicilio valen ~3 meses; hace falta uno reciente (< 90 días).
3. La dirección del recibo ≠ la del perfil, campo por campo (acentos `Panamá`/`Panama`, `Calle 50` vs `C. 50`, corregimiento, código postal).

**Checklist de reenvío:**
- [ ] Fase A — `play.google.com/console` → banner de verificación **o** Configuración → Datos de la cuenta de desarrollador → Verificación de identidad. Anotar: motivo exacto del rechazo + dirección que muestra el perfil.
- [ ] Fase A — `payments.google.com` → Configuración → dirección del perfil de pagos. Comparar con la anterior.
- [ ] Fase B — Conseguir recibo de servicio **reciente** a nombre de Alejandro Seijas (o estado de cuenta bancario si el recibo no está a su nombre).
- [ ] Fase C — Editar el perfil para que la dirección calce **exactamente** con el documento. Guardar.
- [ ] Fase D — Subir el documento (PDF/foto a color, completo, 4 esquinas, fecha visible) → "Verificar ahora" → esperar 1–3 días hábiles.
- [ ] Registrar resultado aquí y en el standup log.

---

## Backlog priorizado

Orden decidido por el PO tras la revisión del arquitecto (2026-09-06). El
razonamiento: H-9 no tiene nada que loguear mientras no haya usuarios Android
externos; D-1 crea ese canal, así que D-1 va antes que H-9 y H-9 se empareja
con D-1 o justo después. H-5 sí tiene valor inmediato (Extension + PWA en
producción con usuarios reales).

| # | ID | Item | Talla | Depende de | Notas |
|---|---|---|---|---|---|
| — | **S-1..S-4** | Arranque Scrum + housekeeping repo | M | — | ✅ Sprint 1 CERRADO 2026-09-06 |
| 1 | **H-5** | `_deviceId` embebido en el vault cifrado | M | — | Toca ambos forks de `engine.js`. `device-id.js` ya genera y persiste el UUID en IDB. Falta incluir `_deviceId` en el payload antes del `JSON.stringify` en `guardarVaultCifrado`. La Extension no lo usa pero debe exportar la misma API surface (`verify-crypto-sync.sh` verde). Valor inmediato: Extension + PWA están en producción. |
| 2 | **D-1** | Distribución Android alternativa | M | — | APK firmado → IzzyOnDroid + GitHub Releases. Canal Android independiente de Play Store. **Es el hedge contra un segundo rechazo de PS-1** — el arquitecto lo trata como el item más urgente, no como alternativa descartable. |
| 3 | **H-9** | Logging de eventos sync | M | D-1 (para que tenga señal real) | `syncLog[]` append-only en IDB: `{ timestamp, operación, resultado, _deviceId }`. Cubre subida/descarga/conflicto. Entra emparejado con D-1 o inmediatamente después — antes de tener usuarios Android externos no hay nada que diagnosticar. |
| 4 | **M-4** | Decisión de unificación i18n | S | — | Spike + ADR. Extension usa `_locales/{es,en,pt_BR}/messages.json` (formato Chrome); PWA/Capacitor usa `web/src/i18n/strings.*.js` (módulos JS). Opciones: A) mantener separados, B) source único JSON + generador, C) Capacitor hereda PWA y Extension mantiene `_locales`. |
| 5 | **B-1** | OneDrive `refresh_token` → almacenamiento seguro | M | — | Spike primero. MSAL gestiona el token en `sessionStorage`, no IDB. Investigar `PublicClientApplication` con cache persistente / `INetworkModule` para mover el token al `DpmKeyPlugin` (Android Keystore). |
| 6 | **F7-A** | Android Autofill Service nativo | L | PS-1 **+ gate de arquitectura** | Épica v0.7.0. **NO entra a Planning** hasta cerrar 3 huecos de seguridad/diseño en el chat del Project DPM (ver desglose abajo). |
| 7 | **F7-B** | iOS Credential Provider Extension | L | Mac + Apple Dev $99 | Diferida sin fecha. |

---

## Desglose de F7-A (épica — GATE DE ARQUITECTURA antes de Planning)

**Objetivo:** el gestor aparece como opción de autocompletado del sistema Android en
cualquier app y navegador, sin abrir la app (paridad con Bitwarden/1Password).

### Huecos que el arquitecto revisor debe cerrar ANTES de dividir en items de sprint

1. **Verificación de asociación `packageName` ↔ dominio vía Digital Asset Links
   (`assetlinks.json`).** [Seguro] El framework de Autofill no garantiza que una app
   que declara un dominio realmente lo sea. Sin esta verificación, una app maliciosa
   se anuncia como el dominio legítimo y el sistema le ofrece las credenciales. Es el
   vector de phishing que Bitwarden/1Password mitigan explícitamente. La "paridad" no
   está completa sin esto.
2. **Guard del path de escritura (`onSaveRequest`).** [Probable] ¿Cómo se cifra una
   credencial nueva capturada por autofill? ¿Pasa por `guardarVaultCifrado` con la
   clave de sesión activa, o hay un buffer intermedio? Zero-Knowledge no-negociable →
   no puede quedar implícito.
3. **Posible campo de schema nuevo `packageNames: []`.** [Suposición] Para apps sin
   app-links configurados donde el dominio web no basta para el matching. Si se
   confirma, es cambio de schema que toca `credential-schema.js` + ambos forks →
   decisión de arquitectura previa, no descubrimiento a mitad de implementación.

### Prerrequisitos (no son código)
1. PS-1 resuelta → cuenta activa para internal track
2. AAB subido al internal track → confirmar instala y corre
3. Biometría probada en dispositivo físico (el emulador no permite enroll real)
4. Decidir: F7-A en el mismo proyecto Capacitor o módulo separado

### Sub-items candidatos (a confirmar tras el gate)
- `DpmAutofillService.kt` — `onFillRequest` / `onSaveRequest`
- Verificación Digital Asset Links en el matching
- Heurística de matching por `packageName` + `webDomain` (+ `packageNames[]` si aplica)
- Bridge JS→Kotlin para leer credenciales del vault descifrado en sesión
- UI de selección de credencial (inline o actividad dedicada) — DoD de UI: desktop N/A, cubrir touch Android
- `AndroidManifest.xml` + `res/xml/autofill_service.xml` + permiso `BIND_AUTOFILL_SERVICE`
- Guardas: solo sirve credenciales con sesión biométrica activa; no persiste descifrado
  fuera de la sesión Capacitor; `autofillHints` correctos; guard de `onSaveRequest`

---

## Historial de refinamiento

| Fecha | Cambio |
|---|---|
| 2026-09-06 | Backlog creado. Consolidados roadmap-v0.7.0 + backlog diferido v0.6.0 (H-5, H-9, M-4, B-1) + D-1 (distribución alternativa). Priorización con PS-1 bloqueado: hardening desbloqueado primero, F7-A al fondo hasta desbloquear Play Store. |
| 2026-09-06 | Rev. tras validación del arquitecto: D-1 sube a #2 (hedge contra 2º rechazo de PS-1); H-9 baja a #3 y se empareja con D-1 (sin usuarios Android externos no hay señal que loguear). F7-A marcado con GATE DE ARQUITECTURA — 3 huecos a cerrar antes de Planning: Digital Asset Links, guard de `onSaveRequest`, posible campo `packageNames[]` en schema. |
| 2026-09-06 | PS-1: cuenta confirmada individual (Alejandro Seijas). Añadido checklist de reenvío de 4 fases + 3 causas probables del rechazo (documento no a su nombre / recibo caducado / dirección desalineada). |
