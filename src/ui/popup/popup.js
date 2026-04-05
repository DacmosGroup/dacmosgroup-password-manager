// ============================================
// DacmosGroup Password Manager — Popup Logic
// Controla las vistas y navegación del popup
// ============================================

// ── Referencias al DOM ──
const viewSetup    = document.getElementById('viewSetup');
const viewLocked   = document.getElementById('viewLocked');
const viewUnlocked = document.getElementById('viewUnlocked');
const statusBadge  = document.getElementById('statusBadge');
const statusDot    = statusBadge.querySelector('.status-dot');
const statusLabel  = statusBadge.querySelector('.status-label');
const errorMsg     = document.getElementById('errorMsg');
const navBar       = document.getElementById('navBar');

// ── Funciones de navegación entre vistas ──

// Oculta todas las vistas y muestra solo la indicada
function mostrarVista(vista) {
  [viewSetup, viewLocked, viewUnlocked].forEach(v => v.classList.add('hidden'));
  vista.classList.remove('hidden');
}

// Actualiza el badge de estado en el header
function actualizarEstado(desbloqueado) {
  if (desbloqueado) {
    statusDot.className   = 'status-dot unlocked';
    statusLabel.textContent = 'Desbloqueado';
    navBar.style.display  = 'flex';
  } else {
    statusDot.className   = 'status-dot locked';
    statusLabel.textContent = 'Bloqueado';
    navBar.style.display  = 'none';
  }
}

// ── Inicialización ──

// Al abrir el popup, verificamos el estado actual del vault
async function inicializar() {
  // Por ahora simulamos la lógica — E1.3 conectará el motor de cifrado real
  const { vaultConfigurado, sesionActiva } = await obtenerEstado();

  if (!vaultConfigurado) {
    // Primera vez — mostrar pantalla de bienvenida
    mostrarVista(viewSetup);
    actualizarEstado(false);
  } else if (sesionActiva) {
    // Sesión activa — vault desbloqueado
    mostrarVista(viewUnlocked);
    actualizarEstado(true);
    cargarConteoCredenciales();
  } else {
    // Vault configurado pero bloqueado
    mostrarVista(viewLocked);
    actualizarEstado(false);
  }
}

// Obtiene el estado del vault desde chrome.storage
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

// Actualiza el contador de credenciales en la vista desbloqueada
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

// Botón: ir a configuración inicial
document.getElementById('btnGoSetup').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Botón: mostrar/ocultar contraseña maestra
document.getElementById('btnTogglePassword').addEventListener('click', () => {
  const input = document.getElementById('masterPasswordInput');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// Botón: desbloquear vault
document.getElementById('btnUnlock').addEventListener('click', async () => {
  const password = document.getElementById('masterPasswordInput').value;

  if (!password) {
    errorMsg.classList.remove('hidden');
    errorMsg.textContent = 'Ingresa tu contraseña maestra';
    return;
  }

  // PLACEHOLDER — E1.3 implementará la verificación criptográfica real
  // Por ahora simulamos una verificación básica para probar la UI
  const resultado = await verificarPasswordSimulado(password);

  if (resultado) {
    errorMsg.classList.add('hidden');
    chrome.storage.local.set({ sesionActiva: true });
    mostrarVista(viewUnlocked);
    actualizarEstado(true);
    cargarConteoCredenciales();
  } else {
    errorMsg.classList.remove('hidden');
    errorMsg.textContent = 'Contraseña incorrecta';
    document.getElementById('masterPasswordInput').value = '';
  }
});

// Botón: abrir vault completo
document.getElementById('btnOpenVault').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/vault/vault.html') });
});

// Botón: agregar credencial
document.getElementById('btnAddCredential').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/vault/vault.html?action=new') });
});

// Botón: bloquear
document.getElementById('navLock').addEventListener('click', () => {
  chrome.storage.local.set({ sesionActiva: false });
  document.getElementById('masterPasswordInput').value = '';
  mostrarVista(viewLocked);
  actualizarEstado(false);
});

// Botón: ir a settings
document.getElementById('navSettings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/settings/settings.html') });
});

// ── Simulación temporal (se reemplaza en E1.3) ──
// NOTA DE SEGURIDAD: Esto es SOLO para probar la UI.
// Nunca usar comparación directa de contraseñas en producción.
async function verificarPasswordSimulado(password) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['masterPasswordHash'], (result) => {
      // Si no hay hash guardado, cualquier password pasa (modo demo)
      if (!result.masterPasswordHash) {
        resolve(true);
      } else {
        resolve(result.masterPasswordHash === password);
      }
    });
  });
}

// ── Arrancar ──
inicializar();
