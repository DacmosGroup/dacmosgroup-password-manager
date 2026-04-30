// ============================================
// Dacmos Password Manager — Health Dashboard
// F1.3: Password Health Reports
// ============================================

import { verificarHIBP } from '../../health/password-health.js'

// ── Referencias al DOM ──
const btnVolver         = document.getElementById('btnVolver')
const statusBanner      = document.getElementById('statusBanner')
const bannerIcono       = document.getElementById('bannerIcono')
const bannerTexto       = document.getElementById('bannerTexto')
const loadingState      = document.getElementById('loadingState')
const emptyState        = document.getElementById('emptyState')
const errorState        = document.getElementById('errorState')
const reporteContent    = document.getElementById('reporteContent')
const numSeguras        = document.getElementById('numSeguras')
const numDebiles        = document.getElementById('numDebiles')
const numReutilizadas   = document.getElementById('numReutilizadas')
const numComprometidas  = document.getElementById('numComprometidas')
const hibpProgress      = document.getElementById('hibpProgress')
const hibpProgressBar   = document.getElementById('hibpProgressBar')
const hibpProgressLabel = document.getElementById('hibpProgressLabel')
const hibpProgressPct   = document.getElementById('hibpProgressPct')
const healthList        = document.getElementById('healthList')

// ── Estado del dashboard ──
let reporte          = null  // Reporte de salud cargado desde session
let compromidasCount = 0     // Contador de comprometidas (actualizado progresivamente)
let erroresHIBP      = 0     // Credenciales en las que HIBP falló

// ── Utilidad: leer claves de chrome.storage.session ──
function leerSesion(claves) {
  return new Promise(r => chrome.storage.session.get(claves, r))
}

// ── Navegación ──
btnVolver.addEventListener('click', () => {
  window.location.href = chrome.runtime.getURL('src/ui/vault/vault.html')
})

// ── Renderizado del ícono de sitio (consistente con vault.js) ──
function obtenerIcono(sitio) {
  const n = (sitio || '').toLowerCase()
  if (n.includes('google') || n.includes('gmail')) return '🔵'
  if (n.includes('github'))   return '⚫'
  if (n.includes('facebook')) return '🔷'
  if (n.includes('twitter') || n.includes('x.com')) return '🐦'
  if (n.includes('netflix'))  return '🔴'
  if (n.includes('amazon'))   return '📦'
  if (n.includes('banco') || n.includes('bank')) return '🏦'
  if (n.includes('linkedin')) return '💼'
  if (n.includes('microsoft') || n.includes('outlook')) return '🪟'
  if (n.includes('apple'))    return '🍎'
  return '🔐'
}

// Previene XSS al inyectar datos del usuario en el DOM
function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str || ''
  return div.innerHTML
}

// ── Renderizado del resumen numérico ──
function actualizarResumen() {
  if (!reporte) return

  // Credencial "segura" = sin ningún problema detectado
  const seguras = reporte.items.filter(i =>
    !i.esDebil &&
    !i.esReutilizada &&
    (!i.hibp || (!i.hibp.comprometida && !i.hibp.error))
  ).length

  numSeguras.textContent       = seguras
  numDebiles.textContent       = reporte.debiles
  numReutilizadas.textContent  = reporte.reutilizadas
  numComprometidas.textContent = compromidasCount > 0 ? compromidasCount : '0'
}

// ── Renderizado del ícono clasificador del ítem ──
function claseItem(item) {
  if (item.hibp?.comprometida)   return 'item-comprometida'
  if (item.esDebil)              return 'item-debil'
  if (item.esReutilizada)        return 'item-reutilizada'
  return 'item-ok'
}

// ── HTML de los badges de problema de un ítem ──
function htmlBadgesItem(item) {
  const badges = []

  if (item.esDebil) {
    badges.push(`<span class="hbadge hbadge-debil">⚠️ Débil · ${item.entropia} bits</span>`)
  }

  if (item.esReutilizada) {
    badges.push(`<span class="hbadge hbadge-reutilizada">🔁 Reutilizada</span>`)
  }

  // Estado HIBP: null = pendiente, error = sin red, comprometida = en filtraciones
  if (item.hibp === null) {
    badges.push(`<span class="hbadge hbadge-verificando" id="hibp-badge-${item.id}">⏳ Verificando HIBP...</span>`)
  } else if (item.hibp.error) {
    badges.push(`<span class="hbadge hbadge-error-hibp">🔘 HIBP no disponible</span>`)
  } else if (item.hibp.comprometida) {
    const veces = item.hibp.conteo.toLocaleString('es')
    badges.push(`<span class="hbadge hbadge-comprometida">🚨 Comprometida · ${veces} filtraciones</span>`)
  }

  if (badges.length === 0) {
    badges.push(`<span class="hbadge hbadge-ok">✅ Sin problemas detectados</span>`)
  }

  return badges.join('')
}

// ── Renderizar la lista completa de ítems ──
function renderizarLista() {
  healthList.innerHTML = ''

  for (const item of reporte.items) {
    const li = document.createElement('li')
    li.className  = `health-item ${claseItem(item)}`
    li.dataset.id = item.id

    li.innerHTML = `
      <div class="health-item-avatar">${obtenerIcono(item.sitio)}</div>
      <div class="health-item-info">
        <div class="health-item-site">${escapeHtml(item.sitio)}</div>
        <div class="health-item-user">${escapeHtml(item.usuario)}</div>
        <div class="health-item-badges">${htmlBadgesItem(item)}</div>
      </div>
    `

    healthList.appendChild(li)
  }
}

