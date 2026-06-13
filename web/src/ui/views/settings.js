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
import * as autoLock           from '../../auto-lock/auto-lock-manager.js'
import { initI18n, t }         from '../../i18n/i18n.js'
import {
  esBiometriaDisponible,
  hayBiometriaConfigurada,
  configurarBiometria,
  desactivarBiometria,
} from '../../crypto/biometric-bridge.js'

// ── Modal seguro de contraseña (reemplaza prompt() nativo) ──

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
                 placeholder="${t('settings.modal.placeholder')}" autocomplete="current-password">
          <button type="button" class="dpm-pass-modal__toggle" id="dpm-pass-toggle"
                  aria-label="${t('settings.modal.aria.toggle')}">👁</button>
        </div>
        <div class="dpm-pass-modal__acciones">
          <button type="button" class="btn btn--pequeño btn--secundario" id="dpm-pass-cancelar">${t('settings.modal.btn.cancel')}</button>
          <button type="button" class="btn btn--pequeño btn--primario"   id="dpm-pass-ok">${t('settings.modal.btn.continue')}</button>
        </div>
      </div>`
    document.body.appendChild(overlay)

    const input    = overlay.querySelector('#dpm-pass-input')
    const btnOk    = overlay.querySelector('#dpm-pass-ok')
    const btnCan   = overlay.querySelector('#dpm-pass-cancelar')
    const btnToggle = overlay.querySelector('#dpm-pass-toggle')

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

  const [persistencia, syncConfig, bioDisponible, bioConfigurada] = await Promise.all([
    verificarPersistencia(),
    idbStorage.get(['syncConfig', 'config']),
    esBiometriaDisponible(),
    hayBiometriaConfigurada(),
  ])

  // Versión leída del manifest (fuente única de verdad — paridad con la
  // Extension que usa chrome.runtime.getManifest().version). Evita el drift
  // del literal hardcodeado que mostró v0.4.3 hasta v0.5.1.
  const versionApp = await _leerVersionManifest()

  const configActual  = syncConfig.config  ?? {}
  const syncConf      = syncConfig.syncConfig ?? {}
  const proveedorSync = syncConf.proveedor ?? null
  const idiomaActual  = configActual.idioma ?? 'auto'

  const estaConectadoGoogle    = proveedorSync === 'google-drive'
  const estaConectadoOneDrive  = estaConectadoMicrosoft()

  const _btnIdioma = (val, label) => {
    const activo = idiomaActual === val
    return `<button type="button" class="btn btn--pequeño ${activo ? 'btn--primario' : 'btn--secundario'}" data-idioma="${val}">${label}</button>`
  }

  contenedor.innerHTML = `
    <div class="vista">
      <h1 class="settings__titulo">${t('settings.titulo')}</h1>

      <!-- ── 0. Idioma ── -->
      <p class="seccion-titulo">${t('settings.section.language')}</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__fila-info" style="margin-bottom:12px">
          <div class="settings__fila-titulo">${t('settings.language.title')}</div>
          <div class="settings__fila-descripcion">${t('settings.language.desc')}</div>
        </div>
        <div class="settings__idioma-selector" id="idioma-selector">
          ${_btnIdioma('auto', t('settings.language.auto'))}
          ${_btnIdioma('es',    'Español')}
          ${_btnIdioma('en',    'English')}
          ${_btnIdioma('pt_BR', 'Português')}
        </div>
      </div>

      <!-- ── 1. Contraseña Maestra ── -->
      <p class="seccion-titulo">${t('settings.section.master')}</p>
      <div class="settings__seccion tarjeta">
        <form id="form-cambiar-pass" novalidate>
          <div class="credform__campos">
            <div class="campo">
              <label for="s-pass-actual">${t('settings.master.label.current')}</label>
              <input type="password" id="s-pass-actual" class="input" autocomplete="current-password">
            </div>
            <div class="campo">
              <label for="s-pass-nueva">${t('settings.master.label.new')}</label>
              <input type="password" id="s-pass-nueva" class="input" autocomplete="new-password">
            </div>
            <div class="campo">
              <label for="s-pass-confirmar">${t('settings.master.label.confirm')}</label>
              <input type="password" id="s-pass-confirmar" class="input" autocomplete="new-password">
            </div>
          </div>
          <div class="unlock__error oculto" id="pass-error" role="alert"></div>
          <div class="unlock__error alerta--exito oculto" id="pass-exito" role="status"></div>
          <button type="submit" class="btn btn--primario" id="btn-cambiar-pass">${t('settings.master.btn.change')}</button>
        </form>
      </div>

      <!-- ── 2. Portapapeles ── -->
      <p class="seccion-titulo">${t('settings.section.clipboard')}</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">${t('settings.clipboard.title')}</div>
            <div class="settings__fila-descripcion">${t('settings.clipboard.desc')}</div>
          </div>
          <div class="settings__fila-accion">
            <label class="toggle">
              <input type="checkbox" id="s-limpiar-clip"
                     ${configActual.limpiarPortapapeles !== false ? 'checked' : ''}
                     aria-label="${t('settings.clipboard.aria')}">
              <span class="toggle__slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- ── 2b. Bloqueo automático (F5-A) ── -->
      <p class="seccion-titulo">${t('settings.section.autolock')}</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">${t('settings.autolock.title')}</div>
            <div class="settings__fila-descripcion">${t('settings.autolock.desc')}</div>
          </div>
          <div class="settings__fila-accion">
            <select id="s-auto-lock" class="input">
              <option value="1"  ${(configActual.autoLock ?? 5) === 1  ? 'selected' : ''}>${t('settings.autolock.1m')}</option>
              <option value="5"  ${(configActual.autoLock ?? 5) === 5  ? 'selected' : ''}>${t('settings.autolock.5m')}</option>
              <option value="15" ${(configActual.autoLock ?? 5) === 15 ? 'selected' : ''}>${t('settings.autolock.15m')}</option>
              <option value="30" ${(configActual.autoLock ?? 5) === 30 ? 'selected' : ''}>${t('settings.autolock.30m')}</option>
              <option value="60" ${(configActual.autoLock ?? 5) === 60 ? 'selected' : ''}>${t('settings.autolock.1h')}</option>
              <option value="0"  ${(configActual.autoLock ?? 5) === 0  ? 'selected' : ''}>${t('settings.autolock.never')}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- ── 3. Backup ── -->
      <p class="seccion-titulo">${t('settings.section.backup')}</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">${t('settings.backup.export.title')}</div>
            <div class="settings__fila-descripcion">${t('settings.backup.export.desc')}</div>
          </div>
          <div class="settings__fila-accion">
            <button class="btn btn--pequeño btn--secundario" id="btn-exportar" type="button">${t('common.export')}</button>
          </div>
        </div>
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">${t('settings.backup.import.title')}</div>
            <div class="settings__fila-descripcion">${t('settings.backup.import.desc')}</div>
          </div>
          <div class="settings__fila-accion">
            <label class="btn btn--pequeño btn--secundario">
              ${t('common.import.btn')}
              <input type="file" id="input-importar" accept=".json" class="archivo-entrada-oculta">
            </label>
          </div>
        </div>
        <div class="unlock__error oculto" id="backup-msg" role="alert"></div>
      </div>

      <!-- ── 3b. Exportar / Importar CSV ── -->
      <p class="seccion-titulo">${t('settings.section.csv')}</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">${t('settings.csv.export.title')}</div>
            <div class="settings__fila-descripcion">${t('settings.csv.export.desc')}</div>
          </div>
          <div class="settings__fila-accion settings__fila-accion--multiple">
            <button class="btn btn--pequeño btn--secundario" id="btn-exportar-csv-generico" type="button">${t('settings.csv.btn.generic')}</button>
            <button class="btn btn--pequeño btn--secundario" id="btn-exportar-csv-bitwarden" type="button">${t('settings.csv.btn.bitwarden')}</button>
          </div>
        </div>
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">${t('settings.csv.import.title')}</div>
            <div class="settings__fila-descripcion">${t('settings.csv.import.desc')}</div>
          </div>
          <div class="settings__fila-accion">
            <button class="btn btn--pequeño btn--secundario" id="btnAbrirImportarCSV" type="button">${t('common.import.btn')}</button>
          </div>
        </div>
        <!-- ── Wizard de importación CSV (oculto por defecto) ── -->
        <div id="panelImportarCSV" class="hidden">
          <div class="settings__csv-wizard">
            <label class="campo">
              <span class="campo__etiqueta">${t('settings.csv.file.label')}</span>
              <input type="file" id="inputArchivoCSV" accept=".csv" class="input">
            </label>
            <div id="grupoFormatoCSV" style="display:none">
              <div id="badgeFormatoCSV" class="import-format-badge"></div>
              <select id="selectFormatoCSV" class="input">
                <option value="">${t('settings.csv.format.auto')}</option>
                <option value="google">Google Password Manager</option>
                <option value="bitwarden">Bitwarden</option>
                <option value="lastpass">LastPass</option>
                <option value="1password">1Password</option>
                <option value="generico">${t('settings.csv.format.generic')}</option>
              </select>
            </div>
            <div id="errorImportarCSV" class="unlock__error oculto" role="alert"></div>
            <div id="grupoAccionesCSV" style="display:none" class="settings__csv-wizard-acciones">
              <button class="btn btn--pequeño btn--primario"   id="btnPrevisualizarCSV"    type="button">${t('settings.csv.btn.preview')}</button>
              <button class="btn btn--pequeño btn--secundario" id="btnCancelarImportarCSV" type="button">${t('common.cancel')}</button>
            </div>
            <div id="panelPreviewCSV" class="hidden">
              <div id="resumenPreviewCSV" class="csv-resumen"></div>
              <div class="csv-tabla-scroll">
                <table class="csv-preview-table">
                  <thead>
                    <tr>
                      <th>${t('settings.csv.table.site')}</th>
                      <th>${t('settings.csv.table.url')}</th>
                      <th>${t('settings.csv.table.user')}</th>
                      <th>${t('settings.csv.table.password')}</th>
                      <th>${t('settings.csv.table.status')}</th>
                    </tr>
                  </thead>
                  <tbody id="tbodyPreviewCSV"></tbody>
                </table>
              </div>
              <button class="btn btn--pequeño btn--primario" id="btnConfirmarImportarCSV" type="button" disabled>${t('common.import.btn')}</button>
            </div>
            <div id="successImportarCSV" class="unlock__error alerta--exito oculto" role="status"></div>
          </div>
        </div>
        <div class="unlock__error oculto" id="csv-msg" role="alert"></div>
      </div>

      <!-- ── 4. Sincronización ── -->
      <p class="seccion-titulo" id="seccion-sync">${t('settings.section.sync')}</p>
      <div class="settings__seccion tarjeta">
        <!-- Google Drive -->
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">${t('settings.sync.google.title')}</div>
            <div class="settings__fila-descripcion">
              ${estaConectadoGoogle ? t('settings.sync.connected') : t('settings.sync.disconnected')}
            </div>
          </div>
          <div class="settings__fila-accion settings__fila-accion--multiple">
            ${estaConectadoGoogle
              ? `<button class="btn btn--pequeño btn--secundario" id="btn-sync-google" type="button">${t('settings.sync.btn.sync')}</button>
                 <button class="btn btn--pequeño btn--peligro"   id="btn-desconectar-google" type="button">${t('common.disconnect')}</button>`
              : `<button class="btn btn--pequeño btn--primario"  id="btn-conectar-google" type="button">${t('common.connect')}</button>`
            }
          </div>
        </div>
        <!-- OneDrive -->
        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">${t('settings.sync.onedrive.title')}</div>
            <div class="settings__fila-descripcion">
              ${estaConectadoOneDrive ? t('settings.sync.connected') : t('settings.sync.disconnected')}
            </div>
          </div>
          <div class="settings__fila-accion settings__fila-accion--multiple">
            ${estaConectadoOneDrive
              ? `<button class="btn btn--pequeño btn--secundario" id="btn-sync-onedrive" type="button">${t('settings.sync.btn.sync')}</button>
                 <button class="btn btn--pequeño btn--peligro"   id="btn-desconectar-onedrive" type="button">${t('common.disconnect')}</button>`
              : `<button class="btn btn--pequeño btn--primario"  id="btn-conectar-onedrive" type="button">${t('common.connect')}</button>`
            }
          </div>
        </div>
        <div class="unlock__error oculto" id="sync-msg" role="alert"></div>
      </div>

      <!-- ── 5. Almacenamiento (F4.5) ── -->
      <p class="seccion-titulo">${t('settings.section.storage')}</p>
      <div class="settings__seccion tarjeta">
        <div class="settings__estado-persistencia">
          ${persistencia.persistente
            ? t('settings.storage.protected')
            : persistencia.soportada
              ? t('settings.storage.evictable')
              : t('settings.storage.unknown')
          }
        </div>
        ${persistencia.soportada ? `
        <p class="settings__uso-storage">
          ${t('settings.storage.usage', {
            used:  _formatearBytes(persistencia.usoBytes),
            quota: _formatearBytes(persistencia.cuotaBytes),
          })}
        </p>` : ''}
      </div>

      <!-- ── Sesión ── -->
      <p class="seccion-titulo">${t('settings.section.session')}</p>
      <div class="settings__seccion tarjeta">

        ${bioDisponible ? `
        <div class="settings__fila" id="fila-biometria">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">${t('settings.biometrics.title')}</div>
            <div class="settings__fila-descripcion">${t('settings.biometrics.desc')}</div>
          </div>
          <div class="settings__fila-accion">
            ${bioConfigurada
              ? `<button class="btn btn--pequeño btn--peligro" id="btn-desactivar-bio" type="button">${t('settings.biometrics.btn.disable')}</button>`
              : `<button class="btn btn--pequeño btn--secundario" id="btn-activar-bio" type="button">${t('settings.biometrics.btn.enable')}</button>`
            }
          </div>
        </div>
        <div class="settings__fila oculto" id="panel-bio-confirm">
          <div class="settings__fila-info" style="flex:1">
            <label class="settings__fila-titulo" for="bio-pass-input">${t('settings.biometrics.confirm.label')}</label>
            <div class="campo__wrapper" style="margin-top:6px">
              <input type="password" id="bio-pass-input" class="input" autocomplete="current-password">
            </div>
            <div class="unlock__error oculto" id="bio-confirm-error" role="alert" style="margin-top:4px"></div>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn btn--pequeño btn--secundario" id="btn-bio-cancelar" type="button">${t('settings.biometrics.confirm.cancel')}</button>
              <button class="btn btn--pequeño btn--primario" id="btn-bio-confirmar" type="button">${t('settings.biometrics.confirm.btn')}</button>
            </div>
          </div>
        </div>
        <div class="unlock__error oculto" id="bio-exito" style="color:var(--color-primary);padding:8px 0 0 0"></div>
        ` : ''}

        <div class="settings__fila">
          <div class="settings__fila-info">
            <div class="settings__fila-titulo">${t('settings.session.lock.title')}</div>
            <div class="settings__fila-descripcion">${t('settings.session.lock.desc')}</div>
          </div>
          <div class="settings__fila-accion">
            <button class="btn btn--pequeño btn--peligro" id="btn-bloquear" type="button">${t('settings.session.btn.lock')}</button>
          </div>
        </div>
      </div>

      <p class="settings__version-pie">
        ${t('settings.version', { version: versionApp })}
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
      errEl.textContent = t('settings.master.error.min')
      errEl.classList.remove('oculto'); return
    }
    if (nueva !== confirmar) {
      errEl.textContent = t('settings.master.error.mismatch')
      errEl.classList.remove('oculto'); return
    }

    const btn = contenedor.querySelector('#btn-cambiar-pass')
    btn.disabled = true; btn.textContent = t('settings.master.btn.loading')
    try {
      const claveNueva = await cambiarMasterPassword(actual, nueva)
      establecerClave(claveNueva)
      exitoEl.textContent = t('settings.master.success')
      exitoEl.classList.remove('oculto')
      contenedor.querySelector('#s-pass-actual').value  = ''
      contenedor.querySelector('#s-pass-nueva').value   = ''
      contenedor.querySelector('#s-pass-confirmar').value = ''
    } catch (err) {
      errEl.textContent = err.message === 'PASSWORD_INCORRECTA'
        ? t('settings.master.error.incorrect')
        : t('settings.master.error.generic')
      errEl.classList.remove('oculto')
    } finally {
      btn.disabled = false; btn.textContent = t('settings.master.btn.change')
    }
  })

  // ── Exportar backup ──
  contenedor.querySelector('#btn-exportar')?.addEventListener('click', async () => {
    const password = await _pedirContrasena(t('settings.backup.pass.export.prompt'))
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
      backupMsg.textContent = t('settings.backup.error.export')
      backupMsg.classList.remove('oculto')
    }
  })

  // ── Importar backup ──
  contenedor.querySelector('#input-importar')?.addEventListener('change', async (e) => {
    const archivo   = e.target.files?.[0]
    const backupMsg = contenedor.querySelector('#backup-msg')
    if (!archivo) return

    const password = await _pedirContrasena(t('settings.backup.pass.import.prompt'))
    if (!password) { e.target.value = ''; return }

    e.target.disabled = true

    try {
      const texto  = await archivo.text()
      const backup = JSON.parse(texto)

      backupMsg.style.cssText = ''
      backupMsg.textContent   = t('settings.backup.progress', { current: 1, total: 3 })
      backupMsg.classList.remove('oculto')

      const total = await importarVaultBackup(backup, password, {
        onProgreso: (paso, totalPasos) => {
          backupMsg.textContent = t('settings.backup.progress', { current: paso, total: totalPasos })
        },
      })

      backupMsg.style.cssText = 'background:rgba(46,204,113,0.1);border-color:rgba(46,204,113,0.3);color:var(--color-success);'
      backupMsg.textContent   = t('settings.backup.success', { count: total })
    } catch (err) {
      console.error('[IMPORT]', err)
      backupMsg.style.cssText = ''
      backupMsg.textContent   =
        err.message === 'PASSWORD_INCORRECTA'
          ? t('settings.backup.error.pass')
          : err.message === 'IMPORT_PASSWORD_MISMATCH'
            ? t('settings.backup.error.mismatch')
            : err.message === 'BACKUP_INVALIDO'
              ? t('settings.backup.error.invalid')
              : t('settings.backup.error.import')
      backupMsg.classList.remove('oculto')
    } finally {
      e.target.value    = ''
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
      csvMsg.textContent = t('settings.csv.error.export')
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
      csvMsg.textContent = t('settings.csv.error.export')
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
      try { await sincronizar(new GoogleDriveAdapter()) } catch (_) { /* silencioso */ }
      await navegar('#/settings')
    } catch (err) {
      msgEl.textContent = _mensajeErrorSync(err) ?? t('settings.sync.error.connect.google')
      msgEl.classList.remove('oculto')
    }
  })

  contenedor.querySelector('#btn-sync-google')?.addEventListener('click', async () => {
    const msgEl = contenedor.querySelector('#sync-msg')
    const btn   = contenedor.querySelector('#btn-sync-google')
    btn.disabled    = true
    btn.textContent = t('settings.sync.btn.loading')
    try {
      const { resultado } = await sincronizar(new GoogleDriveAdapter())
      msgEl.style.cssText = 'background:rgba(46,204,113,0.1);border-color:rgba(46,204,113,0.3);color:var(--color-success);'
      msgEl.textContent   = _mensajeSyncOk(resultado, t('settings.sync.google.title'))
      msgEl.classList.remove('oculto')
    } catch (err) {
      msgEl.style.cssText = ''
      msgEl.textContent   = _mensajeErrorSync(err) ?? t('settings.sync.error.sync.google')
      msgEl.classList.remove('oculto')
    } finally {
      btn.disabled    = false
      btn.textContent = t('settings.sync.btn.sync')
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
      try { await sincronizar(new OneDriveAdapter()) } catch (_) { /* silencioso */ }
      await navegar('#/settings')
    } catch (err) {
      msgEl.textContent = _mensajeErrorSync(err) ?? t('settings.sync.error.connect.ms')
      msgEl.classList.remove('oculto')
    }
  })

  contenedor.querySelector('#btn-sync-onedrive')?.addEventListener('click', async () => {
    const msgEl = contenedor.querySelector('#sync-msg')
    const btn   = contenedor.querySelector('#btn-sync-onedrive')
    btn.disabled    = true
    btn.textContent = t('settings.sync.btn.loading')
    try {
      const { resultado } = await sincronizar(new OneDriveAdapter())
      msgEl.style.cssText = 'background:rgba(46,204,113,0.1);border-color:rgba(46,204,113,0.3);color:var(--color-success);'
      msgEl.textContent   = _mensajeSyncOk(resultado, t('settings.sync.onedrive.title'))
      msgEl.classList.remove('oculto')
    } catch (err) {
      msgEl.style.cssText = ''
      msgEl.textContent   = _mensajeErrorSync(err) ?? t('settings.sync.error.sync.ms')
      msgEl.classList.remove('oculto')
    } finally {
      btn.disabled    = false
      btn.textContent = t('settings.sync.btn.sync')
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
    configActual.limpiarPortapapeles = e.target.checked
  })

  // ── Selector bloqueo automático (F5-A) ──
  contenedor.querySelector('#s-auto-lock').addEventListener('change', async (e) => {
    const minutos = parseInt(e.target.value)
    await idbStorage.set({ config: { ...configActual, autoLock: minutos } })
    configActual.autoLock = minutos
    autoLock.destroy()
    autoLock.init({
      limitMinutos: minutos,
      onLock: () => { limpiarSesion(); navegar('#/unlock') },
    })
  })

  // ── Biometría ──
  if (bioDisponible) {
    const panelConfirm = contenedor.querySelector('#panel-bio-confirm')
    const exitoEl      = contenedor.querySelector('#bio-exito')
    const errorConfirm = contenedor.querySelector('#bio-confirm-error')

    if (!bioConfigurada) {
      contenedor.querySelector('#btn-activar-bio')?.addEventListener('click', () => {
        panelConfirm.classList.remove('oculto')
        contenedor.querySelector('#bio-pass-input').focus()
      })
    }

    contenedor.querySelector('#btn-bio-cancelar')?.addEventListener('click', () => {
      panelConfirm.classList.add('oculto')
      contenedor.querySelector('#bio-pass-input').value = ''
      errorConfirm.classList.add('oculto')
    })

    contenedor.querySelector('#btn-bio-confirmar')?.addEventListener('click', async () => {
      const pass = contenedor.querySelector('#bio-pass-input').value
      if (!pass) return
      errorConfirm.classList.add('oculto')
      const btn = contenedor.querySelector('#btn-bio-confirmar')
      btn.disabled = true
      try {
        const resultado = await configurarBiometria(pass)
        if (!resultado) {
          errorConfirm.textContent = t('settings.biometrics.confirm.error')
          errorConfirm.classList.remove('oculto')
        } else {
          panelConfirm.classList.add('oculto')
          contenedor.querySelector('#btn-activar-bio')?.remove()
          exitoEl.textContent = t('settings.biometrics.success')
          exitoEl.classList.remove('oculto')
        }
      } catch (_) {
        errorConfirm.textContent = t('auth.unlock.error.generic')
        errorConfirm.classList.remove('oculto')
      } finally {
        btn.disabled = false
        contenedor.querySelector('#bio-pass-input').value = ''
      }
    })

    contenedor.querySelector('#btn-desactivar-bio')?.addEventListener('click', async () => {
      await desactivarBiometria()
      const fila = contenedor.querySelector('#fila-biometria')
      if (fila) {
        fila.querySelector('.settings__fila-accion').innerHTML =
          `<button class="btn btn--pequeño btn--secundario" id="btn-activar-bio" type="button">${t('settings.biometrics.btn.enable')}</button>`
        fila.querySelector('#btn-activar-bio').addEventListener('click', () => {
          panelConfirm.classList.remove('oculto')
          contenedor.querySelector('#bio-pass-input').focus()
        })
      }
    })
  }

  // ── Bloquear vault ──
  contenedor.querySelector('#btn-bloquear').addEventListener('click', () => {
    autoLock.destroy()
    limpiarSesion()
    navegar('#/unlock')
  })

  // ── Selector de idioma (F5-B) ──
  contenedor.querySelector('#idioma-selector').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-idioma]')
    if (!btn) return

    const idioma = btn.dataset.idioma

    if (idioma === 'auto') {
      // Eliminar config.idioma — vuelve a navigator.language
      const { idioma: _omit, ...configSinIdioma } = configActual
      await idbStorage.set({ config: configSinIdioma })
    } else {
      await idbStorage.set({ config: { ...configActual, idioma } })
    }

    await initI18n()
    window.location.reload()
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

