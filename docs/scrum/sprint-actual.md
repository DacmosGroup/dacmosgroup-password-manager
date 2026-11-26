# Sin sprint activo — Planning del Sprint 4 pendiente

**Estado:** ENTRE SPRINTS
**Último sprint:** Sprint 3, cerrado el 2026-11-26 (Review + Retro en `sprints/sprint-03.md`)

> El PO elige el Sprint Goal y 2–4 items del `product-backlog.md` (README §Ceremonias).
> Candidatos: **PS-2** (pruebas cerradas en Play con vc 4), **H-9** (logging de eventos sync), **DV-1**
> (claves ajenas del registro de developer verification). Si un item toca criptografía, sync, permisos,
> distribución o firma, pasa antes por el gate de arquitectura.

---

## Sprint Goal

_(por definir en el Planning)_

---

## Items comprometidos

| ID | Item | Talla | Estado |
|---|---|---|---|

---

## Definition of Done del sprint

DoD general del `README.md`, que desde la Retro del Sprint 3 incluye: verificar el APK que **entrega** cada
canal y probar la PWA servida en un **preview por rama** antes del merge.

---

## Standup log

```
2026-11-26 — Sprint 3 cerrado. Siguiente: Planning del Sprint 4 (PO). Bloqueos: ninguno.
2026-11-26 — Mantenimiento entre sprints (arquitecto): T-2 ampliado a `text=auto eol=lf` para `web/**` y `src/**` (`dfeb909`; renormalize sin cambios, binarios intactos, 0 archivos con CRLF). SC-1: datos del gate reunidos y enviados al arquitecto (reproducción, carga, opciones del paquete, advisories, inventario de terceros); sin reemplazo hasta cerrar el gate. Siguiente: Planning del Sprint 4 (PO; el arquitecto propone SC-1 primero). Bloqueos: gate de SC-1.
2026-11-26 — SC-1 ✅ (gate cerrado: opción B). Receta fijada en `tools/vendor/msal/` (msal-browser 3.30.0, msal-common 14.16.1, esbuild 0.27.2: mismo archivo que 0.28.0 y fuera de GHSA-g7r4-m6w7-qqqr; `npm audit` 0); `verify-vendored.yml` + `sha256sum -c` de `web/libs/SHA256SUMS` en el deploy. Local OK; CI ubuntu-latest `success` (5/5); negativa sin `--minify`: "Recompilar y comparar" `failure`, rama borrada. Nuevos SC-2 y SC-3 propuestos. Siguiente: merge a main (deploy sin cambios de runtime; OK del PO) y Planning del Sprint 4. Bloqueos: ninguno.
2026-11-26 — Arquitecto aprueba esbuild 0.27.2 y el merge. Merge `e92fae5`. Evidencia (runs en `main`): verify-vendored.yml https://github.com/DacmosGroup/dacmosgroup-password-manager/actions/runs/45872830634 `success`; deploy-pwa.yml https://github.com/DacmosGroup/dacmosgroup-password-manager/actions/runs/45872830570 `success` (pasos "Verificar hashes de Workbox" y "Verificar hash de MSAL" `success` antes del deploy). Producción: `msal-browser.esm.min.js` = `827dca96…` (`application/javascript`), SW `e92fae5` controlando, "MSAL v3 inicializado", sin errores de JS. Nuevos en el backlog: CI-1 (actions por SHA) y SC-4 (Workbox verificado desde npm). Siguiente: Planning del Sprint 4 (PO). Bloqueos: ninguno.
```

---

## Fuera de alcance (explícito)

_(por definir en el Planning)_
