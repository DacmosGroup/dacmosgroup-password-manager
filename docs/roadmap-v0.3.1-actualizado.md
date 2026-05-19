# 🗺️ Roadmap — Dacmos Password Manager v0.3.1

**DacmosGroup.co — Datos · Nube · Movilidad · Seguridad**
**Documento generado:** Mayo 2026
**Versión base:** 0.3.0 (aprobada en Chrome Web Store)
**Versión objetivo:** 0.3.1 ✅ COMPLETADA — Mayo 2026

---

## Estado final

Todos los features de v0.3.1 completados y mergeados a `main`.
Rama `feature/v0.3.1` mergeada el 18 de mayo de 2026.
Enviado a revisión en Chrome Web Store el 18 de mayo de 2026.

---

## Contexto estratégico

v0.3.1 consolida mejoras de UX y pulido identificadas durante la auditoría
funcional de v0.3.0. No introduce features nuevos — corrige fricciones
detectadas en uso real del producto.

**Estrategia CWS:** v0.3.1 reemplazó a v0.3.0 en la cola de revisión.
Un solo ciclo de revisión cubrió ambas versiones.

---

## Principios que NO cambiaron en v0.3.1

- Zero-Knowledge local-first
- engine.js intacto — sin cambios en el motor de cifrado
- Lógica de sync — sin cambios
- Sin dependencias externas de crypto
- Manifest V3
- Código comentado en español

---

## Features v0.3.1

### F3.1 — Botón "← Inicio" consistente en todas las vistas ✅

**Origen:** L6 — auditoría funcional v0.3.0
**Problema:** Las vistas abiertas en pestaña completa (Vault, Health,
Generator, Settings) no tenían navegación de retorno uniforme. Health
tenía botón "← Vault", el resto dependía del botón Atrás del navegador.

**Solución implementada:** Botón `← Inicio` agregado en el header de
las 4 vistas. Comportamiento: `window.close()` — cierra la pestaña y
devuelve el foco al contexto anterior.

**Decisión técnica destacada:** `health.js` usaba `window.location.href`
(navegación interna). Migrado a `window.close()` para comportamiento
consistente con las demás vistas.

**Archivos modificados:**
- `src/ui/vault/vault.html` + `vault.css` + `vault.js`
- `src/ui/health/health.html` + `health.js`
- `src/ui/generator/generator.html` + `generator.css` + `generator.js`
- `src/ui/settings/settings.html` + `settings.css` + `settings.js`

---

### F3.2 — Autocompletado en GitHub ✅ (no-issue)

**Origen:** L8 — auditoría funcional v0.3.0
**Diagnóstico real:** El síntoma "autocompletado no funciona en GitHub"
fue un falso positivo. El autolock configurado a 1 minuto bloqueaba el
vault durante la navegación entre tabs. Con el vault desbloqueado, el
autocompletado en GitHub funciona correctamente, incluyendo el flujo
completo con TOTP.

**Learning adicional documentado:** El mensaje "No hay credenciales
guardadas para este formulario" aparece tanto cuando el vault está
bloqueado como cuando no hay credenciales — ambiguedad que puede
confundir al usuario.

**Archivos modificados:** Ninguno.

---

### F3.3 — Tamaño de fuente en cards del vault ✅

**Origen:** L9 — auditoría funcional v0.3.0

**Cambios aplicados en vault.css:**

| Selector | Antes | Después |
|----------|-------|---------|
| `.totp-codigo` | 14px | 16px |
| `.totp-timer` | 11px | 12px |
| `.totp-etiqueta` | 9px | 10px |
| `.credential-date` | 11px · opacity 0.7 | 12px · opacity 0.85 |
| `.credential-user` | 12px | 13px |

**Decisión de diseño:** `opacity: 0.7` → `opacity: 0.85` en lugar de
eliminarla — mantiene la jerarquía visual (fecha es info secundaria)
pero mejora el contraste sin romper la diferenciación.

