# Sprint 2 — Android fuera de Play Store + deviceId en el vault · CERRADO

**Inicio:** 2026-09-06 · **Cierre:** 2026-11-25
**Sprint Goal:** DPM Android disponible para usuarios reales fuera de Play Store, y el vault cifrado identificando su dispositivo de origen.
**Resultado del Goal:** ✅ cumplido
**Standup log completo:** `docs/scrum/sprint-actual.md` en `59bce83` (último commit antes del cierre)

---

## Sprint Review

### Incremento demostrado

| ID | Item | Talla | Aceptación PO | Nota |
|---|---|---|---|---|
| H-5 | `_deviceId` embebido en el payload cifrado del vault, resuelto dentro del engine en ambos forks | M | ✅ aceptado | Brief v2 del arquitecto tras 3 divergencias reportadas por Code. `3c29a2d` + docs §30. En la PWA lo resuelve `device-id.js`; en la Extension, `null` (asimetría deliberada, documentada). |
| D-1 | APK firmado publicado fuera de Play Store | M | ✅ aceptado | Release `v0.6.1` en GitHub: `dacmos-pm-v0.6.1.apk` (vc 2), firmado con `dacmos-pm`, con SHA-256 del archivo y huella del certificado. DoD reformulada en D1-17: IzzyOnDroid descartado porque su política no admite código hecho con IA generativa. Docs §31 (D1-1..D1-17). |
| EX-1 | Exportar backup cifrado y CSV en Android | S–M | ✅ aceptado | Entró el 2026-11-18 como dependencia de D-1 (bloqueaba la publicación). `DpmExportPlugin` (SAF, solo escritura, 2 MIME en lista blanca) + `allowBackup="false"` + `dataExtractionRules`. |

Arreglos que salieron al probar en el teléfono, dentro de D-1:

- `5b58423` — el splash nativo no terminaba nunca. La app no había arrancado jamás en un teléfono; el AAB v0.6.0 tampoco arranca.
- `242f7f7` — la barra inferior quedaba tapada por los botones del sistema (edge-to-edge de Android 15+).
- `b152ec6` — el service worker de la PWA se registraba dentro del APK y, al actualizar instalando encima, seguía sirviendo el código viejo. Ahora no hay SW en nativo (D1-15/D1-16).
- `d955c29` / `a411ab1` — el sync queda oculto en Android (SY-1) y el aviso del CSV se amplía: no abrirlo con asistentes de IA ni visores en la nube.

### Verificación

- `bash scripts/verify-crypto-sync.sh` → exit 0 (repetido al cierre, 2026-11-25).
- H-5: `tests/h5-verify.mjs` exit 0.
- EX-1: pasos 1–4 de la DoD en el teléfono del PO (backup a Descargas y a Drive, cancelar sin error, ida y vuelta desinstalar → instalar → importar con TOTP, CSV con confirmación). Paso 5 (PWA en escritorio e incógnito tras el deploy) ✅.
- Android, instalación limpia **y** actualización: prueba A/B (A limpia → B encima: aparece el marcador `0.6.1-B` → A encima de B: desaparece; reabrir sin bucle) ✅.
- Antes de cada build: `npx cap sync android` y hash de `engine.js` igual en los assets empaquetados (§31 D1-14).
- No probado (documentado): `bmgr backupnow` y la transferencia al migrar de teléfono.

### Fuera del incremento

Nada comprometido quedó sin hacer. Pasan al backlog:

- **SW-1** — Workbox servido desde el propio dominio (hoy `importScripts` desde `storage.googleapis.com`).
- **DIST-1** — evaluar otros canales de distribución Android (spike, después de SW-1).
- **UX-BIO-1**, **UX-1**, **UX-2**, **SY-1**, **T-2** — creados durante D-1.
- **AAB vc 3 / 0.6.1 para Play** — internal track habilitado (PS-1 cerrado el 2026-09-07); el AAB v0.6.0 no se sube.

---

## Sprint Retro

**¿Qué cambiamos para el próximo sprint?**

1. **Puerta de arquitectura según riesgo.** D-1 llevó unas 10 rondas con el arquitecto, varias por temas menores. Desde 2026-11-25 el gate es obligatorio solo para criptografía, sync, permisos, distribución y firma, y dependencias o CDN nuevos; el resto lo implementa Code con OK del PO y lo registra en el standup (`README.md`, "Puerta según riesgo").
2. **Repo conectado al Project DPM por GitHub.** El arquitecto trabajaba con copias subidas a mano que se atrasaban: el 2026-11-25 propuso corregir el README con un arreglo que ya estaba en `59bce83`. Desde hoy el Project lee el repo por GitHub (se sincroniza tras cada push) y la carpeta local `_KNOWLEDGE\DPM`; ya no se suben docs a mano.
3. **Teléfono desde el primer build de cada item de Android.** Los tres problemas grandes de D-1 (splash infinito, SW sirviendo código viejo, barra tapada) aparecieron recién en el teléfono, ya cerca de publicar. En el Sprint 3, el primer APK de cada item Android se instala en el teléfono antes de seguir con el resto.

---

## Métricas

- Items comprometidos: 2 (H-5, D-1) + 1 que entró a mitad de sprint (EX-1) · completados: 3
- Duración: 80 días de calendario · ~5 días de trabajo efectivo (6-sep, 17/18/19-nov y la sesión de cierre)
- Pausa larga: de 2026-09-07 a 2026-11-10 sin código, por un bloqueo de acceso personal, no técnico (standup del 2026-09-06). No se registró como "Sprint pausado" (README, regla de >3 semanas): queda anotado aquí.
- Commits: 33 — código 9 (`feat`/`fix`), config y distribución 3 (`chore`/`content`), docs 21
