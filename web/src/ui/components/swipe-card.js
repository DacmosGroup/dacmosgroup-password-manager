/**
 * swipe-card.js — Gesto swipe horizontal para cards de credenciales
 *
 * Implementación con Pointer Events API (W3C standard, no Touch Events).
 * Funciona con touch, mouse y stylus sin dependencias externas.
 * Compatible con iOS Safari 13+ y Chrome Android.
 *
 * Estructura HTML requerida:
 *   <div class="card" data-id="<uuid>">
 *     <div class="card__contenido">...</div>
 *     <div class="card__acciones">
 *       <button class="card__accion card__accion--editar">Editar</button>
 *       <button class="card__accion card__accion--eliminar">Eliminar</button>
 *     </div>
 *   </div>
 *
 * Comportamiento:
 *   Swipe > UMBRAL_PX izquierda → añade .card--swiped (CSS revela botones)
 *   Swipe < UMBRAL_PX o pointercancel → resetea con transición suave 0.2s
 */

const UMBRAL_PX  = 70   // píxeles para activar el swipe
const OFFSET_MAX = 120  // desplazamiento máximo al activar (ancho de los botones)

/**
 * Activa el comportamiento de swipe en un elemento card.
 *
 * @param {HTMLElement} card - El elemento .card
 * @param {{ onEditar?: (id: string) => void, onEliminar?: (id: string) => void }} manejadores
 */
export function activarSwipe(card, manejadores) {
  const contenido = card.querySelector('.card__contenido')
  const id        = card.dataset.id

  let startX   = 0
  let currentX = 0
  let activo   = false
  let swiped   = false

  // ── Helpers de transición visual ──

  function resetear() {
    contenido.style.transition = 'transform 0.2s ease'
    contenido.style.transform  = 'translateX(0)'
    card.classList.remove('card--swiped')
    swiped = false
  }

  function confirmarSwipe() {
    contenido.style.transition = 'transform 0.2s ease'
    contenido.style.transform  = `translateX(-${OFFSET_MAX}px)`
    card.classList.add('card--swiped')
    swiped = true
  }

  // ── Pointer Events ──

  card.addEventListener('pointerdown', (e) => {
    // Ignorar botones que no sean el principal (botón izquierdo / primer dedo)
    if (e.button !== 0 && e.pointerType !== 'touch') return
    // Si el press cae sobre los botones de acción, no capturar — el click
    // debe fluir naturalmente al botón sin ser redirigido a card por setPointerCapture
    if (e.target.closest('.card__acciones')) return
    startX   = e.clientX
    currentX = e.clientX
    activo   = true
    // setPointerCapture garantiza que pointermove y pointerup lleguen
    // aunque el puntero salga del elemento durante el gesto
    card.setPointerCapture(e.pointerId)
    contenido.style.transition = 'none'  // sin transición durante el arrastre
  })

  card.addEventListener('pointermove', (e) => {
    if (!activo) return
    currentX    = e.clientX
    const delta = currentX - startX

    // Solo swipe hacia la izquierda (delta negativo)
    if (delta >= 0) {
      contenido.style.transform = 'translateX(0)'
      return
    }
    // Limitar al máximo visible para que los botones no queden cortados
    const offset = Math.max(delta, -OFFSET_MAX)
    contenido.style.transform = `translateX(${offset}px)`
  })

  card.addEventListener('pointerup', () => {
    if (!activo) return
    activo      = false
    const delta = currentX - startX

    if (delta < -UMBRAL_PX) {
      confirmarSwipe()
    } else {
      const wasSwiped = swiped  // capturar antes de que resetear() borre el estado
      resetear()
      // Tap limpio (≤8px de jitter) sobre card no-swiped → navegar a edición
      if (!wasSwiped && Math.abs(delta) < 8) {
        manejadores.onEditar?.(id)
      }
    }
  })

  // pointercancel: el sistema tomó control del puntero (scroll, notificación, etc.)
  card.addEventListener('pointercancel', () => {
    activo = false
    resetear()
  })

  // ── Botones de acción (capa trasera) ──

  const btnEditar = card.querySelector('.card__accion--editar')
  if (btnEditar) {
    btnEditar.addEventListener('click', (e) => {
      e.stopPropagation()
      resetear()
      manejadores.onEditar?.(id)
    })
  }

  const btnEliminar = card.querySelector('.card__accion--eliminar')
  if (btnEliminar) {
    btnEliminar.addEventListener('click', (e) => {
      e.stopPropagation()
      resetear()
      manejadores.onEliminar?.(id)
    })
  }

}
