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
  cargarVaultDescifrado,
} from '../../crypto/engine.js'
import { generarCSVGenerico, generarCSVBitwarden } from '../../export/csv-exporter.js'
import { inicializarWizardImportCSV }              from '../../import/import-wizard.js'
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
import { sincronizar }         from '../../sync/sync-manager.js'
import { navegar }             from '../router.js'

// ── Modal seguro de contraseña (reemplaza prompt() nativo) ──

// Inyecta los estilos del modal una sola vez en el <head>.
// Usa variables CSS del design system para integrarse con el tema de la PWA.
function _inyectarEstilosModal() {
  if (document.getElementById('dpm-pass-modal-styles')) return
  const style = document.createElement('style')
  style.id = 'dpm-pass-modal-styles'
  style.textContent = `
    .dpm-pass-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999}
    .dpm-pass-modal{background:var(--color-surface,#1a1a2e);border:1px solid var(--color-border,rgba(255,255,255,.12));border-radius:12px;padding:24px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:16px;box-shadow:0 8px 32px rgba(0,0,0,.5)}
    .dpm-pass-modal__titulo{color:var(--color-text,#e0e0e0);font-size:.875rem;margin:0;line-height:1.4}
    .dpm-pass-modal__campo{position:relative}
    .dpm-pass-modal__input{width:100%;padding:10px 40px 10px 12px;box-sizing:border-box;background:var(--color-input-bg,rgba(255,255,255,.06));border:1px solid var(--color-border,rgba(255,255,255,.12));border-radius:8px;color:var(--color-text,#e0e0e0);font-size:.9rem}
    .dpm-pass-modal__toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--color-text-secondary,#888);font-size:.85rem;padding:4px;line-height:1}
    .dpm-pass-modal__acciones{display:flex;gap:8px;justify-content:flex-end}
  `
  document.head.appendChild(style)
}

/**
 * Solicita la contraseña maestra mediante un modal seguro con type="password".
 * Retorna la contraseña ingresada, o null si el usuario canceló.
 * Reemplaza prompt() nativo que mostraba la contraseña en texto plano (H-10).
 *
 * @param {string} titulo — texto descriptivo que aparece sobre el input
 * @returns {Promise<string|null>}
 */
