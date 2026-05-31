/**
 * settings.js — Vista de configuración (F4.4 + F4.5)
 *
 * Secciones:
 *   1. Contraseña maestra (cambiar)
 *   2. Bloqueo automático (solo informativo en PWA v0.4.0)
 *   3. Portapapeles
 *   4. Backup (exportar / importar)
 *   5. Sincronización (Google Drive / OneDrive)
 *   6. Almacenamiento (F4.5) — estado de persistencia + uso
 *
 * Si la sesión no está activa, redirige a #/unlock.
 */

import {
  cambiarMasterPassword,
  exportarVaultBackup,
  importarVaultBackup,
} from '../../crypto/engine.js'
import { idbStorage }          from '../../storage/indexeddb-adapter.js'
import { verificarPersistencia } from '../../storage/persistence-manager.js'
import {
  sesionActiva, obtenerClave,
  establecerClave, limpiarSesion,
} from '../../storage/session.js'
import { conectar as conectarGoogle, desconectar as desconectarGoogle } from '../../auth/google-auth.js'
import { conectar as conectarMicrosoft, desconectar as desconectarMicrosoft, estaConectado as estaConectadoMicrosoft } from '../../auth/microsoft-auth.js'
import { GoogleDriveAdapter }  from '../../sync/google-drive-adapter.js'
import { OneDriveAdapter }     from '../../sync/onedrive-adapter.js'
import { navegar }             from '../router.js'