/**
 * Lee la versión de la PWA desde el manifest (fuente única de verdad).
 * Paridad con la Extension (chrome.runtime.getManifest().version).
 * Si el manifest no puede leerse, retorna '' — el footer omite el número
 * sin romper el render (caso patológico: PWA sin manifest accesible).
 */
async function _leerVersionManifest() {
  try {
    const resp = await fetch('/manifest.json', { cache: 'no-cache' })
    if (!resp.ok) return ''
    const data = await resp.json()
    return data.version ?? ''
  } catch (_) {
    return ''
  }
}

/** Formatea bytes en una cadena legible (B, KB, MB) */
function _formatearBytes(bytes) {
  if (!bytes || bytes === 0) return '0 KB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(2)} MB`
  const kb = bytes / 1024
  return `${Math.round(kb)} KB`
}

function _mensajeSyncOk(resultado, proveedor) {
  if (resultado === 'descargado') return t('settings.sync.ok.downloaded', { provider: proveedor })
  if (resultado === 'subido')     return t('settings.sync.ok.uploaded',   { provider: proveedor })
  return t('settings.sync.ok.no.changes')
}

function _mensajeErrorSync(err) {
  const msg = err?.message ?? ''
  if (msg === 'GOOGLE_GIS_TIMEOUT')    return t('settings.sync.error.gis')
  if (msg.includes('popup_blocked'))   return t('settings.sync.error.popup')
  if (msg === 'MICROSOFT_POPUP_BLOQUEADO') return t('settings.sync.error.popup')
  if (msg === 'SYNC_MASTER_PASSWORD_MISMATCH') return t('settings.sync.error.mismatch')
  return null
}
