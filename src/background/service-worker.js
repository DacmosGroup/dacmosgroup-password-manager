// ================================================
// DacmosGroup Password Manager — Service Worker
// E1.7: Manejo de mensajes del content script
// ================================================

// ── Al instalar la extensión ──
chrome.runtime.onInstalled.addListener(() => {
  console.log('DacmosGroup Password Manager instalado');

  chrome.storage.local.get(['config'], (result) => {
    if (!result.config) {
      chrome.storage.local.set({
        config: {
          autoLock:  5,
          clipboard: 30,
        }
      });
    }
  });
});

// ── Escuchar mensajes ──
chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {

  // Vault bloqueado desde popup
  if (mensaje.tipo === 'BLOQUEAR_VAULT') {
    chrome.storage.local.set({ sesionActiva: false });
    sendResponse({ ok: true });
  }

  // Estado del vault
  if (mensaje.tipo === 'OBTENER_ESTADO') {
    chrome.storage.local.get(['vaultConfigurado', 'sesionActiva'], (result) => {
      sendResponse(result);
    });
    return true;
  }

  // Content script detectó campos de login
  if (mensaje.tipo === 'CAMPOS_LOGIN_DETECTADOS') {
    // Guardar el dominio activo para sugerencias en el popup
    chrome.storage.local.set({
      dominioActivo: mensaje.dominio,
      urlActiva:     mensaje.url,
    });
    sendResponse({ ok: true });
  }

  // Content script solicita credenciales para autocompletar
  if (mensaje.tipo === 'SOLICITAR_AUTOCOMPLETADO') {
    chrome.storage.local.get(['vaultCifrado', 'sesionActiva'], (result) => {
      if (!result.sesionActiva || !result.vaultCifrado) {
        sendResponse({ credenciales: [] });
        return;
      }

      // NOTA: En E1.8 descifraremos y filtraremos por dominio
      // Por ahora retornamos señal de que hay vault disponible
      sendResponse({ credenciales: [], vaultDisponible: true });
    });
    return true;
  }
});
