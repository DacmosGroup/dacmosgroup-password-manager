# CLAUDE.md — Dacmos Password Manager

## Rol de Claude Code en este proyecto

Claude Code = Implementador.
Claude en el chat del proyecto = Arquitecto revisor.

**Nunca proponer arquitectura propia.**
**Solo implementar lo aprobado en el chat del proyecto.**

---

## Protocolo obligatorio por feature

1. Leer los documentos de referencia antes de escribir código
2. Si hay dudas de arquitectura → reportar al chat, no asumir
3. Implementar exactamente lo aprobado — sin adiciones
4. Al terminar cada feature, en este orden:
   a. Tests de verificación → reportar resultados al chat
   b. Commit de código con mensaje convencional
   c. Leer docs/fX.X-decisiones-temp.md si existe
   d. Insertar su contenido en documento-tecnico.md
   e. Eliminar el archivo temporal
   f. Actualizar roadmap: marcar feature como ✅ COMPLETADO
   g. Commit de documentación separado del de código
5. Nunca cerrar sesión con documentación desactualizada

---

## Documentos de referencia — leer en este orden

1. docs/decisions/ADR-001-stack-mobile.md
2. docs/roadmap-v0.4.0.md (versión activa)
3. docs/documento-tecnico.md

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
- [ ] `docs/roadmap-vX.X.md` activo — criterios `[x]`, estado `✅ COMPLETADO fecha`
- [ ] `docs/documento-tecnico.md` — header versión, sección de decisiones nueva
- [ ] `docs/fX.X-decisiones-temp.md` — consumir e insertar en documento-tecnico.md, luego **eliminar** (nunca commitear el temporal)
- [ ] `docs/decisions/ADR-*.md` — crear si hubo nueva decisión arquitectural aprobada

### 2. Archivos fuera del repo — actualizar en la misma sesión

- [ ] `C:\DacmosGroup\CLAUDE.md` (L1) — tabla "Estado de productos activos"
- [ ] `_KNOWLEDGE/DACMOSGROUP_MASTER_CONTEXT.md` — snapshot versiones + entrada en historial
- [ ] `memory/project-products.md` — versiones y estado actual del producto

### 3. Claude AI — subida manual al Project DPM

Subir los archivos que fueron modificados en esta sesión:

| Archivo | Destino |
|---|---|
| `_KNOWLEDGE/DACMOSGROUP_MASTER_CONTEXT.md` | Project **DPM** + Project **General** |
| `docs/documento-tecnico.md` | Project **DPM** |
| `docs/roadmap-vX.X.md` activo | Project **DPM** |
| `CLAUDE.md` (root del repo) | Project **DPM** |
| `README.md` | Project **DPM** |

Registrar la fecha de subida en la tabla "Sincronización con Claude.ai Projects"
de `DACMOSGROUP_MASTER_CONTEXT.md`.
