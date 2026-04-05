// ============================================
// DacmosGroup Password Manager — Vault Logic
// Gestión visual de credenciales (CRUD UI)
// ============================================

// ── Referencias al DOM ──
const credentialList    = document.getElementById('credentialList');
const emptyState        = document.getElementById('emptyState');
const searchInput       = document.getElementById('searchInput');
const modalOverlay      = document.getElementById('modalOverlay');
const modalTitle        = document.getElementById('modalTitle');
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
let credenciales = [];       // Lista completa de credenciales
let credencialEditando = null; // ID de la credencial en edición (null = nueva)

// ── Inicialización ──
async function inicializar() {
  await cargarCredenciales();
  renderizarLista(credenciales);

  // Si viene con ?action=new en la URL, abrir modal directamente
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'new') abrirModal();
}

// ── Cargar credenciales desde storage ──
// NOTA: En E1.3 estas credenciales vendrán cifradas con AES-256-GCM
async function cargarCredenciales() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['credenciales'], (result) => {
      credenciales = result.credenciales || [];
      resolve();
    });
  });
}

// ── Renderizar lista de credenciales ──
function renderizarLista(lista) {
  credentialList.innerHTML = '';

  if (lista.length === 0) {
    emptyState.classList.remove('hidden');
    credentialList.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  credentialList.classList.remove('hidden');

  lista.forEach(cred => {
    const item = crearItemCredencial(cred);
    credentialList.appendChild(item);
  });
}

// Crea el elemento HTML de una credencial
function crearItemCredencial(cred) {
  const li = document.createElement('li');
  li.className = 'credential-item';
  li.dataset.id = cred.id;

  // Ícono basado en el nombre del sitio
  const icono = obtenerIcono(cred.sitio);

  li.innerHTML = `
    <div class="credential-avatar">${icono}</div>
    <div class="credential-info">
      <div class="credential-site">${cred.sitio}</div>
      <div class="credential-user">${cred.usuario}</div>
    </div>
    <div class="credential-actions">
      <button class="btn-icon btn-copiar" data-id="${cred.id}" title="Copiar contraseña">📋</button>
      <button class="btn-icon btn-editar" data-id="${cred.id}" title="Editar">✏️</button>
      <button class="btn-icon btn-danger btn-eliminar" data-id="${cred.id}" title="Eliminar">🗑️</button>
    </div>
  `;

  // Eventos de los botones de acción
  li.querySelector('.btn-copiar').addEventListener('click', (e) => {
    e.stopPropagation();
    copiarPassword(cred.id);
  });

  li.querySelector('.btn-editar').addEventListener('click', (e) => {
    e.stopPropagation();
    abrirModalEdicion(cred.id);
  });

  li.querySelector('.btn-eliminar').addEventListener('click', (e) => {
    e.stopPropagation();
    eliminarCredencial(cred.id);
  });

  return li;
}

// Asigna un ícono según el nombre del sitio
function obtenerIcono(sitio) {
  const nombre = sitio.toLowerCase();
  if (nombre.includes('google') || nombre.includes('gmail')) return '🔵';
  if (nombre.includes('github'))   return '⚫';
  if (nombre.includes('facebook')) return '🔷';
  if (nombre.includes('twitter') || nombre.includes('x.com')) return '🐦';
  if (nombre.includes('netflix'))  return '🔴';
  if (nombre.includes('amazon'))   return '📦';
  if (nombre.includes('bank') || nombre.includes('banco')) return '🏦';
  return '🔐'; // ícono genérico
}

// ── Operaciones CRUD ──

// Copiar contraseña al portapapeles
async function copiarPassword(id) {
  const cred = credenciales.find(c => c.id === id);
  if (!cred) return;

  // NOTA DE SEGURIDAD: En E1.3 la contraseña vendrá descifrada en memoria
  await navigator.clipboard.writeText(cred.password);

  // Feedback visual temporal
  const btn = document.querySelector(`.btn-copiar[data-id="${id}"]`);
  if (btn) {
    btn.textContent = '✅';
    setTimeout(() => btn.textContent = '📋', 2000);
  }
}

// Eliminar credencial con confirmación
async function eliminarCredencial(id) {
  if (!confirm('¿Eliminar esta credencial?')) return;

  credenciales = credenciales.filter(c => c.id !== id);
  await guardarEnStorage();
  renderizarLista(credenciales);
}

// ── Modal: Abrir para nueva credencial ──
function abrirModal() {
  credencialEditando = null;
  modalTitle.textContent = 'Nueva Credencial';
  limpiarFormulario();
  modalOverlay.classList.remove('hidden');
  document.getElementById('inputSitio').focus();
}

// ── Modal: Abrir para editar ──
function abrirModalEdicion(id) {
  const cred = credenciales.find(c => c.id === id);
  if (!cred) return;

  credencialEditando = id;
  modalTitle.textContent = 'Editar Credencial';

  document.getElementById('inputSitio').value   = cred.sitio    || '';
  document.getElementById('inputUrl').value     = cred.url      || '';
  document.getElementById('inputUsuario').value = cred.usuario  || '';
  document.getElementById('inputPassword').value = cred.password || '';
  document.getElementById('inputNotas').value   = cred.notas    || '';

  evaluarFortaleza(cred.password || '');
  modalOverlay.classList.remove('hidden');
}

// Limpia el formulario del modal
function limpiarFormulario() {
  ['inputSitio','inputUrl','inputUsuario','inputPassword','inputNotas']
    .forEach(id => document.getElementById(id).value = '');
  strengthFill.style.width = '0%';
  strengthLabel.textContent = '';
}

// ── Guardar credencial ──
async function guardarCredencial() {
  const sitio    = document.getElementById('inputSitio').value.trim();
  const usuario  = document.getElementById('inputUsuario').value.trim();
  const password = document.getElementById('inputPassword').value;

  // Validación básica
  if (!sitio || !usuario || !password) {
    alert('Sitio, usuario y contraseña son obligatorios');
    return;
  }

  if (credencialEditando) {
    // Editar existente
    const idx = credenciales.findIndex(c => c.id === credencialEditando);
    if (idx !== -1) {
      credenciales[idx] = {
        ...credenciales[idx],
        sitio,
        url:      document.getElementById('inputUrl').value.trim(),
        usuario,
        password,
        notas:    document.getElementById('inputNotas').value.trim(),
        modificado: new Date().toISOString(),
      };
    }
  } else {
    // Nueva credencial
    const nueva = {
      id:        crypto.randomUUID(),
      sitio,
      url:       document.getElementById('inputUrl').value.trim(),
      usuario,
      password,
      notas:     document.getElementById('inputNotas').value.trim(),
      creado:    new Date().toISOString(),
      modificado: new Date().toISOString(),
    };
    credenciales.push(nueva);
  }

  await guardarEnStorage();
  cerrarModal();
  renderizarLista(credenciales);
}

// Guarda el array de credenciales en chrome.storage
// NOTA DE SEGURIDAD: En E1.3 se cifrarán con AES-256-GCM antes de guardar
async function guardarEnStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ credenciales }, resolve);
  });
}

