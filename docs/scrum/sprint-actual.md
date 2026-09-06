# Sprint 1 — Arranque Scrum + repo limpio

**Estado:** EN CURSO
**Inicio:** 2026-09-06
**Tope blando:** ~2 semanas de trabajo efectivo

---

## Sprint Goal

Infraestructura Scrum operativa y repositorio en estado limpio, listo para
arrancar sprints de features sobre v0.7.0.

---

## Items comprometidos

| ID | Item | Talla | Estado |
|---|---|---|---|
| S-1 | Infra Scrum: `docs/scrum/` con README (modelo), product-backlog, sprint-actual, plantillas | S | ✅ DONE |
| S-2 | Consolidar el backlog desde roadmap-v0.7.0 + backlog diferido v0.6.0 + canales de distribución | S | ✅ DONE |
| S-3 | Housekeeping repo: commit de docs pendientes (CLAUDE.md + README.md), resolver 2 screenshots sin trackear, borrar ramas locales mergeadas | S | ✅ DONE |
| S-4 | Sync estado del workspace: `memory/project-products.md` (+ nueva memoria `project-dpm-scrum`), `DACMOSGROUP_MASTER_CONTEXT.md`, tabla L1 de `C:\DacmosGroup\CLAUDE.md` | S | ✅ DONE |

---

## Definition of Done del sprint

- `docs/scrum/` creado, poblado y coherente
- `product-backlog.md` ordenado, con PS-1 marcado como bloqueante externo
- `git status` limpio (working tree sin cambios sueltos ni untracked no resueltos)
- 12 ramas locales ya mergeadas a `main` eliminadas
- Docs de estado del workspace reflejan "DPM retomado 2026-09-06, Sprint 1"
- Commits de código/housekeeping y de documentación separados
- `docs/scrum/README.md` enviado al chat del Project DPM para visto bueno del arquitecto (acción del PO)

---

## Standup log

```
2026-09-06 — Hecho: S-1 y S-2 completos (docs/scrum/ creado, backlog consolidado). | Siguiente: S-3 housekeeping + S-4 sync de docs de estado. | Bloqueos: ninguno. PS-1 sigue rechazada (async, no bloquea SP1).
2026-09-06 — Hecho: S-3 (13 ramas mergeadas borradas, screenshots sueltos limpiados, docs v0.5.1/v0.6.0 commiteadas) + S-4 (memoria + master context + L1 actualizados). Los 4 items DONE. | Siguiente: Sprint Review + Retro → cerrar SP1. PO: revisar commits antes de push + pegar README.md al chat Project DPM. | Bloqueos: ninguno.
```

---

## Fuera de alcance (explícito)

- Nada de código de producto. Ni H-5, ni H-9, ni F7-A.
- No se toca `src/`, `web/src/`, `android/`, `manifest.json`.
- No se hace `git push` — los commits quedan en `main` local para revisión del PO.
- PS-1 (verificación Play Store) es acción del PO fuera del sprint.

---

## Sprint 2 — candidatos (decidir en Planning)

Recomendación del equipo: **H-5 + H-9** (hardening desbloqueado, recupera disciplina
de crypto tras la pausa, entrega robustez + diagnóstico real). Alternativa fuerte:
**D-1** si la prioridad es que Android llegue a usuarios ya, sin esperar Play Store.
