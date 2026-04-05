// ================================================
// DacmosGroup Password Manager — Service Worker
// Background script: gestiona estado de la sesión
// ================================================

// Tiempo de inactividad en minutos (default: 5)
let tiempoInactividad = 5;

// ── Al instalar la extensión ──
chrome.runtime.onInstalled.addListener(() => {
  console.log('DacmosGroup Password Manager instalado');

  // Inicializar configuración por defecto
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

// ── Escuchar mensajes desde popup y vault ──
chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
  if (mensaje.tipo === 'BLOQUEAR_VAULT') {
    bloquearVault();
    sendResponse({ ok: true });
  }

  if (mensaje.tipo === 'OBTENER_ESTADO') {
    chrome.storage.local.get(['vaultConfigurado', 'sesionActiva'], (result) => {
      sendResponse(result);
    });
    return true; // Mantener canal abierto para respuesta async
  }
});

// ── Bloquear vault ──
function bloquearVault() {
  chrome.storage.local.set({ sesionActiva: false });
}
