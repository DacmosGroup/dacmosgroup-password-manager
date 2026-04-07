// ================================================
// DacmosGroup Password Manager — Service Worker
// E1.9: Lock automático + badge de credenciales
// ================================================

// ── Estado del timer de inactividad ──
let timerInactividad = null;
let tiempoBloqueo    = 5 * 60 * 1000; // Default: 5 minutos en ms

// ── Al instalar la extensión ──
chrome.runtime.onInstalled.addListener(() => {
  console.log('DacmosGroup Password Manager instalado');
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

// ── Filtrar credenciales por dominio ──
function filtrarPorDominio(credenciales, dominio) {
  return credenciales.filter(cred => {
    if (!cred.url && !cred.sitio) return false;
    const dominioLower = dominio.toLowerCase();

    if (cred.url) {
      try {
        const urlGuardada = new URL(cred.url).hostname.toLowerCase()
          .replace('www.', '');
        const dominioActual = dominioLower.replace('www.', '');
        if (urlGuardada.includes(dominioActual) ||
            dominioActual.includes(urlGuardada)) return true;
      } catch (_) {}
    }

    if (cred.sitio) {
      const sitioLower = cred.sitio.toLowerCase();
      if (dominioLower.includes(sitioLower) ||
          sitioLower.includes(dominioLower.split('.')[0])) return true;
    }

    return false;
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

  // Vault desbloqueado — iniciar timer y guardar credenciales
  if (mensaje.tipo === 'VAULT_DESBLOQUEADO') {
    guardarCredencialesSesion(mensaje.credenciales).then(() => {
      iniciarTimerInactividad();
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
        const filtradas    = filtrarPorDominio(credenciales, mensaje.dominio);
        actualizarBadge(true, filtradas.length);
      }
    });

    sendResponse({ ok: true });
  }

  // Content script solicita credenciales para autocompletar
  if (mensaje.tipo === 'SOLICITAR_AUTOCOMPLETADO') {
    // Resetear timer — el usuario está activo
    resetearTimerInactividad();

    chrome.storage.local.get(['sesionActiva'], async (result) => {
      if (!result.sesionActiva) {
        sendResponse({ credenciales: [], bloqueado: true });
        return;
      }

      const todasLasCredenciales = await obtenerCredencialesSesion();
      const filtradas = filtrarPorDominio(todasLasCredenciales, mensaje.dominio);
      sendResponse({ credenciales: filtradas });
    });
    return true;
  }
});

// ── Resetear timer cuando cambia de pestaña ──
chrome.tabs.onActivated.addListener(() => {
  resetearTimerInactividad();
});

// ── Limpiar badge cuando cambia de pestaña ──
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (!tab.url) return;
    try {
      const dominio = new URL(tab.url).hostname;
      chrome.storage.local.get(['sesionActiva'], async (result) => {
        if (result.sesionActiva) {
          const credenciales = await obtenerCredencialesSesion();
          const filtradas    = filtrarPorDominio(credenciales, dominio);
          actualizarBadge(true, filtradas.length);
        } else {
          actualizarBadge(false, 0);
        }
      });
    } catch (_) {}
  });
});
