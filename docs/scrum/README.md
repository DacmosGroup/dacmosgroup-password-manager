# Modelo Scrum-lite — Dacmos Password Manager

**Adoptado:** 2026-09-06 (Sprint 1)
**Ámbito:** gestión de todo el trabajo de DPM a partir de v0.7.0.
**Naturaleza:** Scrum adaptado a un equipo de una persona + asistentes Claude.
No es Scrum de manual: se conservan los artefactos y el ritmo, se recortan las
ceremonias a lo que aporta valor a un solo-founder con disponibilidad irregular.

---

## Roles

| Rol Scrum | Quién | Responsabilidad |
|---|---|---|
| **Product Owner** | Alejandro Seijas | Prioriza el Product Backlog, define el Sprint Goal, acepta el incremento, decide releases |
| **Arquitecto revisor** | Claude en el chat del Project DPM | Diseño de arquitectura y decisiones técnicas. No implementa. Valida propuestas antes de codificar |
| **Equipo de desarrollo** | Claude Code (VS Code) | Implementa exactamente lo aprobado. Ejecuta el Definition of Done. Mantiene docs y backlog al día |

> Mantiene el protocolo existente del proyecto: Claude Code **nunca propone
> arquitectura propia**, solo implementa lo aprobado en el chat del Project.

---

## Artefactos

Todos viven en `docs/scrum/`, versionados en git. No hay herramienta externa.

| Archivo | Qué es | Quién lo mantiene |
|---|---|---|
| `README.md` | Este documento — las reglas del juego | PO (cambios de proceso) |
| `product-backlog.md` | Lista única y ordenada de todo el trabajo pendiente, con prioridad y estimación T-shirt | Code, tras cada Planning y Review |
| `sprint-actual.md` | Sprint en curso: Goal, items comprometidos, DoD, standup log | Code, cada sesión |
| `sprints/sprint-XX.md` | Archivo cerrado de cada sprint (Review + Retro) | Code, al cerrar el sprint |
| `_templates/` | Plantillas de sprint-actual y de cierre | — |

---

## Cadencia — sprints por alcance, no por calendario

La disponibilidad de Alejandro es irregular (semanas sin tocar el proyecto son
normales). Un sprint atado al calendario produciría "sprints fallidos" sin culpa
del equipo. Por eso:

- **Un sprint = un Sprint Goal demostrable.** Termina cuando el Goal se cumple, no
  cuando pasan N días.
- **Tope blando:** ~2 semanas de trabajo efectivo (no de calendario). Si el sprint
  se estira mucho, es señal de que el Goal era demasiado grande → dividir.
- **Un solo sprint activo a la vez.** No se arranca el siguiente sin cerrar el actual
  (Review + Retro escritos).

---

## Ceremonias

### Sprint Planning — al inicio de cada sprint
El PO elige el **Sprint Goal** y 2–4 items del `product-backlog.md`.
Code escribe `sprint-actual.md` desde la plantilla y reordena el backlog.
Si algún item tiene dudas de arquitectura → va primero al chat del Project DPM.

### Standup — al abrir cada sesión de trabajo
Tres líneas al final de `sprint-actual.md`, sección "Standup log":
```
YYYY-MM-DD — Hecho: … | Siguiente: … | Bloqueos: …
```
Sustituye al "¿dónde quedé?" de inicio de sesión.

### Sprint Review — al cumplir el Sprint Goal
- Verificación manual del incremento (el proyecto no tiene test suite automatizada).
- Se registra qué se demostró y qué quedó fuera.
- El PO acepta o rechaza cada item.

### Sprint Retro — inmediatamente después del Review
Una sola pregunta: **¿qué cambiamos para el próximo sprint?** → 1–3 acciones concretas.
Se escribe en `sprints/sprint-XX.md` junto al Review y el sprint se archiva.

---

## Definition of Done

Un item está DONE cuando cumple **todo** lo aplicable (hereda el protocolo del
proyecto en `.claude/CLAUDE.md`):

- [ ] Implementado exactamente lo aprobado — sin adiciones
- [ ] Tests de verificación ejecutados → resultado reportado al chat del Project
- [ ] `verify-crypto-sync.sh` exit 0 si se tocó algún archivo con fork (`src/` ↔ `web/src/`)
- [ ] Commit de **código** con mensaje convencional
- [ ] `docs/documento-tecnico.md` actualizado (header de versión + sección de decisiones si aplica)
- [ ] `docs/fX.X-decisiones-temp.md` consumido e insertado, luego eliminado (nunca se commitea)
- [ ] Roadmap / backlog: item marcado `✅ COMPLETADO fecha`
- [ ] Commit de **documentación** separado del de código
- [ ] Ningún archivo de estado del workspace quedó desactualizado (ver checklist en `.claude/CLAUDE.md`)

---

## Estimación

T-shirt sizing, relativo, sin horas:

| Talla | Significado orientativo |
|---|---|
| **S** | Un cambio acotado, un archivo o dos, sin tocar crypto ni forks. Spike o decisión (ADR). |
| **M** | Varias piezas, puede tocar forks, requiere verificación cruzada de plataformas. |
| **L** | Épica. Código nativo nuevo (Kotlin/Swift), integración con SO, o dependencia externa. Se divide antes de entrar a un sprint. |

Un sprint sano lleva ~1 L dividido en Ms, o 2–3 Ms, o un puñado de Ss.

---

## Bloqueantes externos

Los items que dependen de un tercero (aprobación de Play Store, hardware, cuentas
de pago) **no entran a un sprint como trabajo de dev**. Viven en el backlog con la
etiqueta `[BLOQUEANTE EXTERNO]` y propiedad del PO. El sprint puede tener un item
de "preparar todo para cuando se desbloquee", pero no esperar al desbloqueo.
