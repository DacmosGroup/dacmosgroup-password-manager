/**
 * router.js — Router hash-based para la PWA (SPA)
 *
 * Rutas soportadas:
 *   #/setup           Configuración inicial del vault
 *   #/unlock          Desbloqueo con contraseña maestra
 *   #/vault           Lista de credenciales (vista principal)
 *   #/health          Password Health dashboard
 *   #/generator       Generador de contraseñas
 *   #/settings        Configuración y opciones
 *   #/credential-form Añadir/editar credencial
 *
 * Pila de navegación mínima (Condición 2 de la aprobación):
 *   navegar(ruta) → push a _historial + montar vista
 *   atras()       → pop de _historial + montar vista anterior
 *   Si _historial vacío → navegar a #/vault
 *
 * credential-form.js llama siempre a atras() al Guardar o Cancelar,
 * lo que garantiza que siempre vuelve a #/vault.
 */

import { montar as montarSetup }     from './views/setup.js'
import { montar as montarUnlock }    from './views/unlock.js'
import { montar as montarVault }     from './views/vault.js'
import { montar as montarHealth }    from './views/health.js'
import { montar as montarGenerator } from './views/generator.js'
import { montar as montarSettings }  from './views/settings.js'
import { montar as montarCredForm }  from './views/credential-form.js'

// Pila de historial de rutas visitadas (para el botón "atrás")
let _historial = []

// Estado opcional que una vista puede pasar a la siguiente
// (ej. la credencial a editar al navegar a credential-form)
let _estado = null

// Mapa de ruta → función de montaje de vista
const _rutas = {
  '#/setup':           montarSetup,
  '#/unlock':          montarUnlock,
  '#/vault':           montarVault,
  '#/health':          montarHealth,
  '#/generator':       montarGenerator,
  '#/settings':        montarSettings,
  '#/credential-form': montarCredForm,
}

/** Retorna la ruta activa actual según el hash del URL */
export function rutaActual() {
  return window.location.hash || '#/vault'
}

/** Retorna el estado pasado por la vista anterior (o null) */
export function obtenerEstado() {
  return _estado
}

/**
 * Navega a una ruta, opcionalmente con estado para la vista destino.
 * Registra la ruta actual en el historial antes de navegar.
 * @param {string} ruta
 * @param {*} [estado] - Datos opcionales para la vista (ej. credencial a editar)
 */
export async function navegar(ruta, estado = null) {
  const rulaAnterior = rutaActual()
  _historial.push(rulaAnterior)
  _estado = estado

  if (window.location.hash === ruta) {
    // El hash no cambia → hashchange no se dispara → montar manualmente
    await _montarVista(ruta)
  } else {
    window.location.hash = ruta
    // El evento hashchange dispara _montarVista
  }
}

/**
 * Vuelve a la vista anterior en el historial.
 * Si el historial está vacío, navega a #/vault (fallback seguro).
 */
export async function atras() {
  const rutaAnterior = _historial.pop() ?? '#/vault'
  _estado = null

  if (window.location.hash === rutaAnterior) {
    await _montarVista(rutaAnterior)
  } else {
    window.location.hash = rutaAnterior
  }
}

/**
 * Monta la vista correspondiente a una ruta en el contenedor #app.
 * Llamada tanto desde navegar() como desde el listener hashchange.
 * @param {string} ruta
 */
async function _montarVista(ruta) {
  const contenedor = document.getElementById('app')
  if (!contenedor) return

  const montarFn = _rutas[ruta]
  if (!montarFn) {
    // Ruta desconocida → redireccionar a vault como fallback
    await navegar('#/vault')
    return
  }

  try {
    await montarFn(contenedor)
  } catch (error) {
    console.error(`Error al montar la vista ${ruta}:`, error)
    contenedor.innerHTML = `
      <div class="vista vista--error">
        <p class="error-texto">Error al cargar la vista. Recarga la página.</p>
      </div>`
  }
}

// Escuchar cambios de hash para soportar el botón Atrás del browser
window.addEventListener('hashchange', () => {
  _montarVista(rutaActual())
})

// Exportar para que app.js pueda inicializar la vista inicial sin duplicar lógica
export { _montarVista as montarVistaInicial }
