# CLAUDE.md — Dacmos Password Manager

## Rol de Claude Code en este proyecto

Claude Code = Implementador (equipo de desarrollo en el modelo Scrum).
Claude en el chat del proyecto = Arquitecto revisor.
Alejandro = Product Owner.

**Nunca proponer arquitectura propia.**
**Solo implementar lo aprobado en el chat del proyecto.**

---

## Gestión del proyecto — Scrum-lite

Desde 2026-09-06 el trabajo se gestiona con el modelo definido en
**`docs/scrum/README.md`** (leerlo entero antes de operar). Resumen:

- El pendiente vive en `docs/scrum/product-backlog.md` (lista única ordenada,
  reemplaza los `roadmap-vX.X.md` sueltos como fuente de prioridad).
- El sprint en curso vive en `docs/scrum/sprint-actual.md`.
- Al abrir sesión: leer `sprint-actual.md` (standup log + items) y escribir una
  línea nueva de standup. Opcional solo en mantenimiento puro sin cambio de estado.
- Un item con dudas de arquitectura no entra a Planning — pasa antes por el chat
  del Project DPM ("gate de arquitectura" en el README).
- Bloqueantes externos (Play Store, hardware) no son trabajo de sprint.

---

## Protocolo obligatorio por feature

1. Leer los documentos de referencia antes de escribir código
2. Si hay dudas de arquitectura → reportar al chat, no asumir
3. Implementar exactamente lo aprobado — sin adiciones
4. Al terminar cada feature, en este orden:
   a. Tests de verificación → reportar resultados al chat
   b. `verify-crypto-sync.sh` exit 0 si se tocó algún fork (`src/` ↔ `web/src/`)
   c. Commit de código con mensaje convencional
   d. Leer docs/fX.X-decisiones-temp.md si existe
   e. Insertar su contenido en documento-tecnico.md
   f. Eliminar el archivo temporal
   g. Marcar el item como ✅ DONE en `docs/scrum/sprint-actual.md` y en `product-backlog.md`
   h. Commit de documentación separado del de código
5. Al cumplir el Sprint Goal: escribir `docs/scrum/sprints/sprint-XX.md`
   (Review + Retro) y resetear `sprint-actual.md` — ver README §Ceremonias
6. Nunca cerrar sesión con documentación desactualizada

---

## Documentos de referencia — leer en este orden

1. docs/scrum/README.md (modelo de gestión)
2. docs/scrum/sprint-actual.md + docs/scrum/product-backlog.md (qué toca ahora)
3. docs/decisions/ADR-001-stack-mobile.md
4. docs/documento-tecnico.md
5. docs/protocolo-desarrollo.md (ciclo arquitecto ↔ Code, cobertura de UI)

---

## Principios no negociables

- Zero-Knowledge — cifrado siempre en el cliente
- AES-256-GCM + PBKDF2-SHA256 × 600,000 iteraciones
- Sin librerías externas de crypto — solo crypto.subtle nativa
- Código comentado en español
- Terminología técnica en inglés cuando es estándar de la industria

---

## Estructura del repo

```
src/            ← Chrome Extension (MV3)
web/            ← PWA Mobile (v0.4.0+)
docs/           ← Documentación técnica y roadmaps
docs/scrum/     ← Modelo de gestión, backlog, sprint activo, sprints cerrados
docs/decisions/ ← ADRs (Architecture Decision Records)
tests/          ← Scripts de verificación temporales (se eliminan post-uso)
```

---

## Convención de commits

```
feat(scope):  nueva funcionalidad
fix(scope):   corrección de bug
docs:         solo documentación
refactor:     sin cambio de comportamiento
test:         scripts de verificación temporales
chore:        tareas de mantenimiento del repo
```

Los commits de código y documentación van **siempre separados**.

---

## Formato del archivo temporal de decisiones

Cuando el chat del proyecto genera decisiones durante una sesión,
crea el archivo:

```
docs/fX.X-decisiones-temp.md
```

