// ================================================
// Dacmos Password Manager — Content Script
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
  // Evitar duplicados — verificar tanto el dataset como el DOM (SPAs desmontan/remontan campos)
  if (campo.dataset.dacmosIcono) return;
  const padre = campo.parentElement;
  if (padre && padre.querySelector('.dacmos-autofill-icon')) return;
  campo.dataset.dacmosIcono = 'true';

  // Asegurar que el padre tenga posición relativa
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

// ── Escapar caracteres HTML para prevenir XSS ──
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Mostrar selector de credenciales (preview — E1.8 lo expande) ──
function mostrarSelectorCredenciales(credenciales) {
  eliminarSelectorExistente();

  const overlay = document.createElement('div');
  overlay.id = 'dacmos-credential-selector';

  Object.assign(overlay.style, {
    position:   'fixed',
    inset:      '0',
    background: 'rgba(0,0,0,0.5)',
    zIndex:     '2147483647',
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  });

  overlay.innerHTML = `
    <div style="
      background: #16213e;
      border: 1px solid #2a3a5c;
      border-radius: 10px;
      padding: 20px;
      min-width: 300px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #2a3a5c;">
        <span style="color:#00d4ff; font-weight:700; font-size:15px;">🔐 DacmosGroup</span>
        <button id="dacmos-cerrar" style="background:transparent; border:none; color:#8892a4; cursor:pointer; font-size:20px; padding:0 4px;">✕</button>
      </div>
      <p style="color:#8892a4; font-size:12px; margin-bottom:12px;">
        Selecciona una credencial para autocompletar
      </p>
      <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; max-height:240px; overflow-y:auto;">
        ${credenciales.map((c, i) => `
          <li>
            <button class="dacmos-cred-btn" data-index="${i}" style="
              width:100%; background:#0f3460;
              border:1px solid #2a3a5c; border-radius:8px;
              padding:12px 14px; color:#e8e8e8; cursor:pointer;
              text-align:left; display:flex; flex-direction:column; gap:3px;
              transition: border-color 0.2s;
            ">
              <span style="font-weight:600; font-size:13px;">${escapeHtml(c.sitio)}</span>
              <span style="color:#8892a4; font-size:12px;">${escapeHtml(c.usuario)}</span>
              ${c.url ? `<span style="color:#00d4ff; font-size:11px;">${escapeHtml(c.url)}</span>` : ''}
            </button>
          </li>
        `).join('')}
      </ul>
      <p style="color:#8892a4; font-size:11px; margin-top:12px; text-align:center;">
        Zero-Knowledge · AES-256-GCM
      </p>
    </div>
  `;

  document.body.appendChild(overlay);

  // Cerrar al hacer clic en overlay
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) eliminarSelectorExistente();
  });

  // Cerrar con botón X
  document.getElementById('dacmos-cerrar').addEventListener('click', eliminarSelectorExistente);

  // Cerrar con Escape
  const cerrarConEsc = (e) => {
    if (e.key === 'Escape') {
      eliminarSelectorExistente();
      document.removeEventListener('keydown', cerrarConEsc);
    }
  };
  document.addEventListener('keydown', cerrarConEsc);

  // Hover effect en botones
  overlay.querySelectorAll('.dacmos-cred-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#0066cc';
      btn.style.background  = '#1a3a6e';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = '#2a3a5c';
      btn.style.background  = '#0f3460';
    });

    // Seleccionar credencial
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.index);
      const cred = credenciales[idx];
      llenarCampos(cred);
      eliminarSelectorExistente();

      // Feedback visual en los campos
      mostrarFeedbackAutocompletado();
    });
  });
}

// ── Feedback visual al autocompletar ──
function mostrarFeedbackAutocompletado() {
  [camposDetectados.usuario, camposDetectados.password].forEach(campo => {
    if (!campo) return;
    const estiloOriginal = campo.style.outline;
    campo.style.outline = '2px solid #2ecc71';
    campo.style.transition = 'outline 0.3s';
    setTimeout(() => {
      campo.style.outline = estiloOriginal;
    }, 2000);
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
// Se disparan focus/blur además de input/change para compatibilidad con
// React/Vue (inputs controlados que requieren estos eventos para sincronizar estado).
function llenarCampos(credencial) {
  if (camposDetectados.usuario && credencial.usuario) {
    camposDetectados.usuario.dispatchEvent(new Event('focus', { bubbles: true }));
    camposDetectados.usuario.value = credencial.usuario;
    camposDetectados.usuario.dispatchEvent(new Event('input', { bubbles: true }));
    camposDetectados.usuario.dispatchEvent(new Event('change', { bubbles: true }));
    camposDetectados.usuario.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  if (camposDetectados.password && credencial.password) {
    camposDetectados.password.dispatchEvent(new Event('focus', { bubbles: true }));
    camposDetectados.password.value = credencial.password;
    camposDetectados.password.dispatchEvent(new Event('input', { bubbles: true }));
    camposDetectados.password.dispatchEvent(new Event('change', { bubbles: true }));
    camposDetectados.password.dispatchEvent(new Event('blur', { bubbles: true }));
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

  // Vault bloqueado — limpiar íconos y mostrar aviso
  if (mensaje.tipo === 'VAULT_BLOQUEADO') {
    iconosInyectados.forEach(icono => icono.remove());
    iconosInyectados = [];
    eliminarSelectorExistente();

    // Mostrar aviso discreto
    const aviso = document.createElement('div');
    aviso.style.cssText = `
      position: fixed; bottom: 20px; right: 20px;
      background: #16213e; border: 1px solid #e74c3c;
      border-radius: 8px; padding: 12px 16px;
      color: #e8e8e8; font-size: 13px; z-index: 2147483647;
      font-family: 'Segoe UI', system-ui, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    `;
    aviso.textContent = '🔒 DacmosGroup — Vault bloqueado por inactividad';
    document.body.appendChild(aviso);
    setTimeout(() => aviso.remove(), 4000);
    sendResponse({ ok: true });
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

// ── Notificar actividad del usuario al service worker ──
// Resetea el timer de inactividad en cada interacción
function notificarActividad() {
  try {
    chrome.runtime.sendMessage({ tipo: 'ACTIVIDAD_USUARIO' });
  } catch (_) {}
}

// Escuchar eventos de actividad del usuario
['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evento => {
  document.addEventListener(evento, notificarActividad, { passive: true });
});

// ── Iniciar detección ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectarCamposLogin);
} else {
  detectarCamposLogin();
}