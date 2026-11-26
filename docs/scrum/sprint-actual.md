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
| SW-1 | Servir Workbox desde el propio dominio en la PWA | S | ⬜ TODO — gate pedido (dependencia/CDN) |
| AAB-1 | AAB vc 3 / 0.6.1 firmado desde `main` al internal track de Play | S–M | ⬜ TODO — gate pedido (distribución y firma) |

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
```

---

## Fuera de alcance (explícito)

- H-9 salvo que sobre capacidad; F7-A; DIST-1 (spike después de SW-1).
- Cambios en `engine.js` o en el sync.
