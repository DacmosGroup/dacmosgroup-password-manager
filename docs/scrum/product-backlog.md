# Product Backlog — Dacmos Password Manager

**Última actualización:** 2026-11-19 (D-1 y EX-1 ✅ — APK 0.6.1; nuevos UX-1, UX-2, UX-BIO-1, SY-1, T-2)
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
| PWA | v0.6.1 | ✅ Live en dpm.dacmosgroup.co (dominio restablecido el 2026-11-19) |
| Android (Capacitor v8) | v0.6.1 | ✅ APK vc 2 en GitHub Releases (D-1) · ✅ AAB vc 3 en el internal testing de Play (AAB-1, 2026-11-25), firmado por Play con `dacmos-pm`: se actualiza de un canal al otro sin desinstalar. El AAB v0.6.0 no arranca (splash) y no se distribuye |
| iOS | — | Stub Capacitor. Bloqueado (Mac + Apple Developer $99) |

---

## Bloqueantes externos — propiedad del PO, no son trabajo de sprint

### PS-1 · Verificación de identidad Play Store  `[BLOQUEANTE EXTERNO]` — ✅ CERRADO 2026-09-07
- **Estado:** ✅ **CERRADO 2026-09-07.** Identidad verificada (*"Your identity has been verified successfully"*, notificación Sep 7). Cuenta de desarrollador **completa**: tipo Personal · nombre legal, dirección y teléfono de contacto ✅ verificados · email `info@dacmosgroup.co` ✅ verificado. Banner "Finish setting up" desaparecido → **internal track habilitado.** *(Precisión 2026-11-25: lo habilitado era la cuenta; la app no existía en la consola hasta AAB-1, que la creó y configuró Play App Signing — `documento-tecnico.md` §32.)*
- **Reenvío que lo destrabó:** comprobante de domicilio actualizado, 2026-09-06. Rechazo previo: 2026-06-17.
- **Cuenta:** tipo individual.
- **Único pendiente Android-Play:** subir un AAB al internal track — ver follow-up abajo.
  - ⚠️ **NO subir el AAB v0.6.0 que ya está firmado hoy** — es anterior a H-5 (`3c29a2d`, 2026-09-06) y su fork PWA de `engine.js` no lleva `_deviceId`. Rebuild + re-firma desde `main` post-H-5 antes de subir. (D-1 no tiene este problema: su APK se construye sobre `main` actual y ya trae H-5.)
- **Si se rechaza de nuevo:** plan B = estado de cuenta bancario (dirección con ciudad/provincia mejor formateada).
- **Cuenta:** tipo **individual** (titular: Alejandro Seijas). Los identificadores de la cuenta no se documentan en el repo.
- **Qué desbloquea:** todo el track Android de v0.7.0 (internal testing → F7-A). No bloquea el resto del backlog; **D-1 es el hedge** si esto se demora o se rechaza de nuevo.
- **Reenvíos limitados** → completar el diagnóstico antes de pulsar "Verificar ahora".

### PS-2 · Pruebas cerradas antes de producción en Play  `[BLOQUEANTE EXTERNO]`
- Las cuentas personales nuevas deben pasar por **pruebas cerradas con al menos 12 testers durante 14 días seguidos** antes de poder solicitar acceso a producción. Hoy DPM está en internal testing (1 tester).
- Propiedad del PO (reclutar testers). Sin fecha; no bloquea el resto del backlog. Antes de abrir pruebas cerradas: completar la ficha de la tienda y las declaraciones de *App content*.

**Causas más probables del rechazo (revisar primero):**
1. El recibo eléctrico usado **no está a nombre de Alejandro Seijas** (cuenta individual → el documento debe ir a su nombre; si está a nombre de un familiar/propietario/empresa, hace falta otro: estado de cuenta bancario a su nombre).
2. El recibo de junio **caducó** — los documentos de domicilio valen ~3 meses; hace falta uno reciente (< 90 días).
3. La dirección del recibo ≠ la del perfil, campo por campo (acentos `Panamá`/`Panama`, `Calle 50` vs `C. 50`, corregimiento, código postal).

