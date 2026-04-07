// ================================================
// DacmosGroup Password Manager — Settings Logic
// E1.10: Export/Import vault cifrado
// ================================================

import {
  configurarVault,
  cambiarMasterPassword,
  exportarVaultBackup,
  importarVaultBackup,
} from '../../crypto/engine.js';

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
const panelConfigurar      = document.getElementById('panelConfigurar');
const panelCambiar         = document.getElementById('panelCambiar');

// ── Inicialización ──
async function inicializar() {
  await cargarConfiguracion();
  await determinarPanel();
}

async function determinarPanel() {
  const { vaultConfigurado } = await new Promise((resolve) => {
    chrome.storage.local.get(['vaultConfigurado'], resolve);
  });

  if (vaultConfigurado) {
    panelConfigurar.classList.add('hidden');
    panelCambiar.classList.remove('hidden');
  } else {
    panelConfigurar.classList.remove('hidden');
    panelCambiar.classList.add('hidden');
  }
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
function evaluarFortaleza(password, fillEl, labelEl) {
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
  fillEl.style.width           = nivel.ancho;
  fillEl.style.backgroundColor = nivel.color;
  labelEl.textContent          = nivel.label;
  labelEl.style.color          = nivel.color;
  return puntos;
}

// ── Configurar vault ──
async function guardarMasterPassword() {
  const nueva     = inputNuevaMaster.value;
  const confirmar = inputConfirmarMaster.value;

  errorMaster.classList.add('hidden');
  successMaster.classList.add('hidden');

  if (!nueva || !confirmar) { mostrarError(errorMaster, 'Completa ambos campos'); return; }
  if (nueva.length < 12)    { mostrarError(errorMaster, 'Mínimo 12 caracteres'); return; }
  if (nueva !== confirmar)  { mostrarError(errorMaster, 'Las contraseñas no coinciden'); return; }

  const fortaleza = evaluarFortaleza(nueva, strengthFill, strengthLabel);
  if (fortaleza < 3) {
    mostrarError(errorMaster, 'Contraseña muy débil — usa mayúsculas, números y símbolos');
    return;
  }

  const btnGuardar = document.getElementById('btnGuardarMaster');
  btnGuardar.textContent = 'Configurando vault seguro...';
  btnGuardar.disabled    = true;

  try {
    await configurarVault(nueva);
    await new Promise((resolve) => chrome.storage.local.set({ sesionActiva: true }, resolve));

    inputNuevaMaster.value     = '';
    inputConfirmarMaster.value = '';
    strengthFill.style.width   = '0%';
    strengthLabel.textContent  = '';

    mostrarExito(successMaster, '✅ Vault configurado con AES-256-GCM + PBKDF2-SHA256');
    setTimeout(() => {
      panelConfigurar.classList.add('hidden');
      panelCambiar.classList.remove('hidden');
    }, 2000);
  } catch (error) {
    mostrarError(errorMaster, 'Error al configurar el vault — intenta de nuevo');
  } finally {
    btnGuardar.textContent = 'Guardar contraseña maestra';
    btnGuardar.disabled    = false;
  }
}

// ── Cambiar contraseña maestra ──
async function cambiarPassword() {
  const actual    = document.getElementById('inputActualMaster').value;
  const nueva     = document.getElementById('inputNuevaCambio').value;
  const confirmar = document.getElementById('inputConfirmarCambio').value;
  const errorEl   = document.getElementById('errorCambio');
  const successEl = document.getElementById('successCambio');
  const fillEl    = document.getElementById('strengthFillCambio');
  const labelEl   = document.getElementById('strengthLabelCambio');

  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!actual || !nueva || !confirmar) { mostrarError(errorEl, 'Completa todos los campos'); return; }
  if (nueva.length < 12)  { mostrarError(errorEl, 'Mínimo 12 caracteres'); return; }
  if (nueva !== confirmar) { mostrarError(errorEl, 'Las contraseñas no coinciden'); return; }
  if (actual === nueva)    { mostrarError(errorEl, 'La nueva debe ser diferente a la actual'); return; }

  const fortaleza = evaluarFortaleza(nueva, fillEl, labelEl);
  if (fortaleza < 3) { mostrarError(errorEl, 'Contraseña muy débil'); return; }

  const btnCambiar = document.getElementById('btnCambiarMaster');
  btnCambiar.textContent = 'Re-cifrando vault...';
  btnCambiar.disabled    = true;

  try {
    await cambiarMasterPassword(actual, nueva);
    document.getElementById('inputActualMaster').value    = '';
    document.getElementById('inputNuevaCambio').value     = '';
    document.getElementById('inputConfirmarCambio').value = '';
    fillEl.style.width  = '0%';
    labelEl.textContent = '';
    mostrarExito(successEl, '✅ Contraseña cambiada — vault re-cifrado con nuevas claves');
  } catch (error) {
    if (error.message === 'PASSWORD_INCORRECTA') {
      mostrarError(errorEl, 'La contraseña actual es incorrecta');
    } else {
      mostrarError(errorEl, 'Error al cambiar la contraseña — intenta de nuevo');
    }
  } finally {
    btnCambiar.textContent = 'Cambiar contraseña maestra';
    btnCambiar.disabled    = false;
  }
}

