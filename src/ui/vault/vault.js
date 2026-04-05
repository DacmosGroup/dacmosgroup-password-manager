// ============================================
// DacmosGroup Password Manager — Vault Logic
// E1.5: CRUD completo de credenciales cifradas
// ============================================

import { desbloquearVault, guardarVaultCifrado, cargarVaultDescifrado } from '../../crypto/engine.js';

// ── Referencias al DOM ──
const unlockOverlay      = document.getElementById('unlockOverlay');
const vaultWrapper       = document.getElementById('vaultWrapper');
const unlockInput        = document.getElementById('unlockInput');
const unlockError        = document.getElementById('unlockError');
const btnDesbloquear     = document.getElementById('btnDesbloquear');
const credentialList     = document.getElementById('credentialList');
const credentialCounter  = document.getElementById('credentialCounter');
const emptyState         = document.getElementById('emptyState');
const searchInput        = document.getElementById('searchInput');
const modalOverlay       = document.getElementById('modalOverlay');
const modalTitle         = document.getElementById('modalTitle');
const modalError         = document.getElementById('modalError');
const btnNuevaCredencial = document.getElementById('btnNuevaCredencial');
const btnAgregarPrimero  = document.getElementById('btnAgregarPrimero');
const btnCerrarModal     = document.getElementById('btnCerrarModal');
const btnCancelar        = document.getElementById('btnCancelar');
const btnGuardar         = document.getElementById('btnGuardar');
const strengthFill       = document.getElementById('strengthFill');
const strengthLabel      = document.getElementById('strengthLabel');

// ── Estado local ──
let credenciales       = [];
let credencialEditando = null;
let claveSesion        = null; // Clave AES en memoria — nunca va a storage

// ── Inicialización ──
async function inicializar() {
  const { sesionActiva } = await new Promise((resolve) => {
    chrome.storage.local.get(['sesionActiva'], resolve);
  });

  // Si hay sesión activa, intentar desbloquear automáticamente
  // pidiendo la contraseña con la pantalla elegante del vault
  unlockInput.focus();

  // Abrir modal si viene con ?action=new (después de desbloquear)
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'new') {
    // Se abrirá el modal después del desbloqueo
    window._abrirModalAlDesbloquear = true;
  }
}

// ── Desbloquear vault ──
async function desbloquear() {
  const password = unlockInput.value;

  if (!password) {
    mostrarErrorUnlock('Ingresa tu contraseña maestra');
    return;
  }

  btnDesbloquear.textContent = 'Verificando...';
  btnDesbloquear.disabled    = true;
  unlockError.classList.add('hidden');

  try {
    claveSesion = await desbloquearVault(password);

    if (!claveSesion) {
      mostrarErrorUnlock('Contraseña incorrecta');
      unlockInput.value = '';
      unlockInput.focus();
      return;
    }

    // Cargar credenciales descifradas
    credenciales = await cargarVaultDescifrado(claveSesion);

    // Mostrar vault
    unlockOverlay.classList.add('hidden');
    vaultWrapper.classList.remove('hidden');
    btnNuevaCredencial.classList.remove('hidden');

    renderizarLista(credenciales);

    // Abrir modal si viene con ?action=new
    if (window._abrirModalAlDesbloquear) {
      abrirModal();
      window._abrirModalAlDesbloquear = false;
    }

  } catch (error) {
    mostrarErrorUnlock('Error al desbloquear — intenta de nuevo');
  } finally {
    btnDesbloquear.textContent = 'Desbloquear Vault';
    btnDesbloquear.disabled    = false;
  }
}

function mostrarErrorUnlock(mensaje) {
  unlockError.textContent = mensaje;
  unlockError.classList.remove('hidden');
}