Code lo lee, inserta el contenido en la sección correspondiente
de docs/documento-tecnico.md, y elimina el temporal en el mismo
commit de documentación.

Nunca commitear el archivo temporal — debe eliminarse antes del commit.

---

## Protocolo de desarrollo — aislamiento de sync

**Nunca ejecutar operaciones de sync desde la extensión load-unpacked
(desarrollo) contra el Drive o OneDrive de producción.**

La extensión load-unpacked y la extensión CWS comparten el mismo
`appDataFolder` en Google Drive del perfil Chrome activo. Una operación
de sync desde la extensión de desarrollo puede sobrescribir el vault
real de producción — fue la causa del incidente de la sesión 31 mayo 2026.

**Regla:** Usar un perfil Chrome separado o cuenta de prueba para
sesiones de desarrollo que involucren sync con Drive u OneDrive.

---

## Checklist de documentación — pre-commit y pre-cierre de sesión

Ejecutar en orden al final de cada sesión con cambios, antes de push.

### 1. Archivos del repo — verificar antes del commit `docs:`

- [ ] `manifest.json` (root) — `"version"` coincide con el tag del release
- [ ] `web/manifest.json` — `"version"` coincide con el tag del release
- [ ] `README.md` — badges, sección Funciones Principales, roadmap, estado CWS
- [ ] `CLAUDE.md` (root) — Versioning Strategy, próximo hito
- [ ] `docs/scrum/sprint-actual.md` — items al día (⬜/🔄/✅), standup log de la sesión
- [ ] `docs/scrum/product-backlog.md` — item marcado ✅ / reordenado si el PO lo decidió; entrada en "Historial de refinamiento"
- [ ] `docs/scrum/sprints/sprint-XX.md` — creado si se cerró el sprint (Review + Retro)
- [ ] `docs/documento-tecnico.md` — header versión, sección de decisiones nueva
- [ ] `docs/fX.X-decisiones-temp.md` — consumir e insertar en documento-tecnico.md, luego **eliminar** (nunca commitear el temporal)
- [ ] `docs/decisions/ADR-*.md` — crear si hubo nueva decisión arquitectural aprobada

### 2. Archivos fuera del repo — actualizar en la misma sesión

- [ ] `C:\DacmosGroup\CLAUDE.md` (L1) — tabla "Estado de productos activos"
- [ ] `_KNOWLEDGE/DACMOSGROUP_MASTER_CONTEXT.md` — snapshot versiones + entrada en historial
- [ ] `memory/project-products.md` — versiones y estado actual del producto
- [ ] `memory/project-dpm-scrum.md` — estado del sprint activo + próximo

### 3. Claude AI — Project DPM (desde 2026-11-25: repo conectado por GitHub)

El Project DPM lee el repo por la integración de GitHub (Contexto) y la carpeta
local `_KNOWLEDGE\DPM`. **Ya no se suben docs del repo a mano.** Al cerrar:

1. Push de lo commiteado (repo público: leer el diff antes).
2. El PO pulsa **sincronizar** el repo en Contexto del Project (la copia no se
   actualiza sola). Lo no pusheado no lo ve el arquitecto: los briefs
   `*-decisiones-temp.md` y los resultados de prueba se siguen pegando en el chat.
3. Si se crea un doc nuevo que el arquitecto debe leer (p. ej. `sprints/sprint-XX.md`),
   confirmar que entra en la selección de archivos de GitHub del Project.

Solo queda subido a mano lo que no vive en el repo: `_KNOWLEDGE/content/audiencia-target.md`.
No duplicar en Contexto archivos que ya trae GitHub (dos versiones = una atrasada).

El contexto maestro (`_KNOWLEDGE/DACMOSGROUP_MASTER_CONTEXT.md`) ya no se sube al Project:
si cambió, `dg master` y subir el skill `dacmos-master-context` una vez (desde 2026-11-17).
Registrar la fecha de subida en la tabla "Sincronización con Claude.ai Projects" de ese archivo.
