/**
 * nav-bottom.js — Componente de navegación principal (F4.4)
 *
 * Genera la barra de navegación que se muestra como:
 *   Mobile (< 768px): barra fija en la parte inferior de la pantalla
 *   Desktop (≥ 768px): sidebar fijo en el lado izquierdo
 *
 * El mismo HTML se reutiliza en ambos contextos — el CSS de main.css
 * controla el layout según el breakpoint. No hay lógica JS para esto.
 *
 * Condición 1 (aprobada): cada ítem incluye SIEMPRE ícono + etiqueta:
 *   <button class="nav-item" data-ruta="#/vault">
 *     <span class="nav-item__icono">🗄️</span>
 *     <span class="nav-item__etiqueta">Vault</span>
 *   </button>
 */

import { navegar, rutaActual } from '../router.js'
import { t } from '../../i18n/i18n.js'

// Rutas donde la nav NO debe mostrarse (setup, unlock, form de credencial)
const RUTAS_SIN_NAV = new Set(['#/setup', '#/unlock', '#/credential-form'])

// Referencia al contenedor montado (para actualizar el estado activo)
let _contenedor = null

/**
 * Monta el componente de navegación en el DOM.
 * Crea el elemento #nav-contenedor y lo añade al body.
 * Debe llamarse una vez desde app.js, después de initI18n().
 */
export function montarNavBottom() {
  // Evitar duplicados si se llama más de una vez
  if (document.getElementById('nav-contenedor')) return

  // Items de navegación — se evalúan después de initI18n() para usar el idioma correcto
  const ITEMS = [
    { ruta: '#/vault',     icono: '🗄️',  etiqueta: t('nav.vault')     },
    { ruta: '#/health',    icono: '🛡️',  etiqueta: t('nav.health')    },
    { ruta: '#/generator', icono: '⚡',   etiqueta: t('nav.generator') },
    { ruta: '#/settings',  icono: '⚙️',  etiqueta: t('nav.settings')  },
  ]

  _contenedor = document.createElement('div')
  _contenedor.id = 'nav-contenedor'

  const nav = document.createElement('nav')
  nav.className   = 'nav-bottom'
  nav.setAttribute('aria-label', t('nav.aria.label'))

  ITEMS.forEach(({ ruta, icono, etiqueta }) => {
    const btn = document.createElement('button')
    btn.className  = 'nav-item'
    btn.dataset.ruta = ruta
    btn.setAttribute('type', 'button')
    btn.setAttribute('aria-label', etiqueta)
    btn.innerHTML = `
      <span class="nav-item__icono" aria-hidden="true">${icono}</span>
      <span class="nav-item__etiqueta">${etiqueta}</span>`

    btn.addEventListener('click', () => {
      navegar(ruta)
    })

    nav.appendChild(btn)
  })

  _contenedor.appendChild(nav)
  document.body.appendChild(_contenedor)

  // Sincronizar estado activo al primer render
  _actualizarActivo()

  // Escuchar hashchange para actualizar el ítem activo y visibilidad
  window.addEventListener('hashchange', _actualizarActivo)
}

/**
 * Actualiza la clase .nav-item--activo y la visibilidad del contenedor.
 * Se llama en cada cambio de hash para reflejar la ruta activa.
 */
function _actualizarActivo() {
  if (!_contenedor) return

  const ruta = rutaActual()

  // Ocultar la nav en vistas de pantalla completa (setup, unlock, credential-form)
  if (RUTAS_SIN_NAV.has(ruta)) {
    _contenedor.style.display = 'none'
    // Eliminar el margen/padding del app cuando no hay nav
    const app = document.getElementById('app')
    if (app) app.classList.add('sin-nav')
    return
  }

  _contenedor.style.display = ''
  const app = document.getElementById('app')
  if (app) app.classList.remove('sin-nav')

  // Marcar el ítem de la ruta activa
  _contenedor.querySelectorAll('.nav-item').forEach(btn => {
    const esActivo = btn.dataset.ruta === ruta
    btn.classList.toggle('nav-item--activo', esActivo)
    btn.setAttribute('aria-current', esActivo ? 'page' : 'false')
  })
}

/**
 * Fuerza una actualización del estado activo de la nav.
 * Útil para llamar desde app.js después de determinar la vista inicial.
 */
export function actualizarNavActivo() {
  _actualizarActivo()
}
