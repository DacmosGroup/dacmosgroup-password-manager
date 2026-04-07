// ================================================
// DacmosGroup Password Manager — Content Script
// E1.7: Autodetección de campos de login
// Se inyecta en todas las páginas web
// ================================================

// ── Constantes de detección ──
// Heurísticas basadas en atributos comunes de campos de login
const SELECTORES_USUARIO = [
  'input[type="email"]',
  'input[type="text"][name*="user"]',
  'input[type="text"][name*="email"]',
  'input[type="text"][name*="login"]',
  'input[type="text"][id*="user"]',
  'input[type="text"][id*="email"]',
  'input[type="text"][id*="login"]',
  'input[autocomplete="username"]',
  'input[autocomplete="email"]',
];

const SELECTORES_PASSWORD = [
  'input[type="password"]',
];

// Palabras clave que confirman que es un formulario de login
const PALABRAS_LOGIN = [
  'login', 'signin', 'sign-in', 'log-in',
  'iniciar', 'acceder', 'entrar', 'ingresar',
  'auth', 'authenticate',
];

// ── Estado del content script ──
let camposDetectados = {
  usuario:   null,
  password:  null,
  formulario: null,
};

let iconosInyectados = [];

// ── Función principal de detección ──
function detectarCamposLogin() {
  // Buscar todos los campos de contraseña — son el indicador más confiable
  const camposPassword = document.querySelectorAll(SELECTORES_PASSWORD.join(','));

  if (camposPassword.length === 0) return; // No hay campos de contraseña

  // Para cada campo de contraseña encontrado
  camposPassword.forEach(campoPass => {
    // Buscar el formulario padre
    const form = campoPass.closest('form');

    // Buscar campo de usuario asociado
    const campoUsuario = encontrarCampoUsuario(form, campoPass);

    // Verificar que parece un formulario de login
    if (!esFormularioLogin(form, campoPass)) return;

    // Registrar campos detectados
    camposDetectados = {
      usuario:    campoUsuario,
      password:   campoPass,
      formulario: form,
    };

    // Inyectar íconos en los campos detectados
    if (campoUsuario) inyectarIcono(campoUsuario, 'usuario');
    inyectarIcono(campoPass, 'password');

    // Notificar al service worker que encontramos un formulario de login
    notificarDeteccion();
  });
}

// ── Encontrar campo de usuario cercano al campo de contraseña ──
function encontrarCampoUsuario(form, campoPassword) {
  // Primero buscar dentro del formulario
  if (form) {
    for (const selector of SELECTORES_USUARIO) {
      const campo = form.querySelector(selector);
      if (campo && campo !== campoPassword) return campo;
    }
  }

  // Si no hay formulario, buscar en el DOM cercano
  for (const selector of SELECTORES_USUARIO) {
    const campos = document.querySelectorAll(selector);
    for (const campo of campos) {
      if (campo !== campoPassword) return campo;
    }
  }

  return null;
}

// ── Verificar si es un formulario de login ──
function esFormularioLogin(form, campoPassword) {
  // Siempre true si hay un campo de contraseña — es el indicador más fuerte
  if (!form) return true;

  const textoForm = (
    form.innerHTML +
    form.getAttribute('action') +
    form.getAttribute('id') +
    form.getAttribute('class')
  ).toLowerCase();

  // Si el formulario menciona palabras de login, es muy probable
  const tieneKeyword = PALABRAS_LOGIN.some(kw => textoForm.includes(kw));

  // Si tiene exactamente un campo de contraseña, es login (no registro)
  const numPasswords = form.querySelectorAll('input[type="password"]').length;

  return tieneKeyword || numPasswords === 1;
}

// ── Inyectar ícono 🔐 junto al campo ──
function inyectarIcono(campo, tipo) {
  // Evitar duplicados
  if (campo.dataset.dacmosIcono) return;
  campo.dataset.dacmosIcono = 'true';

  // Asegurar que el padre tenga posición relativa
  const padre = campo.parentElement;
  if (!padre) return;

  const estiloActual = window.getComputedStyle(padre).position;
  if (estiloActual === 'static') {
    padre.style.position = 'relative';
  }

  // Crear el ícono
  const icono = document.createElement('button');
  icono.className    = 'dacmos-autofill-icon';
  icono.textContent  = '🔐';
  icono.title        = 'DacmosGroup — Autocompletar';
  icono.type         = 'button'; // Evitar submit del formulario
  icono.dataset.tipo = tipo;

  // Estilos del ícono — inline para no depender de CSS externo
  Object.assign(icono.style, {
    position:      'absolute',
    right:         '8px',
    top:           '50%',
    transform:     'translateY(-50%)',
    background:    'transparent',
    border:        'none',
    cursor:        'pointer',
    fontSize:      '16px',
    zIndex:        '999999',
    padding:       '2px',
    lineHeight:    '1',
    opacity:       '0.7',
    transition:    'opacity 0.2s',
  });

  icono.addEventListener('mouseenter', () => icono.style.opacity = '1');
  icono.addEventListener('mouseleave', () => icono.style.opacity = '0.7');

  // Al hacer clic en el ícono — trigger autocompletado (E1.8)
  icono.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    solicitarAutocompletado();
  });

  padre.appendChild(icono);
  iconosInyectados.push(icono);

  // Agregar padding al campo para que el texto no quede debajo del ícono
  const paddingActual = parseInt(window.getComputedStyle(campo).paddingRight) || 0;
  campo.style.paddingRight = Math.max(paddingActual, 32) + 'px';
}

