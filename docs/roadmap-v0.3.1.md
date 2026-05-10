# 🗺️ Roadmap — Dacmos Password Manager v0.3.1

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**
**Documento generado:** Mayo 2026
**Versión base:** 0.3.0 (en revisión Chrome Web Store)
**Versión objetivo:** 0.3.1

---

## Contexto estratégico

v0.3.1 consolida mejoras de UX y pulido identificadas durante la auditoría
funcional de v0.3.0. No introduce features nuevos — corrige fricciones
detectadas en uso real del producto.

**Estrategia CWS:** v0.3.1 reemplaza a v0.3.0 en la cola de revisión.
Un solo ciclo de revisión cubre ambas versiones.

---

## Principios que NO cambian en v0.3.1

- Zero-Knowledge local-first
- engine.js intacto — sin cambios en el motor de cifrado
- Lógica de sync — sin cambios
- Sin dependencias externas de crypto
- Manifest V3
- Código comentado en español

---

## Features v0.3.1

### F3.1 — Botón "← Inicio" consistente en todas las vistas

**Origen:** L6 — auditoría funcional v0.3.0
**Problema:** Las vistas abiertas en pestaña completa (Vault, Health,
Generator, Settings) no tienen navegación de retorno uniforme. Health
tiene botón "← Vault", el resto depende del botón Atrás del navegador.

**Solución:** Agregar botón `← Inicio` en el header de todas las vistas
de pestaña completa, con comportamiento consistente.

**Archivos afectados:**
- `src/ui/vault/vault.html`
- `src/ui/health/health.html`
- `src/ui/generator/generator.html`
- `src/ui/settings/settings.html`
- CSS correspondiente de cada vista

---

### F3.2 — Autocompletado en GitHub y sitios con diseño especial

**Origen:** L8 — auditoría funcional v0.3.0
**Problema:** El content script no detecta el formulario de login de
GitHub ni otros sitios con diseños no estándar.

**Solución:** Revisar y ampliar las heurísticas de detección en
`autofill.js` para cubrir:
- Formularios donde el campo usuario y password están en pasos separados
- Sitios que usan shadow DOM o componentes custom
- GitHub específicamente

**Archivos afectados:**
- `src/content/autofill.js`

---

### F3.3 — Tamaño de fuente en cards del vault

**Origen:** L9 — auditoría funcional v0.3.0
**Problema:** El código TOTP, timestamps y metadatos secundarios de las
credenciales son difíciles de leer a 100% de zoom del navegador.

**Solución:** Aumentar tamaño de fuente en:
- Badge TOTP (código de 6 dígitos)
- Timestamps de modificación
- Textos secundarios de las cards

**Archivos afectados:**
- `src/ui/vault/vault.css`

---

### F3.4 — Versión dinámica en Settings

**Origen:** Fix detectado durante auditoría — Settings mostraba "0.1.1"
hardcodeado incluso después de bumps de versión.
**Problema:** La versión en la sección "Modelo de Seguridad" de Settings
está hardcodeada en el HTML.

**Solución:** Leer la versión dinámicamente desde `chrome.runtime.getManifest().version`
en `settings.js` e inyectarla en el DOM al cargar.

**Archivos afectados:**
- `src/ui/settings/settings.js`
- `src/ui/settings/settings.html` (eliminar texto hardcodeado)

---

### F3.5 — Fix formularios de dos campos password (Create/Confirm)

**Origen:** L3 — auditoría funcional v0.3.0
**Problema:** En formularios con campo "Create password" y "Confirm
password", el autocompletado llena el segundo campo en lugar del primero.
El usuario no puede copiar fácilmente desde Confirm a Create.

**Solución:** Mejorar la lógica de selección de campo objetivo en
`autofill.js` para priorizar el primer campo de tipo password en el
formulario, no el último.

**Archivos afectados:**
- `src/content/autofill.js`

---

## Lo que NO cambia en v0.3.1

- `engine.js` — intacto
- `src/sync/` — todos los adaptadores sin cambios
- `src/background/service-worker.js` — sin cambios
- Todos los features de v0.3.0 — sin regresión
- `manifest.json` — solo bump de versión a 0.3.1

---

## Criterios de completitud

- [ ] F3.1 — Botón ← Inicio en todas las vistas
- [ ] F3.2 — Autocompletado mejorado (GitHub + formularios especiales)
- [ ] F3.3 — Fuente más grande en cards del vault
- [ ] F3.4 — Versión dinámica en Settings
- [ ] F3.5 — Fix formularios Create/Confirm password
- [ ] Versión bumpeada a 0.3.1 en manifest.json
- [ ] PR mergeado a main con descripción completa
- [ ] ZIP generado y subido al CWS

---

## Learnings documentados — v0.3.0

Estos learnings motivaron v0.3.1 y son contenido educativo para
blog y videos de DacmosGroup:

| # | Learning | Aplicación en contenido |
|---|----------|------------------------|
| L1 | Token OAuth se revoca al cambiar contraseña Google | Tutorial: gestión de tokens OAuth |
| L2 | Passkeys vs contraseñas en gestores PM | Video: ¿Passkeys reemplazan a los gestores? |
| L3 | Autocompletado en formularios Create/Confirm | Guía de usuario actualizada |
| L4 | Claude usa Google SSO — no crear credencial separada | FAQ de la guía de usuario |
| L5 | Contraseña incorrecta guardada afecta autocompletado | Best practices de uso de DPM |
| L6 | Navegación entre vistas no uniforme | Fix en F3.1 |
| L7 | TOTP probado en producción real con GitHub | Tutorial: migrar 2FA a DPM |
| L8 | Autocompletado no funciona en GitHub | Fix en F3.2 |
| L9 | Fuente pequeña en cards a 100% zoom | Fix en F3.3 |

---

## Brief para Claude Code — v0.3.1

```
Proyecto: Dacmos Password Manager
Branch de trabajo: crear rama feature/v0.3.1 desde main
Documentos de referencia: docs/documento-tecnico.md, docs/roadmap-v0.3.1.md

Antes de iniciar cualquier desarrollo:
1. Lee docs/documento-tecnico.md completo
2. Lee docs/roadmap-v0.3.1.md completo
3. Confirma qué ítem vamos a desarrollar en esta sesión
4. Propón la arquitectura antes de escribir código
5. Espera mi aprobación antes de proceder

Ítem a desarrollar en esta sesión: [ESPECIFICAR]
```

---

## Roadmap completo actualizado

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 🔄  Mejoras UX y pulido
v0.4.0 ⏳  App móvil React Native (iOS + Android)
v0.5.0 ⏳  Tier Premium $1-1.50/mes + Plan Familias
v1.0.0 ⏳  Auditoría Cure53 + listado público CWS
```

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
