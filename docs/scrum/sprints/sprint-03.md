# Sprint 3 — Play internal track + SW sin CDN externo · CERRADO

**Inicio:** 2026-11-25 · **Cierre:** 2026-11-26
**Sprint Goal:** DPM en el internal track de Play y la PWA sin dependencias externas en el service worker.
**Resultado del Goal:** ✅ cumplido
**Standup log completo:** `docs/scrum/sprint-actual.md` en el commit anterior al cierre

---

## Sprint Review

### Incremento demostrado

| ID | Item | Talla | Aceptación PO | Nota |
|---|---|---|---|---|
| AAB-1 | AAB vc 3 / 0.6.1 firmado desde `main` al internal track de Play | S–M | ✅ aceptado | Play App Signing con `dacmos-pm` vía PEPK + clave de subida `dacmos-upload`; guard de firma fail-closed en `build.gradle` (`-Pdpm.signing=upload`). `78ad1a9` + docs §32. |
| AAB-1b | `assetlinks.json` con un único fingerprint | S | ✅ aceptado | Solo `B9:3E` (`dacmos-pm`), verificado en producción. `1e594c6`. |
| SW-1 | Workbox servido desde el propio dominio en la PWA | S | ✅ aceptado | Workbox 7.0.0 vendorizado con `SHA256SUMS` verificado en el CI antes del deploy; CSP sin `storage.googleapis.com`. En producción con `600ed5b`. Docs §32. |
| AAB-2 | AAB vc 4 / 0.6.1 sin Automatic protection de Play | S | ✅ aceptado | Entró el 2026-11-26 (P-100): vc 3 salió de Play con código inyectado (`com.pairip`). Protección apagada a nivel de app; vc 4 desde `6465106` (`main` sin SW-1, mismo código que vc 2 y vc 3). Docs §32. |

Cambio de distribución que salió dentro de SW-1:

- `b064a6a` — `deploy-pwa.yml` despliega con la rama que dispara el job. Antes `--branch=main` fijo: un
  `workflow_dispatch` desde cualquier rama publicaba en producción. Ahora cualquier otra rama genera un preview.

### Verificación

- **SW-1**
  - Local con la CSP de producción (Chrome headless): SW activo, precache, página controlada, navegación offline.
  - Clon nuevo en Windows: `sha256sum -c` OK.
  - Preview: actualización del SW viejo (Workbox del CDN) a SW-1 en el mismo alias. Banner, activación tras el
    clic, cachés del deploy anterior borradas, navegación offline y 0 peticiones a `googleapis.com`.
  - Negativa en el CI: con un byte alterado, el paso de hashes da `failure`, el deploy queda `skipped` y no hay alias.
  - Producción: `curl -I` → `200` + `application/javascript`, CSP sin CDN.
- **AAB-1** (2026-11-25)
  - A33: actualización del APK vc 2 de GitHub a vc 3 de Play sin desinstalar.
  - Segundo teléfono: instalación limpia desde Play.
- **AAB-2** (2026-11-26)
  - Método validado sobre vc 3: el `base.apk` de Play contiene `com/pairip` y el AAB propio no.
  - vc 4 en el A33 (vc 3 → vc 4 desde Play) y en el S25 (APK vc 2 de GitHub → vc 4 desde Play): instalador
    Play, `firstInstallTime` sin cambio, firma `B9:3E`, `com/pairip` = 0, `classes.dex` igual al del AAB
    propio, bóveda que se desbloquea, también en modo avión.
  - `base.apk` idéntico en los dos teléfonos.
- Antes del build de vc 4: checkout limpio de `6465106`, `npx cap sync android`, hash de `engine.js` igual en
  `web/` y en los assets, `keytool -printcert` del AAB → clave de subida.
- `verify-crypto-sync.sh`: no aplica (ningún fork tocado).

### Fuera del incremento

Nada comprometido quedó sin hacer. Siguen en el backlog:

- **PS-2** — pruebas cerradas (12 testers / 14 días) antes de producción en Play. Arranca con vc 4.
- **DV-1** — registro de developer verification: `B9:3E` registrada. Las claves ajenas se retiran o se
  documentan (acción del PO, fuera del repo).
- **H-9** (reserva, no entró), **SW-DEV**, **DIST-1**, **F7-A**.

---

## Sprint Retro

**¿Qué cambiamos para el próximo sprint?**

1. **Verificar lo que entrega el canal, no solo lo que subimos.** Play inyectaba código en vc 3 y la DoD de
   AAB-1 pasó sin notarlo, porque se verificó la firma pero no el contenido. Ahora la DoD (README) exige
   sacar del dispositivo el APK que entrega el canal y compararlo con el build propio.
2. **Toda prueba de la PWA servida, en un preview.** Con los previews por rama ya se puede probar un cambio
   de SW, cabeceras o CSP (incluida la actualización desde producción) antes del merge. Queda en la DoD (README).
3. **Inventario de accesos de la máquina de desarrollo.** El push falló porque git usaba un token personal
   olvidado; se revocó y git pasó a OAuth por el navegador. El inventario vive **fuera del repo** (es
   público) y se revisa en cada cierre de sprint.

---

## Métricas

- Items comprometidos: 3 (SW-1, AAB-1, AAB-1b) + 1 que entró a mitad de sprint (AAB-2) · completados: 4
- Duración: 2 días de calendario · 2 sesiones de trabajo
- Commits del sprint (Planning a cierre): `feat` 3, `fix` 1, `ci` 1, `merge` 1, `docs` 8 (incluido el de cierre)