// ── Renderizar lista ──
function renderizarLista(lista) {
  credentialList.innerHTML = '';

  // Actualizar contador
  const total = credenciales.length;
  credentialCounter.textContent = total > 0
    ? `${lista.length} de ${total} credencial${total !== 1 ? 'es' : ''}`
    : '';

  if (lista.length === 0) {
    emptyState.classList.remove('hidden');
    credentialList.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  credentialList.classList.remove('hidden');
  lista.forEach(cred => credentialList.appendChild(crearItemCredencial(cred)));
}

function crearItemCredencial(cred) {
  const li = document.createElement('li');
  li.className  = 'credential-item';
  li.dataset.id = cred.id;

  // Fecha de modificación formateada
  const fecha = new Date(cred.modificado).toLocaleDateString('es', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  li.innerHTML = `
    <div class="credential-avatar">${obtenerIcono(cred.sitio)}</div>
    <div class="credential-info">
      <div class="credential-site">${escapeHtml(cred.sitio)}</div>
      <div class="credential-user">${escapeHtml(cred.usuario)}</div>
      <div class="credential-date">Modificado: ${fecha}</div>
    </div>
    <div class="credential-actions">
      <button class="btn-icon btn-copiar"   data-id="${cred.id}" title="Copiar contraseña">📋</button>
      <button class="btn-icon btn-editar"   data-id="${cred.id}" title="Editar">✏️</button>
      <button class="btn-icon btn-eliminar" data-id="${cred.id}" title="Eliminar">🗑️</button>
    </div>
  `;

  li.querySelector('.btn-copiar').addEventListener('click',   (e) => { e.stopPropagation(); copiarPassword(cred.id); });
  li.querySelector('.btn-editar').addEventListener('click',   (e) => { e.stopPropagation(); abrirModalEdicion(cred.id); });
  li.querySelector('.btn-eliminar').addEventListener('click', (e) => { e.stopPropagation(); eliminarCredencial(cred.id); });

  return li;
}

function obtenerIcono(sitio) {
  const n = sitio.toLowerCase();
  if (n.includes('google') || n.includes('gmail')) return '🔵';
  if (n.includes('github'))   return '⚫';
  if (n.includes('facebook')) return '🔷';
  if (n.includes('twitter') || n.includes('x.com')) return '🐦';
  if (n.includes('netflix'))  return '🔴';
  if (n.includes('amazon'))   return '📦';
  if (n.includes('banco') || n.includes('bank')) return '🏦';
  if (n.includes('linkedin')) return '💼';
  if (n.includes('microsoft') || n.includes('outlook')) return '🪟';
  if (n.includes('apple'))    return '🍎';
  return '🔐';
}

// Prevenir XSS al mostrar datos del usuario en el DOM
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── CRUD ──

// COPIAR contraseña al portapapeles
async function copiarPassword(id) {
  const cred = credenciales.find(c => c.id === id);
  if (!cred) return;

  await navigator.clipboard.writeText(cred.password);

  // Limpiar portapapeles automáticamente según configuración
  const { config } = await new Promise(r => chrome.storage.local.get(['config'], r));
  const segundos = config?.clipboard ?? 30;
  if (segundos > 0) {
    setTimeout(() => navigator.clipboard.writeText(''), segundos * 1000);
  }

  // Feedback visual
  const btn = document.querySelector(`.btn-copiar[data-id="${id}"]`);
  if (btn) {
    const textoOriginal = btn.textContent;
    btn.textContent = '✅';
    btn.title = 'Copiado!';
    setTimeout(() => {
      btn.textContent = textoOriginal;
      btn.title = 'Copiar contraseña';
    }, 2000);
  }
}

// ELIMINAR credencial
async function eliminarCredencial(id) {
  const cred = credenciales.find(c => c.id === id);
  if (!confirm(`¿Eliminar credencial de "${cred?.sitio}"?`)) return;

  credenciales = credenciales.filter(c => c.id !== id);

  // Cifrar y guardar vault actualizado
  await guardarVaultCifrado(credenciales, claveSesion);
  renderizarLista(credenciales);
}

// ── Modal ──

function abrirModal() {
  credencialEditando = null;
  modalTitle.textContent = '+ Nueva Credencial';
  modalError.classList.add('hidden');
  limpiarFormulario();
  modalOverlay.classList.remove('hidden');
  document.getElementById('inputSitio').focus();
}

function abrirModalEdicion(id) {
  const cred = credenciales.find(c => c.id === id);
  if (!cred) return;

  credencialEditando = id;
  modalTitle.textContent = `✏️ Editar — ${cred.sitio}`;
  modalError.classList.add('hidden');

  document.getElementById('inputSitio').value    = cred.sitio    || '';
  document.getElementById('inputUrl').value      = cred.url      || '';
  document.getElementById('inputUsuario').value  = cred.usuario  || '';
  document.getElementById('inputPassword').value = cred.password || '';
  document.getElementById('inputNotas').value    = cred.notas    || '';

  evaluarFortaleza(cred.password || '');
  modalOverlay.classList.remove('hidden');
}

function limpiarFormulario() {
  ['inputSitio','inputUrl','inputUsuario','inputPassword','inputNotas']
    .forEach(id => document.getElementById(id).value = '');
  strengthFill.style.width  = '0%';
  strengthLabel.textContent = '';
}

function cerrarModal() {
  modalOverlay.classList.add('hidden');
  credencialEditando = null;
  limpiarFormulario();
}

// GUARDAR credencial (crear o actualizar)
async function guardarCredencial() {
  const sitio    = document.getElementById('inputSitio').value.trim();
  const url      = document.getElementById('inputUrl').value.trim();
  const usuario  = document.getElementById('inputUsuario').value.trim();
  const password = document.getElementById('inputPassword').value;
  const notas    = document.getElementById('inputNotas').value.trim();

  // Validación
  modalError.classList.add('hidden');
  if (!sitio)    { mostrarErrorModal('El nombre del sitio es obligatorio'); return; }
  if (!usuario)  { mostrarErrorModal('El usuario o email es obligatorio');  return; }
  if (!password) { mostrarErrorModal('La contraseña es obligatoria');       return; }

  const ahora = new Date().toISOString();

  if (credencialEditando) {
    // ACTUALIZAR existente
    const idx = credenciales.findIndex(c => c.id === credencialEditando);
    if (idx !== -1) {
      credenciales[idx] = {
        ...credenciales[idx],
        sitio, url, usuario, password, notas,
        modificado: ahora,
      };
    }
  } else {
    // CREAR nueva
    credenciales.push({
      id:         crypto.randomUUID(),
      sitio, url, usuario, password, notas,
      creado:     ahora,
      modificado: ahora,
    });
  }

  // Deshabilitar botón durante el cifrado
  btnGuardar.textContent = 'Guardando...';
  btnGuardar.disabled    = true;

  try {
    // Cifrar y guardar con AES-256-GCM
    await guardarVaultCifrado(credenciales, claveSesion);
    cerrarModal();
    renderizarLista(credenciales);
  } catch (error) {
    mostrarErrorModal('Error al guardar — intenta de nuevo');
  } finally {
    btnGuardar.textContent = 'Guardar';
    btnGuardar.disabled    = false;
  }
}

function mostrarErrorModal(mensaje) {
  modalError.textContent = mensaje;
  modalError.classList.remove('hidden');
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
}

// ── Event Listeners ──

// Desbloqueo
btnDesbloquear.addEventListener('click', desbloquear);
unlockInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') desbloquear();
});
document.getElementById('btnToggleUnlock').addEventListener('click', () => {
  unlockInput.type = unlockInput.type === 'password' ? 'text' : 'password';
});