// ── Guardar configuración de seguridad ──
async function guardarConfigSeguridad() {
  const config = {
    autoLock:  parseInt(selectAutoLock.value),
    clipboard: parseInt(selectClipboard.value),
  };
  await new Promise((resolve) => chrome.storage.local.set({ config }, resolve));
  mostrarExito(successSeguridad, '✅ Guardado');
}

// ── EXPORTAR vault ──
function mostrarFormExportar() {
  document.getElementById('formExportar').classList.toggle('hidden');
  document.getElementById('formImportar').classList.add('hidden');
}

async function confirmarExportar() {
  const password = document.getElementById('inputExportarPass').value;
  const errorEl  = document.getElementById('errorExportar');
  errorEl.classList.add('hidden');

  if (!password) { mostrarError(errorEl, 'Ingresa tu contraseña maestra'); return; }

  const btn = document.getElementById('btnConfirmarExportar');
  btn.textContent = 'Generando backup...';
  btn.disabled    = true;

  try {
    const backup = await exportarVaultBackup(password);

    // Descargar archivo
    const blob     = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const fecha    = new Date().toISOString().split('T')[0];
    a.href         = url;
    a.download     = `dacmosgroup-vault-backup-${fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);

    document.getElementById('inputExportarPass').value = '';
    document.getElementById('formExportar').classList.add('hidden');
    alert('✅ Backup exportado — guárdalo en un lugar seguro.');

  } catch (error) {
    if (error.message === 'PASSWORD_INCORRECTA') {
      mostrarError(errorEl, 'Contraseña incorrecta');
    } else {
      mostrarError(errorEl, 'Error al exportar — intenta de nuevo');
    }
  } finally {
    btn.textContent = 'Descargar backup';
    btn.disabled    = false;
  }
}

// ── IMPORTAR vault ──
function mostrarFormImportar() {
  document.getElementById('formImportar').classList.toggle('hidden');
  document.getElementById('formExportar').classList.add('hidden');
}

async function confirmarImportar() {
  const archivo  = document.getElementById('inputArchivoBackup').files[0];
  const password = document.getElementById('inputImportarPass').value;
  const errorEl  = document.getElementById('errorImportar');
  const successEl = document.getElementById('successImportar');

  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!archivo)  { mostrarError(errorEl, 'Selecciona un archivo de backup'); return; }
  if (!password) { mostrarError(errorEl, 'Ingresa la contraseña maestra'); return; }

  const btn = document.getElementById('btnConfirmarImportar');
  btn.textContent = 'Importando...';
  btn.disabled    = true;

  try {
    // Leer archivo
    const texto  = await archivo.text();
    const backup = JSON.parse(texto);

    // Importar y fusionar
    const totalCredenciales = await importarVaultBackup(backup, password);

    document.getElementById('inputArchivoBackup').value = '';
    document.getElementById('inputImportarPass').value  = '';

    mostrarExito(successEl, `✅ ${totalCredenciales} credenciales importadas correctamente`);

    setTimeout(() => {
      document.getElementById('formImportar').classList.add('hidden');
    }, 3000);

  } catch (error) {
    if (error.message === 'PASSWORD_INCORRECTA') {
      mostrarError(errorEl, 'Contraseña incorrecta o backup de otro vault');
    } else if (error.message === 'BACKUP_INVALIDO') {
      mostrarError(errorEl, 'Archivo inválido — no es un backup de DacmosGroup');
    } else {
      mostrarError(errorEl, 'Error al importar — verifica el archivo');
    }
  } finally {
    btn.textContent = 'Importar credenciales';
    btn.disabled    = false;
  }
}

// ── Borrar todo ──
async function borrarTodo() {
  if (!confirm('⚠️ ¿Eliminar TODAS las credenciales permanentemente?')) return;
  if (!confirm('⚠️ Última advertencia — esta acción NO se puede deshacer.')) return;
  await new Promise((resolve) => chrome.storage.local.clear(resolve));
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

// ── Event Listeners — Panel Configurar ──
inputNuevaMaster.addEventListener('input', (e) => {
  evaluarFortaleza(e.target.value, strengthFill, strengthLabel);
});

document.getElementById('btnToggleNueva').addEventListener('click', () => {
  inputNuevaMaster.type = inputNuevaMaster.type === 'password' ? 'text' : 'password';
});

document.getElementById('btnToggleConfirmar').addEventListener('click', () => {
  inputConfirmarMaster.type = inputConfirmarMaster.type === 'password' ? 'text' : 'password';
});

document.getElementById('btnGuardarMaster').addEventListener('click', guardarMasterPassword);

// ── Event Listeners — Panel Cambiar ──
document.getElementById('inputNuevaCambio').addEventListener('input', (e) => {
  evaluarFortaleza(
    e.target.value,
    document.getElementById('strengthFillCambio'),
    document.getElementById('strengthLabelCambio')
  );
});

document.getElementById('btnToggleActual').addEventListener('click', () => {
  const el = document.getElementById('inputActualMaster');
  el.type  = el.type === 'password' ? 'text' : 'password';
});

document.getElementById('btnToggleNuevaCambio').addEventListener('click', () => {
  const el = document.getElementById('inputNuevaCambio');
  el.type  = el.type === 'password' ? 'text' : 'password';
});

document.getElementById('btnToggleConfirmarCambio').addEventListener('click', () => {
  const el = document.getElementById('inputConfirmarCambio');
  el.type  = el.type === 'password' ? 'text' : 'password';
});

document.getElementById('btnCambiarMaster').addEventListener('click', cambiarPassword);

// ── Event Listeners — Seguridad ──
document.getElementById('btnGuardarSeguridad').addEventListener('click', guardarConfigSeguridad);

// ── Event Listeners — Backup ──
document.getElementById('btnExportar').addEventListener('click', mostrarFormExportar);
document.getElementById('btnCancelarExportar').addEventListener('click', () => {
  document.getElementById('formExportar').classList.add('hidden');
});
document.getElementById('btnConfirmarExportar').addEventListener('click', confirmarExportar);
document.getElementById('btnToggleExportarPass').addEventListener('click', () => {
  const el = document.getElementById('inputExportarPass');
  el.type  = el.type === 'password' ? 'text' : 'password';
});

document.getElementById('btnImportar').addEventListener('click', mostrarFormImportar);
document.getElementById('btnCancelarImportar').addEventListener('click', () => {
  document.getElementById('formImportar').classList.add('hidden');
});
document.getElementById('btnConfirmarImportar').addEventListener('click', confirmarImportar);
document.getElementById('btnToggleImportarPass').addEventListener('click', () => {
  const el = document.getElementById('inputImportarPass');
  el.type  = el.type === 'password' ? 'text' : 'password';
});

// ── Event Listeners — Zona de peligro ──
document.getElementById('btnBorrarTodo').addEventListener('click', borrarTodo);

// ── Arrancar ──
inicializar();
