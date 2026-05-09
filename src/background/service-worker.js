// ================================================
// Dacmos Password Manager — Service Worker
// E1.9: Lock automático + badge de credenciales
// F1.6: URL matching mejorado (dominio base, wildcards)
// F2.1: Google Drive Sync (BYOC)
// F2.2: OneDrive Sync (BYOC)
// ================================================

import { filtrarCredenciales } from '../utils/url-matcher.js'
import {
  sincronizarTrasEscritura,
  conectarGoogleDrive,
  desconectarGoogleDrive,
  obtenerEstadoSync,
} from '../sync/sync-manager.js'
import {
  sincronizarOneDrive,
  conectarOneDrive,
  desconectarOneDrive,
} from '../sync/onedrive-sync-manager.js'

// Enruta la sincronización al adaptador activo según syncConfig.proveedor
function dispararSync() {
  chrome.storage.local.get(['syncConfig'], r => {
    if (r.syncConfig?.proveedor === 'onedrive') {
      sincronizarOneDrive()        // fire-and-forget
    } else {
      sincronizarTrasEscritura()   // google-drive (comportamiento anterior)
    }
  })
}

// ── Al instalar la extensión ──
chrome.runtime.onInstalled.addListener(() => {
  console.log('Dacmos Password Manager instalado');
  chrome.storage.local.get(['config'], (result) => {
    if (!result.config) {
      chrome.storage.local.set({
        config: { autoLock: 5, clipboard: 30 }
      });
    }
  });
  // Inicializar badge
  actualizarBadge(false, 0);
});

// ── Gestión del timer de inactividad ──
// DECISIÓN DE SEGURIDAD: Usamos chrome.alarms en lugar de setTimeout
// porque los service workers en Manifest V3 se "duermen" después de
// 30 segundos — setTimeout se cancela. chrome.alarms persiste aunque
// el service worker esté dormido.

function iniciarTimerInactividad() {
  chrome.storage.local.get(['config'], (result) => {
    const minutos = result.config?.autoLock ?? 5;
    if (minutos === 0) return; // 0 = nunca bloquear

    // Crear alarma que sobrevive al sleep del service worker
    chrome.alarms.create('autoLock', { delayInMinutes: minutos });
  });
}

function detenerTimerInactividad() {
  chrome.alarms.clear('autoLock');
}

function resetearTimerInactividad() {
  chrome.storage.local.get(['sesionActiva'], (result) => {
    if (result.sesionActiva) {
      // Reiniciar la alarma
      detenerTimerInactividad();
      iniciarTimerInactividad();
    }
  });
}

// ── Escuchar alarmas ──
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoLock') {
    bloquearVault();
    console.log('DacmosGroup: vault bloqueado por inactividad');
  }
});


// ── Bloquear vault ──
async function bloquearVault() {
  detenerTimerInactividad();

  // Limpiar credenciales de sesión
  await new Promise((resolve) => {
    chrome.storage.session.clear(resolve);
  });

  // Marcar sesión como inactiva
  chrome.storage.local.set({ sesionActiva: false });

  // Limpiar badge
  actualizarBadge(false, 0);

  // Notificar a todas las pestañas activas
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { tipo: 'VAULT_BLOQUEADO' })
        .catch(() => {}); // Ignorar tabs sin content script
    });
  });
}

// ── Badge en el ícono de la extensión ──
// Muestra cuántas credenciales hay para el sitio actual
function actualizarBadge(activo, cantidad) {
  if (!activo || cantidad === 0) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  chrome.action.setBadgeText({ text: String(cantidad) });
  chrome.action.setBadgeBackgroundColor({ color: '#0066cc' });
}

// ── Guardar credenciales en sesión ──
async function guardarCredencialesSesion(credenciales) {
  return new Promise((resolve) => {
    chrome.storage.session.set({ credencialesSesion: credenciales }, resolve);
  });
}

// ── Obtener credenciales de sesión ──
async function obtenerCredencialesSesion() {
  return new Promise((resolve) => {
    chrome.storage.session.get(['credencialesSesion'], (result) => {
      resolve(result.credencialesSesion || []);
    });
  });
}


