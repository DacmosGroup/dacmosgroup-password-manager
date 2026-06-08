/**
 * i18n.js — Módulo de internacionalización PWA
 *
 * Orden de prioridad:
 *   1. config.idioma en IndexedDB (preferencia guardada por el usuario)
 *   2. navigator.language del navegador
 *   3. EN como fallback final
 *
 * Uso: importar { t, initI18n } y llamar await initI18n() en app.js
 * antes de montar cualquier vista.
 */

import { strings as stringsEs }   from './strings.es.js'
import { strings as stringsEn }   from './strings.en.js'
import { strings as stringsPtBr } from './strings.pt_BR.js'
import { idbStorage }             from '../storage/indexeddb-adapter.js'

const DICTIONARIES = {
  es:    stringsEs,
  en:    stringsEn,
  pt_BR: stringsPtBr,
}

// ES por defecto hasta que initI18n() complete
let _dict = stringsEs

/**
 * Inicializa el idioma activo.
 * Debe llamarse con await en app.js antes de montar la primera vista.
 */
export async function initI18n() {
  try {
    const { config } = await idbStorage.get(['config'])
    const stored = config?.idioma
    if (stored && DICTIONARIES[stored]) {
      _dict = DICTIONARIES[stored]
      return
    }
  } catch (_) {
    // IDB no disponible — usar navigator.language
  }

  const lang = navigator.language ?? 'en'
  if (lang.startsWith('es')) {
    _dict = stringsEs
  } else if (lang.startsWith('pt')) {
    _dict = stringsPtBr
  } else {
    _dict = stringsEn
  }
}

/**
 * Traduce una clave. Interpola {var} con los valores de vars.
 * Fallback: ES → clave original si no existe en ningún idioma.
 *
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function t(key, vars) {
  let text = _dict[key] ?? stringsEs[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return text
}
