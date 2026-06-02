# Protocolo de Desarrollo — Dacmos Password Manager

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**

> Este documento define el protocolo de trabajo entre Claude (arquitecto revisor)
> y Claude Code (implementador) para el desarrollo del Dacmos Password Manager.

---

## Roles

| Rol | Responsabilidad |
|-----|----------------|
| **Claude en el chat del proyecto** | Arquitecto revisor — lee docs, declara restricciones y principios, valida propuestas de Code, aprueba commits. Nunca implementa ni dicta soluciones. |
| **Claude Code** | Implementador — lee docs, propone arquitectura y soluciones técnicas, ejecuta solo lo aprobado, reporta divergencias antes de implementar. |

> **Nota importante sobre roles:** Code SÍ propone arquitectura y soluciones.
> Lo que no hace es tomar decisiones de diseño de forma unilateral ni avanzar
> cuando hay ambigüedad. El arquitecto aprueba, rechaza o redirige — nunca
> resuelve por Code lo que Code puede y debe resolver solo.

---

## Ciclo obligatorio por feature

```
1. Claude lee docs del proyecto (roadmap + doc-técnico)
2. Claude propone arquitectura (qué + por qué)
3. Usuario aprueba o ajusta
4. Claude redacta brief para Code
5. Code lee docs, propone plan detallado y reporta divergencias
6. Claude valida el plan — responde con restricciones, NO con soluciones
7. Se itera hasta que el plan sea correcto
8. Claude autoriza implementación explícitamente
9. Code implementa y reporta resultados
10. Claude valida antes del commit
11. Code hace commit de código
12. Code actualiza documentación (commit separado)
13. Usuario sube docs actualizados al proyecto Claude
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

---

## Manejo de divergencias — regla crítica

Cuando Code reporta una divergencia durante la propuesta de arquitectura,
el arquitecto **NO responde con la solución**. Responde con la restricción
o principio que la solución debe satisfacer, y le pide a Code que proponga
cómo satisfacerlo.

**Flujo correcto ante una divergencia:**

```
Code: "En el service worker no tengo acceso a la clave AES —
       ¿cómo implemento la verificación antes de persistir?"

INCORRECTO — arquitecto da la solución:
  "Compara sal_remoto vs sal_local. Si son distintas y hay sesión
   activa, no persistir. Si no hay sesión, escribir todo e
   invalidar sesión."

CORRECTO — arquitecto declara la restricción:
  "La integridad del vault local debe estar garantizada incluso
   cuando el service worker no tiene acceso a la clave AES.
   La solución no puede violar Zero-Knowledge. Propón cómo
   satisfacer esa restricción."
