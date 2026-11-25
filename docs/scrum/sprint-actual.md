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
```

---

## Fuera de alcance (explícito)

- H-9 salvo que sobre capacidad; F7-A; DIST-1 (spike después de SW-1).
- Cambios en `engine.js` o en el sync.
