#!/usr/bin/env bash
# verify.sh — Recompila web/libs/msal-browser.esm.min.js con la receta fijada y compara su SHA-256
# con web/libs/SHA256SUMS (SC-1, documento-tecnico §32). Sale con 1 si no coincide.
#
# Uso (desde cualquier carpeta):
#   npm ci --ignore-scripts --prefix tools/vendor/msal
#   bash tools/vendor/msal/verify.sh
#
# Versiones fijadas en package.json + package-lock.json (integridad del registro de npm):
#   @azure/msal-browser 3.30.0 · @azure/msal-common 14.16.1 · esbuild 0.27.2
# --ignore-scripts: esbuild no necesita su postinstall; el binario sale del paquete opcional de la
# plataforma (@esbuild/linux-x64, @esbuild/win32-x64…), también fijado en el lock.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$AQUI/../../.." && pwd)"
SUMS="$REPO/web/libs/SHA256SUMS"
ARCHIVO="msal-browser.esm.min.js"
SALIDA="$(mktemp -d)/$ARCHIVO"

# Receta original (F4.3, 2026-05-30): bundle ESM autocontenido desde dist/index.mjs del paquete.
cd "$AQUI/node_modules/@azure/msal-browser"
"$AQUI/node_modules/.bin/esbuild" dist/index.mjs --bundle --format=esm --platform=browser \
  --minify --outfile="$SALIDA" --log-level=warning

ESPERADO="$(grep -E "[ *]$ARCHIVO\$" "$SUMS" | cut -d' ' -f1)"
OBTENIDO="$(sha256sum "$SALIDA" | cut -d' ' -f1)"
VENDORIZADO="$(sha256sum "$REPO/web/libs/$ARCHIVO" | cut -d' ' -f1)"

echo "esbuild:        $("$AQUI/node_modules/.bin/esbuild" --version)"
echo "esperado:       $ESPERADO  (web/libs/SHA256SUMS)"
echo "recompilado:    $OBTENIDO"
echo "en el repo:     $VENDORIZADO"

if [ -z "$ESPERADO" ] || [ "$OBTENIDO" != "$ESPERADO" ] || [ "$VENDORIZADO" != "$ESPERADO" ]; then
  echo "FALLO: el bundle no se reproduce o no coincide con SHA256SUMS" >&2
  exit 1
fi
echo "OK: $ARCHIVO se reproduce byte a byte"
