# Dependencias Vendoreadas — web/libs/

Este directorio contiene librerías de terceros copiadas localmente en lugar de cargarse desde CDN.
El vendoreo garantiza que las versiones son fijas y auditables, y que la PWA funciona offline sin
dependencias en CDN externos para el flujo de autenticación OAuth.

---

## msal-browser.esm.min.js (SC-1, §32)

| Campo | Valor |
|-------|-------|
| **Librería** | @azure/msal-browser (con @azure/msal-common empaquetado dentro) |
| **Versión** | 3.30.0 (msal-common 14.16.1, fijada de forma exacta por msal-browser) |
| **Distribución** | Bundle ESM autocontenido generado con esbuild desde `dist/index.mjs` del paquete (el paquete no trae un ESM de un solo archivo) |
| **Generado** | 2026-05-30 (F4.3) · receta verificada y fijada el 2026-11-26 |
| **SHA-256** | `827dca9694b5e713bbe10687952d6cacea8431ee73f66f5abe07c628d46f84c5` (en `SHA256SUMS`) |
| **Tamaño** | 318,971 bytes |
| **Licencia** | MIT (`LICENSE-msal-browser`, copiada del paquete) |
| **Repositorio** | https://github.com/AzureAD/microsoft-authentication-library-for-js |

### Receta (reproducible)

Dentro de `node_modules/@azure/msal-browser`:

```bash
esbuild dist/index.mjs --bundle --format=esm --platform=browser --minify --outfile=msal-browser.esm.min.js
```

Versiones fijadas en `tools/vendor/msal/package.json` + `package-lock.json`. Para comprobarlo:

```bash
npm ci --ignore-scripts --prefix tools/vendor/msal
bash tools/vendor/msal/verify.sh
```

`verify-vendored.yml` (CI) hace lo mismo en cada cambio de `web/libs/**` o `tools/vendor/**`, y
`deploy-pwa.yml` corre `sha256sum -c --strict SHA256SUMS` en `web/libs/` antes de desplegar (sin `npm`).

**Versiones de esbuild que generan el mismo archivo:** de 0.27.2 a 0.28.0 (probadas 0.27.2, 0.27.3, 0.27.4,
0.27.5, 0.27.7 y 0.28.0). 0.27.0/0.27.1 y 0.28.1/0.28.2 dan otro archivo. Se fija **0.27.2**: es la única del
rango fuera del advisory GHSA-g7r4-m6w7-qqqr (bajo; afecta al servidor de desarrollo de esbuild en Windows,
que la receta no usa).

### Integridad de los paquetes (`dist.integrity` del registro = `package-lock.json`)

| Paquete | Integridad |
|---|---|
| `@azure/msal-browser@3.30.0` | `sha512-I0XlIGVdM4E9kYP5eTjgW8fgATdzwxJvQ6bm2PNiHaZhEuUz47NYw1xHthC9R+lXz4i9zbShS0VdLyxd7n0GGA==` |
| `@azure/msal-common@14.16.1` | `sha512-nyxsA6NA4SVKh5YyRpbSXiMr7oQbwark7JU9LMeg6tJYTSPyAGkdx61wPT4gyxZfxlSxMMEyAsWaubBlNyIa1w==` |
| `esbuild@0.27.2` y su binario por plataforma | en `tools/vendor/msal/package-lock.json` |

### Corrección (2026-11-26)

Hasta esta fecha este archivo decía que el origen era `npm pack` → `dist/msal-browser.esm.min.js` (ese
archivo no existe en el paquete) y documentaba el SHA-256 `3FD8427C…`, que es el de una copia con CRLF de
Windows, no el del blob que se despliega. El contenido nunca cambió: la receta de arriba, que estaba en el
documento técnico (F4.3), lo reproduce byte a byte.

### Protocolo de actualización

1. Cambiar las versiones en `tools/vendor/msal/package.json` y regenerar el lock
   (`npm install --package-lock-only --ignore-scripts`); `npm audit` sin advisories que apliquen.
2. `npm ci --ignore-scripts` y la receta → nuevo `msal-browser.esm.min.js` en `web/libs/`.
3. `sha256sum msal-browser.esm.min.js > SHA256SUMS` en `web/libs/`; actualizar esta sección y `versions.json`.
4. `bash tools/vendor/msal/verify.sh` → OK.
5. Probar el flujo OAuth completo (Google Drive + OneDrive) antes del commit, en un preview por rama.

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
