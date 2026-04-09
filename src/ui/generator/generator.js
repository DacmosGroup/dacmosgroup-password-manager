// ================================================
// Dacmos Password Manager — Generator Logic
// Generador criptográfico usando Web Crypto API
// DECISIÓN DE SEGURIDAD: crypto.getRandomValues()
// genera números aleatorios criptográficamente
// seguros — nunca usar Math.random() para passwords
// ================================================

// ── Conjuntos de caracteres ──
const CHARS = {
  mayusculas: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  minusculas: 'abcdefghijklmnopqrstuvwxyz',
  numeros:    '0123456789',
  simbolos:   '!@#$%^&*()_+-=[]{}|;:,.<>?',
  ambiguos:   '0O1lI',
};

// ── Estado ──
let historial = []; // Últimas 5 contraseñas generadas
let passwordActual = '';

// ── Referencias al DOM ──
const passwordText    = document.getElementById('passwordText');
const strengthFill    = document.getElementById('strengthFill');
const strengthLabel   = document.getElementById('strengthLabel');
const entropyLabel    = document.getElementById('entropyLabel');
const longitudSlider  = document.getElementById('longitudSlider');
const longitudValue   = document.getElementById('longitudValue');
const historyList     = document.getElementById('historyList');

// ── Generador principal ──
// DECISIÓN DE SEGURIDAD: Usamos el método de rechazo (rejection sampling)
// para evitar sesgo estadístico al mapear bytes aleatorios a caracteres.
// Un simple módulo (%) introduce sesgo cuando el alfabeto no divide
// uniformemente el rango del byte (0-255).
function generarPassword() {
  const longitud      = parseInt(longitudSlider.value);
  const usaMayusculas = document.getElementById('chkMayusculas').checked;
  const usaMinusculas = document.getElementById('chkMinusculas').checked;
  const usaNumeros    = document.getElementById('chkNumeros').checked;
  const usaSimbolos   = document.getElementById('chkSimbolos').checked;
  const excluirAmb    = document.getElementById('chkExcluirAmbiguos').checked;

  // Validar que al menos un tipo esté seleccionado
  if (!usaMayusculas && !usaMinusculas && !usaNumeros && !usaSimbolos) {
    alert('Selecciona al menos un tipo de caracteres');
    return;
  }

  // Construir alfabeto
  let alfabeto = '';
  if (usaMayusculas) alfabeto += CHARS.mayusculas;
  if (usaMinusculas) alfabeto += CHARS.minusculas;
  if (usaNumeros)    alfabeto += CHARS.numeros;
  if (usaSimbolos)   alfabeto += CHARS.simbolos;

  // Excluir caracteres ambiguos si está activado
  if (excluirAmb) {
    alfabeto = alfabeto.split('').filter(c => !CHARS.ambiguos.includes(c)).join('');
  }

  // Generar contraseña con rejection sampling
  const password = generarConRejectionSampling(alfabeto, longitud);

  // Garantizar que incluye al menos un caracter de cada tipo seleccionado
  const passwordFinal = garantizarTipos(password, {
    usaMayusculas, usaMinusculas, usaNumeros, usaSimbolos, excluirAmb
  });

  passwordActual = passwordFinal;

  // Mostrar contraseña
  passwordText.textContent = passwordFinal;
  passwordText.classList.remove('placeholder');

  // Evaluar fortaleza y entropía
  const { puntos, entropia } = calcularFortaleza(passwordFinal, alfabeto.length);
  mostrarFortaleza(puntos, entropia);

  // Agregar al historial
  agregarAlHistorial(passwordFinal);
}

// Rejection sampling — elimina el sesgo estadístico
function generarConRejectionSampling(alfabeto, longitud) {
  const resultado  = [];
  const limite     = 256 - (256 % alfabeto.length); // Límite para evitar sesgo

  while (resultado.length < longitud) {
    const bytes = new Uint8Array(longitud * 2); // Generar extra por si hay rechazos
    crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (resultado.length >= longitud) break;
      if (byte < limite) { // Rechazar bytes que causarían sesgo
        resultado.push(alfabeto[byte % alfabeto.length]);
      }
    }
  }

  return resultado.join('');
}

