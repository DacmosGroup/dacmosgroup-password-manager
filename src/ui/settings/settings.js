// ================================================
// DacmosGroup Password Manager — Settings Logic
// E1.4: Gestión completa de Master Password
// ================================================

import { configurarVault, cambiarMasterPassword } from '../../crypto/engine.js';

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

// Muestra el panel correcto según si el vault ya está configurado
async function determinarPanel() {
  const { vaultConfigurado } = await new Promise((resolve) => {
    chrome.storage.local.get(['vaultConfigurado'], resolve);
  });

  if (vaultConfigurado) {
    // Vault ya existe — mostrar panel de cambio
    panelConfigurar.classList.add('hidden');
    panelCambiar.classList.remove('hidden');
  } else {
    // Primera vez — mostrar panel de configuración
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

// ── Configurar vault por primera vez ──
async function guardarMasterPassword() {
  const nueva     = inputNuevaMaster.value;
  const confirmar = inputConfirmarMaster.value;

  errorMaster.classList.add('hidden');
  successMaster.classList.add('hidden');

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
    await new Promise((resolve) => {
      chrome.storage.local.set({ sesionActiva: true }, resolve);
    });

    inputNuevaMaster.value     = '';
    inputConfirmarMaster.value = '';
    strengthFill.style.width   = '0%';
    strengthLabel.textContent  = '';

    mostrarExito(successMaster, '✅ Vault configurado con AES-256-GCM + PBKDF2-SHA256');

    // Cambiar al panel de "cambiar password" después de configurar
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
// DECISIÓN DE SEGURIDAD: Re-cifra todo el vault en memoria.
// Descifra con clave vieja → re-cifra con clave nueva → nuevas sales.
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

  if (!actual || !nueva || !confirmar) {
    mostrarError(errorEl, 'Completa todos los campos');
    return;
  }
  if (nueva.length < 12) {
    mostrarError(errorEl, 'Mínimo 12 caracteres');
    return;
  }
  if (nueva !== confirmar) {
    mostrarError(errorEl, 'Las contraseñas nuevas no coinciden');
    return;
  }
  if (actual === nueva) {
    mostrarError(errorEl, 'La nueva contraseña debe ser diferente a la actual');
    return;
  }
  const fortaleza = evaluarFortaleza(nueva, fillEl, labelEl);
  if (fortaleza < 3) {
    mostrarError(errorEl, 'Contraseña muy débil — usa mayúsculas, números y símbolos');
    return;
  }

  const btnCambiar = document.getElementById('btnCambiarMaster');
  btnCambiar.textContent = 'Re-cifrando vault...';
  btnCambiar.disabled    = true;

  try {
    await cambiarMasterPassword(actual, nueva);

    // Limpiar campos
    document.getElementById('inputActualMaster').value    = '';
    document.getElementById('inputNuevaCambio').value     = '';
    document.getElementById('inputConfirmarCambio').value = '';
    fillEl.style.width    = '0%';
    labelEl.textContent   = '';

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
  await new Promise((resolve) => {
    chrome.storage.local.set({ config }, resolve);
  });
  mostrarExito(successSeguridad, '✅ Guardado');
}

// ── Exportar vault ──
async function exportarVault() {
  const datos = await new Promise((resolve) => {
    chrome.storage.local.get(
      ['vaultCifrado', 'sal', 'sal2', 'tokenVerificacion'], resolve
    );
  });

  if (!datos.vaultCifrado) {
    alert('No hay vault para exportar');
    return;
  }

  const backup = {
    version:           '1.0',
    app:               'DacmosGroup Password Manager',
    fecha:             new Date().toISOString(),
    cifrado:           'AES-256-GCM',
    kdf:               'PBKDF2-SHA256-600000',
    sal:               datos.sal,
    sal2:              datos.sal2,
    tokenVerificacion: datos.tokenVerificacion,
    vaultCifrado:      datos.vaultCifrado,
  };

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

// ── Event Listeners — Otros ──
document.getElementById('btnGuardarSeguridad').addEventListener('click', guardarConfigSeguridad);
document.getElementById('btnExportar').addEventListener('click', exportarVault);
document.getElementById('btnBorrarTodo').addEventListener('click', borrarTodo);

// ── Arrancar ──
inicializar();
