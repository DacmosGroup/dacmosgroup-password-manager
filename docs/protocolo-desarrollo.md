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

---

## Separación de responsabilidades en los briefs de implementación

### Quién decide qué

| Rol | Responsabilidad |
|-----|----------------|
| **Este chat (arquitecto revisor)** | **QUÉ** se construye, **POR QUÉ** se toma cada decisión, qué principios no pueden violarse |
| **Claude Code (implementador)** | **CÓMO** implementarlo, con qué herramientas y en qué orden, cómo manejar errores y casos inesperados |

### Regla práctica para los briefs

Un brief bien escrito describe **objetivos y restricciones**, no procedimientos.

**Señales de que el arquitecto se está pasando de su rol:**

- El brief contiene comandos exactos para ejecutar
- El brief especifica el contenido literal de archivos
- El brief incluye secuencias paso a paso detalladas con orden fijo
- El brief anticipa errores específicos y prescribe cómo resolverlos

Cuando el brief llega a ese nivel de detalle, está tomando decisiones que
le corresponden al implementador: decisiones que dependen del estado real
del entorno, de las herramientas disponibles y de lo que ocurre durante
la ejecución.

**La consecuencia práctica:** un brief demasiado prescriptivo reduce la
capacidad del implementador para adaptarse. Si el entorno no coincide
exactamente con lo que el brief supone (versión de Node.js, herramienta
no instalada, API que cambió), el implementador queda bloqueado porque
el brief le dijo "haz exactamente esto" en lugar de "logra esto".

### Lo que sí pertenece al brief

- El objetivo final verificable ("el APK debe instalarse en Android sin Play Store")
- Las restricciones no negociables ("el keystore no puede ir en el repo")
- Las decisiones de diseño con su razonamiento ("package name: co.dacmosgroup.dpm porque es inmutable y dpm es la abreviatura canónica")
- Los criterios de completitud ("APK firmado, TWA sin barra de URL visible")

### Lo que no pertenece al brief

- La secuencia exacta de comandos para generar el keystore
- El contenido JSON de un archivo de configuración
- Los flags específicos de una herramienta CLI
- El orden en que se resuelven los errores de compilación
