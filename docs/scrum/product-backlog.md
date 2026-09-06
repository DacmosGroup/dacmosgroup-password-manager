# Product Backlog — Dacmos Password Manager

**Última actualización:** 2026-09-06 (Sprint 1 Planning)
**Product Owner:** Alejandro Seijas
**Fuente consolidada de:** `roadmap-v0.7.0.md` · backlog diferido de v0.6.0 (`documento-tecnico.md` §29) · canales de distribución de `DACMOSGROUP_MASTER_CONTEXT.md`

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
- **Estado:** 🔄 **REENVIADA 2026-09-06** — esperando revisión de Google (1–3 días hábiles, aviso por correo a `dacmosgroup@gmail.com` + banner de Play Console). Documento: recibo ENSA de agosto 2026 (`ENSA Agosto 2026.jpeg`), nombre y dirección alineados campo por campo con el perfil. Rechazo previo: 2026-06-17, *"Proof of Address: document info does not match profile"*.
- **Al aprobar:** completar "Verify your contact phone number" → subir AAB al internal track.
  - ⚠️ **NO subir el AAB v0.6.0 que ya está firmado hoy** — es anterior a H-5 (`3c29a2d`, 2026-09-06) y su fork PWA de `engine.js` no lleva `_deviceId`. Rebuild + re-firma desde `main` post-H-5 antes de subir. (D-1 no tiene este problema: su APK se construye sobre `main` actual y ya trae H-5.)
- **Si se rechaza de nuevo:** plan B = estado de cuenta bancario (dirección con ciudad/provincia mejor formateada).
- **Cuenta:** `dacmosgroup@gmail.com` · ID 6476802733577318173 · tipo **individual** (nombre legal: Alejandro Seijas).
- **Qué desbloquea:** todo el track Android de v0.7.0 (internal testing → F7-A). No bloquea el resto del backlog; **D-1 es el hedge** si esto se demora o se rechaza de nuevo.
- **Reenvíos limitados** → completar el diagnóstico antes de pulsar "Verificar ahora".

**Causas más probables del rechazo (revisar primero):**
1. El recibo eléctrico usado **no está a nombre de Alejandro Seijas** (cuenta individual → el documento debe ir a su nombre; si está a nombre de un familiar/propietario/empresa, hace falta otro: estado de cuenta bancario a su nombre).
2. El recibo de junio **caducó** — los documentos de domicilio valen ~3 meses; hace falta uno reciente (< 90 días).
3. La dirección del recibo ≠ la del perfil, campo por campo (acentos `Panamá`/`Panama`, `Calle 50` vs `C. 50`, corregimiento, código postal).

**Checklist de reenvío:**
- [x] Fase A — perfil revisado: cuenta Personal, nombre legal ALEJANDRO ALBERTO SEIJAS HERNANDEZ, dirección ya alineada con el recibo.
- [x] Fase B — recibo ENSA agosto 2026 (emisión 29-ago, dentro de 60 días), a nombre completo del titular.
- [x] Fase C — dirección del perfil calza campo por campo.
- [x] Fase D — subido 2026-09-06 vía Home → Verify your identity → "Utility bill" → estado **Submitted**.
- [ ] Registrar resultado de Google aquí y en el standup log del sprint activo.

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
| — | **H-5** | `_deviceId` embebido en el vault cifrado | M | — | ✅ **COMPLETADO 2026-09-06** (Sprint 2). `_resolverDeviceId()` interno en ambos forks (PWA → `device-id.js`; Extension → `null`), embebido en `configurarVault` + `guardarVaultCifrado` + `cambiarMasterPassword`. Sin bump de `BLOB_VERSION`. Decisión: `documento-tecnico.md` §30. `verify-crypto-sync.sh` exit 0. |
| 2 | **D-1** | Distribución Android alternativa | M | — | APK firmado → IzzyOnDroid + GitHub Releases. Canal Android independiente de Play Store. **Es el hedge contra un segundo rechazo de PS-1** — el arquitecto lo trata como el item más urgente, no como alternativa descartable. |
| 3 | **H-9** | Logging de eventos sync | M | D-1 (para que tenga señal real) | `syncLog[]` append-only en IDB: `{ timestamp, operación, resultado, _deviceId }`. Cubre subida/descarga/conflicto. Entra emparejado con D-1 o inmediatamente después — antes de tener usuarios Android externos no hay nada que diagnosticar. |
| 4 | **M-4** | Decisión de unificación i18n | S | — | Spike + ADR. Extension usa `_locales/{es,en,pt_BR}/messages.json` (formato Chrome); PWA/Capacitor usa `web/src/i18n/strings.*.js` (módulos JS). Opciones: A) mantener separados, B) source único JSON + generador, C) Capacitor hereda PWA y Extension mantiene `_locales`. |
| 5 | **B-1** | OneDrive `refresh_token` → almacenamiento seguro | M | — | Spike primero. MSAL gestiona el token en `sessionStorage`, no IDB. Investigar `PublicClientApplication` con cache persistente / `INetworkModule` para mover el token al `DpmKeyPlugin` (Android Keystore). |
| 6 | **F7-A** | Android Autofill Service nativo | L | PS-1 **+ gate de arquitectura** | Épica v0.7.0. **NO entra a Planning** hasta cerrar 3 huecos de seguridad/diseño en el chat del Project DPM (ver desglose abajo). |
| 7 | **F7-B** | iOS Credential Provider Extension | L | Mac + Apple Dev $99 | Diferida sin fecha. |
| 8 | **T-1** | `verify-crypto-sync.sh` no compara aridad de funciones | S | — | Mejora de tooling (sugerida por el arquitecto durante H-5). `check_exports` compara solo nombres exportados — cambiar la firma de una función forkeada (agregar/quitar parámetros) pasa el check sin detectarse. Sin driver urgente; al fondo. |

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
| 2026-09-06 | **H-5 ✅ COMPLETADO** (Sprint 2). Gate de arquitectura resuelto en 2 rondas de brief: el payload cifrado ya era objeto `{ credenciales }` (no array plano), sync per-item de §15 nunca se implementó, resolución del `deviceId` interna al engine sin parámetro. Decisión consolidada en `documento-tecnico.md` §30. Nuevo item **T-1** (S) al fondo: `verify-crypto-sync.sh` no compara aridad. Cirugía de doc previa: §29 (v0.6.0) extraída de §27 Referencias, numeración corregida. |