```

**Por qué importa:** si el arquitecto resuelve las divergencias por Code,
Code aprende a esperar soluciones en lugar de desarrollar criterio propio.
Además, Code tiene acceso directo al código real — su propuesta parte de
evidencia concreta, la del arquitecto parte de documentación.

**La iteración es el proceso.** Si la propuesta de Code no satisface la
restricción, el arquitecto señala exactamente qué principio se viola y
por qué — no cómo arreglarlo. Se itera hasta convergencia.

**Excepción válida:** cuando la divergencia involucra un contrato de
serialización o formato de datos ya especificado en `documento-tecnico.md`,
el arquitecto puede señalar que el formato es incorrecto y referir a la
sección exacta del doc-técnico como fuente de verdad. Eso es declarar
una restricción, no dar una solución.

---

## Captura de decisiones de sesión

Antes de pedirle a Code que actualice `documento-tecnico.md`,
generar un archivo temporal con las decisiones del chat:

```
docs/fX.X-decisiones-temp.md
```

Code lo lee, lo inserta en `documento-tecnico.md` en la sección
correspondiente, y lo elimina en el mismo commit de documentación.

**El archivo temporal debe quedar UNTRACKED (`U`) hasta que Code lo consuma.**
No hacer `git add` de archivos temporales — su destino es el interior de
`documento-tecnico.md`, no el historial de commits.

**Qué capturar:**
- Opciones descartadas y por qué
- Riesgos identificados y mitigaciones
- Contratos de API / serialización
- Decisiones de diseño con razonamiento
- Reglas de proceso aprobadas en la sesión

---

## Auditorías — consolidar, no re-auditar desde cero

Cuando se lanza una auditoría de diagnóstico, Code construye sobre
los hallazgos previos documentados — no redescubre lo ya conocido.

**Flujo correcto:**
1. Code lee el archivo de hallazgos previos (ej. `auditoria-Xh-decisiones-temp.md`)
2. Para cada hallazgo existente: verifica estado actual contra el código vivo
3. Identifica hallazgos nuevos no cubiertos
4. Entrega tabla unificada con estado de cada hallazgo + evidencia

Lanzar una auditoría nueva sin este punto de partida es desgaste —
redescubrir lo ya documentado consume tokens y tiempo sin producir
valor nuevo.

---

## Regla de proceso — aislamiento de entornos en desarrollo

**La extensión load-unpacked (desarrollo) y la extensión CWS comparten
el mismo `appDataFolder` en Google Drive del perfil Chrome activo.**

Una operación de sync desde la extensión de desarrollo puede sobrescribir
el vault real de producción del usuario.

**Regla:** Nunca ejecutar operaciones de sync desde la extensión
load-unpacked contra el Drive o OneDrive de producción. Usar perfil
Chrome separado o cuenta de prueba para sesiones de desarrollo que
involucren sync.

Esta regla se aplica también a cualquier cliente PWA corriendo en
`localhost` si comparte las credenciales OAuth del usuario real.

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

## Verificación funcional — cobertura obligatoria

### Regla: todos los estados del componente en todos los contextos

Los criterios de aceptación de cada brief deben cubrir **todos los estados
del componente** y **todos los contextos de interacción** antes de que Code
proponga arquitectura.

**Contextos obligatorios para cualquier fix de UI/interacción:**

| Contexto | Herramienta | Cuándo aplica |
|----------|-------------|---------------|
| Desktop mouse | Playwright Chromium estándar (sin touch) | Siempre |
| Mobile touch Android | Playwright Pixel 5 (`hasTouch: true`) | Siempre |
| Safari iOS real | Dispositivo físico o BrowserStack | v0.5.0+ |

Un criterio de aceptación que no especifique ambos contextos (desktop mouse +
mobile touch) está **incompleto** y no puede aprobarse.

**Ejemplo — fix de interacción en card:**

❌ Incompleto:
> "Tap sobre card navega a credential-form"

✅ Completo:
> - Desktop mouse: click en card neutral → navega
> - Desktop mouse: swipe con mouse → revela botones
> - Desktop mouse: click en Editar (card swiped) → navega
> - Desktop mouse: click en Eliminar (card swiped) → confirma/elimina
> - Mobile touch: tap en card neutral → navega
> - Mobile touch: swipe → revela botones
> - Mobile touch: tap en Editar → navega
> - Mobile touch: tap en Eliminar → confirma/elimina

### Regla: gap en propuesta de Code → corregir el brief, no parchear

Si el arquitecto detecta un gap en la propuesta de Code que debió estar
cubierto por los criterios originales del brief, **el error es del brief**.

Acción correcta:
1. Objetar la propuesta señalando el escenario no cubierto
2. Devolver a Code para que reevalúe con el escenario completo
3. Code trae propuesta actualizada

Acción incorrecta:
- El arquitecto refina/completa la propuesta de Code
- El arquitecto propone la solución al gap

### Regla: diferencia Android vs iOS en pruebas

- `Playwright Pixel 5` con `hasTouch: true` cubre **Chrome Android** con alta
  fidelidad (motor Blink, Pointer Events completo).
- **No** emula Safari iOS real (WebKit). Playwright webkit en Windows no es
  Safari iOS real.
- Safari iOS real se incorpora como criterio obligatorio en v0.5.0 cuando haya
  inversión en Apple Developer.

### Origen de estas reglas

Aprendizaje directo de la sesión de verificación funcional v0.4.2 (2 junio
2026): el fix `touch-action: pan-y` (commit `c868330`) fue verificado solo en
Playwright iPhone 14 touch. El path desktop mouse falló porque
`setPointerCapture` redirige `click` al elemento capturante en Chromium —
comportamiento no reproducido por `touchscreen.tap()` de Playwright. El gap
no se detectó porque los criterios del brief no especificaban desktop mouse
explícitamente.

---

## Cierre de sesión — checklist

```
[ ] Feature/fix implementada y testeada
[ ] Criterios de aceptación verificados y reportados
[ ] Commit de código en la rama correspondiente
[ ] docs/fX.X-decisiones-temp.md generado (si hubo decisiones)
[ ] Code insertó decisiones en documento-tecnico.md
[ ] Archivo(s) temporal(es) eliminado(s)
[ ] Roadmap actualizado con ✅
[ ] Commit de documentación separado
[ ] Docs actualizados subidos al proyecto Claude
```
