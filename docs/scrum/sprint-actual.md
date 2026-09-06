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
| H-5 | `_deviceId` embebido en el payload cifrado del vault (`guardarVaultCifrado`), + misma API surface en el fork de la Extension | M | ⬜ TODO — **gate de arquitectura primero** |
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
```

---

## Fuera de alcance (explícito)

- **H-9** (sync logging) → Sprint 3, emparejado con D-1 ya entregado.
- **F7-A** (Android Autofill) → bloqueado por PS-1 + gate de arquitectura (3 huecos).
- El envío/seguimiento de PS-1 en Play Console → acción del PO, fuera del sprint.
- Nada de UI nueva en Extension/PWA salvo lo mínimo de H-5.
