# Roadmap v0.5.1 — Saneamiento pre-v0.6.0

**Versión base:** 0.5.0 (publicada en CWS + PWA LIVE)
**Estado:** ✅ COMPLETADO — 2026-06-11
**Origen:** Auditoría interna v0.5.0 (`docs/auditoria-v0.5.0-hallazgos.md`)
**Naturaleza:** Ciclo de saneamiento. Sin features nuevas de producto — resuelve
paridad Extension↔PWA y deuda antes de que Capacitor (v0.6.0) herede el bundle PWA.

> Decisión de scope: ciclo separado **antes** de v0.6.0 para que Capacitor envuelva
> código saneado desde el día 1, aislando la migración de schema del wrapping nativo.

---

## Alcance

| Feature | Hallazgo | Estado |
|---|---|---|
| **F5.1-A** — Schema canónico TOTP (`totp`) + shim de lectura dual + convergencia lazy B2 | A-1, M-5 | ✅ COMPLETADO |
| **F5.1-B** — Motor TOTP en la PWA (port `totp.js`) + código en vivo + countdown | A-2 | ✅ COMPLETADO |
| **F5.1-C** — Fix BUG-SYNC-404 en el adapter Drive de la Extension + adapters al protocolo de forks | M-1 | ✅ COMPLETADO |
| **F5.1-D** — Neutralización de CSV formula injection (ambas superficies) + columna TOTP canónica | M-2, M-3 | ✅ COMPLETADO |
| **F5.1-E** — i18n del wizard de import (29 keys ES/EN/PT-BR) | B-2 | ✅ COMPLETADO |
| **F5.1-F** — Correcciones documentales (§6 schema, §10 fileId/B-1, §26 i18n) | M-4, B-1, B-4, M-5 | ✅ COMPLETADO |

---

## Criterios de aceptación

- [x] TOTP creado en Extension (legacy `claveTotp`) → sync → la PWA genera el código
- [x] Convergencia: tras el primer unlock post-actualización no queda `claveTotp` en storage (Extension)
- [x] Idempotencia: el segundo unlock no re-dispara la escritura de convergencia
- [x] Motor TOTP PWA produce códigos idénticos a la Extension (verificado contra el mismo secreto)
- [x] Sync Drive de la Extension autocorrige tras borrado externo del archivo (no atascado en DRIVE_404)
- [x] Export CSV con campo `=HYPERLINK(...)` no ejecuta fórmula al abrir en hoja de cálculo
- [x] Export Bitwarden incluye el secreto TOTP (canónico + fallback legacy)
- [x] Wizard de import sin strings hardcoded; paridad i18n intra-superficie (264/264/264)
- [x] `bash scripts/verify-crypto-sync.sh` exit 0 (5 secciones, incluye totp + schema + adapters)
- [x] `BLOB_VERSION` permanece en 1 (migración a nivel de schema, no del envelope)

---

## Verificación de regresión

`bash scripts/verify-crypto-sync.sh` → exit 0. Cubre engine, password-health, TOTP,
credential-schema y el contrato de los 4 adapters de sync + ancla del fix 404.

---

## Próximo hito — v0.6.0

Capacitor wrapping (iOS + Android nativo) + biometría + Play Store/App Store, sobre
el bundle PWA ya saneado. Backlog heredado: H-5 (deviceId opaco), H-9 (logging de
sync), evaluación de Capacitor Keychain para el refresh_token de OneDrive (B-1),
decisión de unificación de catálogos i18n (M-4).
