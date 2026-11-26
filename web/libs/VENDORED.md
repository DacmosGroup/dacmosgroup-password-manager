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

---

## workbox-v7.0.0/ (SW-1, §32)

| Campo | Valor |
|-------|-------|
| **Librería** | Workbox (Google) — `workbox-sw`, `-core`, `-precaching`, `-routing`, `-strategies`, `-expiration` |
| **Versión** | 7.0.0 (la misma que se cargaba antes desde `storage.googleapis.com/workbox-cdn/releases/7.0.0/`) |
| **Distribución** | Loader `workbox-sw.js` + `build/workbox-<módulo>.prod.js` de cada paquete; sin `.map` ni `.dev.js` |
| **Origen** | `npm pack <paquete>@7.0.0` |
| **Fecha de descarga** | 2026-11-26 |
| **Licencia** | MIT (`workbox-v7.0.0/LICENSE`, copiada de `workbox-sw`) |
| **Repositorio** | https://github.com/GoogleChrome/workbox |

### Integridad de los paquetes (comprobada al descargar)

El sha512 de cada `.tgz`, calculado localmente, coincide con `dist.integrity` del registro de npm
(`npm view <paquete>@7.0.0 dist.integrity`):

| Paquete | `dist.integrity` |
|---|---|
| `workbox-sw@7.0.0` | `sha512-SWfEouQfjRiZ7GNABzHUKUyj8pCoe+RwjfOIajcx6J5mtgKkN+t8UToHnpaJL5UVVOf5YhJh+OHhbVNIHe+LVA==` |
| `workbox-core@7.0.0` | `sha512-81JkAAZtfVP8darBpfRTovHg8DGAVrKFgHpOArZbdFd78VqHr5Iw65f2guwjE2NlCFbPFDoez3D3/6ZvhI/rwQ==` |
| `workbox-precaching@7.0.0` | `sha512-EC0vol623LJqTJo1mkhD9DZmMP604vHqni3EohhQVwhJlTgyKyOkMrZNy5/QHfOby+39xqC01gv4LjOm4HSfnA==` |
| `workbox-routing@7.0.0` | `sha512-8YxLr3xvqidnbVeGyRGkaV4YdlKkn5qZ1LfEePW3dq+ydE73hUUJJuLmGEykW3fMX8x8mNdL0XrWgotcuZjIvA==` |
| `workbox-strategies@7.0.0` | `sha512-dg3qJU7tR/Gcd/XXOOo7x9QoCI9nk74JopaJaYAQ+ugLi57gPsXycVdBnYbayVj34m6Y8ppPwIuecrzkpBVwbA==` |
| `workbox-expiration@7.0.0` | `sha512-MLK+fogW+pC3IWU9SFE+FRStvDVutwJMR5if1g7oBJx3qwmO69BNoJQVaMXq41R0gg3MzxVfwOGKx3i9P6sOLQ==` |

Comprobación adicional: los seis archivos son idénticos byte a byte a los que servía el CDN de Google
(mismo comportamiento que antes de SW-1).

### Archivos y SHA-256 (`workbox-v7.0.0/SHA256SUMS`)

| Archivo | Bytes | SHA-256 |
|---|---|---|
| `workbox-core.prod.js` | 3,126 | `a4481117eed468cbb7c33ef933b8863513801dc5ff49369d65fc8f96e9a237dc` |
| `workbox-expiration.prod.js` | 6,366 | `dffae3c6fe4e8db145cb9072c289a5987290f25d617ef6ac4d2d1782551cedd7` |
| `workbox-precaching.prod.js` | 7,047 | `b3bdc6db1166d40a4a51b9ca55a1b36edb9c9738e104cb6e27bccfda8d1c3632` |
| `workbox-routing.prod.js` | 3,499 | `d3bddc9652e6c2d1150dd30ad5e7723576e08af5250275cec079e70136fefd1f` |
| `workbox-strategies.prod.js` | 6,877 | `42d337246f06dae3eb4a169afa0a1045a4d905617b78cfef33c355963d001566` |
| `workbox-sw.js` | 1,361 | `f7f9d1f6d4a82b17a6a0b3ef28bbcde3d8e0533a87e4159bd84411c8ad34ea21` |

`deploy-pwa.yml` corre `sha256sum -c --strict SHA256SUMS` en esta carpeta antes de desplegar: si un
archivo no coincide, el job falla y no hay deploy. `.gitattributes` (`web/libs/** -text`) evita que git
convierta los finales de línea en Windows, lo que cambiaría los hashes.

`service-worker.js` hace `importScripts('/libs/workbox-v7.0.0/workbox-sw.js')` y
`workbox.setConfig({ modulePathPrefix: '/libs/workbox-v7.0.0/', debug: false })`. `debug: false` es
obligatorio: sin él, en `localhost` el loader pediría los `.dev.js`, que no están vendorizados.

### Protocolo de actualización

1. En una carpeta vacía: `npm pack <paquete>@<versión>` para los seis paquetes.
2. Comparar el sha512 de cada `.tgz` con `npm view <paquete>@<versión> dist.integrity`.
3. Copiar `build/workbox-sw.js` y los `build/workbox-<módulo>.prod.js` a `web/libs/workbox-v<versión>/`.
4. `sha256sum workbox-*.js > SHA256SUMS` dentro de esa carpeta.
5. Actualizar las rutas en `service-worker.js` y `deploy-pwa.yml`, `versions.json` y este archivo.
6. Si el SW necesita un módulo nuevo de Workbox, vendorizarlo igual (si no, el loader falla por CSP).
7. Probar registro del SW, precache y modo offline antes del commit; deploy y `curl -I` después.
