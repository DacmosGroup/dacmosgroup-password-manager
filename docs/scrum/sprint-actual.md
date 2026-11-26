# Sprint 3 — Play internal track + SW sin CDN externo

**Estado:** EN CURSO
**Inicio:** 2026-11-25
**Tope blando:** ~2 semanas de trabajo efectivo

> Sprint 2 cerrado el 2026-11-25: Review + Retro en `sprints/sprint-02.md`.

---

## Sprint Goal

DPM en el internal track de Play y la PWA sin dependencias externas en el service worker.

---

## Items comprometidos

| ID | Item | Talla | Estado |
|---|---|---|---|
| SW-1 | Servir Workbox desde el propio dominio en la PWA | S | ⬜ TODO — gate cerrado 2026-11-25 (§32) |
| AAB-1 | AAB vc 3 / 0.6.1 firmado desde `main` al internal track de Play | S–M | ✅ DONE 2026-11-25 (§32) |
| AAB-1b | `assetlinks.json` con un único fingerprint (`dacmos-pm`) | S | ✅ DONE 2026-11-25 (`1e594c6`) |

Reserva (solo si sobra capacidad): **H-9** — logging de eventos sync.

---

## Definition of Done del sprint

Además del DoD general (`README.md`), y por la Retro del Sprint 2:

- Puerta según riesgo: gate solo en las áreas listadas en `README.md`.
- Item de Android: el primer APK/AAB del item se prueba en el teléfono antes de seguir;
  al cierre, instalación limpia **y** actualización (§31 D1-14/D1-16).

---

## Standup log

```
2026-11-25 — Sprint 2 cerrado (Review + Retro). Project DPM conectado al repo por GitHub + carpeta _KNOWLEDGE\DPM; instrucciones del Project actualizadas (puerta según riesgo). Siguiente: Planning del Sprint 3 (PO). Bloqueos: ninguno.
2026-11-25 — Planning. PO aprueba Goal + SW-1 + AAB-1 (H-9 de reserva). Ambos pasan por el gate: preguntas al arquitecto en chat nuevo del Project — SW-1: vendorizar Workbox (versión fijada + hash documentado) o SW propio mínimo; AAB-1: Play App Signing con clave de subida `dacmos-pm` o clave propia, y efecto en usuarios del APK de GitHub (sin update cruzado) y en `assetlinks.json` / F7-A. Siguiente: brief del arquitecto. Bloqueos: gate.
2026-11-25 — Gate cerrado (arquitecto): AAB-1 opción B (PO) = `dacmos-pm` como clave de firma de la app vía PEPK + clave de subida nueva `dacmos-upload`; assetlinks dentro del sprint; DV-1 al backlog. SW-1: Workbox 7.0.0 vendorizado con SHA256SUMS. Hecho AAB-1: app creada en Play Console (`co.dacmosgroup.dpm`); Google había generado una clave propia al crear la app (SHA-256 `A4:1F:F9:50…E8:92`, install base 0 %), reemplazada por `dacmos-pm` (Provide a copy → PEPK); Play muestra app signing `B9:3E:FD:CB…E3:FC` y upload `7C:1C:DB:5A…AD:94`, coinciden con los keystores locales. `build.gradle` con guard fail-closed (`-Pdpm.signing=upload`, rama `feature/aab-1`, `78ad1a9`). `cap sync` + hash de engine.js igual; AAB vc 3 / 0.6.1 firmado con la clave de subida (keytool -printcert: `7C:1C`), SHA-256 del archivo `549458c6…dd4dd`; publicado en internal testing (1 tester: PO). Prueba en teléfono (A33, Android 16), actualización sobre el APK vc 2 de GitHub sin desinstalar: antes vc 2 / installer packageinstaller / firma b93efdcb; después vc 3 / installer com.android.vending / firma b93efdcb (apksigner sobre base.apk), firstInstallTime sin cambio, bóveda se desbloquea ✅. Instalación limpia desde Play en un segundo teléfono (sin DPM previo), con la cuenta del tester: instala y arranca, bóveda nueva ✅. DoD de Android de AAB-1 cumplida (limpia + actualización). Siguiente: merge a main, assetlinks.json, SW-1. Bloqueos: ninguno.
2026-11-25 — Hecho: AAB-1 docs (`db1c817`, §32). Arquitecto aprueba AAB-1b: solo `B9:3E` (sin subida, sin la clave generada por Google). `assetlinks.json` en `1e594c6`, deploy propio. Verificado en producción: curl -I 200 + application/json; API statements:list → un statement, `B9:3E`; pm get-app-links N/A (sin autoVerify). §32 revisada: no describe ubicación, respaldo ni contraseñas de los keystores. Primera mitad del Sprint Goal cumplida (DPM en internal track). Siguiente: SW-1 según §32. Bloqueos: ninguno. PO: confirmar DV-1 en Play Console esta semana.
2026-11-25 — Cierre de sesión. README (fila Play Store) al día. SW-1 queda para la próxima sesión (decisión del PO). Estado: SW-1 ⬜ (contrato en §32, sin código); Goal a medias (Play ✅, SW sin CDN pendiente). Próxima sesión: SW-1 → deploy propio → si se cumple el Goal, Review + Retro del Sprint 3. Bloqueos: ninguno.
2026-11-26 — SW-1 implementado (`7905e5f`): Workbox 7.0.0 en `web/libs/workbox-v7.0.0/` (npm pack, sha512 = dist.integrity, idéntico al CDN), SHA256SUMS + `sha256sum -c --strict` en deploy-pwa.yml antes del deploy en todas las ramas, CSP sin storage.googleapis.com. Pruebas locales con la CSP de producción (Chrome headless): SW activado, precache 16 entradas, página controlada, navegación offline OK; prueba negativa local (byte alterado → exit 1); clon nuevo en Windows (autocrlf=true) → `sha256sum -c` OK. Gate (arquitecto): aprobados `.gitattributes` (`web/libs/** -text`) y `LICENSE` MIT como añadidos; aprobado `--branch=${{ github.ref_name }}` en deploy-pwa.yml (`b064a6a`: antes un dispatch desde una rama publicaba en producción); prueba de actualización SW viejo → SW-1 en un preview (`preview-sw1`) y prueba negativa en el CI (`ci-negativa-sw1`) antes del merge. P-100: se apaga Automatic protection de Play a nivel de app; método de verificación confirmado (`com.pairip` presente en el base.apk de vc 3 servido por Play, ausente en los builds propios); vc 4 / 0.6.1 desde `main` **sin** SW-1, y luego merge de SW-1. Siguiente: pruebas en preview y CI; PO apaga la protección. Bloqueos: ninguno.
```

---

## Fuera de alcance (explícito)

- H-9 salvo que sobre capacidad; F7-A; DIST-1 (spike después de SW-1).
- Cambios en `engine.js` o en el sync.
