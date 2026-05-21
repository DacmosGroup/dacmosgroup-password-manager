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
