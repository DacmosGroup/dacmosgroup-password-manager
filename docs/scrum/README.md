# Modelo Scrum-lite — Dacmos Password Manager

**Adoptado:** 2026-09-06 (Sprint 1) · **Rev. 1:** 2026-09-06 tras validación del arquitecto revisor
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
> arquitectura propia**, solo implementa lo aprobado en el chat del Project
> (o, fuera de las áreas de gate, lo aprobado por el PO — ver "Puerta según riesgo").

---

## Artefactos

Todos viven en `docs/scrum/`, versionados en git. No hay herramienta externa.

| Archivo | Qué es | Quién lo mantiene |
|---|---|---|
| `README.md` | Este documento — las reglas del juego | PO (cambios de proceso) |
| `product-backlog.md` | Lista única y ordenada de todo el trabajo pendiente, con prioridad y estimación T-shirt | Code, transcribiendo el orden que decidió el PO en Planning/Review |
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

### Estado "Sprint pausado" — para las ausencias largas

Si pasan **más de 3 semanas de calendario sin un standup nuevo**, el sprint no
queda en limbo: se **congela explícitamente**. Al detectarlo (normalmente al
retomar), lo primero es escribir en `sprint-actual.md`:

```
PAUSADO YYYY-MM-DD — Motivo: … | Items cerrados: … | Falta: … | Contexto para retomar: …
```

Al volver, el standup de reapertura parte de esa nota — no de reconstruir el
contexto a mano. Si al retomar el Sprint Goal ya no tiene sentido, se cierra el
sprint como "⚠️ parcial" y se replantea en un Planning nuevo.

---

## Ceremonias

### Sprint Planning — al inicio de cada sprint
El PO elige el **Sprint Goal** y 2–4 items del `product-backlog.md`.
Code escribe `sprint-actual.md` desde la plantilla y refleja en el backlog el
orden que el PO decidió (transcribe la decisión, no la toma).
Un item **no entra a Planning** si tiene preguntas de arquitectura abiertas —
se resuelven antes en el chat del Project DPM (ver "Gate de arquitectura" abajo).

### Standup — al abrir cada sesión de trabajo
Tres líneas al final de `sprint-actual.md`, sección "Standup log":
```
YYYY-MM-DD — Hecho: … | Siguiente: … | Bloqueos: …
```
Sustituye al "¿dónde quedé?" de inicio de sesión.

**Opcional en sesiones de mantenimiento puro** (sin cambio de estado del sprint:
housekeeping, consulta, doc menor). Obligatorio en cualquier sesión que toque
items del sprint — y muy especialmente en la primera sesión tras una pausa.

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
- [ ] Docs pusheados y repo sincronizado en el Project DPM de Claude.ai (acción del PO — el arquitecto revisor lee el repo por GitHub; desde 2026-11-25 ya no se suben a mano)
- [ ] Si el item toca UI/interacción: los criterios de aceptación cubren **desktop mouse + mobile touch Android** (+ Safari iOS si aplica) — regla de `protocolo-desarrollo.md`
- [ ] **Si el item toca Android:** se da por terminado solo tras una prueba de humo en un **dispositivo físico**, con checklist registrado en el standup, en los **dos caminos de instalación** (limpia y actualización encima de la versión anterior), verificando en ambos algo que solo trae el build nuevo. Antes del build: `npx cap sync android` + hash de `engine.js` igual en `web/` y en los assets empaquetados (`documento-tecnico.md` §31, D1-14)
- [ ] **Si el item publica en un canal** (Play, GitHub Releases u otro): se saca del dispositivo el APK que **entrega el canal** y se compara con el build propio (firma con `apksigner`, ausencia de código inyectado como `com.pairip`, tamaño del `classes.dex`). Lo que se verifica es lo que recibe el usuario, no lo que se subió (Retro del Sprint 3, `documento-tecnico.md` §32)
- [ ] **Si el item toca la PWA servida** (service worker, `_headers`/CSP, archivos de `web/libs/`): se prueba en un **preview por rama** de Cloudflare Pages antes del merge (`workflow_dispatch` desde la rama, nunca desde `main`), incluida la **actualización** desde la versión en producción cuando cambia el SW (Retro del Sprint 3)

---

## Gate de arquitectura — antes de meter un item a Planning

Un item con preguntas de diseño abiertas **no se compromete a un sprint**. Se
lleva primero al chat del Project DPM y no vuelve al backlog como "listo para
sprint" hasta que el arquitecto revisor cierra:

- Contratos de datos / cambios de schema (tocan `credential-schema.js` + ambos forks)
- Guards de seguridad nuevos (cualquier cosa que sirva o escriba credenciales)
- Integración con APIs del SO (Autofill, Credential Provider, Keystore)
- Cualquier divergencia que Code reporte durante la propuesta de plan

**Puerta según riesgo (desde 2026-11-25, decisión del PO).** El gate es
obligatorio solo para: criptografía, sync, permisos (Android/extensión),
distribución y firma, y dependencias o CDN nuevos. El resto (p. ej. builds,
CSS/UX menores, tooling) lo implementa Code con el OK del PO, lo registra en el
standup log y el arquitecto lo revisa después. Ante la duda, pasa por el gate.

Esto es el ciclo por feature de `protocolo-desarrollo.md` (pasos 1–8) — Scrum no
lo reemplaza, lo envuelve.

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
