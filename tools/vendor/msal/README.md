# tools/vendor/msal — receta reproducible de MSAL vendorizado

Herramienta de verificación de `web/libs/msal-browser.esm.min.js` (SC-1, `docs/documento-tecnico.md` §32).
**No es una dependencia de la app:** no se carga en runtime ni la usa el deploy.

```bash
npm ci --ignore-scripts --prefix tools/vendor/msal
bash tools/vendor/msal/verify.sh
```

`verify.sh` recompila el bundle con las versiones de `package-lock.json` y sale con 1 si el resultado no
coincide byte a byte con `web/libs/SHA256SUMS`. El CI lo ejecuta en `verify-vendored.yml`.
Cómo actualizar MSAL: `web/libs/VENDORED.md`, "Protocolo de actualización".
