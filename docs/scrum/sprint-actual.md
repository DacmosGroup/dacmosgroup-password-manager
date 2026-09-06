# Sprint 2 — Android fuera de Play Store + deviceId en el vault

**Estado:** EN CURSO
**Inicio:** 2026-09-06
**Tope blando:** ~2 semanas de trabajo efectivo

---

## Sprint Goal

DPM Android disponible para usuarios reales fuera de Play Store, y el vault
cifrado identificando su dispositivo de origen.

---

## Items comprometidos

| ID | Item | Talla | Estado |
|---|---|---|---|
| H-5 | `_deviceId` embebido en el payload cifrado del vault, resuelto dentro del engine en ambos forks | M | ✅ DONE 2026-09-06 — código + verificación + docs (§30). Gate cerrado (brief v2), OK de arquitectura, pusheado a `origin/main` (`5bd8d03`, `3c29a2d`, `8dcd199`). |
| D-1 | APK firmado (keystore `keys/dacmos-pm-release.keystore`) publicado en GitHub Releases + enviado a IzzyOnDroid | M | ⬜ TODO |

---

## Definition of Done del sprint

Además del DoD general (`README.md`):

**H-5**
- `_deviceId` se incluye en el objeto cifrado antes del `JSON.stringify` en `web/src/crypto/engine.js`
- `src/crypto/engine.js` (Extension) exporta la misma API surface — `verify-crypto-sync.sh` exit 0
- Decisión explícita y documentada sobre `BLOB_VERSION` y migración de vaults existentes (arquitecto)
- Ambos forks en el mismo commit · `documento-tecnico.md` con la sección de decisiones

**D-1**
- APK `co.dacmosgroup.dpm` firmado con el keystore de release (mismo que el AAB)
- Publicado en GitHub Releases con notas de versión
- Enviado a IzzyOnDroid (o metadata + solicitud listas si el proceso es asíncrono)
- `README.md` + landing (`dacmosgroup.co`) reflejan el canal nuevo
- No se toca el flujo de Play Store (PS-1 sigue su curso aparte)

---

## Gate de arquitectura — pendiente antes de implementar H-5

Llevar al chat del Project DPM:
1. ¿`_deviceId` dentro del payload obliga a bump de `BLOB_VERSION`?
2. Migración de vaults pre-H-5: ¿convergencia lazy (como el schema TOTP en v0.5.1) o bump?
3. La Extension no usa `_deviceId` — ¿cómo mantiene API surface idéntica sin lógica muerta?
4. ¿`_deviceId` viaja en el sync? Implicación en H-9 (Sprint 3) y en detección de conflictos.

D-1 no tiene gate — es empaquetado y distribución.

---

## Standup log

```
2026-09-06 — Planning. Sprint 2 confirmado por el PO (Goal + H-5 + D-1). Siguiente: llevar H-5 al arquitecto para el brief; implementación en sesión nueva de Code. D-1 puede arrancar en paralelo (sin gate). Bloqueos: ninguno. PS-1 reenviada, en revisión de Google (async).
2026-09-06 — Code abre sesión H-5. Brief del arquitecto recibido (h5-decisiones-temp.md). Auditoría del código antes de implementar: 3 divergencias entre el brief y el código real, reportadas al chat del Project — NO se escribe código hasta que el arquitecto/PO resuelvan. (1) El payload cifrado YA es objeto `{ credenciales: [...] }` desde v0.4.0, no un array plano → cae la premisa de "cambio estructural mayor" y de la lectura dual-forma. (2) El sync per-item con `deviceId`+`lamportClock` de §15 NO está implementado; el sync vigente es blob monolítico LWW sin ningún `deviceId`. Única fuente de device id en el repo = `web/src/storage/device-id.js`, sin consumidores. (3) `guardarVaultCifrado` tiene 3+ call sites de escritura en la PWA (credential-form.js, vault.js, unlock.js); alimentar el param opcional solo desde un "chokepoint" deja `_deviceId: null` en cada edición normal. Bloqueos: gate de arquitectura reabierto por estas 3 divergencias.
2026-09-06 — Brief v2 del arquitecto (gate cerrado). Ajuste posterior: `configurarVault` y `cambiarMasterPassword` también resuelven `_deviceId` (evitar regresión "campo presente → ausente" en cambio de master password). H-5 implementado: `_resolverDeviceId()` interno en ambos forks, sin parámetro; PWA → `device-id.js`, Extension → `null`. 3 commits en `feature/h5-deviceid`: (1) `docs:` cirugía §29/§27 + numeración + 4 refs vivas · (2) `feat(crypto):` H-5 + `tests/h5-verify.mjs` · (3) `docs:` §30 + §15 warning + §21 (Hallazgo vs Backlog H-5) + §29 DA-3 + nota asimetría `CLAUDE.md` + backlog (H-5 ✅, nuevo T-1). `verify-crypto-sync.sh` exit 0 · harness exit 0.
2026-09-06 — OK de arquitectura. Merge ff a `main` + `git push origin main` (`5a1d01c..8dcd199`). **H-5 DONE.** Riesgo anotado en `product-backlog.md` (bloque PS-1): el AAB v0.6.0 firmado es anterior a H-5 → rebuild + re-firma desde `main` post-H-5 antes de subir al internal track. Pendiente: Dacmos sube `documento-tecnico.md` + `CLAUDE.md` + `product-backlog.md` al Project DPM (reemplazando). Sprint 2 sigue abierto — falta D-1 (arranca sobre `main` post-H-5, sin nada especial).
```

---

## Fuera de alcance (explícito)

- **H-9** (sync logging) → Sprint 3, emparejado con D-1 ya entregado.
- **F7-A** (Android Autofill) → bloqueado por PS-1 + gate de arquitectura (3 huecos).
- El envío/seguimiento de PS-1 en Play Console → acción del PO, fuera del sprint.
- Nada de UI nueva en Extension/PWA salvo lo mínimo de H-5.