**Checklist de reenvío:**
- [x] Fase A — perfil revisado: cuenta Personal, nombre legal completo del titular, dirección ya alineada con el recibo.
- [x] Fase B — recibo de servicio público reciente (dentro de 60 días), a nombre completo del titular.
- [x] Fase C — dirección del perfil calza campo por campo.
- [x] Fase D — subido 2026-09-06 vía Home → Verify your identity → "Utility bill" → estado **Submitted**.
- [x] Registrar resultado de Google aquí y en el standup log del sprint activo — ✅ **APROBADO 2026-09-07**.

**Follow-up desbloqueado por PS-1 — ✅ hecho como AAB-1 (Sprint 3, 2026-11-25; firma con clave de subida `dacmos-upload`, no con el keystore de release: §32).** Texto original: rebuild del AAB desde `main` post-H-5 (`versionCode 3`, `versionName 0.6.1` — ya reservado en `d1-decisiones-temp.md` §D1-1) + re-firma con el keystore de release + subida al internal track. Es trabajo de dev análogo a la Fase 1 de D-1, pero con un Goal distinto al de Sprint 2 ("fuera de Play Store") → ¿entra a Sprint 2 por scope, va a Sprint 3, o es sprint aparte? No necesita GitHub (solo keystore + Play Console, ambos disponibles).

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
| — | **D-1** | Distribución Android alternativa | M | — | ✅ **COMPLETADO 2026-11-19** (Sprint 2). APK 0.6.1 (vc 2) firmado con `dacmos-pm` en GitHub Releases (`v0.6.1`); SHA-256 del archivo y huella del certificado publicados en la Release. **IzzyOnDroid descartado** (su política no admite código con contribuciones de IA generativa; D1-17); `fastlane/metadata/` se conserva para un canal futuro (DIST-1). Probado en un teléfono real. Decisiones: `documento-tecnico.md` §31 (D1-1..D1-17). |
| — | **AAB-1** | AAB vc 3 / 0.6.1 al internal track de Play | S–M | — | ✅ **COMPLETADO 2026-11-25** (Sprint 3). Play App Signing con `dacmos-pm` vía PEPK + clave de subida `dacmos-upload`; guard fail-closed en `build.gradle` (`-Pdpm.signing=upload`, `78ad1a9`). Probado: actualización sobre el APK vc 2 de GitHub sin desinstalar y instalación limpia. `documento-tecnico.md` §32. |
| — | **AAB-2** | AAB vc 4 / 0.6.1 sin Automatic protection de Play | S | — | ✅ **COMPLETADO 2026-11-26** (Sprint 3, P-100). Protección apagada a nivel de app; vc 4 desde `6465106` (mismo código que vc 2/vc 3); verificado en A33 (Play → Play) y S25 (GitHub → Play): firma `B9:3E`, sin `com.pairip`, bóveda intacta y en modo avión (§32). PS-2 arranca con vc 4. |
| 2b | **SW-1** | Servir Workbox desde el propio dominio en la PWA | S | — | ✅ **COMPLETADO 2026-11-26** (Sprint 3). Workbox 7.0.0 vendorizado en `web/libs/workbox-v7.0.0/` con `SHA256SUMS` verificado en el CI antes del deploy; CSP sin `storage.googleapis.com`; previews por rama en `deploy-pwa.yml`; prueba de actualización en preview y prueba negativa en el CI; en producción con `600ed5b` (§32). |
| 3 | **H-9** | Logging de eventos sync | M | D-1 (para que tenga señal real) | `syncLog[]` append-only en IDB: `{ timestamp, operación, resultado, _deviceId }`. Cubre subida/descarga/conflicto. Entra emparejado con D-1 o inmediatamente después — antes de tener usuarios Android externos no hay nada que diagnosticar. |
| 4 | **M-4** | Decisión de unificación i18n | S | — | Spike + ADR. Extension usa `_locales/{es,en,pt_BR}/messages.json` (formato Chrome); PWA/Capacitor usa `web/src/i18n/strings.*.js` (módulos JS). Opciones: A) mantener separados, B) source único JSON + generador, C) Capacitor hereda PWA y Extension mantiene `_locales`. |
| 5 | **B-1** | OneDrive `refresh_token` → almacenamiento seguro | M | — | Spike primero. MSAL gestiona el token en `sessionStorage`, no IDB. Investigar `PublicClientApplication` con cache persistente / `INetworkModule` para mover el token al `DpmKeyPlugin` (Android Keystore). |
| 6 | **F7-A** | Android Autofill Service nativo | L | PS-1 **+ gate de arquitectura** | Épica v0.7.0. **NO entra a Planning** hasta cerrar 3 huecos de seguridad/diseño en el chat del Project DPM (ver desglose abajo). |
| 7 | **F7-B** | iOS Credential Provider Extension | L | Mac + Apple Dev $99 | Diferida sin fecha. |
| 8 | **T-1** | `verify-crypto-sync.sh` no compara aridad de funciones | S | — | Mejora de tooling (sugerida por el arquitecto durante H-5). `check_exports` compara solo nombres exportados — cambiar la firma de una función forkeada (agregar/quitar parámetros) pasa el check sin detectarse. Sin driver urgente; al fondo. |
| 8b | **T-2** | `org.gradle.java.home` con ruta absoluta de una máquina | S | — | Propuesto por el arquitecto en D-1 (D1-7). El build de Android solo corre en la laptop actual: reemplazar la ruta por detección portable (`JAVA_HOME` o toolchain con auto-detect forzando JDK 21) antes de llevar Android a CI. Al resolverlo, `npx cap sync android` y la comparación del hash de `engine.js` (D1-14) van al mismo script. **Nota 2026-11-26:** los assets web empaquetados llevan CRLF porque se compila en Windows con `core.autocrlf=true`; para una build reproducible hay que fijar los finales de línea de `web/` (`.gitattributes`) o normalizarlos antes de `cap sync` (§32). |
| 8c | **SY-1** | Sincronización en Android con OAuth nativo | M–L | **SG-1 + gate de arquitectura** | Creado en D-1 (D1-12). Hoy el sync está oculto en Android: Google bloquea OAuth en WebViews embebidos y el sync sin los guards de SG-1 no se habilita en una plataforma nueva. Opciones a evaluar: Custom Tabs/AppAuth o Credential Manager. |
| 8d | **UX-1** | Ocultar el splash al terminar la inicialización | S | — | Creado en D-1 (D1-9). Hoy `launchAutoHide: true` + 500 ms; puede verse un destello entre el splash y la primera vista. `SplashScreen.hide()` al terminar el init de `app.js`. Cosmético. |
| 8e | **UX-2** | Diálogos propios en lugar de `confirm()` y del modal con estilos inyectados | S | — | Creado en D-1. (1) Los botones del `confirm()` salen en inglés en Android (los pone Capacitor): diálogo propio siguiendo el patrón de `_pedirContrasena()`. (2) En la PWA, el modal de contraseña sale sin estilo porque la CSP (`style-src 'self'`) bloquea el `<style>` que inyecta; en el APK se ve bien. (3) En el teléfono, la descripción de "Exportar CSV" queda en una palabra por línea por los dos botones. |
| 8f | **UX-BIO-1** | Mensaje cuando no hay huella registrada | S | Ampliar el puente de `DpmKeyPlugin` | Creado en D-1 (D1-11). `isAvailable()` devuelve solo un booleano; para mostrar "registra una huella en los Ajustes del teléfono" hace falta devolver el código de `BiometricManager`. No se amplió el plugin de claves por un texto. Mientras tanto, la ficha lo aclara. |
| 8g | **DIST-1** | Evaluar otros canales de distribución Android | S (spike) | Después de SW-1 | Creado en D-1 (D1-17) tras descartar IzzyOnDroid por su política de IA. Evaluar F-Droid principal (compila desde el código: ligado a T-2 y a build reproducible), Accrescent y otros, **revisando la política sobre código generado con IA de cada uno**. Requisito para cualquiera: completar `fastlane/metadata` con ícono y capturas. Prioridad baja. |
| 8h | **SW-DEV** | Bypass del service worker en desarrollo (`ENTORNO_DEV`) | S | Después de SW-1 | Creado 2026-11-25. El contrato de §20 (bypass por hostname en localhost) se documentó pero **nunca se implementó** (solo en el commit de docs `412e1cf`). Hoy en desarrollo se usa DevTools. No entra en SW-1 para no mezclar alcances. |
| 8i | **DV-1** | Verificación de desarrolladores de Android para el APK fuera de Play | S | — | 🔄 **Registro confirmado por el PO el 2026-11-26** (Play Console → Android developer verification): `co.dacmosgroup.dpm` registrado y verificado con `B9:3E` (`dacmos-pm`), así que el APK de GitHub queda cubierto. Queda retirar o documentar las claves ajenas del registro (acción del PO en la consola; el detalle no va al repo). |
| 9 | **SG-1** | Guards de subida del sync (G1–G4) | M | **Gate de arquitectura + aprobación del PO** | **Propuesto por el arquitecto (2026-11-10); NO aprobado.** Verificado en código por Code (el detalle técnico del hallazgo se mantiene en el Project DPM, no en este repo público). Propuesta: **G1** sal remota ≠ local → no subir en automático, pedir confirmación; **G2** el local encoge mucho o es ≈ vacío frente al remoto → confirmación; **G3** primera sync solo descarga (ya existe en la Extension; verificar la PWA); **G4** snapshot `vault.prev-<ts>.json` en appData antes de sobrescribir (anillo de 3). Restricción: el service worker de la Extension no tiene la clave AES, el guard usa solo lo que está en claro. Ambos forks. Origen: incidente 31-may/1-jun y pérdida de la bóveda del PO (auditoría del workspace, AUD-67). |
| — | **EX-1** | Exportar backup cifrado (y CSV) en Android | S–M | — | ✅ **COMPLETADO 2026-11-18** (Sprint 2, dentro de D-1). `DpmExportPlugin` propio (SAF, solo escritura, 0 dependencias), confirmación del CSV en ambas plataformas, `allowBackup=false` + `dataExtractionRules`, sync oculto en Android. Ida y vuelta del backup probada en Samsung real (credenciales + TOTP). §31 D1-10..D1-13. |
| 10 | **ER-1** | Recuperación de emergencia de la maestra (kit de recuperación) | L | **Gate de arquitectura + aprobación del PO** | **Propuesto por el arquitecto (2026-11-10); NO aprobado.** Hoy la clave del vault **es** PBKDF2(contraseña, sal): no hay clave que envolver. Requiere jerarquía de claves (DEK aleatoria envuelta por KEK de contraseña y por KEK de recuperación impresa) = cambio de envelope, **bump de `BLOB_VERSION`** y regla de §23 (las 3 superficies deben **leer** v2 antes de que ninguna lo **produzca**: dos releases). Decisión abierta: v2 = DEK con Argon2id movido a v3, o ambos combinados. No habría evitado una sobrescritura, solo una contraseña olvidada. Workspace: P-34. |

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
| 2026-11-10 | Sesión de recuperación de accesos (sin código): añadidos **SG-1** (guards del sync) y **ER-1** (recuperación de emergencia), ambos **propuestos por el arquitecto y sin aprobar**; sin cambios de prioridad del resto. Contexto: D-1 sigue bloqueado por el PAT de GitHub. |
| 2026-09-06 | **H-5 ✅ COMPLETADO** (Sprint 2). Gate de arquitectura resuelto en 2 rondas de brief: el payload cifrado ya era objeto `{ credenciales }` (no array plano), sync per-item de §15 nunca se implementó, resolución del `deviceId` interna al engine sin parámetro. Decisión consolidada en `documento-tecnico.md` §30. Nuevo item **T-1** (S) al fondo: `verify-crypto-sync.sh` no compara aridad. Cirugía de doc previa: §29 (v0.6.0) extraída de §27 Referencias, numeración corregida. |
| 2026-11-17 | **D-1 Fase 1 + primera prueba en dispositivo físico.** La app Android nunca había arrancado (splash nativo sin `hide()`, corregido); los assets web empaquetados eran pre-H-5 (ahora `npx cap sync android` antes de cada build). Funciona: vault, TOTP, biometría (requiere huella clase 3 registrada), persistencia. Falla: exportar backup/CSV → nuevo **EX-1** (propuesto, sin aprobar) y D-1 pasa a depender de él. Para el arquitecto: canal de exportación, mensaje cuando no hay biometría, sync Drive/OneDrive en el WebView sin probar, aviso de borrado a los 7 días en Android, `cap sync` en el procedimiento de build. |
| 2026-11-18/19 | **EX-1 aprobado y ✅; D-1 ✅.** El arquitecto eligió un plugin nativo propio separado de `DpmKeyPlugin` (SAF) y el PO aprobó EX-1 y el bloqueo de las copias del sistema (`allowBackup` + `dataExtractionRules`, porque con targetSdk 36 `allowBackup` solo no corta la transferencia entre teléfonos). Sync oculto en Android también en el setup. DoD de EX-1 completa en un Samsung real; PWA 0.6.1 desplegada y verificada. Nuevos: **T-2** (propuesto en D1-7), **SY-1**, **UX-1**, **UX-2**, **UX-BIO-1**. DoD general: todo item de Android exige prueba en dispositivo físico. Hallazgo fuera del repo: el subdominio de la PWA no tenía registro DNS (restablecido el 2026-11-19). |
| 2026-11-19 | Antes de la Release: barra inferior tapada en Android (edge-to-edge, `242f7f7`) y **service worker dentro del APK** sirviendo el código viejo al actualizar (`b152ec6`, opción (a) del arquitecto: sin SW en nativo). Probado con A/B en el teléfono. Nuevo **SW-1** (Workbox desde el propio dominio), propuesto antes de H-9. DoD de Android: instalación limpia **y** actualización. |
| 2026-11-19 | **IzzyOnDroid descartado** (App Inclusion Policy: sin código con contribuciones de IA generativa; consultada 2026-11-19). D-1 cerrado con GitHub Releases y DoD reformulada (hashes publicados). Nuevo **DIST-1** (spike, después de SW-1). README con "Cómo se desarrolla DPM"; Obtainium documentado como herramienta de terceros. |
| 2026-11-25 | **Sprint 2 cerrado** (Review + Retro en `sprints/sprint-02.md`): H-5, D-1 y EX-1 aceptados. Retro: puerta de arquitectura según riesgo (README), repo conectado al Project DPM por GitHub, teléfono desde el primer build de cada item Android. Orden del backlog sin cambios; Sprint 3 en Planning (candidatos: SW-1 + AAB vc 3 / 0.6.1, H-9 de reserva — decide el PO). |
| 2026-11-25 | Sprint 3: gate cerrado. **AAB-1 ✅** (Play App Signing con `dacmos-pm`, opción B del PO; actualización GitHub → Play probada). Nuevos: **PS-2** (pruebas cerradas 12 testers / 14 días antes de producción), **DV-1** (verificación de desarrolladores para el APK fuera de Play), **SW-DEV** (el bypass de §20 nunca se implementó). `assetlinks.json` adelantado al Sprint 3 (un solo fingerprint). |
| 2026-11-25 | **AAB-1b ✅** `assetlinks.json` solo con `B9:3E` (`1e594c6`), verificado en producción. DV-1 sube de prioridad: confirmación del PO en Play Console esta semana. |
| 2026-11-26 | **SW-1 ✅** en producción (`600ed5b`): prueba de actualización en preview y negativa en el CI; `deploy-pwa.yml` con previews por rama (antes un dispatch desde cualquier rama publicaba en producción). **AAB-2** nuevo en el Sprint 3: Automatic protection de Play se apaga (P-100) y PS-2 arranca con vc 4 / 0.6.1 (`6465106`). |
| 2026-11-26 | **AAB-2 ✅** y **Sprint 3 cerrado** (Review + Retro en `sprints/sprint-03.md`): SW-1, AAB-1, AAB-1b y AAB-2 aceptados. Retro: verificar el APK que entrega el canal y probar la PWA servida en un preview (ambos en la DoD del README); inventario de accesos de la máquina fuera del repo. Siguiente: Planning del Sprint 4 (PO); candidatos PS-2, H-9, DV-1. |