// ── Notificar detección al service worker ──
function notificarDeteccion() {
  try {
    chrome.runtime.sendMessage({
      tipo:    'CAMPOS_LOGIN_DETECTADOS',
      dominio: window.location.hostname,
      url:     window.location.href,
    });
  } catch (error) {
    // La extensión puede estar deshabilitada — ignorar silenciosamente
  }
}

// ── Solicitar autocompletado ──
function solicitarAutocompletado() {
  try {
    chrome.runtime.sendMessage({
      tipo:    'SOLICITAR_AUTOCOMPLETADO',
      dominio: window.location.hostname,
      url:     window.location.href,
    }, (respuesta) => {
      if (respuesta?.credenciales?.length > 0) {
        // E1.8 manejará la selección y el llenado
        mostrarSelectorCredenciales(respuesta.credenciales);
      } else {
        mostrarMensajeSinCredenciales();
      }
    });
  } catch (error) {
    console.log('DacmosGroup: extensión no disponible');
  }
}

// ── Mostrar selector de credenciales (preview — E1.8 lo expande) ──
function mostrarSelectorCredenciales(credenciales) {
  eliminarSelectorExistente();

  const selector = document.createElement('div');
  selector.id        = 'dacmos-credential-selector';
  selector.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #16213e;
      border: 1px solid #2a3a5c;
      border-radius: 8px;
      padding: 16px;
      z-index: 2147483647;
      min-width: 280px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: 'Segoe UI', system-ui, sans-serif;
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="color:#00d4ff; font-weight:700; font-size:14px;">🔐 DacmosGroup — Autocompletar</span>
        <button id="dacmos-cerrar-selector" style="background:transparent; border:none; color:#8892a4; cursor:pointer; font-size:18px;">✕</button>
      </div>
      <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px;">
        ${credenciales.map((c, i) => `
          <li>
            <button
              class="dacmos-cred-option"
              data-index="${i}"
              style="
                width:100%;
                background:#0f3460;
                border:1px solid #2a3a5c;
                border-radius:6px;
                padding:10px 14px;
                color:#e8e8e8;
                cursor:pointer;
                text-align:left;
                display:flex;
                flex-direction:column;
                gap:2px;
              "
            >
              <span style="font-weight:600; font-size:13px;">${c.sitio}</span>
              <span style="color:#8892a4; font-size:12px;">${c.usuario}</span>
            </button>
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  document.body.appendChild(selector);

  // Cerrar selector
  document.getElementById('dacmos-cerrar-selector').addEventListener('click', eliminarSelectorExistente);

  // Seleccionar credencial
  selector.querySelectorAll('.dacmos-cred-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.index);
      const cred = credenciales[idx];
      llenarCampos(cred);
      eliminarSelectorExistente();
    });
  });
}

// ── Mostrar mensaje sin credenciales ──
function mostrarMensajeSinCredenciales() {
  eliminarSelectorExistente();

  const msg = document.createElement('div');
  msg.id = 'dacmos-credential-selector';
  msg.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #16213e;
      border: 1px solid #2a3a5c;
      border-radius: 8px;
      padding: 14px 18px;
      z-index: 2147483647;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #8892a4;
      font-size: 13px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    ">
      🔐 No hay credenciales guardadas para este sitio
    </div>
  `;

  document.body.appendChild(msg);
  setTimeout(eliminarSelectorExistente, 3000);
}

// ── Llenar campos con credencial seleccionada ──
function llenarCampos(credencial) {
  if (camposDetectados.usuario && credencial.usuario) {
    camposDetectados.usuario.value = credencial.usuario;
    camposDetectados.usuario.dispatchEvent(new Event('input', { bubbles: true }));
    camposDetectados.usuario.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (camposDetectados.password && credencial.password) {
    camposDetectados.password.value = credencial.password;
    camposDetectados.password.dispatchEvent(new Event('input', { bubbles: true }));
    camposDetectados.password.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// ── Limpiar selector existente ──
function eliminarSelectorExistente() {
  const existing = document.getElementById('dacmos-credential-selector');
  if (existing) existing.remove();
}

// ── Escuchar mensajes del service worker ──
chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
  if (mensaje.tipo === 'VERIFICAR_CAMPOS_LOGIN') {
    const tieneLogin = camposDetectados.password !== null;
    sendResponse({ tieneLogin, dominio: window.location.hostname });
  }

  if (mensaje.tipo === 'AUTOCOMPLETAR') {
    llenarCampos(mensaje.credencial);
    sendResponse({ ok: true });
  }
});

// ── Observar cambios en el DOM ──
// Necesario para SPAs (React, Vue, Angular) donde el DOM cambia dinámicamente
const observer = new MutationObserver((mutations) => {
  const hayNuevosCampos = mutations.some(m =>
    Array.from(m.addedNodes).some(n =>
      n.nodeType === 1 && (
        n.matches?.('input[type="password"]') ||
        n.querySelector?.('input[type="password"]')
      )
    )
  );

  if (hayNuevosCampos) {
    setTimeout(detectarCamposLogin, 500);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// ── Iniciar detección ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectarCamposLogin);
} else {
  detectarCamposLogin();
}