/** Monta la vista de settings en el contenedor dado */
export async function montar(contenedor) {
  if (!sesionActiva()) {
    await navegar('#/unlock')
    return
  }

  // Carga asíncrona del estado antes de renderizar
  const [persistencia, syncConfig] = await Promise.all([
    verificarPersistencia(),
    idbStorage.get(['syncConfig', 'config']),
  ])

  const configActual  = syncConfig.config  ?? {}
  const syncConf      = syncConfig.syncConfig ?? {}
  const proveedorSync = syncConf.proveedor ?? null

  const estaConectadoGoogle    = proveedorSync === 'google'
  const estaConectadoOneDrive  = estaConectadoMicrosoft()

  contenedor.innerHTML = `
    <div class="vista">
      <h1 style="margin-bottom:1.5rem;">⚙️ Configuración</h1>

      <!-- ── 1. Contraseña Maestra ── -->
      <p class="seccion-titulo">CONTRASEÑA MAESTRA</p>
      <div class="settings__seccion tarjeta">
        <form id="form-cambiar-pass" novalidate>
          <div class="credform__campos" style="margin-bottom:1rem;">
            <div class="campo">
              <label for="s-pass-actual">Contraseña actual</label>
              <input type="password" id="s-pass-actual" class="input" autocomplete="current-password">
            </div>
            <div class="campo">
              <label for="s-pass-nueva">Nueva contraseña</label>
              <input type="password" id="s-pass-nueva" class="input" autocomplete="new-password">
            </div>
            <div class="campo">
              <label for="s-pass-confirmar">Confirmar nueva contraseña</label>
              <input type="password" id="s-pass-confirmar" class="input" autocomplete="new-password">
            </div>
          </div>
          <div class="unlock__error oculto" id="pass-error" role="alert"></div>
          <div class="unlock__error oculto" id="pass-exito"
               style="background:rgba(46,204,113,0.1);border-color:rgba(46,204,113,0.3);color:var(--color-success);"
               role="status"></div>
          <button type="submit" class="btn btn--primario" id="btn-cambiar-pass">Cambiar contraseña</button>
        </form>
      </div>

      <!-- ── 2. Portapapeles ── -->
      <p class="seccion-titulo">PORTAPAPELES</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">Limpiar portapapeles</div>
            <div class="settings__fila-descripcion">Borrar automáticamente el portapapeles tras copiar una contraseña</div>
          </div>
          <div class="settings__fila-accion">
            <label class="toggle">
              <input type="checkbox" id="s-limpiar-clip" ${configActual.limpiarPortapapeles !== false ? 'checked' : ''} aria-label="Limpiar portapapeles">
              <span class="toggle__slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- ── 3. Backup ── -->
      <p class="seccion-titulo">BACKUP</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">Exportar backup</div>
            <div class="settings__fila-descripcion">Descarga un archivo cifrado con tu vault completo</div>
          </div>
          <div class="settings__fila-accion">
            <button class="btn btn--pequeño btn--secundario" id="btn-exportar" type="button">Exportar</button>
          </div>
        </div>
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">Importar backup</div>
            <div class="settings__fila-descripcion">Restaura un vault desde un archivo de backup</div>
          </div>
          <div class="settings__fila-accion">
            <label class="btn btn--pequeño btn--secundario" style="cursor:pointer;">
              Importar
              <input type="file" id="input-importar" accept=".json" style="display:none;">
            </label>
          </div>
        </div>
        <div class="unlock__error oculto" id="backup-msg" role="alert"></div>
      </div>

      <!-- ── 4. Sincronización ── -->
      <p class="seccion-titulo" id="seccion-sync">SINCRONIZACIÓN</p>
      <div class="settings__seccion tarjeta">
        <!-- Google Drive -->
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">Google Drive</div>
            <div class="settings__fila-descripcion">
              ${estaConectadoGoogle ? '✅ Conectado' : 'Sin conexión'}
            </div>
          </div>
          <div class="settings__fila-accion" style="display:flex;gap:0.5rem;">
            ${estaConectadoGoogle
              ? `<button class="btn btn--pequeño btn--secundario" id="btn-sync-google" type="button">Sincronizar</button>
                 <button class="btn btn--pequeño btn--peligro"   id="btn-desconectar-google" type="button">Desconectar</button>`
              : `<button class="btn btn--pequeño btn--primario"  id="btn-conectar-google" type="button">Conectar</button>`
            }
          </div>
        </div>
        <!-- OneDrive -->
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">Microsoft OneDrive</div>
            <div class="settings__fila-descripcion">
              ${estaConectadoOneDrive ? '✅ Conectado' : 'Sin conexión'}
            </div>
          </div>
          <div class="settings__fila-accion" style="display:flex;gap:0.5rem;">
            ${estaConectadoOneDrive
              ? `<button class="btn btn--pequeño btn--secundario" id="btn-sync-onedrive" type="button">Sincronizar</button>
                 <button class="btn btn--pequeño btn--peligro"   id="btn-desconectar-onedrive" type="button">Desconectar</button>`
              : `<button class="btn btn--pequeño btn--primario"  id="btn-conectar-onedrive" type="button">Conectar</button>`
            }
          </div>
        </div>
        <div class="unlock__error oculto" id="sync-msg" role="alert"></div>
      </div>

      <!-- ── 5. Almacenamiento (F4.5) ── -->
      <p class="seccion-titulo">ALMACENAMIENTO</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__estado-persistencia">
          ${persistencia.persistente
            ? '✅ <strong>Almacenamiento protegido</strong> — tu vault no será borrado automáticamente'
            : persistencia.soportada
              ? '⚠️ <strong>Almacenamiento evictable</strong> — <a href="#" id="link-activar-sync">activa la sincronización</a> para proteger tu vault en iOS'
              : 'ℹ️ Estado de persistencia no disponible en este navegador'
          }
        </div>
        ${persistencia.soportada ? `
        <p class="settings__uso-storage">
          Almacenamiento: ${_formatearBytes(persistencia.usoBytes)} usados
          de ${_formatearBytes(persistencia.cuotaBytes)} disponibles
        </p>` : ''}
      </div>

      <!-- ── Sesión ── -->
      <p class="seccion-titulo">SESIÓN</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">Bloquear vault</div>
            <div class="settings__fila-descripcion">Cerrar sesión y limpiar credenciales de la memoria</div>
          </div>
          <div class="settings__fila-accion">
            <button class="btn btn--pequeño btn--peligro" id="btn-bloquear" type="button">Bloquear</button>
          </div>
        </div>
      </div>

      <p style="text-align:center;font-size:0.75rem;color:var(--color-muted);margin-top:1.5rem;">
        Dacmos Password Manager · Zero-Knowledge · v0.4.0
      </p>
    </div>`

  // ── Cambiar contraseña maestra ──
  contenedor.querySelector('#form-cambiar-pass').addEventListener('submit', async (e) => {
    e.preventDefault()
    const actual    = contenedor.querySelector('#s-pass-actual').value
    const nueva     = contenedor.querySelector('#s-pass-nueva').value
    const confirmar = contenedor.querySelector('#s-pass-confirmar').value
    const errEl     = contenedor.querySelector('#pass-error')
    const exitoEl   = contenedor.querySelector('#pass-exito')
    errEl.classList.add('oculto')
    exitoEl.classList.add('oculto')

    if (nueva.length < 8) {
      errEl.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.'
      errEl.classList.remove('oculto'); return
    }
    if (nueva !== confirmar) {
      errEl.textContent = 'Las contraseñas nuevas no coinciden.'
      errEl.classList.remove('oculto'); return
    }

    const btn = contenedor.querySelector('#btn-cambiar-pass')
    btn.disabled = true; btn.textContent = 'Cambiando...'
    try {
      const claveNueva = await cambiarMasterPassword(actual, nueva)
      establecerClave(claveNueva)
      exitoEl.textContent = 'Contraseña cambiada exitosamente.'
      exitoEl.classList.remove('oculto')
      contenedor.querySelector('#s-pass-actual').value  = ''
      contenedor.querySelector('#s-pass-nueva').value   = ''
      contenedor.querySelector('#s-pass-confirmar').value = ''
    } catch (err) {
      errEl.textContent = err.message === 'PASSWORD_INCORRECTA'
        ? 'Contraseña actual incorrecta.'
        : 'Error al cambiar contraseña. Intenta de nuevo.'
      errEl.classList.remove('oculto')
    } finally {
      btn.disabled = false; btn.textContent = 'Cambiar contraseña'
    }
  })

  // ── Exportar backup ──
  contenedor.querySelector('#btn-exportar')?.addEventListener('click', async () => {
    const password = prompt('Ingresa tu contraseña maestra para exportar el backup:')
    if (!password) return
    const backupMsg = contenedor.querySelector('#backup-msg')
    try {
      const backup   = await exportarVaultBackup(password)
      const json     = JSON.stringify(backup, null, 2)
      const blob     = new Blob([json], { type: 'application/json' })
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = `dacmos-backup-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (_) {
      backupMsg.textContent = 'Error al exportar. Verifica tu contraseña.'
      backupMsg.classList.remove('oculto')
    }
  })

  // ── Importar backup ──
  contenedor.querySelector('#input-importar')?.addEventListener('change', async (e) => {
    const archivo   = e.target.files?.[0]
    const backupMsg = contenedor.querySelector('#backup-msg')
    if (!archivo) return

    const password = prompt('Ingresa la contraseña maestra del backup:')
    if (!password) { e.target.value = ''; return }

    // Bloquear el input mientras dura el import (evita doble submit)
    e.target.disabled = true

    try {
      const texto  = await archivo.text()
      const backup = JSON.parse(texto)

      // Mostrar indicador de progreso antes de la primera derivación PBKDF2
      backupMsg.style.cssText = ''
      backupMsg.textContent   = 'Importando... (1/3)'
      backupMsg.classList.remove('oculto')

      const total = await importarVaultBackup(backup, password, {
        onProgreso: (paso, totalPasos) => {
          backupMsg.textContent = `Importando... (${paso}/${totalPasos})`
        },
      })

      backupMsg.style.cssText = 'background:rgba(46,204,113,0.1);border-color:rgba(46,204,113,0.3);color:var(--color-success);'
      backupMsg.textContent   = `Backup importado: ${total} credenciales.`
    } catch (err) {
      backupMsg.style.cssText = ''
      backupMsg.textContent   =
        err.message === 'PASSWORD_INCORRECTA'
          ? 'Contraseña incorrecta para este backup.'
          : err.message === 'IMPORT_PASSWORD_MISMATCH'
            ? 'La contraseña del backup no coincide con la contraseña actual del vault.'
            : err.message === 'BACKUP_INVALIDO'
              ? 'El archivo seleccionado no es un backup válido de Dacmos PM.'
              : 'Error al importar el backup.'
      backupMsg.classList.remove('oculto')
    } finally {
      e.target.value    = ''     // permite re-seleccionar el mismo archivo
      e.target.disabled = false
    }
  })

  // ── Sync Google Drive ──
  contenedor.querySelector('#btn-conectar-google')?.addEventListener('click', async () => {
    const msgEl = contenedor.querySelector('#sync-msg')
    try {
      await conectarGoogle()
      await idbStorage.set({ syncConfig: { ...syncConf, proveedor: 'google' } })
      await navegar('#/settings')  // recargar la vista
    } catch (err) {
      msgEl.textContent = _mensajeErrorSync(err) ?? 'Error al conectar con Google Drive.'
      msgEl.classList.remove('oculto')
    }
  })

  contenedor.querySelector('#btn-sync-google')?.addEventListener('click', async () => {
    const msgEl = contenedor.querySelector('#sync-msg')
    try {
      const adapter    = new GoogleDriveAdapter()
      const datosLocal = await idbStorage.get(['vaultCifrado'])
      if (datosLocal.vaultCifrado) await adapter.guardar(datosLocal.vaultCifrado)
      msgEl.style.cssText = 'background:rgba(46,204,113,0.1);border-color:rgba(46,204,113,0.3);color:var(--color-success);'
      msgEl.textContent   = 'Sincronizado con Google Drive.'
      msgEl.classList.remove('oculto')
    } catch (err) {
      msgEl.style.cssText = ''
      msgEl.textContent   = _mensajeErrorSync(err) ?? 'Error al sincronizar con Google Drive.'
      msgEl.classList.remove('oculto')
    }
  })

  contenedor.querySelector('#btn-desconectar-google')?.addEventListener('click', async () => {
    await desconectarGoogle()
    await idbStorage.set({ syncConfig: { ...syncConf, proveedor: null, fileId: null } })
    await navegar('#/settings')
  })

  // ── Sync OneDrive ──
  contenedor.querySelector('#btn-conectar-onedrive')?.addEventListener('click', async () => {
    const msgEl = contenedor.querySelector('#sync-msg')
    try {
      await conectarMicrosoft()
      await navegar('#/settings')
    } catch (err) {
      msgEl.textContent = _mensajeErrorSync(err) ?? 'Error al conectar con OneDrive.'
      msgEl.classList.remove('oculto')
    }
  })

  contenedor.querySelector('#btn-sync-onedrive')?.addEventListener('click', async () => {
    const msgEl = contenedor.querySelector('#sync-msg')
    try {
      const adapter    = new OneDriveAdapter()
      const datosLocal = await idbStorage.get(['vaultCifrado'])
      if (datosLocal.vaultCifrado) await adapter.guardar(datosLocal.vaultCifrado)
      msgEl.style.cssText = 'background:rgba(46,204,113,0.1);border-color:rgba(46,204,113,0.3);color:var(--color-success);'
      msgEl.textContent   = 'Sincronizado con OneDrive.'
      msgEl.classList.remove('oculto')
    } catch (err) {
      msgEl.style.cssText = ''
      msgEl.textContent   = _mensajeErrorSync(err) ?? 'Error al sincronizar con OneDrive.'
      msgEl.classList.remove('oculto')
    }
  })

  contenedor.querySelector('#btn-desconectar-onedrive')?.addEventListener('click', async () => {
    await desconectarMicrosoft()
    await navegar('#/settings')
  })

  // ── Link a sync desde sección Almacenamiento (F4.5) ──
  contenedor.querySelector('#link-activar-sync')?.addEventListener('click', (e) => {
    e.preventDefault()
    contenedor.querySelector('#seccion-sync')?.scrollIntoView({ behavior: 'smooth' })
  })

  // ── Toggle portapapeles ──
  contenedor.querySelector('#s-limpiar-clip').addEventListener('change', async (e) => {
    await idbStorage.set({ config: { ...configActual, limpiarPortapapeles: e.target.checked } })
  })

  // ── Bloquear vault ──
  contenedor.querySelector('#btn-bloquear').addEventListener('click', () => {
    limpiarSesion()
    navegar('#/unlock')
  })
}

/** Formatea bytes en una cadena legible (B, KB, MB) */
function _formatearBytes(bytes) {
  if (!bytes || bytes === 0) return '0 KB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(2)} MB`
  const kb = bytes / 1024
  return `${Math.round(kb)} KB`
}

/**
 * Traduce errores de auth conocidos a mensajes legibles para el usuario.
 * Retorna null si el error no es un código conocido — el caller usa su
 * mensaje por defecto (ej. 'Error al sincronizar con Google Drive.').
 *
 * Códigos manejados:
 *   GOOGLE_GIS_TIMEOUT               — GIS no cargó en 10s
 *   GOOGLE_AUTH_ERROR:popup_blocked* — popup de Google bloqueado
 *   MICROSOFT_POPUP_BLOQUEADO        — popup de Microsoft bloqueado
 */
function _mensajeErrorSync(err) {
  const msg = err?.message ?? ''
  if (msg === 'GOOGLE_GIS_TIMEOUT')
    return 'Google Auth no disponible. Comprueba tu conexión a internet.'
  if (msg.includes('popup_blocked'))
    return 'Popup bloqueado por el navegador. Desconecta y vuelve a conectar para autenticarte.'
  if (msg === 'MICROSOFT_POPUP_BLOQUEADO')
    return 'Popup bloqueado por el navegador. Desconecta y vuelve a conectar para autenticarte.'
  return null
}
