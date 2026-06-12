#!/usr/bin/env bash
# =============================================================
# verify-crypto-sync.sh — Dacmos Password Manager
# Verifica que los forks manuales estén sincronizados con los
# archivos originales de la Chrome Extension.
#
# Forks verificados:
#   src/crypto/engine.js          ↔  web/src/crypto/engine.js
#   src/health/password-health.js ↔  web/src/health/password-health.js
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
echo "[1/4] Crypto engine — constantes de seguridad y API surface"
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
echo "[2/4] Password-health — constantes y API surface"
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
echo "[3/4] Motor TOTP — constantes y API surface"
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
echo "[4/4] Credential-schema — API surface"
echo ""
echo "  API surface (funciones exportadas):"
check_exports "$EXT_SCHEMA" "$PWA_SCHEMA"

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
