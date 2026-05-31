/**
 * health.js — Vista de Password Health dashboard (F4.4)
 *
 * Muestra el análisis local de seguridad del vault:
 *   - Contadores: seguras, débiles, reutilizadas, comprometidas
 *   - Lista detallada por credencial con badges de estado
 *
 * Usa password-health.js (fork en web/src/health/) para el análisis.
 * El análisis es local — no hace llamadas de red por defecto.
 * Las credenciales se obtienen de la sesión en memoria.
 *
 * Si la sesión no está activa, redirige a #/unlock.
 */

import { analizarSaludLocal } from '../../health/password-health.js'
import { sesionActiva, obtenerCredenciales } from '../../storage/session.js'
import { navegar } from '../router.js'

/** Monta la vista de health en el contenedor dado */
export async function montar(contenedor) {
  // Redirigir si no hay sesión activa
  if (!sesionActiva()) {
    await navegar('#/unlock')
    return
  }

  // Estado de carga mientras se procesa el análisis
  contenedor.innerHTML = `
    <div class="vista">
      <h1 class="health__titulo">🛡️ Salud del Vault</h1>
      <div class="cargando">Analizando contraseñas...</div>
    </div>`

  const credenciales = obtenerCredenciales()

  if (credenciales.length === 0) {
    contenedor.innerHTML = `
      <div class="vista">
        <h1 class="health__titulo">🛡️ Salud del Vault</h1>
        <div class="lista-vacia">
          <div class="lista-vacia__icono">🛡️</div>
          <p class="lista-vacia__texto">
            Añade credenciales a tu vault para ver el análisis de seguridad.
          </p>
        </div>
      </div>`
    return
  }

  try {
    const reporte = await analizarSaludLocal(credenciales)
    const seguras = reporte.total - reporte.debiles - reporte.reutilizadas

    contenedor.innerHTML = `
      <div class="vista">
        <h1 class="health__titulo">🛡️ Salud del Vault</h1>

        <!-- Contadores principales -->
        <div class="health__contadores">
          <div class="health__contador health__contador--seguras">
            <div class="health__contador-numero">${Math.max(0, seguras)}</div>
            <div class="health__contador-label">Seguras</div>
          </div>
          <div class="health__contador health__contador--debiles">
            <div class="health__contador-numero">${reporte.debiles}</div>
            <div class="health__contador-label">Débiles</div>
          </div>
          <div class="health__contador health__contador--reutiliz">
            <div class="health__contador-numero">${reporte.reutilizadas}</div>
            <div class="health__contador-label">Reutilizadas</div>
          </div>
          <div class="health__contador health__contador--comprom">
            <div class="health__contador-numero">${reporte.comprometidas}</div>
            <div class="health__contador-label">Comprometidas</div>
          </div>
        </div>

        <p class="seccion-titulo">DETALLE POR CREDENCIAL</p>

        <!-- Lista de credenciales con sus métricas -->
        <div id="lista-health">
          ${reporte.items.map(item => _renderItem(item)).join('')}
        </div>

        <p class="health__nota-pie">
          Análisis local · Sin llamadas de red · Zero-Knowledge
        </p>
      </div>`

  } catch (error) {
    console.error('Error al analizar vault:', error)
    contenedor.innerHTML = `
      <div class="vista">
        <h1 class="health__titulo">🛡️ Salud del Vault</h1>
        <p class="error-texto">Error al analizar las contraseñas. Intenta de nuevo.</p>
      </div>`
  }
}

/** Genera el HTML de una fila del listado de health */
function _renderItem(item) {
  const badges = []

  if (item.esDebil) {
    badges.push('<span class="badge badge--aviso">Débil</span>')
  }
  if (item.esReutilizada) {
    badges.push('<span class="badge badge--peligro">Reutilizada</span>')
  }
  if (!item.esDebil && !item.esReutilizada) {
    badges.push('<span class="badge badge--exito">Segura</span>')
  }

  return `
    <div class="health__item">
      <div class="health__item-info">
        <div class="health__item-sitio">${_escaparHtml(item.sitio || 'Sin nombre')}</div>
        <div class="health__item-entropia">${item.entropia} bits · ${item.usuario ? _escaparHtml(item.usuario) : ''}</div>
      </div>
      <div class="health__item-badges">
        ${badges.join('')}
      </div>
    </div>`
}

/** Escapa HTML para prevenir XSS */
function _escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
