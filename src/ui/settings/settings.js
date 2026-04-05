// ================================================
// DacmosGroup Password Manager — Settings Logic
// Gestión de configuración y contraseña maestra
// ================================================

// ── Referencias al DOM ──
const inputNuevaMaster     = document.getElementById('inputNuevaMaster');
const inputConfirmarMaster = document.getElementById('inputConfirmarMaster');
const errorMaster          = document.getElementById('errorMaster');
const successMaster        = document.getElementById('successMaster');
const strengthFill         = document.getElementById('strengthFill');
const strengthLabel        = document.getElementById('strengthLabel');
const selectAutoLock       = document.getElementById('selectAutoLock');
const selectClipboard      = document.getElementById('selectClipboard');
const successSeguridad     = document.getElementById('successSeguridad');

// ── Inicialización ──
async function inicializar() {
  await cargarConfiguracion();
}

// Carga la configuración guardada y la refleja en la UI
async function cargarConfiguracion() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['config'], (result) => {
      const config = result.config || {};
      if (config.autoLock !== undefined) {
        selectAutoLock.value = config.autoLock;
      }
      if (config.clipboard !== undefined) {
        selectClipboard.value = config.clipboard;
      }
      resolve();
    });
  });
}

// ── Evaluador de fortaleza de contraseña maestra ──
function evaluarFortaleza(password) {
  let puntos = 0;
  if (password.length >= 8)              puntos++;
  if (password.length >= 12)             puntos++;
  if (/[A-Z]/.test(password))           puntos++;
  if (/[0-9]/.test(password))           puntos++;
  if (/[^A-Za-z0-9]/.test(password))   puntos++;

  const niveles = [
    { label: '',           color: 'transparent', ancho: '0%'   },
    { label: 'Muy débil',  color: '#e74c3c',     ancho: '20%'  },
    { label: 'Débil',      color: '#e67e22',     ancho: '40%'  },
    { label: 'Regular',    color: '#f39c12',     ancho: '60%'  },
    { label: 'Fuerte',     color: '#2ecc71',     ancho: '80%'  },
    { label: 'Muy fuerte', color: '#00d4ff',     ancho: '100%' },
  ];

  const nivel = niveles[puntos] || niveles[0];
  strengthFill.style.width           = nivel.ancho;
  strengthFill.style.backgroundColor = nivel.color;
  strengthLabel.textContent          = nivel.label;
  strengthLabel.style.color          = nivel.color;

  return puntos;
}

// ── Guardar contraseña maestra ──
// NOTA DE SEGURIDAD: En E1.3 esta contraseña se procesará con
// PBKDF2-SHA256 (600,000 iteraciones) antes de almacenarse.
// Por ahora guardamos un placeholder para probar la UI.
async function guardarMasterPassword() {
  const nueva     = inputNuevaMaster.value;
  const confirmar = inputConfirmarMaster.value;

  // Ocultar mensajes anteriores
  errorMaster.classList.add('hidden');
  successMaster.classList.add('hidden');

  // Validaciones
  if (!nueva || !confirmar) {
    mostrarError(errorMaster, 'Completa ambos campos');
    return;
  }

  if (nueva.length < 12) {
    mostrarError(errorMaster, 'Mínimo 12 caracteres para mayor seguridad');
    return;
  }

  if (nueva !== confirmar) {
    mostrarError(errorMaster, 'Las contraseñas no coinciden');
    return;
  }

  const fortaleza = evaluarFortaleza(nueva);
  if (fortaleza < 3) {
    mostrarError(errorMaster, 'Contraseña muy débil — usa mayúsculas, números y símbolos');
    return;
  }

  // PLACEHOLDER — E1.3 reemplaza esto con PBKDF2 real
  await new Promise((resolve) => {
    chrome.storage.local.set({
      vaultConfigurado: true,
      sesionActiva: true,
      // ⚠️ TEMPORAL: En E1.3 se almacenará el hash derivado con PBKDF2
      masterPasswordHash: nueva,
    }, resolve);
  });

  // Limpiar campos
  inputNuevaMaster.value     = '';
  inputConfirmarMaster.value = '';
  strengthFill.style.width   = '0%';
  strengthLabel.textContent  = '';

  mostrarExito(successMaster, '✅ Contraseña maestra guardada correctamente');
}

// ── Guardar configuración de seguridad ──
async function guardarConfigSeguridad() {
  const config = {
    autoLock:  parseInt(selectAutoLock.value),
    clipboard: parseInt(selectClipboard.value),
  };

  await new Promise((resolve) => {
    chrome.storage.local.set({ config }, resolve);
  });

  mostrarExito(successSeguridad, '✅ Guardado');
}

// ── Exportar vault ──
// PLACEHOLDER — E1.10 implementa la exportación cifrada completa
async function exportarVault() {
  const data = await new Promise((resolve) => {
    chrome.storage.local.get(['credenciales'], (result) => {
      resolve(result.credenciales || []);
    });
  });

  if (data.length === 0) {
    alert('No hay credenciales para exportar');
    return;
  }

  alert('Exportación completa disponible en E1.10 — Backup cifrado AES-256-GCM');
}

// ── Borrar todo ──
async function borrarTodo() {
  if (!confirm('⚠️ ¿Estás seguro? Esta acción eliminará TODAS las credenciales permanentemente.')) return;
  if (!confirm('⚠️ Última advertencia — esta acción NO se puede deshacer.')) return;

  await new Promise((resolve) => {
    chrome.storage.local.clear(resolve);
  });

  alert('✅ Vault borrado completamente');
  window.location.reload();
}

// ── Helpers de UI ──
function mostrarError(elemento, mensaje) {
  elemento.textContent = mensaje;
  elemento.classList.remove('hidden');
}

function mostrarExito(elemento, mensaje) {
  elemento.textContent = mensaje;
  elemento.classList.remove('hidden');
  setTimeout(() => elemento.classList.add('hidden'), 3000);
}

// ── Event Listeners ──

// Evaluar fortaleza al escribir
inputNuevaMaster.addEventListener('input', (e) => {
  evaluarFortaleza(e.target.value);
});

// Mostrar/ocultar contraseñas
document.getElementById('btnToggleNueva').addEventListener('click', () => {
  inputNuevaMaster.type = inputNuevaMaster.type === 'password' ? 'text' : 'password';
});

document.getElementById('btnToggleConfirmar').addEventListener('click', () => {
  inputConfirmarMaster.type = inputConfirmarMaster.type === 'password' ? 'text' : 'password';
});

// Botones principales
document.getElementById('btnGuardarMaster').addEventListener('click', guardarMasterPassword);
document.getElementById('btnGuardarSeguridad').addEventListener('click', guardarConfigSeguridad);
document.getElementById('btnExportar').addEventListener('click', exportarVault);
document.getElementById('btnBorrarTodo').addEventListener('click', borrarTodo);

// ── Arrancar ──
inicializar();
