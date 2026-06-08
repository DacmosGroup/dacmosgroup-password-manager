/**
 * t.js — i18n wrapper for Chrome Extension (F5-B)
 * Converts dot-notation keys to chrome.i18n underscore keys.
 * DOM walker applies translations via data-i18n* attributes.
 */

/**
 * Translate a key, optionally interpolating {var} placeholders.
 * @param {string} key  Dot-notation key (e.g. 'vault.counter_other')
 * @param {Object} [vars]  Substitution variables (e.g. { shown: 3, total: 10 })
 * @returns {string}
 */
export function t(key, vars) {
  const msg = chrome.i18n.getMessage(key.replace(/\./g, '_')) || key
  if (!vars) return msg
  return msg.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

/**
 * Walk DOM from root and apply translations via data-i18n* attributes.
 * Call in each page's init function after DOM is ready.
 * @param {Document|Element} [root=document]
 */
export function walkI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = t(el.dataset.i18n)
    if (msg !== el.dataset.i18n) el.textContent = msg
  })
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const msg = t(el.dataset.i18nPlaceholder)
    if (msg !== el.dataset.i18nPlaceholder) el.placeholder = msg
  })
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const msg = t(el.dataset.i18nTitle)
    if (msg !== el.dataset.i18nTitle) el.title = msg
  })
  root.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const msg = t(el.dataset.i18nAria)
    if (msg !== el.dataset.i18nAria) el.setAttribute('aria-label', msg)
  })
}
