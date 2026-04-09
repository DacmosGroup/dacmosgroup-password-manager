// ============================================
// Dacmos Password Manager — Popup Logic
// Conectado al motor de cifrado AES-256-GCM
// ============================================

import { desbloquearVault } from '../../crypto/engine.js';

// ── Referencias al DOM ──
const viewSetup    = document.getElementById('viewSetup');
const viewLocked   = document.getElementById('viewLocked');
const viewUnlocked = document.getElementById('viewUnlocked');
const statusBadge  = document.getElementById('statusBadge');
const statusDot    = statusBadge.querySelector('.status-dot');
const statusLabel  = statusBadge.querySelector('.status-label');
const errorMsg     = document.getElementById('errorMsg');
const navBar       = document.getElementById('navBar');

// ── Funciones de navegación ──
function mostrarVista(vista) {
  [viewSetup, viewLocked, viewUnlocked].forEach(v => v.classList.add('hidden'));
  vista.classList.remove('hidden');
}

function actualizarEstado(desbloqueado) {
  if (desbloqueado) {
    statusDot.className    = 'status-dot unlocked';
    statusLabel.textContent = 'Desbloqueado';
    navBar.style.display   = 'flex';
  } else {
    statusDot.className    = 'status-dot locked';
    statusLabel.textContent = 'Bloqueado';
    navBar.style.display   = 'none';
  }
}

// ── Inicialización ──
async function inicializar() {
  const { vaultConfigurado, sesionActiva } = await obtenerEstado();

  if (!vaultConfigurado) {
    mostrarVista(viewSetup);
    actualizarEstado(false);
  } else if (sesionActiva) {
    mostrarVista(viewUnlocked);
    actualizarEstado(true);
    cargarConteoCredenciales();
  } else {
    mostrarVista(viewLocked);
    actualizarEstado(false);
  }
}

async function obtenerEstado() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['vaultConfigurado', 'sesionActiva'], (result) => {
      resolve({
        vaultConfigurado: result.vaultConfigurado || false,
        sesionActiva:     result.sesionActiva     || false,
      });
    });
  });
}

async function cargarConteoCredenciales() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['credenciales'], (result) => {
      const conteo = result.credenciales ? result.credenciales.length : 0;
      const el = document.getElementById('credentialCount');
      if (el) el.textContent = `${conteo} credencial${conteo !== 1 ? 'es' : ''}`;
      resolve(conteo);
    });
  });
}

// ── Event Listeners ──

document.getElementById('btnGoSetup').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/settings/settings.html') });
});

document.getElementById('btnTogglePassword').addEventListener('click', () => {
  const input = document.getElementById('masterPasswordInput');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// Botón desbloquear — ahora usa el motor de cifrado real
document.getElementById('btnUnlock').addEventListener('click', async () => {
  const password = document.getElementById('masterPasswordInput').value;

  if (!password) {
    errorMsg.classList.remove('hidden');
    errorMsg.textContent = 'Ingresa tu contraseña maestra';
    return;
  }

  // Mostrar estado de carga — PBKDF2 tarda ~1 segundo intencionalmente
  const btnUnlock = document.getElementById('btnUnlock');
  btnUnlock.textContent = 'Verificando...';
  btnUnlock.disabled = true;

  try {
    // Verificación criptográfica real con PBKDF2 + AES-256-GCM
    const clave = await desbloquearVault(password);

    if (clave) {
      errorMsg.classList.add('hidden');
      // Guardar sesión activa — la clave vive solo en memoria de la página
      chrome.storage.local.set({ sesionActiva: true });

      // Cargar y enviar credenciales al service worker para sesión
    const { cargarVaultDescifrado } = await import('../../crypto/engine.js');
    const credenciales = await cargarVaultDescifrado(clave);
    chrome.runtime.sendMessage({
      tipo:         'VAULT_DESBLOQUEADO',
      credenciales: credenciales,
    });
    
      mostrarVista(viewUnlocked);
      actualizarEstado(true);
      cargarConteoCredenciales();
    } else {
      errorMsg.classList.remove('hidden');
      errorMsg.textContent = 'Contraseña incorrecta';
      document.getElementById('masterPasswordInput').value = '';
    }
  } catch (error) {
    errorMsg.classList.remove('hidden');
    errorMsg.textContent = 'Error al verificar — intenta de nuevo';
  } finally {
    btnUnlock.textContent = 'Desbloquear';
    btnUnlock.disabled = false;
  }
});

document.getElementById('btnOpenVault').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/vault/vault.html') });
});

document.getElementById('btnAddCredential').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/vault/vault.html?action=new') });
});

document.getElementById('navLock').addEventListener('click', () => {
  chrome.storage.local.set({ sesionActiva: false });
  document.getElementById('masterPasswordInput').value = '';
  mostrarVista(viewLocked);
  actualizarEstado(false);
});

document.getElementById('navGenerator').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/generator/generator.html') });
});
document.getElementById('navSettings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/settings/settings.html') });
});

// ── Arrancar ──
inicializar();