// Cierra el modal
function cerrarModal() {
  modalOverlay.classList.add('hidden');
  credencialEditando = null;
  limpiarFormulario();
}

// ── Evaluador de fortaleza de contraseña ──
function evaluarFortaleza(password) {
  let puntos = 0;
  if (password.length >= 8)  puntos++;
  if (password.length >= 12) puntos++;
  if (/[A-Z]/.test(password)) puntos++;
  if (/[0-9]/.test(password)) puntos++;
  if (/[^A-Za-z0-9]/.test(password)) puntos++;

  const niveles = [
    { label: '',          color: 'transparent', ancho: '0%'   },
    { label: 'Muy débil', color: '#e74c3c',      ancho: '20%'  },
    { label: 'Débil',     color: '#e67e22',      ancho: '40%'  },
    { label: 'Regular',   color: '#f39c12',      ancho: '60%'  },
    { label: 'Fuerte',    color: '#2ecc71',      ancho: '80%'  },
    { label: 'Muy fuerte',color: '#00d4ff',      ancho: '100%' },
  ];

  const nivel = niveles[puntos] || niveles[0];
  strengthFill.style.width           = nivel.ancho;
  strengthFill.style.backgroundColor = nivel.color;
  strengthLabel.textContent          = nivel.label;
  strengthLabel.style.color          = nivel.color;
}

// ── Event Listeners ──

btnNuevaCredencial.addEventListener('click', abrirModal);
btnAgregarPrimero.addEventListener('click', abrirModal);
btnCerrarModal.addEventListener('click', cerrarModal);
btnCancelar.addEventListener('click', cerrarModal);
btnGuardar.addEventListener('click', guardarCredencial);

// Cerrar modal al hacer clic fuera
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) cerrarModal();
});

// Mostrar/ocultar contraseña en el formulario
btnTogglePass.addEventListener('click', () => {
  const input = document.getElementById('inputPassword');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// Generar contraseña segura (placeholder — E1.6 lo implementa completo)
btnGenerarPass.addEventListener('click', () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const password = Array.from(array)
    .map(b => chars[b % chars.length])
    .join('');
  document.getElementById('inputPassword').value = password;
  evaluarFortaleza(password);
});

// Evaluar fortaleza al escribir
document.getElementById('inputPassword').addEventListener('input', (e) => {
  evaluarFortaleza(e.target.value);
});

// Búsqueda en tiempo real
searchInput.addEventListener('input', (e) => {
  const termino = e.target.value.toLowerCase();
  const filtradas = credenciales.filter(c =>
    c.sitio.toLowerCase().includes(termino) ||
    c.usuario.toLowerCase().includes(termino)
  );
  renderizarLista(filtradas);
});

// ── Arrancar ──
inicializar();
