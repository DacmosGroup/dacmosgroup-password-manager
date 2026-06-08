/**
 * vault.js — Vista principal del vault (F4.4 + F4.5)
 *
 * Muestra la lista de credenciales con:
 *   - Swipe para revelar acciones (editar / eliminar)
 *   - Buscador en tiempo real
 *   - Botón "+ Nueva" para añadir credencial
 *   - Banner de persistencia (F4.5) según estado guardado en idbStorage
 *   - Botón "Agregar al inicio" cuando la PWA es instalable
 *
 * Si la sesión no está activa al montar, redirige a #/unlock.
 */

import { guardarVaultCifrado }  from '../../crypto/engine.js'
import { idbStorage }           from '../../storage/indexeddb-adapter.js'
import {
  sesionActiva, obtenerClave,
  obtenerCredenciales, establecerCredenciales,
} from '../../storage/session.js'
import { activarSwipe }         from '../components/swipe-card.js'
import { estaInstalable, instalar } from '../onboarding/pwa-install.js'
import { navegar }              from '../router.js'
import { escapeHtml }           from '../../utils/escape.js'
import { t }                    from '../../i18n/i18n.js'

/** Monta la vista del vault en el contenedor dado */
export async function montar(contenedor) {
  // Redirigir si no hay sesión activa
  if (!sesionActiva()) {
    await navegar('#/unlock')
    return
  }

  // Cargar estado de persistencia para el banner (F4.5)
  const datos = await idbStorage.get(['persistenciaEstado', 'bannerPersistenciaVisto'])
  const mostrarBanner = datos.persistenciaEstado === 'rechazada'
                     && !datos.bannerPersistenciaVisto

  contenedor.innerHTML = `
    <div class="vista">
      <header class="vault__header">
        <h1 class="vault__titulo">🔐 ${t('nav.vault')}</h1>
        <div class="vault__acciones">
          <button class="btn btn--pequeño btn--secundario oculto" id="btn-instalar" type="button">
            ${t('vault.btn.install')}
          </button>
          <button class="btn btn--primario btn--pequeño" id="btn-nueva" type="button">
            ${t('vault.btn.new')}
          </button>
        </div>
      </header>

      ${mostrarBanner ? `
      <div class="banner-persistencia" id="banner-persistencia" role="alert">
        <p>
          ${t('vault.banner.persistence')}
          <a href="#" id="banner-sync-link">${t('vault.banner.sync.link')}</a>
        </p>
        <button class="banner-persistencia__cerrar" id="btn-banner-cerrar"
                aria-label="${t('vault.banner.close')}">✕</button>
      </div>` : ''}

      <div class="vault__buscador">
        <input type="search"
               id="input-buscar"
               class="input"
               placeholder="${t('vault.search.placeholder')}"
               autocomplete="off"
               spellcheck="false">
      </div>

      <div class="vault__lista" id="lista-credenciales">
        <!-- Se rellena por _renderLista() -->
      </div>
    </div>`

  // ── Referencias DOM ──
  const listaCont    = contenedor.querySelector('#lista-credenciales')
  const inputBuscar  = contenedor.querySelector('#input-buscar')
  const btnNueva     = contenedor.querySelector('#btn-nueva')
  const btnInstalar  = contenedor.querySelector('#btn-instalar')

  // ── Botón de instalación PWA ──
  if (estaInstalable()) {
    btnInstalar.classList.remove('oculto')
    btnInstalar.addEventListener('click', () => instalar())
  }

  // ── Banner de persistencia (F4.5) ──
  if (mostrarBanner) {
    contenedor.querySelector('#banner-sync-link')?.addEventListener('click', (e) => {
      e.preventDefault()
      navegar('#/settings')
    })

    contenedor.querySelector('#btn-banner-cerrar')?.addEventListener('click', async () => {
      await idbStorage.set({ bannerPersistenciaVisto: true })
      contenedor.querySelector('#banner-persistencia')?.remove()
    })
  }

  // ── Botón Nueva credencial ──
  btnNueva.addEventListener('click', () => {
    navegar('#/credential-form', null)  // null = modo añadir
  })

  // ── Buscador ──
  inputBuscar.addEventListener('input', () => {
    _renderLista(listaCont, obtenerCredenciales(), inputBuscar.value.trim())
  })

  // ── Render inicial ──
  _renderLista(listaCont, obtenerCredenciales(), '')
}

/** Renderiza la lista de credenciales con filtrado opcional */
function _renderLista(contenedor, credenciales, filtro) {
  const termino = filtro.toLowerCase()
  const filtradas = termino
    ? credenciales.filter(c =>
        (c.sitio    ?? '').toLowerCase().includes(termino) ||
        (c.usuario  ?? '').toLowerCase().includes(termino) ||
        (c.url      ?? '').toLowerCase().includes(termino))
    : credenciales

  if (filtradas.length === 0) {
    contenedor.innerHTML = `
      <div class="lista-vacia">
        <div class="lista-vacia__icono">${filtro ? '🔍' : '🗄️'}</div>
        <p class="lista-vacia__texto">
          ${filtro
            ? t('vault.no.results', { term: escapeHtml(filtro) })
            : t('vault.empty.text')}
        </p>
      </div>`
    return
  }

  contenedor.innerHTML = filtradas.map(cred => `
    <div class="card" data-id="${escapeHtml(cred.id)}">
      <div class="card__contenido">
        <div class="card__icono" aria-hidden="true">
          ${_inicialSitio(cred.sitio)}
        </div>
        <div class="card__info">
          <div class="card__sitio">${escapeHtml(cred.sitio || t('vault.card.fallback'))}</div>
          <div class="card__usuario">${escapeHtml(cred.usuario || cred.url || '')}</div>
        </div>
        <div class="card__badges">
          ${cred.totp ? '<span class="badge badge--neutro">TOTP</span>' : ''}
        </div>
      </div>
      <div class="card__acciones" aria-hidden="true">
        <button class="card__accion card__accion--editar"  type="button">${t('common.edit.title')}</button>
        <button class="card__accion card__accion--eliminar" type="button">${t('common.delete.title')}</button>
      </div>
    </div>`).join('')

  // Activar swipe en cada card renderizada
  contenedor.querySelectorAll('.card').forEach(card => {
    activarSwipe(card, {
      onEditar:   (id) => _editarCredencial(id),
      onEliminar: (id) => _eliminarCredencial(id, contenedor, filtro),
    })
  })
}

/** Navega al formulario de edición con la credencial seleccionada */
function _editarCredencial(id) {
  const credencial = obtenerCredenciales().find(c => c.id === id)
  if (credencial) {
    navegar('#/credential-form', { credencial })
  }
}

/** Elimina una credencial tras confirmación del usuario */
async function _eliminarCredencial(id, listaCont, filtro) {
  const credencial = obtenerCredenciales().find(c => c.id === id)
  const nombre     = credencial?.sitio || t('vault.card.fallback')

  if (!confirm(t('vault.delete.confirm', { name: nombre }))) return

  const clave = obtenerClave()
  if (!clave) {
    navegar('#/unlock')
    return
  }

  const nuevas = obtenerCredenciales().filter(c => c.id !== id)
  await guardarVaultCifrado(nuevas, clave)
  establecerCredenciales(nuevas)

  // Re-renderizar con el mismo filtro activo
  _renderLista(listaCont, nuevas, filtro)
}

/** Retorna la inicial del sitio para el ícono de la card */
function _inicialSitio(sitio) {
  const s = String(sitio ?? '?').trim()
  return escapeHtml(s.charAt(0).toUpperCase() || '?')
}