// ── Actualizar el badge HIBP de un ítem concreto sin re-renderizar todo ──
function actualizarBadgeHIBP(item) {
  const li = healthList.querySelector(`[data-id="${item.id}"]`)
  if (!li) return

  // Actualizar clase del ítem (puede cambiar a comprometida)
  li.className = `health-item ${claseItem(item)}`

  // Reconstruir solo la zona de badges
  const badgesDiv = li.querySelector('.health-item-badges')
  if (badgesDiv) badgesDiv.innerHTML = htmlBadgesItem(item)
}

// ── Mostrar/ocultar el banner de estado ──
function mostrarBanner(tipo, icono, texto) {
  statusBanner.className = `status-banner banner-${tipo}`
  bannerIcono.textContent = icono
  bannerTexto.textContent = texto
  statusBanner.classList.remove('hidden')
}

function ocultarBanner() {
  statusBanner.classList.add('hidden')
}

// ── Verificación HIBP progresiva ──
// Procesa una credencial por vez, actualizando la UI tras cada resultado.
// Ante un error 429 (rate limit) detiene el bucle y avisa al usuario.
async function ejecutarVerificacionHIBP(credencialesSesion) {
  const total = reporte.items.length
  if (total === 0) return

  hibpProgress.classList.remove('hidden')
  mostrarBanner('info', '⏳', 'Verificando contraseñas con Have I Been Pwned (k-anonymity)...')

  for (let i = 0; i < reporte.items.length; i++) {
    const item = reporte.items[i]

    // Buscar la contraseña en las credenciales de sesión usando el ID como clave
    const credSesion = credencialesSesion.find(c => c.id === item.id)
    if (!credSesion?.password) {
      item.hibp = { comprometida: false, conteo: 0, error: true }
      actualizarBadgeHIBP(item)
      continue
    }

    // Ejecutar la verificación HIBP (SHA-1 + k-anonymity, nunca texto plano)
    const resultado = await verificarHIBP(credSesion.password)
    item.hibp = resultado

    // Detectar rate limit — detener el bucle
    if (resultado.error && resultado.codigoHttp === 429) {
      erroresHIBP = total - i
      mostrarBanner('warn', '⚠️', 'Límite de la API HIBP alcanzado. Resultados parciales mostrados.')
      actualizarBadgeHIBP(item)
      // Marcar las credenciales restantes como "error"
      for (let j = i + 1; j < reporte.items.length; j++) {
        reporte.items[j].hibp = { comprometida: false, conteo: 0, error: true }
        actualizarBadgeHIBP(reporte.items[j])
      }
      break
    }

    if (resultado.comprometida) {
      compromidasCount++
      reporte.comprometidas = compromidasCount
    }

    if (resultado.error) erroresHIBP++

    actualizarBadgeHIBP(item)
    actualizarResumen()

    // Actualizar barra de progreso
    const progreso = Math.round(((i + 1) / total) * 100)
    hibpProgressBar.style.width = `${progreso}%`
    hibpProgressPct.textContent = `${progreso}%`
    hibpProgressLabel.textContent =
      `Verificando ${i + 1} de ${total} con Have I Been Pwned...`
  }

  // Verificación completada
  hibpProgress.classList.add('hidden')

  if (erroresHIBP > 0 && erroresHIBP < total) {
    mostrarBanner('warn', '⚠️', `Verificación parcial: ${erroresHIBP} credencial${erroresHIBP > 1 ? 'es' : ''} no pudo verificarse por error de red.`)
  } else if (erroresHIBP === total) {
    mostrarBanner('warn', '⚠️', 'HIBP no disponible. Análisis local completado (entropía + reutilización).')
  } else {
    mostrarBanner('ok', '✅', 'Verificación completada. Resultados actualizados.')
    setTimeout(ocultarBanner, 4000)
  }

  actualizarResumen()
}

// ── Punto de entrada del dashboard ──
async function inicializar() {
  try {
    // Leer el reporte pre-computado y las credenciales de sesión en paralelo
    const [datosReporte, datosSesion] = await Promise.all([
      leerSesion(['healthReport']),
      leerSesion(['credencialesSesion']),
    ])

    // El reporte se consume al leerlo — eliminarlo de session para no dejarlo huérfano
    chrome.storage.session.remove(['healthReport'])

    const reporteCargado    = datosReporte.healthReport
    const credencialesSesion = datosSesion.credencialesSesion || []

    // Ocultar estado de carga
    loadingState.classList.add('hidden')

    // Sin reporte: vault bloqueado o acceso directo sin pasar por el vault
    if (!reporteCargado) {
      errorState.classList.remove('hidden')
      return
    }

    // Vault vacío
    if (reporteCargado.total === 0) {
      emptyState.classList.remove('hidden')
      return
    }

    // Reporte disponible — mostrar contenido
    reporte = reporteCargado
    reporteContent.classList.remove('hidden')

    actualizarResumen()
    renderizarLista()

    // Ejecutar verificación HIBP solo si hay credenciales en sesión
    if (credencialesSesion.length > 0) {
      await ejecutarVerificacionHIBP(credencialesSesion)
    } else {
      mostrarBanner('warn', '⚠️', 'Sesión expirada — no se pudo verificar HIBP. Desbloquea el vault e intenta de nuevo.')
    }

  } catch (err) {
    loadingState.classList.add('hidden')
    errorState.classList.remove('hidden')
  }
}

inicializar()
