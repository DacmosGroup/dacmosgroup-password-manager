// ================================================
// DacmosGroup Password Manager — Service Worker
// E1.8: Autocompletado con chrome.storage.session
// ================================================

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
});

// ── Guardar credenciales descifradas en sesión ──
// DECISIÓN DE SEGURIDAD: chrome.storage.session es volátil —
// se borra automáticamente al cerrar el browser.
// Las credenciales nunca tocan el disco en texto plano.
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

    // Comparar con URL guardada
    if (cred.url) {
      try {
        const urlGuardada = new URL(cred.url).hostname.toLowerCase()
          .replace('www.', '');
        const dominioActual = dominioLower.replace('www.', '');
        if (urlGuardada.includes(dominioActual) ||
            dominioActual.includes(urlGuardada)) return true;
      } catch (_) {}
    }

    // Comparar con nombre del sitio
    if (cred.sitio) {
      const sitioLower = cred.sitio.toLowerCase();
      if (dominioLower.includes(sitioLower) ||
          sitioLower.includes(dominioLower.split('.')[0])) return true;
    }

    return false;
  });
}

// ── Limpiar sesión (bloquear vault) ──
async function bloquearVault() {
  await new Promise((resolve) => {
    chrome.storage.session.clear(resolve);
  });
  chrome.storage.local.set({ sesionActiva: false });
}

// ── Escuchar mensajes ──
chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {

  // Vault bloqueado desde popup
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

  // Vault desbloqueado — guardar credenciales en sesión
  if (mensaje.tipo === 'VAULT_DESBLOQUEADO') {
    guardarCredencialesSesion(mensaje.credenciales).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  // Content script detectó campos de login
  if (mensaje.tipo === 'CAMPOS_LOGIN_DETECTADOS') {
    chrome.storage.local.set({
      dominioActivo: mensaje.dominio,
      urlActiva:     mensaje.url,
    });
    sendResponse({ ok: true });
  }

  // Content script solicita credenciales para autocompletar
  if (mensaje.tipo === 'SOLICITAR_AUTOCOMPLETADO') {
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