// Modal
btnNuevaCredencial.addEventListener('click', abrirModal);
btnAgregarPrimero.addEventListener('click',  abrirModal);
btnCerrarModal.addEventListener('click',     cerrarModal);
btnCancelar.addEventListener('click',        cerrarModal);
btnGuardar.addEventListener('click',         guardarCredencial);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) cerrarModal();
});

// Cerrar modal con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
    cerrarModal();
  }
});

// Mostrar/ocultar contraseña
document.getElementById('btnTogglePass').addEventListener('click', () => {
  const input = document.getElementById('inputPassword');
  input.type  = input.type === 'password' ? 'text' : 'password';
});

// Generar contraseña segura
document.getElementById('btnGenerarPass').addEventListener('click', () => {
  const chars    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array    = new Uint8Array(16);
  crypto.getRandomValues(array);
  const password = Array.from(array).map(b => chars[b % chars.length]).join('');
  document.getElementById('inputPassword').value = password;
  document.getElementById('inputPassword').type  = 'text';
  evaluarFortaleza(password);
});

// Evaluar fortaleza al escribir
document.getElementById('inputPassword').addEventListener('input', (e) => {
  evaluarFortaleza(e.target.value);
});

// Búsqueda en tiempo real
searchInput.addEventListener('input', (e) => {
  const termino   = e.target.value.toLowerCase();
  const filtradas = credenciales.filter(c =>
    c.sitio.toLowerCase().includes(termino)   ||
    c.usuario.toLowerCase().includes(termino) ||
    (c.url && c.url.toLowerCase().includes(termino))
  );
  renderizarLista(filtradas);
});

// ── Arrancar ──
inicializar();
