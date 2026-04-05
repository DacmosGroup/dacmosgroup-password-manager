// ============================================
// DacmosGroup Password Manager — Vault Logic
// Conectado al motor de cifrado AES-256-GCM
// ============================================

import { desbloquearVault, guardarVaultCifrado, cargarVaultDescifrado } from '../../crypto/engine.js';

// ── Referencias al DOM ──
const credentialList     = document.getElementById('credentialList');
const emptyState         = document.getElementById('emptyState');
const searchInput        = document.getElementById('searchInput');
const modalOverlay       = document.getElementById('modalOverlay');
const modalTitle         = document.getElementById('modalTitle');
const btnNuevaCredencial = document.getElementById('btnNuevaCredencial');
const btnAgregarPrimero  = document.getElementById('btnAgregarPrimero');
const btnCerrarModal     = document.getElementById('btnCerrarModal');
const btnCancelar        = document.getElementById('btnCancelar');
const btnGuardar         = document.getElementById('btnGuardar');
const btnTogglePass      = document.getElementById('btnTogglePass');
const btnGenerarPass     = document.getElementById('btnGenerarPass');
const strengthFill       = document.getElementById('strengthFill');
const strengthLabel      = document.getElementById('strengthLabel');

// ── Estado local ──
let credenciales       = [];
let credencialEditando = null;
let claveSesion        = null; // Clave AES en memoria — nunca va a storage

// ── Inicialización ──
async function inicializar() {
  // Verificar sesión activa
  const { sesionActiva } = await new Promise((resolve) => {
    chrome.storage.local.get(['sesionActiva'], resolve);
  });

  if (!sesionActiva) {
    // Sin sesión activa — redirigir al popup
    alert('Sesión expirada. Por favor desbloquea el vault.');
    window.close();
    return;
  }

  // Pedir password para obtener clave en memoria
  // DECISIÓN DE SEGURIDAD: La clave AES nunca se guarda en storage.
  // Vive solo en memoria RAM durante la sesión activa.
  const password = prompt('Ingresa tu contraseña maestra para acceder al vault:');
  if (!password) {
    window.close();
    return;
  }

  claveSesion = await desbloquearVault(password);

  if (!claveSesion) {
    alert('Contraseña incorrecta');
    window.close();
    return;
  }

  // Cargar credenciales descifradas
  credenciales = await cargarVaultDescifrado(claveSesion);
  renderizarLista(credenciales);

  // Abrir modal si viene con ?action=new
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'new') abrirModal();
}

// ── Renderizar lista ──
function renderizarLista(lista) {
  credentialList.innerHTML = '';

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

  li.innerHTML = `
    <div class="credential-avatar">${obtenerIcono(cred.sitio)}</div>
    <div class="credential-info">
      <div class="credential-site">${cred.sitio}</div>
      <div class="credential-user">${cred.usuario}</div>
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
  return '🔐';
}

// ── CRUD ──

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

  const btn = document.querySelector(`.btn-copiar[data-id="${id}"]`);
  if (btn) {
    btn.textContent = '✅';
    setTimeout(() => btn.textContent = '📋', 2000);
  }
}

async function eliminarCredencial(id) {
  if (!confirm('¿Eliminar esta credencial?')) return;
  credenciales = credenciales.filter(c => c.id !== id);
  await guardarVaultCifrado(credenciales, claveSesion);
  renderizarLista(credenciales);
}

// ── Modal ──

function abrirModal() {
  credencialEditando = null;
  modalTitle.textContent = 'Nueva Credencial';
  limpiarFormulario();
  modalOverlay.classList.remove('hidden');
  document.getElementById('inputSitio').focus();
}

function abrirModalEdicion(id) {
  const cred = credenciales.find(c => c.id === id);
  if (!cred) return;

  credencialEditando = id;
  modalTitle.textContent = 'Editar Credencial';
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
  strengthFill.style.width = '0%';
  strengthLabel.textContent = '';
}

function cerrarModal() {
  modalOverlay.classList.add('hidden');
  credencialEditando = null;
  limpiarFormulario();
}

// ── Guardar credencial cifrada ──
async function guardarCredencial() {
  const sitio    = document.getElementById('inputSitio').value.trim();
  const usuario  = document.getElementById('inputUsuario').value.trim();
  const password = document.getElementById('inputPassword').value;

  if (!sitio || !usuario || !password) {
    alert('Sitio, usuario y contraseña son obligatorios');
    return;
  }

  if (credencialEditando) {
    const idx = credenciales.findIndex(c => c.id === credencialEditando);
    if (idx !== -1) {
      credenciales[idx] = {
        ...credenciales[idx],
        sitio,
        url:       document.getElementById('inputUrl').value.trim(),
        usuario,
        password,
        notas:     document.getElementById('inputNotas').value.trim(),
        modificado: new Date().toISOString(),
      };
    }
  } else {
    credenciales.push({
      id:         crypto.randomUUID(),
      sitio,
      url:        document.getElementById('inputUrl').value.trim(),
      usuario,
      password,
      notas:      document.getElementById('inputNotas').value.trim(),
      creado:     new Date().toISOString(),
      modificado: new Date().toISOString(),
    });
  }

  // Cifrar y guardar con AES-256-GCM
  await guardarVaultCifrado(credenciales, claveSesion);
  cerrarModal();
  renderizarLista(credenciales);
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
btnNuevaCredencial.addEventListener('click', abrirModal);
btnAgregarPrimero.addEventListener('click',  abrirModal);
btnCerrarModal.addEventListener('click',     cerrarModal);
btnCancelar.addEventListener('click',        cerrarModal);
btnGuardar.addEventListener('click',         guardarCredencial);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) cerrarModal();
});

btnTogglePass.addEventListener('click', () => {
  const input = document.getElementById('inputPassword');
  input.type  = input.type === 'password' ? 'text' : 'password';
});

btnGenerarPass.addEventListener('click', () => {
  const chars    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array    = new Uint8Array(16);
  crypto.getRandomValues(array);
  const password = Array.from(array).map(b => chars[b % chars.length]).join('');
  document.getElementById('inputPassword').value = password;
  evaluarFortaleza(password);
});

document.getElementById('inputPassword').addEventListener('input', (e) => {
  evaluarFortaleza(e.target.value);
});

searchInput.addEventListener('input', (e) => {
  const termino  = e.target.value.toLowerCase();
  const filtradas = credenciales.filter(c =>
    c.sitio.toLowerCase().includes(termino) ||
    c.usuario.toLowerCase().includes(termino)
  );
  renderizarLista(filtradas);
});

// ── Arrancar ──
inicializar();