function _pedirContrasena(titulo) {
  _inyectarEstilosModal()
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'dpm-pass-overlay'
    overlay.innerHTML = `
      <div class="dpm-pass-modal" role="dialog" aria-modal="true">
        <p class="dpm-pass-modal__titulo">${titulo}</p>
        <div class="dpm-pass-modal__campo">
          <input type="password" class="dpm-pass-modal__input" id="dpm-pass-input"
                 placeholder="Contraseña maestra" autocomplete="current-password">
          <button type="button" class="dpm-pass-modal__toggle" id="dpm-pass-toggle"
                  aria-label="Mostrar u ocultar contraseña">👁</button>
        </div>
        <div class="dpm-pass-modal__acciones">
          <button type="button" class="btn btn--pequeño btn--secundario" id="dpm-pass-cancelar">Cancelar</button>
          <button type="button" class="btn btn--pequeño btn--primario"   id="dpm-pass-ok">Continuar</button>
        </div>
      </div>`
    document.body.appendChild(overlay)

    const input    = overlay.querySelector('#dpm-pass-input')
    const btnOk    = overlay.querySelector('#dpm-pass-ok')
    const btnCan   = overlay.querySelector('#dpm-pass-cancelar')
    const btnToggle = overlay.querySelector('#dpm-pass-toggle')

    // Foco automático en el campo de contraseña
    requestAnimationFrame(() => input.focus())

    const confirmar = () => { overlay.remove(); resolve(input.value || null) }
    const cancelar  = () => { overlay.remove(); resolve(null) }

    btnToggle.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password'
    })
    btnOk.addEventListener('click',  confirmar)
    btnCan.addEventListener('click', cancelar)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  confirmar()
      if (e.key === 'Escape') cancelar()
    })
  })
}

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

  const estaConectadoGoogle    = proveedorSync === 'google-drive'
  const estaConectadoOneDrive  = estaConectadoMicrosoft()

  contenedor.innerHTML = `
    <div class="vista">
      <h1 class="settings__titulo">⚙️ Configuración</h1>

      <!-- ── 1. Contraseña Maestra ── -->
      <p class="seccion-titulo">CONTRASEÑA MAESTRA</p>
      <div class="settings__seccion tarjeta">
        <form id="form-cambiar-pass" novalidate>
          <div class="credform__campos">
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
          <div class="unlock__error alerta--exito oculto" id="pass-exito"
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
            <label class="btn btn--pequeño btn--secundario">
              Importar
              <input type="file" id="input-importar" accept=".json" class="archivo-entrada-oculta">
            </label>
          </div>
        </div>
        <div class="unlock__error oculto" id="backup-msg" role="alert"></div>
      </div>

      <!-- ── 3b. Exportar / Importar CSV ── -->
      <p class="seccion-titulo">EXPORTAR / IMPORTAR CSV</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">Exportar CSV</div>
            <div class="settings__fila-descripcion">Descarga tus credenciales en formato compatible con otros gestores</div>
          </div>
          <div class="settings__fila-accion settings__fila-accion--multiple">
            <button class="btn btn--pequeño btn--secundario" id="btn-exportar-csv-generico" type="button">Genérico</button>
            <button class="btn btn--pequeño btn--secundario" id="btn-exportar-csv-bitwarden" type="button">Bitwarden</button>
          </div>
        </div>
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">Importar CSV</div>
            <div class="settings__fila-descripcion">Importa desde Google PM, Bitwarden, LastPass, 1Password o CSV genérico</div>
          </div>
          <div class="settings__fila-accion">
            <button class="btn btn--pequeño btn--secundario" id="btnAbrirImportarCSV" type="button">Importar</button>
          </div>
        </div>
        <!-- ── Wizard de importación CSV (oculto por defecto) ── -->
        <div id="panelImportarCSV" class="hidden">
          <div class="settings__csv-wizard">
            <label class="campo">
              <span class="campo__etiqueta">Seleccionar archivo CSV</span>
              <input type="file" id="inputArchivoCSV" accept=".csv" class="input">
            </label>
            <div id="grupoFormatoCSV" style="display:none">
              <div id="badgeFormatoCSV" class="import-format-badge"></div>
              <select id="selectFormatoCSV" class="input">
                <option value="">-- Seleccionar formato --</option>
                <option value="google">Google Password Manager</option>
                <option value="bitwarden">Bitwarden</option>
                <option value="lastpass">LastPass</option>
                <option value="1password">1Password</option>
                <option value="generico">CSV Genérico</option>
              </select>
            </div>
            <div id="errorImportarCSV" class="unlock__error oculto" role="alert"></div>
            <div id="grupoAccionesCSV" style="display:none" class="settings__csv-wizard-acciones">
              <button class="btn btn--pequeño btn--primario"   id="btnPrevisualizarCSV"    type="button">Previsualizar importación</button>
              <button class="btn btn--pequeño btn--secundario" id="btnCancelarImportarCSV" type="button">Cancelar</button>
            </div>
            <div id="panelPreviewCSV" class="hidden">
              <div id="resumenPreviewCSV" class="csv-resumen"></div>
              <div class="csv-tabla-scroll">
                <table class="csv-preview-table">
                  <thead>
                    <tr><th>Sitio</th><th>URL</th><th>Usuario</th><th>Contraseña</th><th>Estado</th></tr>
                  </thead>
                  <tbody id="tbodyPreviewCSV"></tbody>
                </table>
              </div>
              <button class="btn btn--pequeño btn--primario" id="btnConfirmarImportarCSV" type="button" disabled>Importar</button>
            </div>
            <div id="successImportarCSV" class="unlock__error alerta--exito oculto" role="status"></div>
          </div>
        </div>
        <div class="unlock__error oculto" id="csv-msg" role="alert"></div>
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
          <div class="settings__fila-accion settings__fila-accion--multiple">
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
          <div class="settings__fila-accion settings__fila-accion--multiple">
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

      <p class="settings__version-pie">
        Dacmos Password Manager · Zero-Knowledge · v0.4.2
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
    const password = await _pedirContrasena('Ingresa tu contraseña maestra para exportar el backup:')
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

    const password = await _pedirContrasena('Ingresa la contraseña maestra del backup:')
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
      console.error('[IMPORT]', err)
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

  // ── Exportar CSV ──
  contenedor.querySelector('#btn-exportar-csv-generico')?.addEventListener('click', async () => {
    const clave = obtenerClave()
    if (!clave) return
    const csvMsg = contenedor.querySelector('#csv-msg')
    try {
      const credenciales = await cargarVaultDescifrado(clave)
      const csv = generarCSVGenerico(credenciales)
      _descargarArchivo(csv, 'text/csv', `dacmos-export-${new Date().toISOString().slice(0,10)}.csv`)
    } catch (_) {
      csvMsg.textContent = 'Error al exportar. Intenta de nuevo.'
      csvMsg.classList.remove('oculto')
    }
  })

  contenedor.querySelector('#btn-exportar-csv-bitwarden')?.addEventListener('click', async () => {
    const clave = obtenerClave()
    if (!clave) return
    const csvMsg = contenedor.querySelector('#csv-msg')
    try {
      const credenciales = await cargarVaultDescifrado(clave)
      const csv = generarCSVBitwarden(credenciales)
      _descargarArchivo(csv, 'text/csv', `dacmos-bitwarden-${new Date().toISOString().slice(0,10)}.csv`)
    } catch (_) {
      csvMsg.textContent = 'Error al exportar. Intenta de nuevo.'
      csvMsg.classList.remove('oculto')
    }
  })

  // ── Import wizard CSV ──
  inicializarWizardImportCSV(contenedor)

  // ── Sync Google Drive ──
  contenedor.querySelector('#btn-conectar-google')?.addEventListener('click', async () => {
    const msgEl = contenedor.querySelector('#sync-msg')
    try {
      await conectarGoogle()
      await idbStorage.set({ syncConfig: { ...syncConf, proveedor: 'google-drive' } })
      // Sincronizar al conectar — proveedor gana en primera sync (D2).
      // Si el sync falla (ej. master password distinta), se ignora aquí
      // y el usuario puede reintentar desde el botón "Sincronizar".
      try { await sincronizar(new GoogleDriveAdapter()) } catch (_) { /* silencioso */ }
      await navegar('#/settings')
    } catch (err) {
      msgEl.textContent = _mensajeErrorSync(err) ?? 'Error al conectar con Google Drive.'
      msgEl.classList.remove('oculto')
    }
  })

  contenedor.querySelector('#btn-sync-google')?.addEventListener('click', async () => {
    const msgEl = contenedor.querySelector('#sync-msg')
    const btn   = contenedor.querySelector('#btn-sync-google')
    btn.disabled    = true
    btn.textContent = 'Sincronizando...'
    try {
      const { resultado } = await sincronizar(new GoogleDriveAdapter())
      msgEl.style.cssText = 'background:rgba(46,204,113,0.1);border-color:rgba(46,204,113,0.3);color:var(--color-success);'
      msgEl.textContent   = _mensajeSyncOk(resultado, 'Google Drive')
      msgEl.classList.remove('oculto')
    } catch (err) {
      msgEl.style.cssText = ''
      msgEl.textContent   = _mensajeErrorSync(err) ?? 'Error al sincronizar con Google Drive.'
      msgEl.classList.remove('oculto')
    } finally {
      btn.disabled    = false
      btn.textContent = 'Sincronizar'
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
      // Sincronizar al conectar — proveedor gana en primera sync (D2).
      try { await sincronizar(new OneDriveAdapter()) } catch (_) { /* silencioso */ }
      await navegar('#/settings')
    } catch (err) {
      msgEl.textContent = _mensajeErrorSync(err) ?? 'Error al conectar con OneDrive.'
      msgEl.classList.remove('oculto')
    }
  })

  contenedor.querySelector('#btn-sync-onedrive')?.addEventListener('click', async () => {
    const msgEl = contenedor.querySelector('#sync-msg')
    const btn   = contenedor.querySelector('#btn-sync-onedrive')
    btn.disabled    = true
    btn.textContent = 'Sincronizando...'
    try {
      const { resultado } = await sincronizar(new OneDriveAdapter())
      msgEl.style.cssText = 'background:rgba(46,204,113,0.1);border-color:rgba(46,204,113,0.3);color:var(--color-success);'
      msgEl.textContent   = _mensajeSyncOk(resultado, 'OneDrive')
      msgEl.classList.remove('oculto')
    } catch (err) {
      msgEl.style.cssText = ''
      msgEl.textContent   = _mensajeErrorSync(err) ?? 'Error al sincronizar con OneDrive.'
      msgEl.classList.remove('oculto')
    } finally {
      btn.disabled    = false
      btn.textContent = 'Sincronizar'
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

/** Descarga un string como archivo en el navegador sin chrome.downloads */
function _descargarArchivo(contenido, tipo, nombre) {
  const blob = new Blob([contenido], { type: tipo })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
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
 * Retorna el mensaje de éxito diferenciado según la operación que ocurrió.
 * Garantiza que el usuario sepa exactamente qué pasó — nunca un mensaje
 * genérico que confirme una operación que no ocurrió.
 *
 * @param {'descargado'|'subido'|'sin_cambios'} resultado
 * @param {string} proveedor — nombre del proveedor (ej. 'Google Drive')
 */
function _mensajeSyncOk(resultado, proveedor) {
  if (resultado === 'descargado')
    return `Vault descargado desde ${proveedor}. Credenciales actualizadas — ve al vault para verlas.`
  if (resultado === 'subido')
    return `Vault subido a ${proveedor}.`
  return 'Sin cambios — el vault ya estaba sincronizado.'
}

/**
 * Traduce errores conocidos a mensajes legibles para el usuario.
 * Retorna null si el error no es un código conocido — el caller usa su
 * mensaje por defecto (ej. 'Error al sincronizar con Google Drive.').
 *
 * Códigos manejados:
 *   GOOGLE_GIS_TIMEOUT                — GIS no cargó en 10s
 *   GOOGLE_AUTH_ERROR:popup_blocked*  — popup de Google bloqueado
 *   MICROSOFT_POPUP_BLOQUEADO         — popup de Microsoft bloqueado
 *   SYNC_MASTER_PASSWORD_MISMATCH     — vault del proveedor usa otra contraseña
 */
function _mensajeErrorSync(err) {
  const msg = err?.message ?? ''
  if (msg === 'GOOGLE_GIS_TIMEOUT')
    return 'Google Auth no disponible. Comprueba tu conexión a internet.'
  if (msg.includes('popup_blocked'))
    return 'Popup bloqueado por el navegador. Desconecta y vuelve a conectar para autenticarte.'
  if (msg === 'MICROSOFT_POPUP_BLOQUEADO')
    return 'Popup bloqueado por el navegador. Desconecta y vuelve a conectar para autenticarte.'
  if (msg === 'SYNC_MASTER_PASSWORD_MISMATCH')
    return 'El vault en el proveedor fue creado con una contraseña diferente. No es posible sincronizar.'
  return null
}