// ── Escuchar mensajes ──
chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {

  // Vault bloqueado manualmente
  if (mensaje.tipo === 'BLOQUEAR_VAULT') {
    bloquearVault().then(() => sendResponse({ ok: true }));
    return true;
  }

  // Estado del vault
  if (mensaje.tipo === 'OBTENER_ESTADO') {
    chrome.storage.local.get(['vaultConfigurado', 'sesionActiva'], (result) => {
      sendResponse(result);
    });
    return true;
  }

  // Vault desbloqueado — marcar sesión activa, iniciar timer y guardar credenciales
  if (mensaje.tipo === 'VAULT_DESBLOQUEADO') {
    guardarCredencialesSesion(mensaje.credenciales).then(() => {
      chrome.storage.local.set({ sesionActiva: true });
      iniciarTimerInactividad();
      dispararSync();              // fire-and-forget — no bloquea el unlock
      sendResponse({ ok: true });
    });
    return true;
  }

  // Resetear timer por actividad del usuario
  if (mensaje.tipo === 'ACTIVIDAD_USUARIO') {
    resetearTimerInactividad();
    sendResponse({ ok: true });
  }

  // Content script detectó campos de login
  if (mensaje.tipo === 'CAMPOS_LOGIN_DETECTADOS') {
    chrome.storage.local.set({
      dominioActivo: mensaje.dominio,
      urlActiva:     mensaje.url,
    });

    // Actualizar badge con cantidad de credenciales para este dominio
    chrome.storage.local.get(['sesionActiva'], async (result) => {
      if (result.sesionActiva) {
        const credenciales = await obtenerCredencialesSesion();
        const filtradas    = filtrarCredenciales(credenciales, mensaje.url);
        actualizarBadge(true, filtradas.length);
      }
    });

    sendResponse({ ok: true });
    return true;
  }

  // ── Handlers de sincronización (F2.1) ──

  if (mensaje.tipo === 'SYNC_CONECTAR') {
    conectarGoogleDrive()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (mensaje.tipo === 'SYNC_DESCONECTAR') {
    desconectarGoogleDrive()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (mensaje.tipo === 'SYNC_SINCRONIZAR') {
    // Delegar al adaptador activo
    const cfg = new Promise(resolve =>
      chrome.storage.local.get(['syncConfig'], r => resolve(r.syncConfig || {}))
    )
    cfg.then(c => c.proveedor === 'onedrive' ? sincronizarOneDrive() : sincronizarTrasEscritura())
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (mensaje.tipo === 'SYNC_CONECTAR_ONEDRIVE') {
    conectarOneDrive()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (mensaje.tipo === 'SYNC_DESCONECTAR_ONEDRIVE') {
    desconectarOneDrive()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true
  }

  if (mensaje.tipo === 'SYNC_OBTENER_ESTADO') {
    obtenerEstadoSync()
      .then(estado => sendResponse(estado))
      .catch(() => sendResponse({ estado: 'error', mensaje: '', ultimaSync: null, proveedor: null }))
    return true
  }

  // Content script solicita credenciales para autocompletar
  if (mensaje.tipo === 'SOLICITAR_AUTOCOMPLETADO') {
    resetearTimerInactividad();

    chrome.storage.local.get(['sesionActiva'], async (result) => {
      if (!result.sesionActiva) {
        sendResponse({ credenciales: [], bloqueado: true });
        return;
      }

      const todas = await obtenerCredencialesSesion();
      const tipo  = mensaje.tipoFormulario || 'login';
      let filtradas;

      if (tipo === 'tarjeta') {
        // Las tarjetas son universales — no se filtran por dominio
        filtradas = todas.filter(c => c.tipo === 'tarjeta');
      } else if (tipo === 'identidad') {
        // Las identidades son universales — no se filtran por dominio
        filtradas = todas.filter(c => c.tipo === 'identidad');
      } else {
        // Login: filtrar por URL usando el módulo de matching
        filtradas = filtrarCredenciales(todas, mensaje.url);
      }

      sendResponse({ credenciales: filtradas });
    });
    return true;
  }
});

// ── Sync: disparar sincronización cuando vaultCifrado cambia ──
// DECISIÓN: Usamos onChanged en lugar de un mensaje VAULT_GUARDADO explícito
// porque cubre TODOS los paths de escritura, incluyendo cambiarMasterPassword()
// que escribe directamente en storage sin pasar por guardarVaultCifrado().
//
// GUARDIA ANTI-LOOP: Si el cambio incluye _syncTs, fue escrito por sync-manager
// al descargar desde Drive. En ese caso se omite redisparar para evitar
// el ciclo descarga → onChanged → subida innecesaria.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if ('_syncTs' in changes) return  // escritura interna de sync — ignorar
  if ('vaultCifrado' in changes) {
    dispararSync()                  // fire-and-forget — enruta según proveedor activo
  }
})

// ── Resetear timer y actualizar badge cuando cambia de pestaña ──
chrome.tabs.onActivated.addListener((activeInfo) => {
  resetearTimerInactividad();

  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (!tab.url) return;
    chrome.storage.local.get(['sesionActiva'], async (result) => {
      if (result.sesionActiva) {
        const credenciales = await obtenerCredencialesSesion();
        const filtradas    = filtrarCredenciales(credenciales, tab.url);
        actualizarBadge(true, filtradas.length);
      } else {
        actualizarBadge(false, 0);
      }
    });
  });
});
