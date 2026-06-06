# Dependencias Vendoreadas — web/libs/

Este directorio contiene librerías de terceros copiadas localmente en lugar de cargarse desde CDN.
El vendoreo garantiza que las versiones son fijas y auditables, y que la PWA funciona offline sin
dependencias en CDN externos para el flujo de autenticación OAuth.

---

## msal-browser.esm.min.js

| Campo | Valor |
|-------|-------|
| **Librería** | @azure/msal-browser |
| **Versión** | 3.30.0 |
| **Distribución** | ESM bundle minificado (`msal-browser.esm.min.js`) |
| **Origen** | `npm pack @azure/msal-browser@3.30.0` → `dist/msal-browser.esm.min.js` |
| **Fecha de descarga** | 2026-05-30 |
| **SHA-256** | `3FD8427C48139A9F94AF90634EDC3C1C316F77B23A894CC5CCB366E4081FF20A` |
| **Tamaño** | 319,117 bytes |
| **Licencia** | MIT |
| **Repositorio** | https://github.com/AzureAD/microsoft-authentication-library-for-js |

### Por qué se vendorea

La PWA no usa bundler (Vanilla JS sin build step). Importar MSAL.js desde CDN
(`https://alcdn.msauth.net/...`) introduciría una dependencia en tiempo de ejecución
que rompería el modo offline. El vendoreo permite:

1. **Modo offline garantizado** — la librería vive junto a los assets precacheados por Workbox.
2. **Versión fija y auditable** — el hash SHA-256 verifica que el archivo no ha sido alterado.
3. **Sin solicitudes a dominios externos** — todo el código de auth corre desde `self`.

### Protocolo de actualización

Cuando se actualice MSAL.js a una nueva versión:

1. Ejecutar: `npm pack @azure/msal-browser@<nueva-versión>`
2. Copiar `dist/msal-browser.esm.min.js` → `web/libs/msal-browser.esm.min.js`
3. Calcular el hash: `Get-FileHash web/libs/msal-browser.esm.min.js -Algorithm SHA256`
4. Actualizar los campos **Versión**, **Fecha de descarga**, **SHA-256** y **Tamaño** en este archivo
5. Revisar el CHANGELOG de MSAL.js para breaking changes en la API de `PublicClientApplication`
6. Probar el flujo OAuth completo (Google Drive + OneDrive) antes de hacer commit

### Verificación del archivo actual

Para verificar que el archivo en disco coincide con el hash documentado:

```powershell
# PowerShell
(Get-FileHash "web\libs\msal-browser.esm.min.js" -Algorithm SHA256).Hash
# Debe retornar: 3FD8427C48139A9F94AF90634EDC3C1C316F77B23A894CC5CCB366E4081FF20A
```

```bash
# Bash / Linux
sha256sum web/libs/msal-browser.esm.min.js
# Debe retornar: 3fd8427c48139a9f94af90634edc3c1c316f77b23a894cc5ccb366e4081ff20a
```