// Garantiza que la contraseña incluya al menos un caracter de cada tipo activo
function garantizarTipos(password, opciones) {
  const { usaMayusculas, usaMinusculas, usaNumeros, usaSimbolos, excluirAmb } = opciones;
  const chars = password.split('');
  let pos = 0;

  const getChar = (conjunto) => {
    let c = conjunto;
    if (excluirAmb) c = c.split('').filter(ch => !CHARS.ambiguos.includes(ch)).join('');
    const arr = new Uint8Array(1);
    crypto.getRandomValues(arr);
    return c[arr[0] % c.length];
  };

  if (usaMayusculas && !/[A-Z]/.test(password)) chars[pos++] = getChar(CHARS.mayusculas);
  if (usaMinusculas && !/[a-z]/.test(password)) chars[pos++] = getChar(CHARS.minusculas);
  if (usaNumeros    && !/[0-9]/.test(password)) chars[pos++] = getChar(CHARS.numeros);
  if (usaSimbolos   && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    chars[pos++] = getChar(CHARS.simbolos);
  }

  // Mezclar para que los caracteres garantizados no queden siempre al inicio
  return mezclarArray(chars).join('');
}

// Fisher-Yates shuffle con crypto.getRandomValues
function mezclarArray(arr) {
  const bytes = new Uint32Array(arr.length);
  crypto.getRandomValues(bytes);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Calcular fortaleza y entropía ──
// NOTA EDUCATIVA: La entropía mide los bits de aleatoriedad.
// H = L × log2(N) donde L = longitud, N = tamaño del alfabeto
// Una contraseña de 16 chars con alfabeto de 90 chars = ~103 bits
// NIST recomienda mínimo 80 bits para contraseñas seguras.
function calcularFortaleza(password, tamanoAlfabeto) {
  const longitud  = password.length;
  const entropia  = Math.floor(longitud * Math.log2(tamanoAlfabeto));

  let puntos = 0;
  if (longitud >= 8)   puntos++;
  if (longitud >= 12)  puntos++;
  if (longitud >= 16)  puntos++;
  if (entropia >= 50)  puntos++;
  if (entropia >= 80)  puntos++;

  return { puntos: Math.min(puntos, 5), entropia };
}

function mostrarFortaleza(puntos, entropia) {
  const niveles = [
    { label: 'Muy débil',  color: '#e74c3c', ancho: '20%'  },
    { label: 'Débil',      color: '#e67e22', ancho: '30%'  },
    { label: 'Regular',    color: '#f39c12', ancho: '50%'  },
    { label: 'Fuerte',     color: '#2ecc71', ancho: '75%'  },
    { label: 'Muy fuerte', color: '#00d4ff', ancho: '90%'  },
    { label: 'Excelente',  color: '#00d4ff', ancho: '100%' },
  ];

  const nivel = niveles[puntos] || niveles[0];
  strengthFill.style.width           = nivel.ancho;
  strengthFill.style.backgroundColor = nivel.color;
  strengthLabel.textContent          = nivel.label;
  strengthLabel.style.color          = nivel.color;
  entropyLabel.textContent           = `${entropia} bits de entropía`;
}

// ── Historial ──
function agregarAlHistorial(password) {
  historial.unshift({
    password,
    hora: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  });

  // Mantener solo las últimas 5
  if (historial.length > 5) historial.pop();

  renderizarHistorial();
}

function renderizarHistorial() {
  historyList.innerHTML = '';

  if (historial.length === 0) {
    historyList.innerHTML = '<li class="history-empty">Aún no has generado contraseñas</li>';
    return;
  }

  historial.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `
      <span class="history-password">${item.password}</span>
      <span class="history-meta">${item.hora}</span>
      <button class="btn-icon btn-copiar-hist" data-idx="${idx}" title="Copiar">📋</button>
    `;
    li.querySelector('.btn-copiar-hist').addEventListener('click', () => {
      copiarPassword(item.password, li.querySelector('.btn-copiar-hist'));
    });
    historyList.appendChild(li);
  });
}

// ── Copiar al portapapeles ──
async function copiarPassword(password, btn) {
  try {
    await navigator.clipboard.writeText(password);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✅';
      setTimeout(() => btn.textContent = original, 2000);
    }
  } catch (error) {
    console.error('Error al copiar:', error);
  }
}

// ── Event Listeners ──

// Slider de longitud
longitudSlider.addEventListener('input', () => {
  longitudValue.textContent = longitudSlider.value;
  if (passwordActual) generarPassword();
});

// Botón generar
document.getElementById('btnGenerar').addEventListener('click', generarPassword);

// Botón refresh
document.getElementById('btnRefresh').addEventListener('click', generarPassword);

// Botón copiar contraseña actual
document.getElementById('btnCopiar').addEventListener('click', () => {
  if (!passwordActual) return;
  copiarPassword(passwordActual, document.getElementById('btnCopiar'));
});

// Regenerar al cambiar opciones
['chkMayusculas','chkMinusculas','chkNumeros','chkSimbolos','chkExcluirAmbiguos']
  .forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      if (passwordActual) generarPassword();
    });
  });

// Limpiar historial
document.getElementById('btnLimpiarHistorial').addEventListener('click', () => {
  historial = [];
  renderizarHistorial();
});

// ── Generar una contraseña al cargar ──
generarPassword();
