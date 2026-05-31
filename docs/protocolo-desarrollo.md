# Protocolo de Desarrollo — Dacmos Password Manager

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**

> Este documento define el protocolo de trabajo entre Claude (arquitecto revisor)
> y Claude Code (implementador) para el desarrollo del Dacmos Password Manager.

---

## Roles

| Rol | Responsabilidad |
|-----|----------------|
| **Claude en el chat del proyecto** | Arquitecto revisor — lee docs, propone arquitectura, valida resultados, aprueba commits |
| **Claude Code** | Implementador — ejecuta solo lo aprobado, nunca propone arquitectura propia |

---

## Ciclo obligatorio por feature

```
1. Claude lee docs del proyecto (roadmap + doc-técnico)
2. Claude propone arquitectura
3. Usuario aprueba o ajusta
4. Claude redacta brief para Code
5. Code implementa
6. Code reporta resultados al chat
7. Claude valida antes del commit
8. Code hace commit de código
9. Code actualiza documentación (commit separado)
10. Usuario sube docs actualizados al proyecto Claude
```

---

## Brief estándar para Claude Code

Usar esta estructura al inicio de cada sesión de Code:

```
Proyecto: Dacmos Password Manager
Branch: feature/vX.X.X
Feature: FX.X — [nombre]
Sesión anterior completada: FX.X — [nombre]

MODO: PROPUESTA DE ARQUITECTURA PRIMERO
No implementar hasta recibir aprobación explícita.

Leer antes de proponer:
- docs/roadmap-vX.X.X.md → scope de la feature
- docs/documento-tecnico.md → decisiones previas
- docs/decisions/ADR-001-stack-mobile.md → stack mobile
- [archivos de código relevantes]

Al completar la implementación:
1. Ejecutar tests de verificación y reportar resultados
2. Commit de código con mensaje convencional
3. Leer docs/fX.X-decisiones-temp.md si existe
4. Insertar contenido en documento-tecnico.md
5. Eliminar el archivo temporal
6. Marcar feature como ✅ COMPLETADO en el roadmap
7. Commit de documentación separado

Principios no negociables:
- Zero-Knowledge — cifrado siempre en el cliente
- AES-256-GCM + PBKDF2-SHA256 × 600,000 iteraciones
- Sin librerías externas de crypto — solo crypto.subtle
- Código comentado en español

Feature a desarrollar: [ESPECIFICAR]
```

---

## Captura de decisiones de sesión

Antes de pedirle a Code que actualice `documento-tecnico.md`,
generar un archivo temporal con las decisiones del chat:

```
docs/fX.X-decisiones-temp.md
```

Code lo lee, lo inserta en `documento-tecnico.md` en la sección
correspondiente, y lo elimina en el mismo commit de documentación.

**Qué capturar:**
- Opciones descartadas y por qué
- Riesgos identificados y mitigaciones
- Contratos de API / serialización
- Decisiones de diseño con razonamiento

---

## Convención de commits

```
feat(scope):  nueva funcionalidad
fix(scope):   corrección de bug
docs:         solo documentación
refactor:     sin cambio de comportamiento
test:         scripts de verificación temporales
chore:        mantenimiento del repo
```

Commits de código y documentación van **siempre separados**.

---

## Cierre de sesión — checklist

```
[ ] Feature implementada y testeada
[ ] Commit de código en feature/vX.X.X
[ ] docs/fX.X-decisiones-temp.md generado (si hubo decisiones)
[ ] Code insertó decisiones en documento-tecnico.md
[ ] Archivo temporal eliminado
[ ] Roadmap actualizado con ✅
[ ] Commit de documentación separado
[ ] Docs actualizados subidos al proyecto Claude
```