**Archivos modificados:** `src/ui/vault/vault.css`

---

### F3.4 — Versión dinámica en Settings ✅

**Origen:** Fix detectado durante auditoría — Settings mostraba "0.1.1"
hardcodeado incluso después de bumps de versión.

**Solución implementada:**
- `settings.html`: `<span id="versionActual"></span>` (vacío)
- `settings.js`: en `inicializar()` → `chrome.runtime.getManifest().version`
  inyectado en el DOM al cargar

**Archivos modificados:**
- `src/ui/settings/settings.js`
- `src/ui/settings/settings.html`

---

### F3.5 — Fix formularios de dos campos password (Create/Confirm) ✅

**Origen:** L3 — auditoría funcional v0.3.0

**Bug raíz:** El loop `forEach` iteraba todos los campos password del
formulario. El `return` dentro de `forEach` actúa como `continue`, no
como `break` — el último campo password (Confirm) sobreescribía al
primero (Create) en `camposDetectados.password`.

**Fix aplicado:** `forEach` → `for...of` + `break` al encontrar el
primer campo password válido.

```javascript
// ANTES — forEach itera todo, el último campo gana
camposPassword.forEach(campoPass => { ... camposDetectados.password = campoPass })

// DESPUÉS — for...of con break, el primer campo válido gana
for (const campoPass of camposPassword) {
  ...
  camposDetectados.password = campoPass
  break
}
```

**Archivos modificados:** `src/content/autofill.js`

---

## Criterios de completitud — TODOS CUMPLIDOS ✅

- [x] F3.1 — Botón ← Inicio en todas las vistas
- [x] F3.2 — Investigado: no-issue (falso positivo de autolock)
- [x] F3.3 — Fuente más grande en cards del vault
- [x] F3.4 — Versión dinámica en Settings
- [x] F3.5 — Fix formularios Create/Confirm password
- [x] Versión bumpeada a 0.3.1 en manifest.json
- [x] PR mergeado a main con descripción completa
- [x] ZIP generado y subido al CWS

---

## Learnings documentados — v0.3.1

| # | Learning | Aplicación en contenido |
|---|----------|------------------------|
| L1 | Token OAuth se revoca al cambiar contraseña Google | Tutorial: gestión de tokens OAuth |
| L2 | Passkeys vs contraseñas en gestores PM | Video: ¿Passkeys reemplazan a los gestores? |
| L3 | Autocompletado en formularios Create/Confirm — `forEach` vs `for...of` + `break` | Guía de usuario + video sobre bugs sutiles en JS |
| L4 | Claude usa Google SSO — no crear credencial separada | FAQ de la guía de usuario |
| L5 | Contraseña incorrecta guardada afecta autocompletado | Best practices de uso de DPM |
| L6 | Navegación entre vistas no uniforme | Fix en F3.1 |
| L7 | TOTP probado en producción real con GitHub | Tutorial: migrar 2FA a DPM |
| L8 | "No funciona en GitHub" era falso positivo — causa: autolock en 1 min | Video: debugging de extensiones Chrome |
| L9 | Fuente pequeña en cards a 100% zoom | Fix en F3.3 |

---

## Roadmap completo actualizado

```
v0.1.1 ✅  MVP — Chrome Extension Zero-Knowledge
v0.2.0 ✅  Paridad competitiva (F1.1-F1.6)
v0.3.0 ✅  Sync BYOC — Google Drive + OneDrive
v0.3.1 ✅  UX Polish — navegación, legibilidad, fixes autofill
v0.4.0 ⏳  App móvil React Native (iOS + Android)
v0.5.0 ⏳  Tier Premium $1-1.50/mes + Plan Familias
v1.0.0 ⏳  Auditoría Cure53 + listado público CWS
```

---

> **DacmosGroup.co** — Tecnología compleja, explicada de forma simple.
>
> *Datos · Nube · Movilidad · Seguridad*
