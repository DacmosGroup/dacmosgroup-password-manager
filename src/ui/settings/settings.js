// ================================================
// DacmosGroup Password Manager — Settings Logic
// Conectado al motor de cifrado AES-256-GCM real
// ================================================

import { configurarVault } from '../../crypto/engine.js';

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

async function cargarConfiguracion() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['config'], (result) => {
      const config = result.config || {};
      if (config.autoLock  !== undefined) selectAutoLock.value  = config.autoLock;
      if (config.clipboard !== undefined) selectClipboard.value = config.clipboard;
      resolve();
    });
  });
}

// ── Evaluador de fortaleza ──
function evaluarFortaleza(password) {
  let puntos = 0;
  if (password.length >= 8)            puntos++;
  if (password.length >= 12)           puntos++;
  if (/[A-Z]/.test(password))         puntos++;
  if (/[0-9]/.test(password))         puntos++;
  if (/[^A-Za-z0-9]/.test(password)) puntos++;

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

// ── Guardar contraseña maestra con PBKDF2 real ──
// DECISIÓN DE SEGURIDAD: configurarVault() ejecuta PBKDF2-SHA256
// con 600,000 iteraciones. Esto tarda ~1 segundo intencionalmente.
// Ese segundo es insignificante para el usuario pero hace inviable
// un ataque de fuerza bruta que prueba millones de contraseñas.
async function guardarMasterPassword() {
  const nueva     = inputNuevaMaster.value;
  const confirmar = inputConfirmarMaster.value;

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

  // Mostrar estado de carga — PBKDF2 tarda ~1 segundo
  const btnGuardar = document.getElementById('btnGuardarMaster');
  btnGuardar.textContent = 'Configurando vault seguro...';
  btnGuardar.disabled    = true;

  try {
    // Configurar vault con cifrado real AES-256-GCM + PBKDF2
    await configurarVault(nueva);

    // Activar sesión
    await new Promise((resolve) => {
      chrome.storage.local.set({ sesionActiva: true }, resolve);
    });

    // Limpiar campos
    inputNuevaMaster.value     = '';
    inputConfirmarMaster.value = '';
    strengthFill.style.width   = '0%';
    strengthLabel.textContent  = '';

    mostrarExito(successMaster, '✅ Vault configurado con AES-256-GCM + PBKDF2-SHA256');

  } catch (error) {
    mostrarError(errorMaster, 'Error al configurar el vault — intenta de nuevo');
    console.error('Error configurarVault:', error);
  } finally {
    btnGuardar.textContent = 'Guardar contraseña maestra';
    btnGuardar.disabled    = false;
  }
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
async function exportarVault() {
  const datos = await new Promise((resolve) => {
    chrome.storage.local.get(['vaultCifrado', 'sal', 'sal2', 'tokenVerificacion'], resolve);
  });

  if (!datos.vaultCifrado) {
    alert('No hay vault para exportar');
    return;
  }

  // El export incluye el vault ya cifrado — nunca datos en claro
  const backup = {
    version:          '1.0',
    app:              'DacmosGroup Password Manager',
    fecha:            new Date().toISOString(),
    cifrado:          'AES-256-GCM',
    kdf:              'PBKDF2-SHA256-600000',
    sal:              datos.sal,
    sal2:             datos.sal2,
    tokenVerificacion: datos.tokenVerificacion,
    vaultCifrado:     datos.vaultCifrado,
  };

  // Descargar como archivo JSON cifrado
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `dacmosgroup-vault-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Borrar todo ──
async function borrarTodo() {
  if (!confirm('⚠️ ¿Eliminar TODAS las credenciales permanentemente?')) return;
  if (!confirm('⚠️ Última advertencia — esta acción NO se puede deshacer.')) return;

  await new Promise((resolve) => {
    chrome.storage.local.clear(resolve);
  });

  alert('✅ Vault borrado completamente');
  window.location.reload();
}

// ── Helpers UI ──
function mostrarError(elemento, mensaje) {
  elemento.textContent = mensaje;
  elemento.classList.remove('hidden');
}

function mostrarExito(elemento, mensaje) {
  elemento.textContent = mensaje;
  elemento.classList.remove('hidden');
  setTimeout(() => elemento.classList.add('hidden'), 4000);
}

// ── Event Listeners ──
inputNuevaMaster.addEventListener('input', (e) => evaluarFortaleza(e.target.value));

document.getElementById('btnToggleNueva').addEventListener('click', () => {
  inputNuevaMaster.type = inputNuevaMaster.type === 'password' ? 'text' : 'password';
});

document.getElementById('btnToggleConfirmar').addEventListener('click', () => {
  inputConfirmarMaster.type = inputConfirmarMaster.type === 'password' ? 'text' : 'password';
});

document.getElementById('btnGuardarMaster').addEventListener('click', guardarMasterPassword);
document.getElementById('btnGuardarSeguridad').addEventListener('click', guardarConfigSeguridad);
document.getElementById('btnExportar').addEventListener('click', exportarVault);
document.getElementById('btnBorrarTodo').addEventListener('click', borrarTodo);

// ── Arrancar ──
inicializar();
