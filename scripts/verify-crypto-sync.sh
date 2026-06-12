#!/usr/bin/env bash
# =============================================================
# verify-crypto-sync.sh — Dacmos Password Manager
# Verifica que los forks manuales estén sincronizados con los
# archivos originales de la Chrome Extension.
#
# Forks verificados:
#   src/crypto/engine.js            ↔  web/src/crypto/engine.js
#   src/health/password-health.js   ↔  web/src/health/password-health.js
#   src/crypto/totp.js              ↔  web/src/crypto/totp.js              (v0.5.1)
#   src/schema/credential-schema.js ↔  web/src/schema/credential-schema.js (v0.5.1)
#   src/sync/google-drive-adapter.js ↔ web/src/sync/google-drive-adapter.js (contrato, v0.5.1)
#   src/sync/onedrive-adapter.js    ↔  web/src/sync/onedrive-adapter.js    (contrato, v0.5.1)
#
# Diferencias LEGÍTIMAS que el script ignora:
#   engine.js:
#     - import { idbStorage } — solo existe en la versión PWA
#     - chrome.storage.local (callbacks) → idbStorage (promises nativas)
#     - Comentarios de header identificando el fork
#   password-health.js:
#     - Líneas de header documentando que es un fork
#
# El script verifica dos niveles:
#   1. Constantes críticas de seguridad (PBKDF2, AES, SALT, IV, BLOB)
#   2. Funciones exportadas (API surface idéntica en ambas plataformas)
#
# Uso:
#   bash scripts/verify-crypto-sync.sh
#
# Salida:
#   Exit 0 — forks en sincronía
#   Exit 1 — drift crítico detectado
# =============================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

EXT_ENGINE="$REPO_ROOT/src/crypto/engine.js"
PWA_ENGINE="$REPO_ROOT/web/src/crypto/engine.js"
EXT_HEALTH="$REPO_ROOT/src/health/password-health.js"
PWA_HEALTH="$REPO_ROOT/web/src/health/password-health.js"
EXT_TOTP="$REPO_ROOT/src/crypto/totp.js"
PWA_TOTP="$REPO_ROOT/web/src/crypto/totp.js"
EXT_SCHEMA="$REPO_ROOT/src/schema/credential-schema.js"
PWA_SCHEMA="$REPO_ROOT/web/src/schema/credential-schema.js"
EXT_GDRIVE="$REPO_ROOT/src/sync/google-drive-adapter.js"
PWA_GDRIVE="$REPO_ROOT/web/src/sync/google-drive-adapter.js"
EXT_ONEDRIVE="$REPO_ROOT/src/sync/onedrive-adapter.js"
PWA_ONEDRIVE="$REPO_ROOT/web/src/sync/onedrive-adapter.js"

ERRORES=0

echo "==================================================="
echo " Dacmos PM — Fork Sync Verification"
echo "==================================================="
echo ""

# ── Comparar una constante de seguridad entre dos archivos ──
# Extrae la primera ocurrencia del patrón y compara los valores.
# Reporta OK o DRIFT con los valores actuales de cada archivo.
check_constante() {
  local label="$1"
  local patron="$2"
  local file1="$3"
  local file2="$4"

  local val1 val2
  val1=$(grep -E "$patron" "$file1" | head -1 | tr -d ' \t' || echo "NOT_FOUND")
  val2=$(grep -E "$patron" "$file2" | head -1 | tr -d ' \t' || echo "NOT_FOUND")

  if [ "$val1" = "$val2" ]; then
    echo "    ✅ $label"
  else
    echo "    ❌ $label — DRIFT:"
    echo "       Extension:  $val1"
    echo "       PWA:        $val2"
    ERRORES=$((ERRORES + 1))
  fi
}

# ── Verificar el contrato público StorageAdapter entre dos adapters ──
# Los adapters NO son forks bit-exactos (token/storage internos difieren),
# pero deben exponer el mismo contrato público. Solo se comparan los nombres
# del contrato — los helpers privados pueden diferir legítimamente.
check_contrato() {
  local label="$1" file1="$2" file2="$3"
  local re='(guardar|cargar|ultimaModificacion|verificarConexion|nombreProveedor|desconectar) *\('
  local s1 s2
  s1=$(grep -oE "$re" "$file1" | sed 's/ *(//' | sort -u || true)
  s2=$(grep -oE "$re" "$file2" | sed 's/ *(//' | sort -u || true)
  if [ "$s1" = "$s2" ]; then
    echo "    ✅ $label"
  else
    echo "    ❌ $label — DRIFT de contrato:"
    diff <(echo "$s1") <(echo "$s2") || true
    ERRORES=$((ERRORES + 1))
  fi
}

# ── Verificar que un patrón está presente en ambos forks ──
# Usado para anclar fixes que deben existir en las dos superficies
# (ej. invalidación de fileId 404 — BUG-SYNC-404).
check_presencia() {
  local label="$1" patron="$2" file1="$3" file2="$4"
  if grep -qE "$patron" "$file1" && grep -qE "$patron" "$file2"; then
    echo "    ✅ $label"
  else
    echo "    ❌ $label — patrón ausente en un fork"
    ERRORES=$((ERRORES + 1))
  fi
}

# ── Comparar las funciones exportadas entre dos archivos ──
# Extrae nombres de funciones con 'export' y compara el set.
check_exports() {
  local file1="$1"
  local file2="$2"

  local exp1 exp2
  exp1=$(grep -E "^export (async )?function |^export \{" "$file1" \
         | sed 's/export async function //; s/export function //; s/(.*//; s/export {/NAMED_EXPORTS: /' \
         | sort || true)
  exp2=$(grep -E "^export (async )?function |^export \{" "$file2" \
         | sed 's/export async function //; s/export function //; s/(.*//; s/export {/NAMED_EXPORTS: /' \
         | sort || true)

  if [ "$exp1" = "$exp2" ]; then
    echo "    ✅ Funciones exportadas"
  else
    echo "    ❌ Funciones exportadas — DRIFT:"
    diff <(echo "$exp1") <(echo "$exp2") || true
    ERRORES=$((ERRORES + 1))
  fi
}

# ═══════════════════════════════════════════════
# 1. Verificar crypto engine
# ═══════════════════════════════════════════════
echo "[1/5] Crypto engine — constantes de seguridad y API surface"
echo ""
echo "  Constantes críticas:"

check_constante "PBKDF2 iteraciones" \
  "PBKDF2_ITERACIONES\s*=" "$EXT_ENGINE" "$PWA_ENGINE"

check_constante "Salt bytes" \
  "SALT_BYTES\s*=" "$EXT_ENGINE" "$PWA_ENGINE"

check_constante "IV bytes" \
  "IV_BYTES\s*=" "$EXT_ENGINE" "$PWA_ENGINE"

check_constante "Blob version" \
  "BLOB_VERSION\s*=" "$EXT_ENGINE" "$PWA_ENGINE"

check_constante "AES algoritmo" \
  "AES_ALGORITMO\s*=" "$EXT_ENGINE" "$PWA_ENGINE"

check_constante "PBKDF2 hash" \
  "PBKDF2_HASH\s*=" "$EXT_ENGINE" "$PWA_ENGINE"

echo ""
echo "  API surface (funciones exportadas):"
check_exports "$EXT_ENGINE" "$PWA_ENGINE"

# ═══════════════════════════════════════════════
# 2. Verificar password-health
# ═══════════════════════════════════════════════
echo ""
echo "[2/5] Password-health — constantes y API surface"
echo ""
echo "  Constantes críticas:"

check_constante "Umbral entropía (bits)" \
  "UMBRAL_ENTROPIA_BITS\s*=" "$EXT_HEALTH" "$PWA_HEALTH"

echo ""
echo "  API surface (funciones exportadas):"
check_exports "$EXT_HEALTH" "$PWA_HEALTH"

# ═══════════════════════════════════════════════
# 3. Verificar motor TOTP (fork desde v0.5.1)
# ═══════════════════════════════════════════════
echo ""
echo "[3/5] Motor TOTP — constantes y API surface"
echo ""
echo "  Constantes críticas:"

check_constante "Período TOTP (s)" \
  "PERIODO\s*=" "$EXT_TOTP" "$PWA_TOTP"

echo ""
echo "  API surface (funciones exportadas):"
check_exports "$EXT_TOTP" "$PWA_TOTP"

# ═══════════════════════════════════════════════
# 4. Verificar schema de credencial (fork desde v0.5.1)
# ═══════════════════════════════════════════════
echo ""
echo "[4/5] Credential-schema — API surface"
echo ""
echo "  API surface (funciones exportadas):"
check_exports "$EXT_SCHEMA" "$PWA_SCHEMA"

# ═══════════════════════════════════════════════
# 5. Verificar adapters de sync (contrato + fix 404, desde v0.5.1)
# ═══════════════════════════════════════════════
echo ""
echo "[5/5] Sync adapters — contrato StorageAdapter e invalidación 404"
echo ""
echo "  Contrato público (guardar/cargar/ultimaModificacion/...):"
check_contrato "Google Drive — contrato" "$EXT_GDRIVE" "$PWA_GDRIVE"
check_contrato "OneDrive — contrato"     "$EXT_ONEDRIVE" "$PWA_ONEDRIVE"

echo ""
echo "  Anclas de fix cross-superficie:"
check_presencia "Google Drive — invalidación fileId 404 (BUG-SYNC-404)" \
  "_invalidarFileId" "$EXT_GDRIVE" "$PWA_GDRIVE"

# ═══════════════════════════════════════════════
# Resultado final
# ═══════════════════════════════════════════════
echo ""
echo "==================================================="
if [ "$ERRORES" -eq 0 ]; then
  echo " ✅ Todos los forks en sincronía."
  echo ""
  echo " Nota: las diferencias en storage API (callbacks vs promises)"
  echo " son esperadas y no constituyen drift criptográfico."
  exit 0
else
  echo " ❌ $ERRORES valor(es) crítico(s) con drift detectado."
  echo "    Portar los cambios al fork correspondiente antes de hacer commit."
  exit 1
fi
